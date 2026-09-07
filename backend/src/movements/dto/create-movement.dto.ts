import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MovementType } from '@prisma/client';

/**
 * Enforces the direction rules as a *validation* concern, so an ill-formed request is
 * rejected with 400 before the service ever opens a transaction:
 *   IN       -> toLocId required, fromLocId forbidden
 *   OUT      -> fromLocId required, toLocId forbidden
 *   TRANSFER -> both required and distinct
 */
@ValidatorConstraint({ name: 'movementShape', async: false })
export class MovementShapeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateMovementDto;
    const from = dto.fromLocId ?? null;
    const to = dto.toLocId ?? null;
    switch (dto.type) {
      case MovementType.IN:
        return Boolean(to) && !from;
      case MovementType.OUT:
        return Boolean(from) && !to;
      case MovementType.TRANSFER:
        return Boolean(from) && Boolean(to) && from !== to;
      default:
        return true;
    }
  }

  defaultMessage(args: ValidationArguments): string {
    const dto = args.object as CreateMovementDto;
    switch (dto.type) {
      case MovementType.IN:
        return 'An IN movement requires toLocId and must not set fromLocId.';
      case MovementType.OUT:
        return 'An OUT movement requires fromLocId and must not set toLocId.';
      case MovementType.TRANSFER:
        return 'A TRANSFER requires both fromLocId and toLocId, and they must differ.';
      default:
        return 'type must be one of IN, OUT, TRANSFER.';
    }
  }
}

export class CreateMovementDto {
  @IsEnum(MovementType, { message: 'type must be one of IN, OUT, TRANSFER' })
  @Validate(MovementShapeConstraint)
  type!: MovementType;

  @IsString()
  @IsNotEmpty({ message: 'itemId must not be empty' })
  itemId!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'fromLocId must not be empty' })
  fromLocId?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'toLocId must not be empty' })
  toLocId?: string | null;

  @Type(() => Number)
  @IsInt({ message: 'qty must be a whole number' })
  @Min(1, { message: 'qty must be at least 1' })
  qty!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string | null;
}
