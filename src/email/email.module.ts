import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { CourierModule } from './courier.module';

@Module({
  imports: [CourierModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}