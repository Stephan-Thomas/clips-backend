# Batch Royalty Query Implementation Summary

## Overview

This implementation adds a batch royalty query function to the NFT smart contract, allowing frontends to fetch royalty data for multiple tokens in a single RPC call, significantly improving performance and reducing costs.

## What Was Implemented

### 1. Smart Contract (Soroban/Rust)

**Location**: `contracts/nft-royalty/src/lib.rs`

#### New Struct: `BatchRoyaltyInfo`

```rust
#[contracttype]
#[derive(Clone)]
pub struct BatchRoyaltyInfo {
    pub token_id: u128,
    pub recipient: Address,
    pub fee_numerator: u32,
    pub fee_denominator: u32,
}
```

#### New Function: `batch_royalty_info`

```rust
pub fn batch_royalty_info(env: Env, token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo>
```

**Features**:
- Pure view function (no state changes, no access control)
- Returns royalty data for multiple tokens in one call
- Order-preserving: output[i] corresponds to input[i]
- Graceful degradation: non-existent tokens return zero values
- No on-chain batch size limit (RPC limits apply)

#### Implementation Details

- Iterates over input token IDs
- Queries existing storage for each token
- Returns actual data for existing tokens
- Returns zero-value struct for non-existent tokens
- Never reverts on missing tokens
- Delegates to existing storage lookup logic

### 2. Backend Service (NestJS/TypeScript)

**Location**: `src/nft/batch-royalty.service.ts`

**Features**:
- Queries the smart contract's `batch_royalty_info` function
- Caches results in Redis for 5 minutes
- Enforces max batch size of 100 tokens
- Converts basis points to human-readable percentages
- Validates input token IDs
- Handles RPC errors gracefully

**Response Format**:
```typescript
{
  tokenId: "1",
  recipient: "GABC...",
  feeNumerator: 500,
  feeDenominator: 10000,
  royaltyPercentage: "5.00%"
}
```

### 3. API Endpoint

**Endpoint**: `POST /nft/batch-royalty`

**Location**: `src/nft/batch-royalty.controller.ts`

- Public endpoint (no authentication required)
- Accepts array of token IDs
- Returns array of royalty info in same order
- Max batch size: 100 tokens
- Cached for 5 minutes

**Request**:
```json
{
  "tokenIds": [1, 2, 3, 4, 5]
}
```

**Response**:
```json
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

## Files Created

### Smart Contract
- Updated `contracts/nft-royalty/src/lib.rs` - Added `BatchRoyaltyInfo` struct and `batch_royalty_info` function
- `contracts/nft-royalty/BATCH_ROYALTY_QUERY.md` - Comprehensive documentation

### Backend
- `src/nft/batch-royalty.service.ts` - Service for batch queries
- `src/nft/batch-royalty.service.spec.ts` - Unit tests
- `src/nft/batch-royalty.controller.ts` - API controller

### Documentation
- `BATCH_ROYALTY_IMPLEMENTATION.md` - This summary
- Updated `contracts/nft-royalty/README.md` - Added batch query info

### Modified Files
- `src/nft/nft.module.ts` - Added new service and controller
- `contracts/nft-royalty/src/lib.rs` - Added batch query function and tests

## Acceptance Criteria ✅

All requirements met:

- [x] **Function Signature**: `batch_royalty_info(token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo>`
- [x] **Pure View**: No state mutations, no access control, callable by anyone
- [x] **Return Type**: `BatchRoyaltyInfo` with token_id, recipient, fee_numerator, fee_denominator
- [x] **Reuses Existing Type**: Uses existing `RoyaltyInfo` internally
- [x] **Implementation Logic**: Iterates input, delegates to existing lookup, collects results
- [x] **Order Preservation**: Output array matches input array order exactly
- [x] **Same Length**: Output length equals input length
- [x] **Edge Case - Non-existent**: Returns zero-value struct (no revert)
- [x] **Edge Case - Empty**: Returns empty array immediately
- [x] **Edge Case - No Limit**: No on-chain batch size limit
- [x] **No State Changes**: Pure view function
- [x] **No Duplication**: Delegates to existing storage lookup
- [x] **Documentation**: NatSpec comments and comprehensive guides
- [x] **Warning**: Documented RPC timeout risk for large batches

## Test Coverage

### Smart Contract Tests

All tests passing:

1. `test_batch_royalty_info_multiple_tokens` - Verifies correct data for 3 tokens with different royalties
2. `test_batch_royalty_info_with_nonexistent_tokens` - Tests mixed existing/non-existing tokens
3. `test_batch_royalty_info_empty_input` - Verifies empty array returns empty array
4. `test_batch_royalty_info_order_preservation` - Confirms output order matches input order
5. `test_batch_royalty_info_single_token` - Tests single-token batch

### Backend Tests

- Input validation tests
- Empty array handling
- Batch size limit enforcement
- Cache clearing functionality

## Usage Examples

### Frontend (JavaScript/TypeScript)

```typescript
// Fetch royalty data for multiple tokens
const response = await fetch('http://localhost:3000/nft/batch-royalty', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    tokenIds: [1, 2, 3, 4, 5]
  })
});

const royalties = await response.json();

// Display royalty info
royalties.forEach(info => {
  if (info.feeNumerator > 0) {
    console.log(`Token ${info.tokenId}: ${info.royaltyPercentage} to ${info.recipient}`);
  } else {
    console.log(`Token ${info.tokenId}: Not found or no royalty`);
  }
});
```

### cURL

```bash
curl -X POST http://localhost:3000/nft/batch-royalty \
  -H "Content-Type: application/json" \
  -d '{"tokenIds": [1, 2, 3, 4, 5]}'
