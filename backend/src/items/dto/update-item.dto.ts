import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { trimValue } from './create-item.dto';

/**
 * Every field optional, but a *supplied* field is validated: `{sku: ""}` is a 400,
 * while `{}` is an accepted no-op.
 */
export class UpdateItemDto {
  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'sku must not be empty' })
  @MaxLength(64)
  sku?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'unit must not be empty' })
  @MaxLength(32)
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reorderAt must be an integer' })
  @Min(0, { message: 'reorderAt must not be negative' })
  reorderAt?: number;
}
