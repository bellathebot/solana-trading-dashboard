export default async function handler(req, res) {
  var WALLET = process.env.WALLET_ADDRESS || '';
  var HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
  var INITIAL_DEPOSIT_USD = parseFloat(process.env.INITIAL_DEPOSIT_USD || '0');

  var TRACKED_MINTS = {
    'So11111111111111111111111111111111111111112': 'SOL',
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
    'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN': 'JUP',
    '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
    'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm': 'WIF',
    'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL': 'JTO',
    'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3': 'PYTH'
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (!WALLET || !HELIUS_API_KEY) {
    return res.status(500).json({
      error: 'Missing env vars',
      hasWallet: Boolean(WALLET),
      hasHelius: Boolean(HELIUS_API_KEY)
    });
  }

  try {
    var heliusUrl = 'https://mainnet.helius-rpc.com/?api-key=' + HELIUS_API_KEY;

    var solBalance = 0;
    try {
      var balRes = await fetch(heliusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 1, method: 'getBalance', params: [WALLET]
        })
      });
      var balData = await balRes.json();
      solBalance = (balData.result && balData.result.value ? balData.result.value : 0) / 1e9;
    } catch (e) {
      console.error('Balance error:', e.message);
    }

    var tokenAccounts = [];
    try {
      var tokRes = await fetch(heliusUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', id: 2, method: 'getTokenAccountsByOwner',
          params: [
            WALLET,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' }
          ]
        })
      });
      var tokData = await tokRes.json();
      if (tokData.result && tokData.result.value) {
        for (var i = 0; i < tokData.result.value.length; i++) {
          var info = tokData.result.value[i].account.data.parsed.info;
          var amt = parseFloat(info.tokenAmount.uiAmountString || '0');
          if (amt > 0) {
            tokenAccounts.push({ mint: info.mint, amount: amt, decimals: info.tokenAmount.decimals });
          }
        }
      }
    } catch (e) {
      console.error('Token error:', e.message);
    }

    var prices = {};
    try {
      var mints = Object.keys(TRACKED_MINTS).join(',');
      var priceRes = await fetch('https://lite-api.jup.ag/price/v3?ids=' + mints);
      prices = await priceRes.json();
    } catch (e) {
      console.error('Price error:', e.message);
    }

    var solMint = 'So11111111111111111111111111111111111111112';
    var solPriceData = prices[solMint];
    var solPrice = solPriceData ? solPriceData.usdPrice : 0;
    var solChange = solPriceData ? (solPriceData.priceChange24h || 0) : 0;

    var portfolio = [];
    portfolio.push({
      symbol: 'SOL', mint: solMint, amount: solBalance,
      price: solPrice, value: solBalance * solPrice, priceChange24h: solChange
    });

    for (var j = 0; j < tokenAccounts.length; j++) {
      var ta = tokenAccounts[j];
      var sym = TRACKED_MINTS[ta.mint] || ta.mint.slice(0, 6);
      var pd = prices[ta.mint];
      portfolio.push({
        symbol: sym, mint: ta.mint, amount: ta.amount,
        price: pd ? pd.usdPrice : 0,
        value: ta.amount * (pd ? pd.usdPrice : 0),
        priceChange24h: pd ? (pd.priceChange24h || 0) : 0
      });
    }

    var totalValue = 0;
    for (var k = 0; k < portfolio.length; k++) totalValue += portfolio[k].value;

    var allTimePnl = totalValue - INITIAL_DEPOSIT_USD;
    var allTimePnlPct = INITIAL_DEPOSIT_USD > 0 ? (allTimePnl / INITIAL_DEPOSIT_USD) * 100 : 0;

    var watchlist = [];
    var mintKeys = Object.keys(TRACKED_MINTS);
    for (var m = 0; m < mintKeys.length; m++) {
      var wMint = mintKeys[m];
      var wSym = TRACKED_MINTS[wMint];
      if (wSym === 'USDC') continue;
      var wp = prices[wMint];
      if (!wp) continue;
      watchlist.push({
        symbol: wSym, mint: wMint, price: wp.usdPrice,
        priceChange24h: wp.priceChange24h || 0, liquidity: wp.liquidity || 0
      });
    }

    return res.status(200).json({
      ts: new Date().toISOString(),
      wallet: WALLET,
      portfolio: {
        totalValue: totalValue,
        tokens: portfolio.filter(function(t) { return t.value >= 0.01; })
      },
      pnl: {
        initialDeposit: INITIAL_DEPOSIT_USD,
        currentValue: totalValue,
        allTimePnl: allTimePnl,
        allTimePnlPct: allTimePnlPct
      },
      watchlist: watchlist
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
