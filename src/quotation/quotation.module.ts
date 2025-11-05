import { Module } from '@nestjs/common';
import { QuotationService } from './quotation.service';
import { QuotationController } from './quotation.controller';
import { OrmModule } from '../orm/orm.module';

@Module({
  imports: [OrmModule],
  providers: [QuotationService],
  controllers: [QuotationController],
  exports: [QuotationService],
})
export class QuotationModule {}
