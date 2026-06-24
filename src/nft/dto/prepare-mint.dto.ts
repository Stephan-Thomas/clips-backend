import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateMintPreparationDto {
  @ApiProperty({
    description: 'Numeric identifier of the clip to mint',
    example: 42,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clipId: number;

  @ApiProperty({
    description: 'Stellar account that will receive and sign for the NFT',
    example: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
  })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;
}
