import { Inject, Injectable } from '@nestjs/common';
import { CourierClient } from '@trycourier/courier';
import { COURIER_CLIENT } from './courier.module';

@Injectable()
export class EmailService {
  constructor(
    @Inject(COURIER_CLIENT)
    private readonly courierClient: CourierClient){}

  /**
   * Envía un email genérico
   */
  async sendEmail(email: string, title: string, body: string){
    await this.courierClient.send({
      message: {
        to: {
          email
        },
        content: {
          title,
          body
        },
        routing: {
          method: "single",
          channels: ["email"],
        },
      }
    })
  }

  /**
   * Envía un código OTP por email con un template mejorado
   */
   async sendOTPEmail(email: string, otpCode: number, expirationMinutes: number = 5, userName?: string): Promise<void> {
    const templateId = process.env.COURIER_TEMPLATE_OTP || 'REPLACE_WITH_TEMPLATE_ID';
    const data = { otpCode: String(otpCode), expirationMinutes: String(expirationMinutes), userName };


    await this.courierClient.send({
      message: {
        to: { email },
        // usar template + data; casteamos a any para evitar errores de tipos
        template:  templateId ,
        data,
        routing: {
          method: "single",
          channels: ["email"],
        },
      } as any,
    });
  }

  /**
   * Genera el template HTML para el email del OTP
   */
  private getOTPEmailTemplate(otpCode: number, expirationMinutes: number): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h1 style="color: #333; text-align: center; margin-bottom: 20px;">
            Código de Verificación
          </h1>

          <p style="color: #666; font-size: 16px; line-height: 1.5; margin-bottom: 30px;">
            Has solicitado un código de verificación para acceder a tu cuenta.
            Utiliza el siguiente código para completar tu autenticación:
          </p>

          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0;">
            <h2 style="color: #4a90e2; font-size: 36px; letter-spacing: 8px; margin: 0;">
              ${otpCode}
            </h2>
          </div>

          <p style="color: #666; font-size: 14px; line-height: 1.5; margin-top: 30px;">
            <strong> Este código expirará en ${expirationMinutes} minutos.</strong>
          </p>

          <p style="color: #666; font-size: 14px; line-height: 1.5;">
            Si no solicitaste este código, puedes ignorar este mensaje de forma segura.
          </p>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

          <p style="color: #999; font-size: 12px; text-align: center;">
            ShoppingIA - Sistema de Gestión de Compras
          </p>
        </div>
      </div>
    `;
  }
}
