import { Module } from "@nestjs/common";
import { AuthModule } from './auth/auth.module';
import { OrmModule } from "./orm/orm.module";
import { SeederModule } from "./seeder/seeder.module";
import { EmailModule } from './email/email.module';

@Module({
  imports: [AuthModule, OrmModule, SeederModule, EmailModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
