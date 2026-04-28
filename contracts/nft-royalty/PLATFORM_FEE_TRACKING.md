# Platform Fee Tracking Implementation

This document describes the platform fee tracking feature implemented in the NFT Royalty smart contract.

## Overview

The smart contract tracks all platform fees collected from NFT royalty payments in a transparent, immutable way. This enables:

- Real-time visibility into platform revenue
- Transparent fee collection for stakeholders
- Off-chain indexing via events
- Audit trail for all fee collections

## Implementation Details

### 1. State Variable

```rust
/// Storage key for the total accumulated platform fees
const TOTAL_PLATFORM_FEES: &str = "total_platform_fees";
```

- Type: `u128` (unsigned 128-bit integer)
- Storage: Persistent (survives contract upgrades)
- Initial value: 0 (on deployment)
- Unit: Stroops (1 XLM = 10^7 stroops)

### 2. Update Logic

The `execute_royalty_payment` function handles all royalty payments and fee collection:

```rust
pub fn execute_royalty_payment(
    env: Env,
    token_id: u128,
    sale_price: i128,
    payment_token: Address,
    buyer: Address,
    platform_wallet: Address,
)
```

#### Payment Flow:

1. **Validate** sale price and token existence
2. **Calculate** royalty amount: `(sale_price × royalty_bps) / 10000`
3. **Calculate** platform fee: `(sale_price × 500) / 10000` (5%)
4. **Transfer** royalty to creator
5. **Transfer** platform fee to platform wallet
6. **Update** `total_platform_fees` atomically:
   ```rust
   let current_total: u128 = env.storage()
       .persistent()
       .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
       .unwrap_or(0);
   
   let new_total = current_total + platform_fee_amount as u128;
   
   env.storage()
       .persistent()
       .set(&String::from_str(&env, TOTAL_PLATFORM_FEES), &new_total);
   ```
7. **Emit** `PlatformFeeCollected` event
8. **Transfer** remaining amount to seller

#### Atomicity Guarantee:

The platform fee update happens within the same transaction as the payment transfers. If any step fails, the entire transaction reverts, ensuring:

- No payment succeeds without updating `total_platform_fees`
- No partial updates or inconsistent state
- Accurate fee tracking at all times

### 3. View Function

```rust
/// Get the total accumulated platform revenue
/// This is a read-only function with no access control - anyone can call it
/// for transparency.
///
/// @return The total platform fees collected in stroops (1 XLM = 10^7 stroops)
pub fn get_platform_revenue(env: Env) -> u128 {
    env.storage()
        .persistent()
        .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
        .unwrap_or(0)
}
```

- **Access**: Public (no authentication required)
- **Cost**: Free (read-only simulation)
- **Returns**: Total fees in stroops
- **Purpose**: Transparency and auditing

### 4. Event Emission

```rust
#[contracttype]
#[derive(Clone)]
pub struct PlatformFeeCollected {
    pub amount: i128,
    pub new_total: u128,
}
```

Emitted on every platform fee collection:

```rust
env.events().publish(
    (String::from_str(&env, "PlatformFeeCollected"),),
    PlatformFeeCollected {
        amount: platform_fee_amount,
        new_total,
    },
);
```

This enables:
- Off-chain indexing and analytics
- Real-time monitoring
- Historical fee tracking
- Audit trails

## Backend Integration

### Service: `PlatformRevenueService`

Located at: `src/nft/platform-revenue.service.ts`

```typescript
async getPlatformRevenue(): Promise<PlatformRevenueInfo>
```

- Queries the smart contract's `get_platform_revenue()` function
- Caches results in Redis for 1 minute
- Converts stroops to XLM for readability
- Returns:
  ```typescript
  {
    totalFeesStroops: "50000000",
    totalFeesXLM: "5.0000000",
    lastUpdated: "2026-04-28T10:30:00.000Z"
  }
  ```

### API Endpoint

