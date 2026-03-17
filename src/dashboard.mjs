#!/usr/bin/env node
/**
 * Solana Trading Dashboard
 *
 * Terminal dashboard for monitoring trading activity and PNL
 * using Jupiter CLI and Helius CLI.
 *
 * Usage:
 *   node src/dashboard.mjs              # full dashboard (single run)
 *   node src/dashboard.mjs --watch      # auto-refresh mode
 *   node src/dashboard.mjs --snapshot   # record snapshot only (for cron)
 *   node src/dashboard.mjs --pnl        # PNL report only
 *   node src/dashboard.mjs --history    # trade history only
 *   node src/dashboard.mjs --json       # full data as JSON
 */

import { config } from '../lib/config.mjs';
import { collectAll } from '../lib/data.mjs';
import { recordSnapshot, calculatePnl, getTrades, getTradeSummary } from '../lib/pnl.mjs';
import { renderDashboard, renderPnl, renderHistory } from '../lib/render.mjs';

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const SNAPSHOT_ONLY = args.includes('--snapshot');
const PNL_ONLY = args.includes('--pnl');
const HISTORY_ONLY = args.includes('--history');
const JSON_OUTPUT = args.includes('--json');

/**
 * Run one dashboard cycle.
 */
async function run() {
  // Validate config
  if (!config.walletAddress) {
    console.error('Error: WALLET_ADDRESS not set. Copy .env.example to .env and configure it.');
    process.exit(1);
  }

  // Collect data
  const data = await collectAll();

  // Record snapshot
  if (data.portfolio) {
    recordSnapshot(data.portfolio);
  }

  // Snapshot-only mode (for cron jobs — silent)
  if (SNAPSHOT_ONLY) {
    const pnl = calculatePnl(data.portfolio);
    console.log(JSON.stringify({
      ts: data.ts,
      totalValue: data.portfolio?.totalValue || 0,
      allTimePnl: pnl?.allTimePnl || 0,
      allTimePnlPct: pnl?.allTimePnlPct || 0,
    }));
    return;
  }

  // JSON output mode
  if (JSON_OUTPUT) {
    const pnl = calculatePnl(data.portfolio);
    const tradeSummary = getTradeSummary();
    console.log(JSON.stringify({
      ...data,
      pnl,
      tradeSummary,
      trades: getTrades(),
    }, null, 2));
    return;
  }

  // PNL-only mode
  if (PNL_ONLY) {
    const pnl = calculatePnl(data.portfolio);
    const tradeSummary = getTradeSummary();
    console.log(renderPnl(pnl, tradeSummary));
    return;
  }

  // History-only mode
  if (HISTORY_ONLY) {
    const trades = getTrades();
    console.log(renderHistory(trades));
    return;
  }

  // Full dashboard
  const pnl = calculatePnl(data.portfolio);
  console.log(renderDashboard({
    portfolio: data.portfolio,
    pnl,
    perpsMarkets: data.perpsMarkets,
    perpsPositions: data.perpsPositions,
    networkStatus: data.networkStatus,
    ts: data.ts,
  }));
}

/**
 * Watch mode — clear screen and refresh on interval.
 */
async function watch() {
  const clear = () => process.stdout.write('\x1b[2J\x1b[H');

  const tick = async () => {
    clear();
    await run();
    console.log(`  Refreshing every ${config.refreshInterval}s. Press Ctrl+C to exit.`);
  };

  await tick();
  setInterval(tick, config.refreshInterval * 1000);
}

// ── Entry point ──────────────────────────────────────────────────
if (WATCH) {
  watch().catch(err => { console.error('Watch error:', err.message); process.exit(1); });
} else {
  run().catch(err => { console.error('Dashboard error:', err.message); process.exit(1); });
}
