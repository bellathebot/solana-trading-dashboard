const WALLET = process.env.WALLET_ADDRESS || '';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const INITIAL_DEPOSIT_USD = parseFloat(process.env.INITIAL_DEPOSIT_USD || '0');

const TRACKED_MINTS = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
  'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
  'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 'JTO',
  'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH',
};

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (!WALLET || !HELIUS_API_KEY) {
    return res.status(500).json({
      error: 'Missing env vars',
      hasWallet: !!WALLET,
      hasHelius: !!HELIUS_API_KEY,
    });
  }

  try {
    // 1. Get SOL balance via Helius RPC
    let solBalance = 0;
    try {
      const balRes = await fetch(
        'https://mainnet.helius-rpc.com/?api-key=' + HELIUS_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getBalance',
            params: [WALLET],
          }),
        }
      );
      const balData = await balRes.json();
      solBalance = (balData.result?.value || 0) / 1e9;
    } catch (e) {
      console.error('Balance fetch failed:', e.message);
    }

    // 2. Get token accounts via Helius RPC
    let tokenAccounts = [];
    try {
      const tokRes = await fetch(
        'https://mainnet.helius-rpc.com/?api-key=' + HELIUS_API_KEY,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'getTokenAccountsByOwner',
            params: [
              WALLET,
              { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
              { encoding: 'jsonParsed' },
            ],
          }),
        }
      );
      const tokData = await tokRes.json();
      if (tokData.result?.value) {
        tokenAccounts = tokData.result.value
          .map(function (a) {
            var info = a.account.data.parsed.info;
            return {
              mint: info.mint,
              amount: parseFloat(info.tokenAmount.uiAmountString || '0'),
              decimals: info.tokenAmount.decimals,
            };
          })
          .filter(function (t) { return t.amount > 0; });
      }
    } catch (e) {
      console.error('Token accounts fetch failed:', e.message);
    }

    // 3. Get prices from Jupiter
    var prices = {};
    try {
      var mints = Object.keys(TRACKED_MINTS).join(',');
      var priceRes = await fetch('https://lite-api.jup.ag/price/v3?ids=' + mints);
      prices = await priceRes.json();
    } catch (e) {
      console.error('Price fetch failed:', e.message);
    }

    // 4. Build portfolio
    var solMint = 'So11111111111111111111111111111111111111112';
    var solPrice = prices[solMint] ? prices[solMint].usdPrice : 0;
    var solChange = prices[solMint] ? (prices[solMint].priceChange24h || 0) : 0;

    var portfolio = [];
    portfolio.push({
      symbol: 'SOL',
      mint: solMint,
      amount: solBalance,
      price: solPrice,
      value: solBalance * solPrice,
      priceChange24h: solChange,
    });

    for (var i = 0; i < tokenAccounts.length; i++) {
      var ta = tokenAccounts[i];
      var symbol = TRACKED_MINTS[ta.mint] || ta.mint.slice(0, 6);
      var pd = prices[ta.mint];
      var price = pd ? pd.usdPrice : 0;
      var change = pd ? (pd.priceChange24h || 0) : 0;
      portfolio.push({
        symbol: symbol,
        mint: ta.mint,
        amount: ta.amount,
        price: price,
        value: ta.amount * price,
        priceChange24h: change,
      });
    }

    var totalValue = 0;
    for (var j = 0; j < portfolio.length; j++) {
      totalValue += portfolio[j].value;
    }

    var allTimePnl = totalValue - INITIAL_DEPOSIT_USD;
    var allTimePnlPct = INITIAL_DEPOSIT_USD > 0 ? (allTimePnl / INITIAL_DEPOSIT_USD) * 100 : 0;

    // 5. Watchlist
    var watchlist = [];
    var mintKeys = Object.keys(TRACKED_MINTS);
    for (var k = 0; k < mintKeys.length; k++) {
      var mint = mintKeys[k];
      var sym = TRACKED_MINTS[mint];
      if (sym === 'USDC') continue;
      var p = prices[mint];
      if (!p) continue;
      watchlist.push({
        symbol: sym,
        mint: mint,
        price: p.usdPrice,
        priceChange24h: p.priceChange24h || 0,
        liquidity: p.liquidity || 0,
      });
    }

    return res.status(200).json({
      ts: new Date().toISOString(),
      wallet: WALLET,
      portfolio: {
        totalValue: totalValue,
        tokens: portfolio.filter(function (t) { return t.value >= 0.01; }),
      },
      pnl: {
        initialDeposit: INITIAL_DEPOSIT_USD,
        currentValue: totalValue,
        allTimePnl: allTimePnl,
        allTimePnlPct: allTimePnlPct,
      },
      watchlist: watchlist,
    });
  } catch (err) {
    console.error('Top-level handler error:', err);
    return res.status(500).json({ error: String(err.message || err) });
  }
};
