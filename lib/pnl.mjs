/**
 * PNL tracking — snapshots, historical comparison, and profit/loss calculation.
 */
import fs from 'fs';
import path from 'path';
import { config } from './config.mjs';

const SNAPSHOTS_FILE = path.join(config.dataDir, 'snapshots.json');
const TRADES_FILE = path.join(config.dataDir, 'trades.json');

// ── Snapshot persistence ─────────────────────────────────────────

function loadSnapshots() {
  try { return JSON.parse(fs.readFileSync(SNAPSHOTS_FILE, 'utf-8')); }
  catch { return []; }
}

function saveSnapshots(snapshots) {
  // Keep last 2880 entries (~2 days at 1min, ~48 days at 1hr)
  const trimmed = snapshots.slice(-2880);
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(trimmed, null, 2));
}

/**
 * Record a portfolio snapshot.
 */
export function recordSnapshot(portfolio) {
  if (!portfolio?.tokens) return null;

  const snapshot = {
    ts: new Date().toISOString(),
    totalValue: portfolio.totalValue || 0,
    tokens: portfolio.tokens.map(t => ({
      symbol: t.symbol,
      amount: t.amount,
      value: t.value,
      price: t.price,
      priceChange24h: t.priceChange || 0,
    })),
  };

  const snapshots = loadSnapshots();
  snapshots.push(snapshot);
  saveSnapshots(snapshots);
  return snapshot;
}

/**
 * Get the most recent snapshot.
 */
export function getLatestSnapshot() {
  const snapshots = loadSnapshots();
  return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
}

/**
 * Get a snapshot from N minutes ago (approximate).
 */
export function getSnapshotFromAgo(minutesAgo) {
  const snapshots = loadSnapshots();
  if (snapshots.length === 0) return null;

  const targetTime = Date.now() - (minutesAgo * 60 * 1000);
  let closest = snapshots[0];
  let closestDiff = Math.abs(new Date(closest.ts).getTime() - targetTime);

  for (const s of snapshots) {
    const diff = Math.abs(new Date(s.ts).getTime() - targetTime);
    if (diff < closestDiff) {
      closest = s;
      closestDiff = diff;
    }
  }
  return closest;
}

/**
 * Calculate PNL statistics.
 */
export function calculatePnl(currentPortfolio) {
  if (!currentPortfolio?.totalValue) return null;

  const snapshots = loadSnapshots();
  const currentValue = currentPortfolio.totalValue;

  // All-time PNL (vs initial deposit)
  const initialValue = config.initialDepositUsd;
  const allTimePnl = currentValue - initialValue;
  const allTimePnlPct = initialValue > 0 ? (allTimePnl / initialValue) * 100 : 0;

  // Hourly PNL
  const hourAgo = getSnapshotFromAgo(60);
  const hourlyPnl = hourAgo ? currentValue - hourAgo.totalValue : null;
  const hourlyPnlPct = hourAgo && hourAgo.totalValue > 0
    ? ((currentValue - hourAgo.totalValue) / hourAgo.totalValue) * 100 : null;

  // Daily PNL (24h)
  const dayAgo = getSnapshotFromAgo(1440);
  const dailyPnl = dayAgo ? currentValue - dayAgo.totalValue : null;
  const dailyPnlPct = dayAgo && dayAgo.totalValue > 0
    ? ((currentValue - dayAgo.totalValue) / dayAgo.totalValue) * 100 : null;

  // Session high/low
  let sessionHigh = currentValue;
  let sessionLow = currentValue;
  for (const s of snapshots) {
    if (s.totalValue > sessionHigh) sessionHigh = s.totalValue;
    if (s.totalValue < sessionLow) sessionLow = s.totalValue;
  }

  return {
    currentValue,
    initialValue,
    allTimePnl,
    allTimePnlPct,
    hourlyPnl,
    hourlyPnlPct,
    dailyPnl,
    dailyPnlPct,
    sessionHigh,
    sessionLow,
    snapshotCount: snapshots.length,
  };
}

// ── Trade log ────────────────────────────────────────────────────

function loadTrades() {
  try { return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf-8')); }
  catch { return []; }
}

function saveTrades(trades) {
  fs.writeFileSync(TRADES_FILE, JSON.stringify(trades, null, 2));
}

/**
 * Log a trade.
 */
export function logTrade(trade) {
  const trades = loadTrades();
  trades.push({
    ts: new Date().toISOString(),
    ...trade,
  });
  saveTrades(trades);
}

/**
 * Get all trades.
 */
export function getTrades() {
  return loadTrades();
}

/**
 * Get trade summary statistics.
 */
export function getTradeSummary() {
  const trades = loadTrades();
  const wins = trades.filter(t => (t.pnlUsd || 0) > 0);
  const losses = trades.filter(t => (t.pnlUsd || 0) < 0);
  const totalPnl = trades.reduce((sum, t) => sum + (t.pnlUsd || 0), 0);
  const totalFees = trades.reduce((sum, t) => sum + (t.feeUsd || 0), 0);

  return {
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    totalPnl,
    totalFees,
    netPnl: totalPnl - totalFees,
    avgPnl: trades.length > 0 ? totalPnl / trades.length : 0,
    bestTrade: trades.reduce((best, t) => (t.pnlUsd || 0) > (best?.pnlUsd || 0) ? t : best, null),
    worstTrade: trades.reduce((worst, t) => (t.pnlUsd || 0) < (worst?.pnlUsd || 0) ? t : worst, null),
  };
}
