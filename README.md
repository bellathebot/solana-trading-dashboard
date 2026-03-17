# Solana Trading Dashboard

A terminal dashboard for monitoring Solana trading activity and PNL. Built on top of the [Jupiter CLI](https://github.com/jup-ag/cli) and [Helius CLI](https://github.com/helius-labs/helius-cli).

## Features

- **Live Portfolio View** — token balances, USD values, 24h price changes
- **PNL Tracking** — all-time, hourly, and daily profit/loss vs initial deposit
- **Perps Markets** — SOL, BTC, ETH prices, volume, and 24h changes
- **Perps Positions** — open leveraged positions with entry, mark, liquidation prices
- **Network Status** — Solana epoch, block height, version
- **Trade History** — logged trades with PNL per trade
- **Snapshot System** — rolling snapshots for historical PNL comparison
- **Watch Mode** — auto-refreshing terminal dashboard
- **JSON Output** — structured data for programmatic consumption

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Jupiter CLI](https://github.com/jup-ag/cli) (`npm i -g @jup-ag/cli`)
- [Helius CLI](https://github.com/helius-labs/helius-cli) (`npm i -g helius-cli`)
- A Helius API key ([get one free](https://dev.helius.xyz))

## Setup

```bash
# Clone the repo
git clone https://github.com/bellathebot/solana-trading-dashboard.git
cd solana-trading-dashboard

# Configure environment
cp .env.example .env
# Edit .env with your wallet address, API keys, and CLI paths

# Set up Jupiter CLI key (if not already done)
jup keys add trading --file ~/.config/solana/id.json
jup keys use trading
jup config set --output json

# Set up Helius CLI (if not already done)
helius config set-api-key YOUR_API_KEY
```

## Usage

```bash
# Full dashboard (single run)
npm start

# Auto-refreshing watch mode
npm run watch

# PNL report only
npm run pnl

# Trade history
npm run history

# Record snapshot silently (for cron jobs)
npm run snapshot

# Raw JSON output (for piping to other tools)
node src/dashboard.mjs --json
```

## Dashboard Modes

### Full Dashboard (`npm start`)
Shows portfolio, PNL, perps markets, open positions, and network status in a styled terminal UI.

### Watch Mode (`npm run watch`)
Clears the terminal and refreshes the dashboard at the configured interval (default: 60s).

### PNL Report (`npm run pnl`)
Shows detailed profit/loss breakdown: all-time, hourly, daily, session high/low, and trade statistics.

### Snapshot Mode (`npm run snapshot`)
Silently records a portfolio snapshot and outputs a JSON summary. Designed for cron:
```bash
# Record a snapshot every 5 minutes
*/5 * * * * cd /path/to/dashboard && node src/dashboard.mjs --snapshot >> /dev/null
```

## Project Structure

```
solana-trading-dashboard/
├── src/
│   └── dashboard.mjs    # Entry point and CLI argument handling
├── lib/
│   ├── config.mjs       # .env loader and configuration
│   ├── data.mjs         # Data collection from Jupiter & Helius CLIs
│   ├── pnl.mjs          # PNL calculation, snapshots, trade logging
│   └── render.mjs       # Terminal UI rendering
├── .env.example         # Environment template
├── .gitignore           # Excludes .env, data/, node_modules/
├── package.json
└── README.md
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `WALLET_ADDRESS` | Yes | Solana wallet address to track |
| `HELIUS_API_KEY` | Yes | Helius API key for on-chain data |
| `JUPITER_API_KEY` | No | Jupiter API key for higher rate limits |
| `JUP_BIN` | No | Path to `jup` binary (default: `jup`) |
| `HELIUS_BIN` | No | Path to `helius` binary (default: `helius`) |
| `DATA_DIR` | No | Snapshot storage directory (default: `./data`) |
| `INITIAL_DEPOSIT_USD` | No | Initial deposit in USD for all-time PNL |
| `INITIAL_DEPOSIT_SOL` | No | Initial deposit in SOL |
| `REFRESH_INTERVAL` | No | Watch mode refresh interval in seconds (default: 60) |

## License

MIT
