import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Validate, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';
import * as fs from 'node:fs';

@ValidatorConstraint({ name: 'isExistingDirectory', async: false })
class IsExistingDirectoryConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string' || !fs.existsSync(value)) return false;

    try {
      return fs.statSync(value).isDirectory();
    } catch {
      return false;
    }
  }

  defaultMessage(): string {
    return 'directoryPath must point to an existing directory';
  }
}

export class ParseRequestDto {
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'directoryPath must be a string' })
  @IsNotEmpty({ message: 'directoryPath is required and must not be empty' })
  @Validate(IsExistingDirectoryConstraint)
  directoryPath!: string;
}
