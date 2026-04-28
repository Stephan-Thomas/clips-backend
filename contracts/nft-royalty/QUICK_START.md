# Quick Start Guide - Platform Fee Tracking & Batch Royalty Query

## TL;DR

This smart contract tracks all platform fees (5% of NFT sales) in a public, transparent way and supports batch querying of royalty data for multiple tokens in a single call.

## Quick Commands

```bash
# Build contract
cd contracts/nft-royalty
cargo build --target wasm32-unknown-unknown --release

# Run tests
cargo test

# Deploy to testnet
./scripts/deploy.sh testnet

# Query platform revenue (after backend is running)
curl http://localhost:3000/platform/revenue

# Batch query royalties for multiple tokens
curl -X POST http://localhost:3000/nft/batch-royalty \
  -H "Content-Type: application/json" \
  -d '{"tokenIds": [1, 2, 3, 4, 5]}'
```

## Key Functions

### Smart Contract

```rust
// Execute a royalty payment (automatically tracks platform fee)
execute_royalty_payment(
    token_id: u128,
    sale_price: i128,
    payment_token: Address,
    buyer: Address,
    platform_wallet: Address
)

// Get total platform revenue (public, read-only)
get_platform_revenue() -> u128

// Batch query royalties for multiple tokens (public, read-only)
batch_royalty_info(token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo>
```

### Backend API

```bash
# Get platform revenue
GET /platform/revenue

# Response
{
  "totalFeesStroops": "50000000",
  "totalFeesXLM": "5.0000000",
  "lastUpdated": "2026-04-28T10:30:00.000Z"
}

# Batch query royalties
POST /nft/batch-royalty
Body: {"tokenIds": [1, 2, 3, 4, 5]}

# Response
[
  {
    "tokenId": "1",
    "recipient": "GABC...",
    "feeNumerator": 500,
    "feeDenominator": 10000,
    "royaltyPercentage": "5.00%"
  },
  ...
]
```

## How It Works

### Platform Fee Tracking

1. User buys an NFT for 100 XLM
2. Contract calculates:
   - Royalty: 10% = 10 XLM → creator
   - Platform fee: 5% = 5 XLM → platform
   - Seller gets: 85 XLM
3. Contract updates `total_platform_fees += 5 XLM`
4. Emits `PlatformFeeCollected` event
5. Anyone can query total via `get_platform_revenue()`

### Batch Royalty Query

1. Frontend needs royalty data for tokens [1, 2, 3, 4, 5]
2. Makes single API call: `POST /nft/batch-royalty`
3. Backend queries contract's `batch_royalty_info([1, 2, 3, 4, 5])`
4. Contract returns array with royalty data for all 5 tokens
5. Non-existent tokens return zero values (no error)
6. Results cached for 5 minutes

**Performance**: 1 RPC call instead of 5 = 80% faster!

## Example Flow

### Platform Fee Tracking

```rust
// Mint NFT with 10% royalty
mint(creator, 1, "ipfs://...", creator, 1000);

// Execute sale: 100 XLM
execute_royalty_payment(
    1,                    // token_id
    1_000_000_000,       // 100 XLM in stroops
    payment_token,
    buyer,
    platform_wallet
);

// Query total fees
let total = get_platform_revenue();
// Returns: 50_000_000 (5 XLM in stroops)
```

### Batch Royalty Query

```rust
// Mint multiple NFTs with different royalties
mint(creator1, 1, "ipfs://1", creator1, 500);   // 5%
mint(creator2, 2, "ipfs://2", creator2, 1000);  // 10%
mint(creator3, 3, "ipfs://3", creator3, 1500);  // 15%

// Query all at once
let token_ids = vec![&env, 1, 2, 3];
let royalties = batch_royalty_info(token_ids);

// Access results
for i in 0..royalties.len() {
    let info = royalties.get(i).unwrap();
    // info.token_id, info.recipient, info.fee_numerator
}
```

## Testing

```bash
cargo test test_platform_fee_tracking
```

Expected output:
```
test test::test_platform_fee_tracking ... ok
```

## Verification Checklist

### Platform Fee Tracking
- [ ] Contract builds without errors
- [ ] Tests pass (`cargo test test_platform_fee_tracking`)
- [ ] Contract deployed to testnet
- [ ] Backend can query `get_platform_revenue()`
- [ ] API endpoint returns revenue data
- [ ] Events are emitted on fee collection

### Batch Royalty Query
- [ ] Tests pass (`cargo test test_batch_royalty_info`)
- [ ] Backend can query `batch_royalty_info()`
- [ ] API endpoint accepts token ID arrays
- [ ] Non-existent tokens return zero values
- [ ] Order is preserved (output[i] = input[i])
- [ ] Empty input returns empty output

## Constants

- Platform fee: 5% (500 BPS)
- Max royalty: 15% (1500 BPS)
- 1 XLM = 10,000,000 stroops

## Files to Know

- `src/lib.rs` - Main contract code
- `Cargo.toml` - Dependencies
- `scripts/deploy.sh` - Deployment script
- `PLATFORM_FEE_TRACKING.md` - Platform fee docs
- `BATCH_ROYALTY_QUERY.md` - Batch query docs
- `README.md` - Full documentation

## Need Help?

- Platform Fee Tracking: See `PLATFORM_FEE_TRACKING.md`
- Batch Royalty Query: See `BATCH_ROYALTY_QUERY.md`
- Full Documentation: See `README.md`
