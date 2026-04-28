# Batch Royalty Query Implementation

This document describes the batch royalty query feature that allows frontends to fetch royalty data for multiple NFT tokens in a single RPC call.

## Overview

The `batch_royalty_info` function enables efficient querying of royalty information for multiple tokens simultaneously, reducing the number of RPC calls and improving frontend performance.

## Smart Contract Implementation

### Function Signature

```rust
pub fn batch_royalty_info(env: Env, token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo>
```

### Return Type

```rust
#[contracttype]
#[derive(Clone)]
pub struct BatchRoyaltyInfo {
    /// The NFT token ID
    pub token_id: u128,
    /// The address that receives royalty payments (zero address if token doesn't exist)
    pub recipient: Address,
    /// Royalty numerator in basis points (e.g., 500 = 5%)
    pub fee_numerator: u32,
    /// Royalty denominator (always 10000 for basis points calculation)
    pub fee_denominator: u32,
}
```

### Key Features

1. **Pure View Function**: No state mutations, no access control
2. **Order Preservation**: Output array matches input array order exactly
3. **Graceful Degradation**: Non-existent tokens return zero values instead of reverting
4. **No Batch Size Limit**: Contract doesn't impose limits (caller manages size)
5. **Efficient**: Single RPC call for multiple tokens

### Implementation Logic

```rust
pub fn batch_royalty_info(env: Env, token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo> {
    // Handle empty input immediately
    if token_ids.is_empty() {
        return Vec::new(&env);
    }

    let mut results = Vec::new(&env);
    
    // Iterate over input token IDs
    for i in 0..token_ids.len() {
        let token_id = token_ids.get(i).unwrap();
        
        // Try to get royalty info for this token
        let royalty_info_opt: Option<RoyaltyInfo> = env.storage()
            .instance()
            .get(&DataKey::TokenRoyalty(token_id));
        
        let batch_info = match royalty_info_opt {
            Some(royalty_info) => {
                // Token exists - return actual royalty data
                BatchRoyaltyInfo {
                    token_id,
                    recipient: royalty_info.recipient,
                    fee_numerator: royalty_info.bps,
                    fee_denominator: 10000,
                }
            }
            None => {
                // Token doesn't exist - return zero-value entry
                BatchRoyaltyInfo {
                    token_id,
                    recipient: zero_address,
                    fee_numerator: 0,
                    fee_denominator: 10000,
                }
            }
        };
        
        results.push_back(batch_info);
    }
    
    results
}
```

### Edge Case Handling

| Case | Behavior |
|------|----------|
| Empty input array | Returns empty array immediately |
| Non-existent token | Returns zero-value struct (no revert) |
| Mixed existing/non-existing | Returns data for existing, zeros for non-existing |
| Large batch | No on-chain limit (RPC limits apply) |

## Backend Integration

### Service: `BatchRoyaltyService`

Located at: `src/nft/batch-royalty.service.ts`

```typescript
async getBatchRoyaltyInfo(
  tokenIds: (string | number)[],
  skipCache = false,
): Promise<BatchRoyaltyInfo[]>
```

Features:
- Queries the smart contract's `batch_royalty_info` function
- Caches results in Redis for 5 minutes
- Validates input and enforces max batch size (100 tokens)
- Converts stroops to human-readable percentages
- Returns:
  ```typescript
  {
    tokenId: "1",
    recipient: "GABC...",
    feeNumerator: 500,
    feeDenominator: 10000,
    royaltyPercentage: "5.00%"
  }
  ```

### API Endpoint

```
POST /nft/batch-royalty
```

- **Authentication**: None (public endpoint)
- **Rate Limit**: Standard API limits apply
- **Cache**: 5 minutes
- **Max Batch Size**: 100 tokens

#### Request

```json
{
  "tokenIds": [1, 2, 3, 4, 5]
}
```

#### Response

```json
[
  {
    "tokenId": "1",
    "recipient": "GABC123...",
    "feeNumerator": 500,
    "feeDenominator": 10000,
    "royaltyPercentage": "5.00%"
  },
  {
    "tokenId": "2",
    "recipient": "GDEF456...",
    "feeNumerator": 1000,
    "feeDenominator": 10000,
    "royaltyPercentage": "10.00%"
  },
  {
    "tokenId": "3",
    "recipient": "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
    "feeNumerator": 0,
    "feeDenominator": 10000,
    "royaltyPercentage": "0.00%"
  }
]
```

Note: Token 3 in the example doesn't exist (zero address recipient).

## Acceptance Criteria ✅

All requirements met:

