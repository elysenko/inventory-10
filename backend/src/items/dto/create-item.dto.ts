import { Transform, Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Trim before validating so a whitespace-only SKU fails `@IsNotEmpty`. */
export const trimValue = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateItemDto {
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'sku must not be empty' })
  @MaxLength(64)
  sku!: string;

  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(2000)
  description?: string;

  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'unit must not be empty' })
  @MaxLength(32)
  unit!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reorderAt must be an integer' })
  @Min(0, { message: 'reorderAt must not be negative' })
  reorderAt?: number;
}