```
GET /platform/revenue
```

- **Authentication**: None (public endpoint)
- **Rate Limit**: Standard API limits apply
- **Cache**: 1 minute
- **Response**:
  ```json
  {
    "totalFeesStroops": "50000000",
    "totalFeesXLM": "5.0000000",
    "lastUpdated": "2026-04-28T10:30:00.000Z"
  }
  ```

## Acceptance Criteria Verification

### ✅ 1. Initialization at 0

```rust
env.storage()
    .persistent()
    .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
    .unwrap_or(0)  // Returns 0 if not set
```

### ✅ 2. Accumulation Accuracy

Test case from `lib.rs`:

```rust
#[test]
fn test_platform_fee_tracking() {
    // First payment: 100 XLM → 5 XLM fee
    client.execute_royalty_payment(&1, &1_000_000_000, ...);
    assert_eq!(client.get_platform_revenue(), 50_000_000);
    
    // Second payment: 200 XLM → 10 XLM fee
    client.execute_royalty_payment(&1, &2_000_000_000, ...);
    assert_eq!(client.get_platform_revenue(), 150_000_000);
    // Total: 5 + 10 = 15 XLM ✓
}
```

### ✅ 3. View Function Accuracy

```rust
pub fn get_platform_revenue(env: Env) -> u128 {
    env.storage()
        .persistent()
        .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
        .unwrap_or(0)
}
```

Returns the exact value stored in `total_platform_fees`.

### ✅ 4. Mandatory Update

The update is not conditional and happens before the function returns:

```rust
// This code ALWAYS executes if platform_fee_amount > 0
if platform_fee_amount > 0 {
    token_client.transfer(&buyer, &platform_wallet, &platform_fee_amount);
    
    // Update MUST happen here - no conditions, no early returns
    let current_total: u128 = env.storage()
        .persistent()
        .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
        .unwrap_or(0);
    
    let new_total = current_total + platform_fee_amount as u128;
    
    env.storage()
        .persistent()
        .set(&String::from_str(&env, TOTAL_PLATFORM_FEES), &new_total);
    
    // Event emission
    env.events().publish(...);
}
```

If the transfer fails, the entire transaction reverts, so the update never commits.

### ✅ 5. Event Emission

```rust
env.events().publish(
    (String::from_str(&env, "PlatformFeeCollected"),),
    PlatformFeeCollected {
        amount: platform_fee_amount,
        new_total,
    },
);
```

Emitted alongside every fee collection.

### ✅ 6. Documentation

- NatSpec comments on all functions
- Inline documentation for critical sections
- This comprehensive guide

## Testing

Run the test suite:

```bash
cd contracts/nft-royalty
cargo test
```

Key tests:
- `test_platform_fee_tracking`: Verifies accumulation across multiple payments
- `test_mint_and_royalty`: Verifies basic NFT and royalty functionality

## Deployment

1. Build the contract:
   ```bash
   cd contracts/nft-royalty
   cargo build --target wasm32-unknown-unknown --release
   ```

2. Deploy to testnet:
   ```bash
   ./scripts/deploy.sh testnet
   ```

3. Update `.env`:
   ```env
   SOROBAN_NFT_CONTRACT_ID=<deployed_contract_id>
   ```

4. Verify deployment:
   ```bash
   curl http://localhost:3000/platform/revenue
   ```

## Security Considerations

1. **Atomicity**: Fee updates are atomic with payments
2. **Immutability**: `total_platform_fees` can only increase (no reset function)
3. **Transparency**: Public read access for auditing
4. **Event Logging**: All collections are logged
5. **Validation**: Sale prices and amounts are validated

## Future Enhancements

Potential additions (not in current scope):

- Admin withdrawal function with explicit reset
- Multiple platform wallets with fee splitting
- Dynamic fee percentage (governance-controlled)
- Fee rebates or discounts for high-volume users
- Historical fee tracking by time period
