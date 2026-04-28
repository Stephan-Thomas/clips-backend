import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MintClipDto {
  /** ID of the clip being minted */
  @IsString()
  @IsNotEmpty()
  clipId: string;

  /** Creator's wallet address — receives the creator royalty share */
  @IsString()
  @IsNotEmpty()
  creatorWallet: string;

  /** Optional on-chain metadata URI (IPFS / Arweave) */
  @IsOptional()
  @IsUrl()
  metadataUri?: string;

  /**
   * NFT royalty in Basis Points (BPS). 0–10000 (0–100%).
   * Defaults to 1000 (10%) if not provided.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  @Type(() => Number)
  royaltyBps?: number;
}
