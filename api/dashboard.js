/**
 * Vercel Serverless API — /api/dashboard
 * Fetches live portfolio, prices, perps, and network data
 * directly from Jupiter and Helius REST APIs.
 */

const WALLET = process.env.WALLET_ADDRESS || '';
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const INITIAL_DEPOSIT_USD = parseFloat(process.env.INITIAL_DEPOSIT_USD || '100.95');

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const JUP_BASE = 'https://lite-api.jup.ag';

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

/** Fetch with timeout */
async function fetchJson(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Helius RPC call */
async function rpcCall(method, params) {
  return fetchJson(HELIUS_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
}

/** Get SOL balance */
async function getSolBalance() {
  const res = await rpcCall('getBalance', [WALLET]);
  if (!res?.result?.value) return 0;
  return res.result.value / 1e9;
}

/** Get token accounts */
async function getTokenAccounts() {
  const res = await rpcCall('getTokenAccountsByOwner', [
    WALLET,
    { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
    { encoding: 'jsonParsed' },
  ]);
  if (!res?.result?.value) return [];
  return res.result.value.map(a => {
    const info = a.account.data.parsed.info;
    return {
      mint: info.mint,
      amount: parseFloat(info.tokenAmount.uiAmountString || '0'),
      decimals: info.tokenAmount.decimals,
    };
  }).filter(t => t.amount > 0);
}

/** Get token prices from Jupiter */
async function getTokenPrices() {
  const mints = Object.keys(TRACKED_MINTS).join(',');
  return fetchJson(`${JUP_BASE}/price/v3?ids=${mints}`);
}

/** Get perps market data from Jupiter */
async function getPerpsMarkets() {
  // Jupiter perps market data — use the price API for SOL/BTC/ETH
  const perpAssets = {
    'So11111111111111111111111111111111111111112': 'SOL',
  };
  // Simplified: use Jupiter price data for the main perp assets
  return fetchJson(`${JUP_BASE}/price/v3?ids=So11111111111111111111111111111111111111112`);
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  if (!WALLET) {
    return res.status(500).json({ error: 'WALLET_ADDRESS not configured' });
  }
  if (!HELIUS_API_KEY) {
    return res.status(500).json({ error: 'HELIUS_API_KEY not configured' });
  }

  try {
    // Fetch everything in parallel
    const [solBalance, tokenAccounts, prices] = await Promise.all([
      getSolBalance(),
      getTokenAccounts(),
      getTokenPrices(),
    ]);

    // Build portfolio
    const solPrice = prices?.['So11111111111111111111111111111111111111112']?.usdPrice || 0;
    const portfolio = [];

    // Add SOL
    portfolio.push({
      symbol: 'SOL',
      mint: 'So11111111111111111111111111111111111111112',
      amount: solBalance,
      price: solPrice,
      value: solBalance * solPrice,
      priceChange24h: prices?.['So11111111111111111111111111111111111111112']?.priceChange24h || 0,
    });

    // Add tokens
    for (const ta of tokenAccounts) {
      const symbol = TRACKED_MINTS[ta.mint];
      const priceData = prices?.[ta.mint];
      const price = priceData?.usdPrice || 0;
      portfolio.push({
        symbol: symbol || ta.mint.slice(0, 6),
        mint: ta.mint,
        amount: ta.amount,
        price,
        value: ta.amount * price,
        priceChange24h: priceData?.priceChange24h || 0,
      });
    }

    const totalValue = portfolio.reduce((sum, t) => sum + t.value, 0);

    // PNL
    const allTimePnl = totalValue - INITIAL_DEPOSIT_USD;
    const allTimePnlPct = INITIAL_DEPOSIT_USD > 0 ? (allTimePnl / INITIAL_DEPOSIT_USD) * 100 : 0;

    // Watchlist prices
    const watchlist = [];
    for (const [mint, symbol] of Object.entries(TRACKED_MINTS)) {
      if (symbol === 'USDC') continue;
      const p = prices?.[mint];
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
        tokens: portfolio.filter(t => t.value >= 0.01),
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
    return res.status(500).json({ error: err.message });
  }
}
