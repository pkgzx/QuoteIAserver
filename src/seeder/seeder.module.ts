import { Module } from '@nestjs/common';
import { OrmService } from 'src/orm/orm.service';
import { SeederService } from './seeder.service';

@Module({
  controllers: [],
  providers: [OrmService, SeederService],
})
export class SeederModule {}
