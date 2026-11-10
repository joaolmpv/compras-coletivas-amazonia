import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    // Deixa o ZodError subir -- o HttpExceptionFilter formata no envelope padrao.
    return this.schema.parse(value);
  }
}
