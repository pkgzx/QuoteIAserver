import { Module } from '@nestjs/common';
import { RagService } from './rag.service';
import { OrmService } from 'src/orm/orm.service';

@Module({
  controllers: [],
  providers: [RagService, OrmService],
})
export class RagModule {}
