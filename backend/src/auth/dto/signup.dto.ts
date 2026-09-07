import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SignupDto {
  @Transform(trim)
  @IsEmail({}, { message: 'email must be a valid email address' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters long' })
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  name?: string;
}
