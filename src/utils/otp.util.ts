/**
 * Genera un código OTP aleatorio de 6 dígitos
 * @returns Código OTP numérico de 6 dígitos
 */
export function generateOTP(): number {
  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Calcula la fecha de expiración del OTP
 * @param minutes Minutos hasta la expiración (por defecto 5)
 * @returns Fecha de expiración
 */
export function getOTPExpirationDate(minutes: number = 5): Date {
  const expirationDate = new Date();
  expirationDate.setMinutes(expirationDate.getMinutes() + minutes);
  return expirationDate;
}

/**
 * Verifica si un OTP ha expirado
 * @param expiresAt Fecha de expiración del OTP
 * @returns true si el OTP ha expirado, false en caso contrario
 */
export function isOTPExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  return new Date() > expiresAt;
}
