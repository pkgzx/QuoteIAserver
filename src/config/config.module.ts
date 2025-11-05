import { Global, Module } from '@nestjs/common';
import { EnvironmentConfig } from './environment.config';

/**
 * Global configuration module
 * Makes EnvironmentConfig available throughout the application
 */
@Global()
@Module({
  providers: [EnvironmentConfig],
  exports: [EnvironmentConfig],
})
export class ConfigModule {}
