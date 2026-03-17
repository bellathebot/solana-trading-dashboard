/**
 * Terminal UI renderer — formats dashboard data for clean terminal output.
 */

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const CYAN = '\x1b[36m';
const WHITE = '\x1b[37m';
const BG_RED = '\x1b[41m';
const BG_GREEN = '\x1b[42m';

const WIDTH = 62;

function line(char = '─') { return char.repeat(WIDTH); }
function pad(str, len, align = 'left') {
  const s = String(str);
  if (align === 'right') return s.padStart(len);
  return s.padEnd(len);
}
function colorPnl(value, suffix = '') {
  if (value > 0) return `${GREEN}+${value.toFixed(2)}${suffix}${RESET}`;
  if (value < 0) return `${RED}${value.toFixed(2)}${suffix}${RESET}`;
  return `${DIM}${value.toFixed(2)}${suffix}${RESET}`;
}
function colorPct(value) { return colorPnl(value, '%'); }
function formatUsd(value) {
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.001) return `$${value.toFixed(6)}`;
  return `$${value.toFixed(10)}`;
}

/**
 * Render the full dashboard.
 */
export function renderDashboard({ portfolio, pnl, perpsMarkets, perpsPositions, networkStatus, ts }) {
  const lines = [];

  // Header
  lines.push('');
  lines.push(`${BOLD}${CYAN}╔${'═'.repeat(WIDTH)}╗${RESET}`);
  lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}SOLANA TRADING DASHBOARD${RESET}${' '.repeat(WIDTH - 27)}${BOLD}${CYAN}║${RESET}`);
  lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}${new Date(ts).toLocaleString('en-US', { timeZone: 'UTC' })} UTC${RESET}${' '.repeat(Math.max(0, WIDTH - new Date(ts).toLocaleString('en-US', { timeZone: 'UTC' }).length - 8))}${BOLD}${CYAN}║${RESET}`);
  lines.push(`${BOLD}${CYAN}╠${'═'.repeat(WIDTH)}╣${RESET}`);

  // Portfolio
  if (portfolio?.tokens) {
    const totalStr = `$${portfolio.totalValue.toFixed(2)}`;
    lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}PORTFOLIO${RESET}${' '.repeat(WIDTH - 12 - totalStr.length)}${BOLD}${totalStr}${RESET}  ${BOLD}${CYAN}║${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}${line()}${RESET}  ${BOLD}${CYAN}║${RESET}`);

    for (const t of portfolio.tokens) {
      if (t.value < 0.01) continue;
      const sym = pad(t.symbol, 6);
      const amt = pad(t.amount.toFixed(t.decimals > 6 ? 4 : 6), 14, 'right');
      const val = pad(`$${t.value.toFixed(2)}`, 10, 'right');
      const chg = t.priceChange ? colorPct(t.priceChange) : `${DIM}—${RESET}`;
      lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}${sym}${RESET} ${amt} ${val}  ${chg}${' '.repeat(Math.max(0, 8))}${BOLD}${CYAN}║${RESET}`);
    }
  }

  // PNL Section
  if (pnl) {
    lines.push(`${BOLD}${CYAN}╠${'═'.repeat(WIDTH)}╣${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}PROFIT & LOSS${RESET}${' '.repeat(WIDTH - 17)}${BOLD}${CYAN}║${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}${line()}${RESET}  ${BOLD}${CYAN}║${RESET}`);

    const allTime = `All-Time:   ${colorPnl(pnl.allTimePnl)}  (${colorPct(pnl.allTimePnlPct)})`;
    lines.push(`${BOLD}${CYAN}║${RESET}  ${allTime}${' '.repeat(Math.max(0, 16))}${BOLD}${CYAN}║${RESET}`);

    if (pnl.hourlyPnl !== null) {
      const hourly = `1h Change:  ${colorPnl(pnl.hourlyPnl)}  (${colorPct(pnl.hourlyPnlPct)})`;
      lines.push(`${BOLD}${CYAN}║${RESET}  ${hourly}${' '.repeat(Math.max(0, 16))}${BOLD}${CYAN}║${RESET}`);
    }

    if (pnl.dailyPnl !== null) {
      const daily = `24h Change: ${colorPnl(pnl.dailyPnl)}  (${colorPct(pnl.dailyPnlPct)})`;
      lines.push(`${BOLD}${CYAN}║${RESET}  ${daily}${' '.repeat(Math.max(0, 16))}${BOLD}${CYAN}║${RESET}`);
    }

    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}Session High: $${pnl.sessionHigh.toFixed(2)}  Low: $${pnl.sessionLow.toFixed(2)}  Snapshots: ${pnl.snapshotCount}${RESET}${' '.repeat(Math.max(0, 2))}${BOLD}${CYAN}║${RESET}`);
  }

  // Perps Markets
  if (perpsMarkets && perpsMarkets.length > 0) {
    lines.push(`${BOLD}${CYAN}╠${'═'.repeat(WIDTH)}╣${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}PERPS MARKETS${RESET}${' '.repeat(WIDTH - 17)}${BOLD}${CYAN}║${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}${line()}${RESET}  ${BOLD}${CYAN}║${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}${pad('Asset', 6)} ${pad('Price', 14, 'right')} ${pad('24h', 9, 'right')} ${pad('24h Vol', 16, 'right')}${RESET}  ${BOLD}${CYAN}║${RESET}`);

    for (const m of perpsMarkets) {
      const price = m.priceUsd >= 1000 ? `$${m.priceUsd.toFixed(2)}` : `$${m.priceUsd.toFixed(3)}`;
      const chg = colorPct(m.changePct24h);
      const vol = `$${(m.volumeUsd24h / 1_000_000).toFixed(1)}M`;
      lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}${pad(m.asset, 6)}${RESET} ${pad(price, 14, 'right')} ${chg}${' '.repeat(Math.max(0, 4))} ${pad(vol, 10, 'right')}  ${BOLD}${CYAN}║${RESET}`);
    }
  }

  // Perps Positions
  if (perpsPositions?.positions?.length > 0) {
    lines.push(`${BOLD}${CYAN}╠${'═'.repeat(WIDTH)}╣${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}OPEN PERPS POSITIONS${RESET}${' '.repeat(WIDTH - 24)}${BOLD}${CYAN}║${RESET}`);
    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}${line()}${RESET}  ${BOLD}${CYAN}║${RESET}`);

    for (const p of perpsPositions.positions) {
      const side = p.side === 'long' ? `${GREEN}LONG${RESET}` : `${RED}SHORT${RESET}`;
      const pnlStr = colorPnl(p.pnlPct, '%');
      lines.push(`${BOLD}${CYAN}║${RESET}  ${BOLD}${p.asset}${RESET} ${side} ${p.leverage.toFixed(1)}x  $${p.sizeUsd.toFixed(2)}  PNL: ${pnlStr}${' '.repeat(Math.max(0, 8))}${BOLD}${CYAN}║${RESET}`);
      lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}  Entry: $${p.entryPriceUsd.toFixed(2)}  Mark: $${p.markPriceUsd.toFixed(2)}  Liq: $${p.liquidationPriceUsd.toFixed(2)}${RESET}${' '.repeat(Math.max(0, 2))}${BOLD}${CYAN}║${RESET}`);
    }
  }

  // Network Status
  if (networkStatus?.epochInfo) {
    lines.push(`${BOLD}${CYAN}╠${'═'.repeat(WIDTH)}╣${RESET}`);
    const ei = networkStatus.epochInfo;
    const epochPct = ((ei.slotIndex / ei.slotsInEpoch) * 100).toFixed(1);
    const ver = networkStatus.version?.['solana-core'] || '?';
    lines.push(`${BOLD}${CYAN}║${RESET}  ${DIM}Network: Epoch ${ei.epoch} (${epochPct}%)  Height: ${(ei.blockHeight / 1_000_000).toFixed(1)}M  v${ver}${RESET}${' '.repeat(Math.max(0, 2))}${BOLD}${CYAN}║${RESET}`);
  }

  // Footer
  lines.push(`${BOLD}${CYAN}╚${'═'.repeat(WIDTH)}╝${RESET}`);
  lines.push('');

  return lines.join('\n');
}

