import { Module } from "@nestjs/common";
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { OrmModule } from "./orm/orm.module";
import { SeederModule } from "./seeder/seeder.module";
import { EmailModule } from './email/email.module';
import { RagModule } from './rag/rag.module';
import { ToolsModule } from './tools/tools.module';
import { ConversationModule } from './conversation/conversation.module';
import { SuconelModule } from './integrations/suconel/suconel.module';
import { QuotationModule } from './quotation/quotation.module';

@Module({
  imports: [
    ConfigModule, // Global configuration module
    ScheduleModule.forRoot(),
    AuthModule,
    OrmModule,
    SeederModule,
    EmailModule,
    RagModule,
    ToolsModule,
    ConversationModule,
    SuconelModule,
    QuotationModule,
  ],
})
export class AppModule {}
