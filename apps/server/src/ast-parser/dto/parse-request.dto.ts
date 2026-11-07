import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class ParseRequestDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'directoryPath must be a string' })
  @IsNotEmpty({ message: 'directoryPath is required and must not be empty' })
  directoryPath!: string;
}