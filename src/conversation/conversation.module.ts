import { Module } from '@nestjs/common';
import { ConversationService } from './conversation.service';
import { ConversationController } from './conversation.controller';
import { OrmModule } from '../orm/orm.module';
import { EmailModule } from '../email/email.module';
import { ToolsModule } from '../tools/tools.module';

@Module({
  imports: [OrmModule, EmailModule, ToolsModule],
  controllers: [ConversationController],
  providers: [ConversationService],
})
export class ConversationModule {}