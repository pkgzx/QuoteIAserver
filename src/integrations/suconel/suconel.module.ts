import { Module } from '@nestjs/common';
import { SuconelService } from './suconel.service';

@Module({
  imports: [],
  providers: [SuconelService],
  exports: [SuconelService],
})
export class SuconelModule {}
