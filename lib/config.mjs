/**
 * Configuration loader — reads .env file and provides defaults.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

/**
 * Parse a .env file into an object.
 */
function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  }
  return env;
}

const envFile = parseEnvFile(path.join(PROJECT_ROOT, '.env'));

/** Resolve a config value: process.env > .env file > default */
function get(key, defaultValue = '') {
  return process.env[key] || envFile[key] || defaultValue;
}

export const config = {
  walletAddress: get('WALLET_ADDRESS'),
  heliusApiKey: get('HELIUS_API_KEY'),
  jupiterApiKey: get('JUPITER_API_KEY'),
  jupBin: get('JUP_BIN', 'jup'),
  heliusBin: get('HELIUS_BIN', 'helius'),
  dataDir: path.resolve(PROJECT_ROOT, get('DATA_DIR', './data')),
  initialDepositUsd: parseFloat(get('INITIAL_DEPOSIT_USD', '0')),
  initialDepositSol: parseFloat(get('INITIAL_DEPOSIT_SOL', '0')),
  refreshInterval: parseInt(get('REFRESH_INTERVAL', '60'), 10),
  projectRoot: PROJECT_ROOT,
};

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}
