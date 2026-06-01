# Contributing to ClipCash Backend

Thank you for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Stellar Bounty Program](#stellar-bounty-program)
- [Soroban Contract Contributions](#soroban-contract-contributions)
- [Code Standards](#code-standards)
- [Submitting a Pull Request](#submitting-a-pull-request)

---

## Getting Started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in required values
4. Run database migrations: `npx prisma migrate dev`
5. Start the dev server: `npm run start:dev`

---

## Development Workflow

- Create a branch from `main` using the format: `type/issue-number-short-description`
  - Examples: `feat/301-clip-search`, `fix/288-payout-race`, `docs/295-swagger-tags`
- Keep commits focused and use [Conventional Commits](https://www.conventionalcommits.org/) format
- Do not push directly to `main`
- All PRs require passing CI checks before merge

---

## Stellar Bounty Program

ClipCash participates in the **Stellar Community Fund** open-source bounty program. Eligible contributors can earn XLM rewards for completing tagged issues.

### Eligible Issues

Issues tagged with `stellar-bounty` on the [issue tracker](https://github.com/ANYTECHS/clips-backend/issues?q=label%3Astellar-bounty) are eligible for rewards.

### How to Claim a Bounty

1. **Find an open bounty issue** — look for the `stellar-bounty` label
2. **Comment on the issue** to express intent and avoid duplicate work
3. **Submit a PR** that fully satisfies the acceptance criteria
4. **Include your Stellar wallet address** in the PR description using this format:
   ```
   Stellar Wallet: GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```
5. Once the PR is merged and reviewed, the bounty is paid out in XLM to the provided address

### Bounty Board

See open bounties: [https://github.com/ANYTECHS/clips-backend/issues?q=label%3Astellar-bounty+is%3Aopen](https://github.com/ANYTECHS/clips-backend/issues?q=label%3Astellar-bounty+is%3Aopen)

### Rules

- One bounty per contributor per issue
- Partial implementations are not eligible — all acceptance criteria must be met
- The maintainer team has final say on bounty eligibility
- Bounties are paid within 7 days of PR merge

---

## Soroban Contract Contributions

ClipCash uses [Soroban](https://soroban.stellar.org/) smart contracts for NFT royalties and on-chain payments. Contract code lives in `contracts/nft-royalty/`.

### Setup

```bash
# Install Rust and the Soroban CLI
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install --locked soroban-cli

# Build contracts
cd contracts/nft-royalty
cargo build --target wasm32-unknown-unknown --release
```

### Guidelines

- All contract changes must include unit tests in the same PR
- Run `cargo test` before submitting
- Do not change the public interface of existing contract functions without a migration plan
- Document any new contract events in `contracts/nft-royalty/BATCH_ROYALTY_QUERY.md`
- Test on Stellar Testnet before targeting mainnet deployment

---

## Code Standards

- **TypeScript**: strict mode, no `any` unless unavoidable
- **Formatting**: Prettier (`npm run format`)
- **Linting**: ESLint (`npm run lint`)
- **Tests**: Vitest for unit tests; add tests for any new service logic
- **Swagger**: all new controller endpoints must have `@ApiOperation` and `@ApiResponse` decorators

---

## Submitting a Pull Request

1. Ensure all tests pass: `npm test`
2. Ensure linting passes: `npm run lint`
3. Reference the issue in your PR title or description: `Closes #<issue-number>`
4. Fill out the PR template completely
5. Request a review from a maintainer

For questions, open a [Discussion](https://github.com/ANYTECHS/clips-backend/discussions) or join the community.
