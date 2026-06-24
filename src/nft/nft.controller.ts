import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoginGuard } from '../auth/guards/login.guard';
import { NftMintService } from '../clips/nft-mint.service';
import { CreateMintPreparationDto } from './dto/prepare-mint.dto';

interface AuthenticatedRequest extends Request {
  user?: { id?: number | string };
}

@ApiTags('nfts')
@ApiBearerAuth('access-token')
@Controller('nfts')
export class NftController {
  constructor(private readonly nftMintService: NftMintService) {}

  @Post('prepare-mint')
  @UseGuards(LoginGuard)
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ nftMint: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Prepare an unsigned NFT mint transaction',
    description:
      'Validates clip ownership and mint eligibility, uploads metadata when needed, and returns Soroban XDR for the client wallet to sign.',
  })
  @ApiBody({ type: CreateMintPreparationDto })
  @ApiCreatedResponse({
    description: 'Unsigned Soroban mint transaction prepared successfully',
    schema: {
      example: {
        xdr: 'AAAAAgAAA...',
        clipId: 42,
        tokenId: 42,
        metadataUri: 'ipfs://bafy...',
        to: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
        contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEU4',
        network: 'testnet',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid wallet, clip state, royalty, or request payload',
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token is required',
  })
  @ApiNotFoundResponse({ description: 'Clip was not found' })
  @ApiServiceUnavailableResponse({
    description: 'Stellar or metadata infrastructure is unavailable',
  })
  async prepareMint(
    @Body() dto: CreateMintPreparationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const userId = Number(request.user?.id ?? 0);
    await this.nftMintService.validateClipOwner(dto.clipId, userId);
    return this.nftMintService.prepareMintTx(dto.clipId, dto.walletAddress);
  }
}
