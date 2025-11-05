import { Injectable, NotFoundException, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { RequestVerifyDto } from './dto/request-verify.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { OrmService } from 'src/orm/orm.service';
import { EmailService } from 'src/email/email.service';
import { generateOTP, getOTPExpirationDate, isOTPExpired } from 'src/utils/otp.util';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRATION_MINUTES = 5;

  constructor(
    private readonly prismaService: OrmService,
    private readonly emailService: EmailService
  ) {}

  /**
   * Solicita un código de verificación OTP
   * - Si existe un OTP válido (no expirado), reutiliza el mismo
   * - Si no existe o expiró, genera uno nuevo
   */
  async requestVerification(data: RequestVerifyDto): Promise<void> {
    const { email } = data;

    // Buscar usuario por email
    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si existe un OTP válido (no expirado)
    const hasValidOTP = user.otp && user.otpExpiresAt && !isOTPExpired(user.otpExpiresAt);

    let otpCode: number;
    let expiresAt: Date;

    if (hasValidOTP) {
      // Reutilizar el OTP existente
      otpCode = user.otp!;
      expiresAt = user.otpExpiresAt!;
    } else {
      // Generar nuevo OTP
      otpCode = generateOTP();
      expiresAt = getOTPExpirationDate(this.OTP_EXPIRATION_MINUTES);

      // Guardar OTP en la base de datos
      await this.prismaService.user.update({
        where: { email },
        data: {
          otp: otpCode,
          otpExpiresAt: expiresAt,
        },
      });

    }

    // Enviar el código por email
    try {
      await this.emailService.sendOTPEmail(email, otpCode, this.OTP_EXPIRATION_MINUTES);
    } catch (error) {
      console.error('Error al enviar email:', error);
      throw new BadRequestException('Error al enviar el código de verificación');
    }
  }

  /**
   * Verifica el código OTP proporcionado por el usuario
   */
  async verifyOTP(data: VerifyOtpDto): Promise<{ success: boolean; message: string }> {
    const { email, otpCode } = data;

    // Buscar usuario por email
    const user = await this.prismaService.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Verificar si existe un OTP
    if (!user.otp || !user.otpExpiresAt) {
      throw new BadRequestException('No hay código de verificación pendiente. Solicita uno nuevo.');
    }

    // Verificar si el OTP ha expirado
    if (isOTPExpired(user.otpExpiresAt)) {
      // Limpiar el OTP expirado
      await this.clearOTP(email);
      throw new UnauthorizedException('El código de verificación ha expirado. Solicita uno nuevo.');
    }

    // Verificar si el código coincide
    const providedOTP = parseInt(otpCode, 10);
    if (user.otp !== providedOTP) {
      throw new UnauthorizedException('Código de verificación inválido');
    }

    // OTP válido - limpiar de la base de datos
    await this.clearOTP(email);

    return {
      success: true,
      message: 'Verificación exitosa',
    };
  }

  /**
   * Limpia el OTP de la base de datos
   */
  private async clearOTP(email: string): Promise<void> {
    await this.prismaService.user.update({
      where: { email },
      data: {
        otp: null,
        otpExpiresAt: null,
      },
    });
  }
}