```

### Smart Contract (Rust)

```rust
let token_ids = vec![&env, 1, 2, 3, 4, 5];
let royalties = client.batch_royalty_info(&token_ids);

for i in 0..royalties.len() {
    let info = royalties.get(i).unwrap();
    // Process info.token_id, info.recipient, info.fee_numerator, etc.
}
```

## Performance Benefits

### Before (Single Queries)

```typescript
// 5 separate RPC calls
const royalties = [];
for (const tokenId of [1, 2, 3, 4, 5]) {
  const response = await fetch(`/nft/royalty/${tokenId}`);
  royalties.push(await response.json());
}
// Total time: ~5 seconds (1 second per call)
```

### After (Batch Query)

```typescript
// 1 RPC call
const response = await fetch('/nft/batch-royalty', {
  method: 'POST',
  body: JSON.stringify({ tokenIds: [1, 2, 3, 4, 5] })
});
const royalties = await response.json();
// Total time: ~1 second
```

**Improvements**:
- 80% reduction in RPC calls
- 80% reduction in response time
- 80% reduction in RPC costs
- Better cache utilization
- Improved user experience

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Stellar Blockchain                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         NFT Royalty Smart Contract (Soroban)          │  │
│  │                                                        │  │
│  │  Function:                                            │  │
│  │    batch_royalty_info(token_ids: Vec<u128>)          │  │
│  │      -> Vec<BatchRoyaltyInfo>                        │  │
│  │                                                        │  │
│  │  For each token_id:                                   │  │
│  │    - Query storage for royalty info                   │  │
│  │    - Return actual data if exists                     │  │
│  │    - Return zero values if not exists                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ Single RPC call
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (NestJS)                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         BatchRoyaltyService                           │  │
│  │                                                        │  │
│  │  - Validates input (max 100 tokens)                  │  │
│  │  - Queries batch_royalty_info()                      │  │
│  │  - Caches in Redis (5 min TTL)                       │  │
│  │  - Converts to human-readable format                 │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↑                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │      BatchRoyaltyController                           │  │
│  │                                                        │  │
│  │  POST /nft/batch-royalty (public)                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↑
                            │ HTTP POST
                            │
                      ┌──────────┐
                      │ Frontend │
                      └──────────┘
```

## Deployment

### 1. Build and Deploy Contract

```bash
cd contracts/nft-royalty

# Build
cargo build --target wasm32-unknown-unknown --release

# Deploy to testnet
./scripts/deploy.sh testnet

# Update .env with contract ID
echo "SOROBAN_NFT_CONTRACT_ID=<your_contract_id>" >> ../../.env
```

### 2. Start Backend

```bash
npm install
npm run start:dev
```

### 3. Test the Endpoint

```bash
curl -X POST http://localhost:3000/nft/batch-royalty \
  -H "Content-Type: application/json" \
  -d '{"tokenIds": [1, 2, 3]}'
```

## Best Practices

### Batch Size Recommendations

| Use Case | Recommended Batch Size | Reason |
|----------|------------------------|--------|
| Real-time UI | 10-20 tokens | Fast response, good UX |
| Gallery view | 20-50 tokens | Balance speed/data |
| Background sync | 50-100 tokens | Maximize efficiency |
| Bulk operations | 100 tokens (max) | API limit |

### Caching Strategy

1. **Frontend**: Cache results in memory/localStorage
2. **Backend**: Redis cache (5 minutes)
3. **Invalidation**: Clear cache after minting/updating royalties

### Error Handling

```typescript
try {
  const response = await fetch('/nft/batch-royalty', {
    method: 'POST',
    body: JSON.stringify({ tokenIds })
  });
  
  if (!response.ok) {
    if (response.status === 400) {
      // Invalid input or batch too large
      console.error('Invalid request');
    } else if (response.status === 500) {
      // RPC error or contract error
      console.error('Server error');
    }
  }
  
  const royalties = await response.json();
  // Process royalties
} catch (error) {
  // Network error
  console.error('Network error:', error);
}
```

## Security Considerations

1. **No Access Control**: Function is public by design for transparency
2. **No State Changes**: Pure view function cannot modify storage
3. **DoS Protection**: Backend enforces max batch size (100 tokens)
4. **Input Validation**: Token IDs validated as non-negative integers
5. **Rate Limiting**: Standard API rate limits apply
6. **Cache Poisoning**: Cache keys include all token IDs to prevent poisoning

## Monitoring

### Metrics to Track

- Average batch size
- Response time by batch size
- Cache hit rate
- RPC call frequency
- Error rate by type

### Logging

```typescript
// Service logs
this.logger.log(`Batch royalty query for ${tokenIds.length} tokens`);
this.logger.debug(`Cache hit for batch: ${tokenIds.join(',')}`);
this.logger.error(`RPC error: ${error.message}`);
```

## Future Enhancements

Potential additions (not in current scope):

1. **Pagination**: Support for very large batches with cursor-based pagination
2. **Filtering**: Query only tokens with royalties above a threshold
3. **Sorting**: Return results sorted by royalty percentage or token ID
4. **Aggregation**: Include summary statistics (total, average, min, max)
5. **WebSocket**: Real-time updates when royalties change
6. **GraphQL**: Alternative query interface with flexible field selection

## Support

For questions or issues:
- Smart Contract: See `contracts/nft-royalty/BATCH_ROYALTY_QUERY.md`
- Backend: See `src/nft/batch-royalty.service.ts`
- API: See `src/nft/batch-royalty.controller.ts`
- Tests: Run `cargo test` (contract) or `npm test` (backend)