/**
 * Render PNL-only view.
 */
export function renderPnl(pnl, tradeSummary) {
  const lines = [];
  lines.push('');
  lines.push(`${BOLD}${CYAN}═══ PROFIT & LOSS REPORT ═══${RESET}`);
  lines.push('');

  if (pnl) {
    lines.push(`  Current Value:   ${BOLD}$${pnl.currentValue.toFixed(2)}${RESET}`);
    lines.push(`  Initial Deposit: $${pnl.initialValue.toFixed(2)}`);
    lines.push(`  All-Time PNL:    ${colorPnl(pnl.allTimePnl)} (${colorPct(pnl.allTimePnlPct)})`);
    lines.push(`  Session High:    $${pnl.sessionHigh.toFixed(2)}`);
    lines.push(`  Session Low:     $${pnl.sessionLow.toFixed(2)}`);
    lines.push(`  Snapshots:       ${pnl.snapshotCount}`);
  }

  if (tradeSummary && tradeSummary.totalTrades > 0) {
    lines.push('');
    lines.push(`${BOLD}  Trade Statistics${RESET}`);
    lines.push(`  Total Trades: ${tradeSummary.totalTrades}`);
    lines.push(`  Win/Loss:     ${GREEN}${tradeSummary.wins}W${RESET} / ${RED}${tradeSummary.losses}L${RESET}  (${tradeSummary.winRate.toFixed(1)}%)`);
    lines.push(`  Total PNL:    ${colorPnl(tradeSummary.totalPnl)}`);
    lines.push(`  Total Fees:   ${RED}-$${tradeSummary.totalFees.toFixed(4)}${RESET}`);
    lines.push(`  Net PNL:      ${colorPnl(tradeSummary.netPnl)}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Render trade history.
 */
export function renderHistory(trades) {
  const lines = [];
  lines.push('');
  lines.push(`${BOLD}${CYAN}═══ TRADE HISTORY ═══${RESET}`);
  lines.push('');

  if (!trades || trades.length === 0) {
    lines.push('  No trades recorded yet.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`  ${DIM}${pad('Date', 12)} ${pad('Pair', 14)} ${pad('Side', 6)} ${pad('Size', 10, 'right')} ${pad('PNL', 10, 'right')}${RESET}`);
  lines.push(`  ${DIM}${line()}${RESET}`);

  for (const t of trades.slice(-20).reverse()) {
    const date = new Date(t.ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const pair = t.pair || `${t.from}→${t.to}`;
    const side = t.side || 'swap';
    const size = t.sizeUsd ? `$${t.sizeUsd.toFixed(2)}` : '—';
    const pnl = t.pnlUsd != null ? colorPnl(t.pnlUsd) : `${DIM}—${RESET}`;
    lines.push(`  ${pad(date, 12)} ${pad(pair, 14)} ${pad(side, 6)} ${pad(size, 10, 'right')} ${pnl}`);
  }

  lines.push('');
  return lines.join('\n');
}
