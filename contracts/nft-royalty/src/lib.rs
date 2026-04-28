// Soroban NFT Contract with Platform Fee Tracking
// This contract implements ERC-721-like NFT functionality with royalty payments
// and transparent platform fee tracking.

#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, Address, Env, String, Vec, Map,
};

/// Storage key for the total accumulated platform fees
const TOTAL_PLATFORM_FEES: &str = "total_platform_fees";

/// Platform fee percentage in basis points (e.g., 500 = 5%)
const PLATFORM_FEE_BPS: u32 = 500; // 5% platform fee

/// Royalty information for a single token
/// Contains the recipient address and royalty percentage in basis points
#[contracttype]
#[derive(Clone)]
pub struct RoyaltyInfo {
    /// The address that receives royalty payments
    pub recipient: Address,
    /// Royalty percentage in basis points (e.g., 1000 = 10%, max 1500 = 15%)
    pub bps: u32,
}

/// Batch royalty information including token ID
/// Used by batch_royalty_info to return royalty data for multiple tokens
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

#[contracttype]
#[derive(Clone)]
pub struct NFTMetadata {
    pub owner: Address,
    pub uri: String,
    pub royalty_info: RoyaltyInfo,
}

#[contracttype]
pub enum DataKey {
    TokenOwner(u128),
    TokenURI(u128),
    TokenRoyalty(u128),
    TotalSupply,
}

/// Event emitted when platform fees are collected
#[contracttype]
#[derive(Clone)]
pub struct PlatformFeeCollected {
    pub amount: i128,
    pub new_total: u128,
}

#[contract]
pub struct NFTContract;

