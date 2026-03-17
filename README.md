# Solana Trading Dashboard

A real-time web and terminal dashboard for monitoring Solana trading activity and PNL. Built on the [Jupiter](https://jup.ag) and [Helius](https://helius.dev) APIs.

![Dashboard](https://img.shields.io/badge/Solana-Trading_Dashboard-blue?style=flat-square)

## Features

- **Live Portfolio View** — token balances, USD values, 24h price changes
- **PNL Tracking** — all-time profit/loss vs initial deposit
- **Watchlist** — track prices and liquidity for tokens you care about
- **Auto-Refresh** — updates every 30 seconds
- **Responsive** — works on desktop and mobile
- **Terminal Mode** — CLI dashboard with watch mode and snapshot system

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fbellathebot%2Fsolana-trading-dashboard&env=WALLET_ADDRESS,HELIUS_API_KEY,INITIAL_DEPOSIT_USD)

### Required Environment Variables

Set these in your Vercel project settings:

| Variable | Required | Description |
|----------|----------|-------------|
| `WALLET_ADDRESS` | Yes | Solana wallet address to track |
| `HELIUS_API_KEY` | Yes | Helius API key ([get one free](https://dev.helius.xyz)) |
| `INITIAL_DEPOSIT_USD` | No | Initial deposit in USD for PNL calculation (default: 0) |

## Local Development

```bash
# Clone
git clone https://github.com/bellathebot/solana-trading-dashboard.git
cd solana-trading-dashboard

# Configure
cp .env.example .env
# Edit .env with your wallet address and API keys

# Run web version (requires vercel CLI)
npx vercel dev

# Or use the terminal CLI version
npm start          # full dashboard
npm run watch      # auto-refresh
npm run pnl        # PNL report
npm run snapshot   # record snapshot (for cron)
```

## Project Structure

```
solana-trading-dashboard/
├── api/
│   └── dashboard.js       # Vercel serverless function (Jupiter + Helius APIs)
├── public/
│   └── index.html         # Web frontend (vanilla HTML/CSS/JS)
├── src/
│   └── dashboard.mjs      # Terminal CLI dashboard
├── lib/
│   ├── config.mjs         # .env loader
│   ├── data.mjs           # CLI data collection
│   ├── pnl.mjs            # PNL calculation & snapshots
│   └── render.mjs         # Terminal UI renderer
├── vercel.json            # Vercel routing config
├── .env.example           # Config template
├── .gitignore             # Excludes .env, data/, node_modules/
├── package.json
└── README.md
```

## Architecture

### Web (Vercel)
```
Browser → /api/dashboard → Jupiter Price API + Helius RPC → JSON → Frontend renders
```
The serverless function fetches live data directly from Jupiter and Helius REST APIs. No CLIs needed on the server.

### Terminal (CLI)
```
Terminal → jup CLI + helius CLI → parsed JSON → Terminal UI renderer
```
Uses the locally installed Jupiter and Helius CLIs for data. Supports watch mode, snapshots, and PNL history.

## API

### `GET /api/dashboard`

Returns the full dashboard payload:

```json
{
  "ts": "2026-03-17T02:00:00.000Z",
  "wallet": "jTsP9QPb...",
  "portfolio": {
    "totalValue": 100.77,
    "tokens": [
      { "symbol": "SOL", "amount": 0.8478, "price": 96.14, "value": 81.51, "priceChange24h": 4.5 },
      { "symbol": "USDC", "amount": 19.20, "price": 1.0, "value": 19.20, "priceChange24h": 0 }
    ]
  },
  "pnl": {
    "initialDeposit": 100.95,
    "currentValue": 100.77,
    "allTimePnl": -0.18,
    "allTimePnlPct": -0.18
  },
  "watchlist": [
    { "symbol": "JUP", "price": 0.169, "priceChange24h": 3.8, "liquidity": 50000000 }
  ]
}
```

## License

MIT
