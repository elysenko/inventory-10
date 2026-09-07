import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimValue } from '../../items/dto/create-item.dto';

export class CreateLocationDto {
  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'name must not be empty' })
  @MaxLength(120)
  name!: string;

  @Transform(trimValue)
  @IsString()
  @IsNotEmpty({ message: 'zone must not be empty' })
  @MaxLength(64)
  zone!: string;
}
