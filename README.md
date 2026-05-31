# ClipCash

**Turn your long videos into short viral clips — automatically, with full control, and optional NFT ownership.**

ClipCash helps content creators (YouTubers, podcasters, gamers, coaches…) save many hours of work by turning one long video into dozens or hundreds of short clips ready for TikTok, Instagram Reels, YouTube Shorts, and more.

You always stay in control:
→ Preview every clip
→ Choose which ones you like
→ Delete the bad ones
→ Then post only the good ones automatically

**Bonus: you can also turn your best clips into NFTs on the Stellar network (very cheap & fast) so you truly own them and can earn royalties forever.**

## What makes ClipCash special?

- **Full preview & selection** — most tools post random clips. ClipCash lets you see and pick only the best ones.
- **Automatic posting** to 7+ platforms (TikTok, Instagram, YouTube Shorts, Facebook Reels, Snapchat Spotlight, Pinterest, LinkedIn)
- **Web2 + Web3 in one app** — normal accounts + optional Stellar NFTs with royalties
- **Simple & beautiful interface** — dark mode, clean design, easy to use

## Main Features (MVP – 2026)

- Upload long video or paste YouTube/TikTok link
- AI creates 50–200 short clips (15–60 seconds each)
- Preview screen: watch short previews, select / deselect / bulk delete
- One-click post selected clips to multiple platforms
- Earnings dashboard (shows money from all platforms)
- Optional: mint selected clips as NFTs on Stellar (Soroban smart contracts)
- Subscription plans + small revenue share (we take 5–10% only if you want)

## Tech Stack – Simple Overview

| Part           | Technology                          | Why we chose it                     |
| -------------- | ----------------------------------- | ----------------------------------- |
| Frontend       | Next.js 15 + React + Tailwind       | Fast, beautiful, mobile-friendly    |
| Backend        | NestJS (TypeScript)                 | Clean, organized, easy to grow      |
| Database       | PostgreSQL (via Supabase or Prisma) | Reliable & real-time updates        |
| Queue / Jobs   | BullMQ + Redis                      | Handles long AI & posting tasks     |
| Social Posting | Ayrshare                            | One tool posts to all platforms     |
| Blockchain     | Stellar Soroban (Rust)              | Very cheap fees, built-in royalties |
| AI             | Runway Gen-3 + Claude               | Finds the most viral moments        |

## Quick Start (Local Development)

### Requirements

- Node.js 18 or newer
- Docker (recommended for database & Redis)
- Git

### Clone & install

```bash
git clone https://github.com/your-username/clipcash.git
cd clipcash/backend
cp .env.example .env
npm install
npm run start:dev
```

Open <http://localhost:3000> in your browser.

## API Documentation (Swagger/OpenAPI)

ClipCash provides comprehensive API documentation via Swagger UI.

### Accessing the Docs

When running in **development mode** (`NODE_ENV !== 'production'`):

- **Swagger UI**: <http://localhost:3000/api/docs>
- **OpenAPI JSON**: <http://localhost:3000/api/docs-json> (or `openapi.json` file)

### Authentication

Most endpoints require a Bearer token. To authenticate in Swagger UI:

1. Click the **Authorize** button (🔓) at the top of the page
2. Enter your JWT token: `Bearer your_token_here`
3. Click **Authorize** and close the dialog
4. All subsequent requests will include the token automatically

### Exporting OpenAPI Spec

To export the OpenAPI JSON spec for external use:

```bash
# During development (automatically exported on start)
npm run start:dev

# Or manually export
npm run openapi:export
```

This creates `openapi.json` in the project root, which can be used with:
- Postman (Import → File)
- Insomnia
- Code generators (OpenAPI Generator)
- Frontend client SDKs

### Environment Variables for Swagger

```env
# Disable Swagger UI in production (default: true in prod)
ENABLE_SWAGGER_UI=false

# Or enable it even in production (not recommended for public APIs)
ENABLE_SWAGGER_UI=true
```

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Key variables:

```env
DATABASE_URL=postgresql://...
REDIS_HOST=localhost

# BullMQ Worker Scaling (see BULLMQ_WORKER_SCALING.md for details)
BULLMQ_CLIP_GENERATION_CONCURRENCY=2
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=5

# Stellar (see section below)
STELLAR_NETWORK=testnet
MIN_STELLAR_PAYOUT=5
METRICS_TOKEN=change-this-in-production
```

