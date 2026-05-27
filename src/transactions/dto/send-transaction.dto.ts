import { IsString, IsNotEmpty, IsNumberString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendTransactionDto {
  @ApiProperty({ description: 'Stellar destination address (G...)' })
  @IsString()
  @IsNotEmpty()
  destination: string;

  @ApiProperty({ description: 'Amount of XLM to send (as string, e.g. "10.5")' })
  @IsNumberString()
  @IsNotEmpty()
  amount: string;
}