#[contractimpl]
impl NFTContract {
    /// Mint a new NFT with royalty information
    pub fn mint(
        env: Env,
        to: Address,
        token_id: u128,
        uri: String,
        royalty_recipient: Address,
        royalty_bps: u32,
    ) {
        to.require_auth();
        
        // Validate royalty BPS (max 15%)
        assert!(royalty_bps <= 1500, "Royalty BPS cannot exceed 1500 (15%)");
        
        // Store token owner
        env.storage().instance().set(&DataKey::TokenOwner(token_id), &to);
        
        // Store token URI
        env.storage().instance().set(&DataKey::TokenURI(token_id), &uri);
        
        // Store royalty info
        let royalty_info = RoyaltyInfo {
            recipient: royalty_recipient,
            bps: royalty_bps,
        };
        env.storage().instance().set(&DataKey::TokenRoyalty(token_id), &royalty_info);
        
        // Increment total supply
        let total_supply: u128 = env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(total_supply + 1));
    }

    /// Get the owner of a token
    pub fn owner_of(env: Env, token_id: u128) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist")
    }

    /// Get royalty information for a token
    pub fn get_royalties(env: Env, token_id: u128) -> Map<Address, u32> {
        let royalty_info: RoyaltyInfo = env.storage()
            .instance()
            .get(&DataKey::TokenRoyalty(token_id))
            .expect("Token does not exist");
        
        let mut royalty_map = Map::new(&env);
        royalty_map.set(royalty_info.recipient, royalty_info.bps);
        royalty_map
    }

    /// Batch query royalty information for multiple tokens in a single call
    /// 
    /// This is a pure view function with no state mutations or access control.
    /// Anyone (including frontends without a wallet signer) can call this function.
    /// 
    /// # Parameters
    /// * `token_ids` - Vector of token IDs to query
    /// 
    /// # Returns
    /// Vector of `BatchRoyaltyInfo` structs in the same order as input.
    /// - If a token doesn't exist or has no royalty set, returns a zero-value entry
    /// - Output array length always equals input array length
    /// - Output index matches input index (output[i] corresponds to token_ids[i])
    /// 
    /// # Edge Cases
    /// - Empty input returns empty output immediately
    /// - Non-existent tokens return zeroed struct (recipient = zero address, fees = 0)
    /// - Does not revert on missing tokens
    /// 
    /// # Warning
    /// Very large batches may hit RPC node gas/timeout limits. The caller should
    /// manage request size based on their RPC provider's constraints.
    /// Recommended batch size: 50-100 tokens per call.
    /// 
    /// # Example
    /// ```ignore
    /// let token_ids = vec![&env, 1, 2, 3];
    /// let royalties = batch_royalty_info(env, token_ids);
    /// // Returns 3 BatchRoyaltyInfo structs with royalty data for tokens 1, 2, 3
    /// ```
    pub fn batch_royalty_info(env: Env, token_ids: Vec<u128>) -> Vec<BatchRoyaltyInfo> {
        // Handle empty input immediately
        if token_ids.is_empty() {
            return Vec::new(&env);
        }

        let mut results = Vec::new(&env);
        
        // Iterate over input token IDs and collect royalty info
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
                        fee_denominator: 10000, // Basis points denominator
                    }
                }
                None => {
                    // Token doesn't exist - return zero-value entry
                    // Create a zero address (all zeros)
                    let zero_address = Address::from_string(&String::from_str(
                        &env,
                        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
                    ));
                    
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


    /// Execute a royalty payment for a token sale
    /// This function:
    /// 1. Calculates the royalty amount based on the token's royalty BPS
    /// 2. Calculates the platform fee (5% of sale price)
    /// 3. Transfers royalty to the creator
    /// 4. Transfers platform fee to the platform wallet
    /// 5. Atomically updates total_platform_fees
    /// 6. Emits PlatformFeeCollected event
    ///
    /// @param token_id - The NFT token ID
    /// @param sale_price - The sale price in stroops (1 XLM = 10^7 stroops)
    /// @param payment_token - The token contract address for payment
    /// @param buyer - The buyer's address (payer)
    /// @param platform_wallet - The platform's wallet address
    pub fn execute_royalty_payment(
        env: Env,
        token_id: u128,
        sale_price: i128,
        payment_token: Address,
        buyer: Address,
        platform_wallet: Address,
    ) {
        buyer.require_auth();
        
        // Ensure sale price is positive
        assert!(sale_price > 0, "Sale price must be positive");
        
        // Get royalty info
        let royalty_info: RoyaltyInfo = env.storage()
            .instance()
            .get(&DataKey::TokenRoyalty(token_id))
            .expect("Token does not exist");
        
        // Calculate royalty amount (creator's share)
        let royalty_amount = (sale_price * royalty_info.bps as i128) / 10000;
        
        // Calculate platform fee (5% of sale price)
        let platform_fee_amount = (sale_price * PLATFORM_FEE_BPS as i128) / 10000;
        
        // Calculate seller's net amount
        let seller_amount = sale_price - royalty_amount - platform_fee_amount;
        
        // Get token contract for transfers
        let token_client = token::Client::new(&env, &payment_token);
        
        // Transfer royalty to creator
        if royalty_amount > 0 {
            token_client.transfer(&buyer, &royalty_info.recipient, &royalty_amount);
        }
        
        // Transfer platform fee to platform wallet
        // This MUST happen atomically - cannot be skipped
        if platform_fee_amount > 0 {
            token_client.transfer(&buyer, &platform_wallet, &platform_fee_amount);
            
            // *** CRITICAL: Update total_platform_fees atomically ***
            // This increment happens in the same transaction as the payment
            // and cannot be skipped or made conditional
            let current_total: u128 = env.storage()
                .persistent()
                .get(&String::from_str(&env, TOTAL_PLATFORM_FEES))
                .unwrap_or(0);
            
            let new_total = current_total + platform_fee_amount as u128;
            
            env.storage()
                .persistent()
                .set(&String::from_str(&env, TOTAL_PLATFORM_FEES), &new_total);
            
            // Emit event for off-chain indexers
            env.events().publish(
                (String::from_str(&env, "PlatformFeeCollected"),),
                PlatformFeeCollected {
                    amount: platform_fee_amount,
                    new_total,
                },
            );
        }
        
        // Transfer remaining amount to seller (current token owner)
        let seller = Self::owner_of(env.clone(), token_id);
        if seller_amount > 0 {
            token_client.transfer(&buyer, &seller, &seller_amount);
        }
    }

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

    /// Transfer token ownership (standard ERC-721 transfer)
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u128) {
        from.require_auth();
        
        let current_owner: Address = env.storage()
            .instance()
            .get(&DataKey::TokenOwner(token_id))
            .expect("Token does not exist");
        
        assert!(current_owner == from, "Not the token owner");
        
        env.storage().instance().set(&DataKey::TokenOwner(token_id), &to);
    }

    /// Get token URI
    pub fn token_uri(env: Env, token_id: u128) -> String {
        env.storage()
            .instance()
            .get(&DataKey::TokenURI(token_id))
            .expect("Token does not exist")
    }

    /// Get total supply of minted tokens
    pub fn total_supply(env: Env) -> u128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_platform_fee_tracking() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let buyer = Address::generate(&env);
        let platform = Address::generate(&env);
        let token_address = Address::generate(&env);

        // Initial platform revenue should be 0
        assert_eq!(client.get_platform_revenue(), 0);

        // Mint a token with 10% royalty
        client.mint(
            &creator,
            &1,
            &String::from_str(&env, "ipfs://test"),
            &creator,
            &1000,
        );

        // Execute royalty payment with 100 XLM sale (1,000,000,000 stroops)
        // Platform fee: 5% = 50,000,000 stroops
        // Royalty: 10% = 100,000,000 stroops
        client.execute_royalty_payment(
            &1,
            &1_000_000_000,
            &token_address,
            &buyer,
            &platform,
        );

        // Platform revenue should now be 50,000,000
        assert_eq!(client.get_platform_revenue(), 50_000_000);

        // Execute another payment
        client.execute_royalty_payment(
            &1,
            &2_000_000_000,
            &token_address,
            &buyer,
            &platform,
        );

        // Platform revenue should accumulate: 50M + 100M = 150M
        assert_eq!(client.get_platform_revenue(), 150_000_000);
    }

    #[test]
    fn test_mint_and_royalty() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);
        let token_id = 1u128;

        client.mint(
            &creator,
            &token_id,
            &String::from_str(&env, "ipfs://metadata"),
            &creator,
            &1000, // 10% royalty
        );

        assert_eq!(client.owner_of(&token_id), creator);
        assert_eq!(client.total_supply(), 1);

        let royalties = client.get_royalties(&token_id);
        assert_eq!(royalties.get(creator).unwrap(), 1000);
    }

    #[test]
    fn test_batch_royalty_info_multiple_tokens() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator1 = Address::generate(&env);
        let creator2 = Address::generate(&env);
        let creator3 = Address::generate(&env);

        // Mint three tokens with different royalties
        client.mint(
            &creator1,
            &1,
            &String::from_str(&env, "ipfs://token1"),
            &creator1,
            &500, // 5% royalty
        );

        client.mint(
            &creator2,
            &2,
            &String::from_str(&env, "ipfs://token2"),
            &creator2,
            &1000, // 10% royalty
        );

        client.mint(
            &creator3,
            &3,
            &String::from_str(&env, "ipfs://token3"),
            &creator3,
            &1500, // 15% royalty
        );

        // Batch query all three tokens
        let token_ids = Vec::from_array(&env, [1u128, 2u128, 3u128]);
        let batch_results = client.batch_royalty_info(&token_ids);

        // Verify results
        assert_eq!(batch_results.len(), 3);

        // Token 1
        let info1 = batch_results.get(0).unwrap();
        assert_eq!(info1.token_id, 1);
        assert_eq!(info1.recipient, creator1);
        assert_eq!(info1.fee_numerator, 500);
        assert_eq!(info1.fee_denominator, 10000);

        // Token 2
        let info2 = batch_results.get(1).unwrap();
        assert_eq!(info2.token_id, 2);
        assert_eq!(info2.recipient, creator2);
        assert_eq!(info2.fee_numerator, 1000);
        assert_eq!(info2.fee_denominator, 10000);

        // Token 3
        let info3 = batch_results.get(2).unwrap();
        assert_eq!(info3.token_id, 3);
        assert_eq!(info3.recipient, creator3);
        assert_eq!(info3.fee_numerator, 1500);
        assert_eq!(info3.fee_denominator, 10000);
    }

    #[test]
    fn test_batch_royalty_info_with_nonexistent_tokens() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        // Mint only token 1 and 3, skip token 2
        client.mint(
            &creator,
            &1,
            &String::from_str(&env, "ipfs://token1"),
            &creator,
            &500,
        );

        client.mint(
            &creator,
            &3,
            &String::from_str(&env, "ipfs://token3"),
            &creator,
            &1500,
        );

        // Query tokens 1, 2 (doesn't exist), 3
        let token_ids = Vec::from_array(&env, [1u128, 2u128, 3u128]);
        let batch_results = client.batch_royalty_info(&token_ids);

        // Should return 3 results, with token 2 having zero values
        assert_eq!(batch_results.len(), 3);

        // Token 1 - exists
        let info1 = batch_results.get(0).unwrap();
        assert_eq!(info1.token_id, 1);
        assert_eq!(info1.recipient, creator);
        assert_eq!(info1.fee_numerator, 500);

        // Token 2 - doesn't exist, should have zero values
        let info2 = batch_results.get(1).unwrap();
        assert_eq!(info2.token_id, 2);
        assert_eq!(info2.fee_numerator, 0);
        assert_eq!(info2.fee_denominator, 10000);
        // recipient should be zero address

        // Token 3 - exists
        let info3 = batch_results.get(2).unwrap();
        assert_eq!(info3.token_id, 3);
        assert_eq!(info3.recipient, creator);
        assert_eq!(info3.fee_numerator, 1500);
    }

    #[test]
    fn test_batch_royalty_info_empty_input() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        // Query with empty array
        let token_ids: Vec<u128> = Vec::new(&env);
        let batch_results = client.batch_royalty_info(&token_ids);

        // Should return empty array
        assert_eq!(batch_results.len(), 0);
    }

    #[test]
    fn test_batch_royalty_info_order_preservation() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        // Mint tokens in non-sequential order
        client.mint(
            &creator,
            &10,
            &String::from_str(&env, "ipfs://token10"),
            &creator,
            &300,
        );

        client.mint(
            &creator,
            &5,
            &String::from_str(&env, "ipfs://token5"),
            &creator,
            &700,
        );

        client.mint(
            &creator,
            &15,
            &String::from_str(&env, "ipfs://token15"),
            &creator,
            &1200,
        );

        // Query in specific order: 15, 5, 10
        let token_ids = Vec::from_array(&env, [15u128, 5u128, 10u128]);
        let batch_results = client.batch_royalty_info(&token_ids);

        // Verify order is preserved
        assert_eq!(batch_results.len(), 3);
        assert_eq!(batch_results.get(0).unwrap().token_id, 15);
        assert_eq!(batch_results.get(0).unwrap().fee_numerator, 1200);
        assert_eq!(batch_results.get(1).unwrap().token_id, 5);
        assert_eq!(batch_results.get(1).unwrap().fee_numerator, 700);
        assert_eq!(batch_results.get(2).unwrap().token_id, 10);
        assert_eq!(batch_results.get(2).unwrap().fee_numerator, 300);
    }

    #[test]
    fn test_batch_royalty_info_single_token() {
        let env = Env::default();
        let contract_id = env.register_contract(None, NFTContract);
        let client = NFTContractClient::new(&env, &contract_id);

        let creator = Address::generate(&env);

        client.mint(
            &creator,
            &42,
            &String::from_str(&env, "ipfs://token42"),
            &creator,
            &850,
        );

        // Query single token
        let token_ids = Vec::from_array(&env, [42u128]);
        let batch_results = client.batch_royalty_info(&token_ids);

        assert_eq!(batch_results.len(), 1);
        let info = batch_results.get(0).unwrap();
        assert_eq!(info.token_id, 42);
        assert_eq!(info.recipient, creator);
        assert_eq!(info.fee_numerator, 850);
        assert_eq!(info.fee_denominator, 10000);
    }
}
