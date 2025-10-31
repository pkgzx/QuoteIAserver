import { Module } from '@nestjs/common';
import { OrmService } from './orm.service';

@Module({
  controllers: [],
  providers: [OrmService],
})
export class OrmModule {}
