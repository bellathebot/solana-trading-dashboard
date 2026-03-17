/**
 * Data collection layer — fetches portfolio, prices, perps, and history
 * from Jupiter CLI and Helius CLI.
 */
import { execSync } from 'child_process';
import { config } from './config.mjs';

const PATH_ENV = `PATH=${config.jupBin.replace(/\/[^/]+$/, '')}:${config.heliusBin.replace(/\/[^/]+$/, '')}:${process.env.PATH}`;

/**
 * Execute a CLI command and parse JSON output.
 * Returns null on failure instead of throwing.
 */
function execJson(command) {
  try {
    const raw = execSync(command, {
      encoding: 'utf-8',
      timeout: 30000,
      env: { ...process.env, PATH: `${config.jupBin.replace(/\/[^/]+$/, '')}:${config.heliusBin.replace(/\/[^/]+$/, '')}:${process.env.PATH}` },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return JSON.parse(raw.trim());
  } catch (err) {
    const stderr = err.stderr?.toString() || '';
    const stdout = err.stdout?.toString() || '';
    // Try parsing stdout even on non-zero exit
    try { return JSON.parse(stdout.trim()); } catch {}
    return null;
  }
}

/**
 * Get spot portfolio from Jupiter CLI.
 */
export function getPortfolio() {
  return execJson(`${config.jupBin} spot portfolio -f json`);
}

/**
 * Get spot portfolio for any address (no key needed).
 */
export function getPortfolioForAddress(address) {
  return execJson(`${config.jupBin} spot portfolio --address ${address} -f json`);
}

/**
 * Get a swap quote.
 */
export function getQuote(from, to, amount) {
  return execJson(`${config.jupBin} spot quote --from ${from} --to ${to} --amount ${amount} -f json`);
}

/**
 * Get perps market data.
 */
export function getPerpsMarkets() {
  return execJson(`${config.jupBin} perps markets -f json`);
}

/**
 * Get perps positions.
 */
export function getPerpsPositions() {
  return execJson(`${config.jupBin} perps positions -f json`);
}

/**
 * Get perps trade history.
 */
export function getPerpsHistory(limit = 20) {
  return execJson(`${config.jupBin} perps history --limit ${limit} -f json`);
}

/**
 * Get SOL balance from Helius CLI.
 */
export function getSolBalance(address) {
  return execJson(`${config.heliusBin} balance ${address || config.walletAddress} --json`);
}

/**
 * Get token holdings from Helius CLI.
 */
export function getTokenHoldings(address) {
  return execJson(`${config.heliusBin} tokens ${address || config.walletAddress} --json`);
}

/**
 * Get network status from Helius CLI.
 */
export function getNetworkStatus() {
  return execJson(`${config.heliusBin} network-status --json`);
}

/**
 * Get token prices from Jupiter Price API.
 */
export async function getTokenPrices(mints) {
  try {
    const ids = mints.join(',');
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${ids}`);
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Collect all dashboard data in parallel where possible.
 */
export async function collectAll() {
  const ts = new Date().toISOString();

  // These are sync CLI calls — run them sequentially
  const portfolio = getPortfolio();
  const perpsMarkets = getPerpsMarkets();
  const perpsPositions = getPerpsPositions();
  const networkStatus = getNetworkStatus();

  return {
    ts,
    portfolio,
    perpsMarkets,
    perpsPositions,
    networkStatus,
  };
}
