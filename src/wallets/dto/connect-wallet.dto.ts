import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConnectWalletDto {
  @ApiProperty({ example: 'GC6XOTK6L6LGBKIWH3IRUZPVUY4COGEMW4J5YINOSPKO27YKTUUHTZF3' })
  @IsString()
  address: string;

  @ApiProperty({ example: 'stellar', enum: ['stellar'] })
  @IsIn(['stellar'])
  chain: string;

  @ApiProperty({ example: 'freighter', enum: ['freighter', 'albedo', 'lobstr'] })
  @IsIn(['freighter', 'albedo', 'lobstr'])
  type: string;
}
