import { Controller, Post, Body, Req, UseGuards, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TransactionsService } from './transactions.service';
import { SendTransactionDto } from './dto/send-transaction.dto';

@ApiTags('transactions')
@ApiBearerAuth('access-token')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Send XLM from the user\'s custodial wallet',
    description: 'Backend builds, signs, and submits the Stellar transaction. Frontend only provides amount + destination.',
  })
  @ApiResponse({ status: 201, description: 'Transaction submitted, returns hash' })
  @ApiResponse({ status: 400, description: 'Invalid destination or amount' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'No custodial wallet found' })
  async send(
    @Req() req: any,
    @Body(new ValidationPipe({ transform: true })) dto: SendTransactionDto,
  ) {
    return this.transactionsService.send(req.user.userId, dto);
  }
}
