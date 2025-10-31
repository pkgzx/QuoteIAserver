import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RequestVerifyDto } from './dto/request-verify.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Endpoint para solicitar un código OTP
   * POST /api/v1/auth/request-verification
   */
  @Post('request-verification')
  async requestVerification(@Body() data: RequestVerifyDto): Promise<{ message: string }> {
    await this.authService.requestVerification(data);
    return {
      message: 'Código de verificación enviado exitosamente. Revisa tu email.'
    };
  }

  /**
   * Endpoint para verificar el código OTP
   * POST /api/v1/auth/verify-otp
   */
  @Post('verify-otp')
  async verifyOTP(@Body() data: VerifyOtpDto): Promise<{ success: boolean; message: string }> {
    return this.authService.verifyOTP(data);
  }
}
