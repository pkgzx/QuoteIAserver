import { Module } from '@nestjs/common';
import { MercadolibreService } from './mercadolibre.service';

@Module({
  imports: [],
  providers: [MercadolibreService],
  exports: [MercadolibreService],
})
export class MercadolibreModule {}
