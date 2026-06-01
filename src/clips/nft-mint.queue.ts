/** BullMQ queue name for NFT minting jobs */
export const NFT_MINT_QUEUE = 'nft-mint';

/**
 * NFT mint jobs are background blockchain tasks and can run at a lower
 * queue priority than immediate clip generation.
 */
export const NFT_MINT_QUEUE_PRIORITY = 10;

export const NFT_MINT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  priority: NFT_MINT_QUEUE_PRIORITY,
} as const;
