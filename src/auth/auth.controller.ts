import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';

/**
 * Auth Controller
 * Nota: Los endpoints de verificación han sido removidos.
 * La autenticación ahora se maneja directamente en las conversaciones.
 */
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Los endpoints de verificación han sido removidos
  // La autenticación se hace ahora a través del flujo conversacional
}
