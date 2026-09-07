import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { MovementType } from '@prisma/client';

export const DEFAULT_PAGE_SIZE = 25;
/** Hard ceiling so `?pageSize=100000` can never dump the whole ledger. */
export const MAX_PAGE_SIZE = 200;

export class QueryMovementsDto {
  @IsOptional()
  @IsString()
  itemId?: string;

  @IsOptional()
  @IsEnum(MovementType, { message: 'type must be one of IN, OUT, TRANSFER' })
  type?: MovementType;

  @IsOptional()
  @IsDateString({}, { message: 'from must be an ISO date (YYYY-MM-DD or full ISO-8601)' })
  from?: string;

  @IsOptional()
  @IsDateString({}, { message: 'to must be an ISO date (YYYY-MM-DD or full ISO-8601)' })
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page must be at least 1' })
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize must be a whole number' })
  @Min(1, { message: 'pageSize must be at least 1' })
  @Max(MAX_PAGE_SIZE, { message: `pageSize must not exceed ${MAX_PAGE_SIZE}` })
  pageSize?: number;
}
