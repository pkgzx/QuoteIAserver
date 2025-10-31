import { IsEmail, IsNotEmpty } from 'class-validator';

export class RequestVerifyDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;
}