- [x] **Function Signature**: `batch_royalty_info(token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo>`
- [x] **Pure View**: No state mutations, no access control
- [x] **Return Type**: `BatchRoyaltyInfo` struct with token_id, recipient, fee_numerator, fee_denominator
- [x] **Order Preservation**: Output[i] corresponds to input[i]
- [x] **Same Length**: Output array length equals input array length
- [x] **Graceful Degradation**: Non-existent tokens return zero values (no revert)
- [x] **Empty Input**: Returns empty array immediately
- [x] **No Batch Limit**: Contract doesn't impose size limits
- [x] **NatSpec Warning**: Documented RPC timeout risk for large batches
- [x] **No Duplication**: Delegates to existing storage lookup logic
- [x] **Documentation**: Comprehensive NatSpec comments

## Usage Examples

### Smart Contract

```rust
// Query multiple tokens
let token_ids = vec![&env, 1, 2, 3, 4, 5];
let royalties = client.batch_royalty_info(&token_ids);

// Access results
for i in 0..royalties.len() {
    let info = royalties.get(i).unwrap();
    // info.token_id, info.recipient, info.fee_numerator, etc.
}
```

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
  console.log(`Token ${info.tokenId}: ${info.royaltyPercentage} to ${info.recipient}`);
});
```

### cURL

```bash
curl -X POST http://localhost:3000/nft/batch-royalty \
  -H "Content-Type: application/json" \
  -d '{"tokenIds": [1, 2, 3, 4, 5]}'
```

## Performance Considerations

### RPC Limits

While the smart contract doesn't impose batch size limits, RPC nodes have constraints:

| Batch Size | Estimated Time | Recommendation |
|------------|----------------|----------------|
| 1-10 tokens | < 1 second | Optimal |
| 11-50 tokens | 1-3 seconds | Good |
| 51-100 tokens | 3-5 seconds | Acceptable |
| 100+ tokens | 5+ seconds | Split into multiple requests |

### Caching Strategy

- Backend caches results for 5 minutes
- Cache key includes all token IDs in order
- Different token ID orders create different cache entries
- Clear cache after minting new tokens or updating royalties

### Optimization Tips

1. **Sort Token IDs**: Use consistent ordering for better cache hits
2. **Batch Strategically**: Group related tokens together
3. **Parallel Requests**: For 200+ tokens, make 2-3 parallel requests
4. **Prefetch**: Load royalty data before user needs it

## Testing

### Smart Contract Tests

```bash
cd contracts/nft-royalty
cargo test
```

Key tests:
- `test_batch_royalty_info_multiple_tokens`: Verifies correct data for multiple tokens
- `test_batch_royalty_info_with_nonexistent_tokens`: Tests graceful degradation
- `test_batch_royalty_info_empty_input`: Verifies empty array handling
- `test_batch_royalty_info_order_preservation`: Confirms output order matches input
- `test_batch_royalty_info_single_token`: Tests single-token batch

### Backend Tests

```bash
npm test src/nft/batch-royalty.service.spec.ts
```

## Error Handling

### Smart Contract

- **Empty input**: Returns empty array (no error)
- **Non-existent token**: Returns zero-value struct (no error)
- **Invalid token ID**: Not applicable (u128 type enforced)

### Backend API

- **Empty array**: Returns `[]` (200 OK)
- **Invalid token ID**: Returns `400 Bad Request`
- **Batch too large**: Returns `400 Bad Request` with message
- **RPC timeout**: Returns `500 Internal Server Error`
- **Contract error**: Returns `500 Internal Server Error`

## Migration Guide

### From Single Queries

Before:
```typescript
const royalties = [];
for (const tokenId of tokenIds) {
  const response = await fetch(`/nft/royalty/${tokenId}`);
  royalties.push(await response.json());
}
```

After:
```typescript
const response = await fetch('/nft/batch-royalty', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tokenIds })
});
const royalties = await response.json();
```

Benefits:
- 1 RPC call instead of N
- Faster response time
- Lower RPC costs
- Better cache utilization

## Security Considerations

1. **No Access Control**: Function is public by design for transparency
2. **No State Changes**: Pure view function cannot modify storage
3. **DoS Protection**: Backend enforces max batch size (100 tokens)
4. **Input Validation**: Token IDs validated as non-negative integers
5. **Rate Limiting**: Standard API rate limits apply

## Future Enhancements

Potential additions (not in current scope):

- Pagination support for very large batches
- Filtering options (e.g., only tokens with royalties > X%)
- Sorting options (by royalty percentage, token ID, etc.)
- Aggregated statistics (total royalties, average percentage, etc.)
- WebSocket support for real-time updates
