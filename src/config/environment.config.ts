import { Injectable } from '@nestjs/common';

/**
 * Centralized environment configuration service
 * All environment variables should be accessed through this service
 */
@Injectable()
export class EnvironmentConfig {
  // Database
  readonly databaseUrl = this.getRequired('DATABASE_URL');

  // Authentication & Email
  readonly courierApiKey = this.getRequired('COURIER_API_KEY');
  readonly courierTemplateOtp = this.getRequired('COURIER_TEMPLATE_OTP');

  // OpenAI Configuration
  readonly openaiApiKey = this.getRequired('OPENAI_API_KEY');
  readonly openaiBaseUrl =
    process.env.OPENAI_BASE_URL || 'https://models.inference.ai.azure.com';
  readonly openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  readonly embeddingModel =
    process.env.EMBEDDING_MODEL || 'text-embedding-3-small';

  // Application URLs
  readonly frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  readonly backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';
  readonly port = parseInt(process.env.PORT || '3000', 10);

  // Suconel Integration
  readonly suconelBaseUrl =
    process.env.SUCONEL_BASE_URL || 'https://cms.suconel.com/api';
  readonly suconelAuthToken = this.getRequired('SUCONEL_AUTH_TOKEN');

  // MercadoLibre Integration (Optional)
  readonly meliClientId = process.env.MELI_CLIENT_ID;
  readonly meliClientSecret = process.env.MELI_CLIENT_SECRET;
  readonly meliAccessToken = process.env.MELI_ACCESS_TOKEN;
  readonly meliRefreshToken = process.env.MELI_REFRESH_TOKEN;

  /**
   * Helper method to get required environment variables
   * Throws error if variable is not set
   */
  private getRequired(key: string): string {
    const value = process.env[key];
    if (!value) {
      throw new Error(
        `Required environment variable ${key} is not set. Check your .env file.`,
      );
    }
    return value;
  }

  /**
   * Validate all required configuration on application startup
   */
  validateConfig(): void {
    const requiredVars = [
      'DATABASE_URL',
      'COURIER_API_KEY',
      'COURIER_TEMPLATE_OTP',
      'OPENAI_API_KEY',
      'SUCONEL_AUTH_TOKEN',
    ];

    const missing = requiredVars.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}`,
      );
    }
  }
}
