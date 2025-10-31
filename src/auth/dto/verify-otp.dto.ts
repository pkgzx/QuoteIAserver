import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'El código OTP debe tener exactamente 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'El código OTP debe contener solo números' })
  otpCode: string;
}