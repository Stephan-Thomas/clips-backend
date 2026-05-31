/** BullMQ queue name for NFT minting jobs */
export const NFT_MINT_QUEUE = 'nft-mint';

export const NFT_MINT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
} as const;
