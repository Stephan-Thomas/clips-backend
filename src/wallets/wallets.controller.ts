import {
  Controller,
  Post,
  Delete,
  Param,
  ParseIntPipe,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WalletOwnershipGuard } from './guards/wallet-ownership.guard';
import { WalletsService } from './wallets.service';
import { ConnectWalletDto } from './dto/connect-wallet.dto';

@ApiTags('wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Post('connect')
  @Throttle({ walletConnect: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Connect a Stellar wallet' })
  connect(@Req() req: Request & { user: { userId: number } }, @Body() dto: ConnectWalletDto) {
    return this.walletsService.connect(req.user.userId, dto);
  }

  @Delete(':id')
  @UseGuards(WalletOwnershipGuard)
  @Throttle({ walletDisconnect: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Disconnect (soft-delete) a wallet' })
  disconnect(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { user: { userId: number } },
  ) {
    return this.walletsService.disconnect(id, req.user.userId);
  }
}
