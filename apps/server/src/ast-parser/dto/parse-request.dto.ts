import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class ParseRequestDto {
  @Transform(({ value }: TransformFnParams): unknown => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'directoryPath must be a string' })
  @IsNotEmpty({ message: 'directoryPath is required and must not be empty' })
  directoryPath!: string;
}