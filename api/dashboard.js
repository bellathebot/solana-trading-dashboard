/**
 * Vercel Serverless API — /api/dashboard
 * Fetches live portfolio, prices, and watchlist data
 * from Jupiter and Helius REST APIs.
 *
 * Uses CommonJS for maximum Vercel compatibility.
 */

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

async function heliusRpc(method, params) {
  const url = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await res.json();
  return data.result;
}

async function getSolBalance() {
  try {
    const result = await heliusRpc('getBalance', [WALLET]);
    return (result?.value || 0) / 1e9;
  } catch (e) {
    console.error('getSolBalance error:', e.message);
    return 0;
  }
}

async function getTokenAccounts() {
  try {
    const result = await heliusRpc('getTokenAccountsByOwner', [
      WALLET,
      { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
      { encoding: 'jsonParsed' },
    ]);
    if (!result?.value) return [];
    return result.value
      .map((a) => {
        const info = a.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: parseFloat(info.tokenAmount.uiAmountString || '0'),
          decimals: info.tokenAmount.decimals,
        };
      })
      .filter((t) => t.amount > 0);
  } catch (e) {
    console.error('getTokenAccounts error:', e.message);
    return [];
  }
}

async function getTokenPrices() {
  try {
    const mints = Object.keys(TRACKED_MINTS).join(',');
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mints}`);
    return await res.json();
  } catch (e) {
    console.error('getTokenPrices error:', e.message);
    return {};
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (!WALLET) {
    return res.status(500).json({ error: 'WALLET_ADDRESS env var not set' });
  }
  if (!HELIUS_API_KEY) {
    return res.status(500).json({ error: 'HELIUS_API_KEY env var not set' });
  }

  try {
    const [solBalance, tokenAccounts, prices] = await Promise.all([
      getSolBalance(),
      getTokenAccounts(),
      getTokenPrices(),
    ]);

    const solPrice =
      prices['So11111111111111111111111111111111111111112']?.usdPrice || 0;

    // Build portfolio
    const portfolio = [];

    portfolio.push({
      symbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
      amount: solBalance,
      price: solPrice,
      value: solBalance * solPrice,
      priceChange24h:
        prices['So11111111111111111111111111111111111111112']?.priceChange24h || 0,
    });

    for (const ta of tokenAccounts) {
      const symbol = TRACKED_MINTS[ta.mint] || ta.mint.slice(0, 6);
      const priceData = prices[ta.mint];
      const price = priceData?.usdPrice || 0;
      portfolio.push({
        symbol,
        mint: ta.mint,
        amount: ta.amount,
        price,
        value: ta.amount * price,
        priceChange24h: priceData?.priceChange24h || 0,
      });
    }

    const totalValue = portfolio.reduce((sum, t) => sum + t.value, 0);

    const allTimePnl = totalValue - INITIAL_DEPOSIT_USD;
    const allTimePnlPct =
      INITIAL_DEPOSIT_USD > 0 ? (allTimePnl / INITIAL_DEPOSIT_USD) * 100 : 0;

    // Watchlist
    const watchlist = [];
    for (const [mint, symbol] of Object.entries(TRACKED_MINTS)) {
      if (symbol === 'USDC') continue;
      const p = prices[mint];
      if (!p) continue;
      watchlist.push({
        symbol,
        mint,
        price: p.usdPrice,
        priceChange24h: p.priceChange24h || 0,
        liquidity: p.liquidity || 0,
      });
    }

    return res.status(200).json({
      ts: new Date().toISOString(),
      wallet: WALLET,
      portfolio: {
        totalValue,
        tokens: portfolio.filter((t) => t.value >= 0.01),
      },
      pnl: {
        initialDeposit: INITIAL_DEPOSIT_USD,
        currentValue: totalValue,
        allTimePnl,
        allTimePnlPct,
      },
      watchlist,
    });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
