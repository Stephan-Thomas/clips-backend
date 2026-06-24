import { Module } from '@nestjs/common';
import { ClipsModule } from '../clips/clips.module';
import { NftController } from './nft.controller';

@Module({
  imports: [ClipsModule],
  controllers: [NftController],
})
export class NftModule {}
