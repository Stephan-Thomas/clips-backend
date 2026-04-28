#!/bin/bash

# Deployment script for NFT Royalty Contract with Platform Fee Tracking
# Usage: ./deploy.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}

if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://soroban-rpc.stellar.org"
    NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
    echo "🚀 Deploying to MAINNET"
elif [ "$NETWORK" = "testnet" ]; then
    RPC_URL="https://soroban-testnet.stellar.org"
    NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
    echo "🧪 Deploying to TESTNET"
else
    echo "❌ Invalid network. Use 'testnet' or 'mainnet'"
    exit 1
fi

echo "📦 Building contract..."
cd "$(dirname "$0")/.."
cargo build --target wasm32-unknown-unknown --release

echo "✅ Build complete"
echo ""
echo "🔑 Make sure you have set your secret key:"
echo "   export SOROBAN_SECRET_KEY=S..."
echo ""
echo "📤 Deploy command:"
echo "soroban contract deploy \\"
echo "  --wasm target/wasm32-unknown-unknown/release/nft_royalty_contract.wasm \\"
echo "  --source \$SOROBAN_SECRET_KEY \\"
echo "  --rpc-url $RPC_URL \\"
echo "  --network-passphrase \"$NETWORK_PASSPHRASE\""
echo ""
echo "💡 After deployment, update your .env file:"
echo "   SOROBAN_NFT_CONTRACT_ID=<contract_id>"
