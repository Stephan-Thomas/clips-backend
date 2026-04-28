# NFT Royalty Contract with Platform Fee Tracking

A Soroban smart contract for Stellar that implements NFT minting with royalty payments and transparent platform fee tracking.

## Features

### 1. Platform Fee Tracking

The contract maintains a persistent storage variable `total_platform_fees` that accumulates all platform fees collected from royalty payments.

#### State Variable
- `total_platform_fees: u128` - Persistent storage that tracks cumulative platform revenue in stroops

#### Update Logic
- On every `execute_royalty_payment` call, the platform fee (5% of sale price) is calculated
- The fee is transferred to the platform wallet
- `total_platform_fees` is atomically incremented by the fee amount
- This update happens in the same transaction and cannot be skipped

#### View Function
- `get_platform_revenue() -> u128` - Public read-only function
- Returns the current value of `total_platform_fees`
- No access control - anyone can call for transparency

#### Event Emission
- `PlatformFeeCollected` event is emitted with:
  - `amount`: The platform fee collected in this transaction
  - `new_total`: The updated total platform fees

### 2. NFT Functionality

- Mint NFTs with custom royalty settings (0-15%)
- Transfer ownership
- Query token metadata and royalties
- Execute royalty payments on secondary sales

### 3. Royalty Payment Flow

When `execute_royalty_payment` is called:

1. Validates the sale price and token existence
2. Calculates royalty amount (based on token's royalty BPS)
3. Calculates platform fee (5% of sale price)
4. Transfers royalty to creator
5. Transfers platform fee to platform wallet
6. **Atomically updates `total_platform_fees`** ✓
7. Emits `PlatformFeeCollected` event ✓
8. Transfers remaining amount to seller

## Acceptance Criteria ✓

- [x] `total_platform_fees` initializes at 0 on deployment
- [x] After N royalty payments, `total_platform_fees` equals the sum of all platform fees
- [x] `get_platform_revenue()` returns the same value as `total_platform_fees`
- [x] No royalty payment can succeed without updating `total_platform_fees`
- [x] Event emitted on every platform fee collection
- [x] NatSpec/docstring comments on variable and function

## Building

```bash
cd contracts/nft-royalty
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test
```

## Deployment

```bash
# Build optimized WASM
soroban contract build

# Deploy to testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/nft_royalty_contract.wasm \
  --source <YOUR_SECRET_KEY> \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

## Contract Functions

### Minting
```rust
mint(to: Address, token_id: u128, uri: String, royalty_recipient: Address, royalty_bps: u32)
```

### Royalty Payment
```rust
execute_royalty_payment(
    token_id: u128,
    sale_price: i128,
    payment_token: Address,
    buyer: Address,
    platform_wallet: Address
)
```

### Platform Revenue Query
```rust
get_platform_revenue() -> u128
```

### Batch Royalty Query
```rust
batch_royalty_info(token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo>
```

Fetch royalty information for multiple tokens in a single call. Returns an array of `BatchRoyaltyInfo` structs with:
- `token_id`: The NFT token ID
- `recipient`: Royalty recipient address
- `fee_numerator`: Royalty in basis points (e.g., 500 = 5%)
- `fee_denominator`: Always 10000 (basis points)

Non-existent tokens return zero values instead of reverting. See `BATCH_ROYALTY_QUERY.md` for details.

### Other Functions
- `owner_of(token_id: u128) -> Address`
- `get_royalties(token_id: u128) -> Map<Address, u32>`
- `transfer(from: Address, to: Address, token_id: u128)`
- `token_uri(token_id: u128) -> String`
- `total_supply() -> u128`

## Constants

- `PLATFORM_FEE_BPS`: 500 (5% platform fee)
- Maximum royalty BPS: 1500 (15%)

## Storage Keys

- `total_platform_fees`: Persistent storage for accumulated platform fees
- `TokenOwner(token_id)`: Instance storage for token ownership
- `TokenURI(token_id)`: Instance storage for token metadata URI
- `TokenRoyalty(token_id)`: Instance storage for royalty information
- `TotalSupply`: Instance storage for total minted tokens

## Security Considerations

1. **Atomic Updates**: Platform fee tracking happens atomically within the payment transaction
2. **Authorization**: All state-changing functions require proper authorization
3. **Validation**: Sale prices and royalty BPS are validated
4. **Transparency**: Platform revenue is publicly queryable
5. **Event Logging**: All fee collections are logged for off-chain tracking
