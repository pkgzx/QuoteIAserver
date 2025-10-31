import { Module, Global } from '@nestjs/common';
import { CourierClient } from '@trycourier/courier';

export const COURIER_CLIENT = 'COURIER_CLIENT';

@Global() 
@Module({
  providers: [
    {
      provide: COURIER_CLIENT,
      useFactory: () => {
        return new CourierClient({
          authorizationToken: process.env.COURIER_API_KEY!,
        });
      },
    },
  ],
  exports: [COURIER_CLIENT],
})
export class CourierModule {}