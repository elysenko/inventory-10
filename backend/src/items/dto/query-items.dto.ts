import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Anything that is not the literal `true` reads as "no low-stock filter" — never a 500. */
const toBool = ({ value }: { value: unknown }): boolean =>
  value === true || value === 'true' || value === '1';

export class QueryItemsDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @Transform(toBool)
  low?: boolean;
}
