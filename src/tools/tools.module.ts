import { Module } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { OrmService } from 'src/orm/orm.service';
import { RagService } from 'src/rag/rag.service';
import { OrmModule } from 'src/orm/orm.module';
import { RagModule } from 'src/rag/rag.module';
import { SuconelModule } from 'src/integrations/suconel/suconel.module';
import { QuotationModule } from 'src/quotation/quotation.module';

@Module({
  imports: [OrmModule, RagModule, SuconelModule, QuotationModule],
  controllers: [],
  providers: [ToolsService, OrmService, RagService],
  exports: [ToolsService],
})
export class ToolsModule {}