For detailed guidance on configuring BullMQ worker concurrency for different environments, see [BULLMQ_WORKER_SCALING.md](./BULLMQ_WORKER_SCALING.md).

## Stellar Network Configuration

The backend supports switching between Stellar **testnet** and **mainnet** (public network) via an environment variable.

### `STELLAR_NETWORK`

| Value      | Network                | RPC URL                                  | Use when               |
| ---------- | ---------------------- | ---------------------------------------- | ---------------------- |
| `testnet`  | Stellar Testnet (SDF)  | `https://soroban-testnet.stellar.org`    | Development / staging  |
| `public`   | Stellar Mainnet        | `https://soroban-rpc.stellar.org`        | Production             |

**Default:** `testnet`

Set in your `.env`:

```env
# Development
STELLAR_NETWORK=testnet

# Production
STELLAR_NETWORK=public
```

The `StellarService` reads this variable at startup and exposes the correct `rpcUrl` and `networkPassphrase` to all services that perform Stellar operations (minting, payouts).

### `MIN_STELLAR_PAYOUT`

Minimum payout amount in USD equivalent. Requests below this threshold are rejected with a `400` error to prevent fee-wasting micro-transactions.

```env
MIN_STELLAR_PAYOUT=5   # default: 5 USD
```

## API Endpoints

### Metrics — `GET /metrics`

Prometheus-compatible metrics are exposed at `/metrics` and protected with `METRICS_TOKEN`.

- Send header: `x-metrics-token: <METRICS_TOKEN>`
- This route is not guarded by JWT, but returns `403` when token is missing/invalid.

Tracked metrics:

- `clipcash_clips_generated_total{status="success|failure"}`
- `clipcash_nft_mints_total{status="success|failure"}`
- `clipcash_job_queue_depth{queue="clip-generation"}`
- `clipcash_http_request_duration_seconds{method,route,status_code}`
- `clipcash_stellar_rpc_errors_total`
- `clipcash_cloudinary_upload_errors_total`

### Wallets — `GET /wallets`

Wallet addresses are **partially masked** in all responses for user privacy. Only the last 6 characters of the address are shown (e.g. `******KPRQ6A`).

| Method | Endpoint        | Description                   |
| ------ | --------------- | ----------------------------- |
| GET    | `/wallets`      | List current user's wallets   |
| GET    | `/wallets/:id`  | Get a single wallet by ID     |

### Mint — `POST /clips/:id/mint`

Mint a clip as an NFT on Stellar. Clips that have already been **auto-posted** (`postStatus = "posted"`) cannot be minted and will return `400`.

| Method | Endpoint            | Description         |
| ------ | ------------------- | ------------------- |
| POST   | `/clips/:id/mint`   | Mint clip as NFT    |

### Payouts — `POST /payouts`

Initiate a Stellar payout. Returns `400` if the amount is below `MIN_STELLAR_PAYOUT`.

| Method | Endpoint    | Body                         | Description             |
| ------ | ----------- | ---------------------------- | ----------------------- |
| POST   | `/payouts`  | `{ amount, walletId? }`      | Initiate Stellar payout |

## Project Structure

```text
clips-backend/
├── src/
│   ├── auth/        # JWT, Google OAuth, magic links
│   ├── clips/       # Clip generation & management
│   ├── videos/      # Video upload & processing
│   ├── wallet/      # Wallet listing with masked addresses
│   ├── mint/        # NFT minting (Stellar Soroban)
│   ├── payout/      # Stellar payouts with minimum threshold
│   ├── stellar/     # Stellar SDK configuration (network switching)
│   ├── jobs/        # BullMQ job management
│   ├── earnings/    # Earnings dashboard
│   └── prisma/      # Database connection
├── prisma/
│   └── schema.prisma
└── .env.example
```

## Integration and E2E Tests

Run the subscription integration flow and existing e2e suites with:

```bash
npm run test:e2e
```

The subscription integration scenarios live in `test/subscription-flow.e2e-spec.ts` and cover:

- intent creation with memo and destination
- activation on matching memo+amount
- rejection on wrong amount
- idempotency on duplicate transaction id
- rejection of expired intents (>15 minutes)
