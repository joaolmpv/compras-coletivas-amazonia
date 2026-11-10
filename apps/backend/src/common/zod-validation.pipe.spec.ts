import { z, ZodError } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const schema = z.object({ email: z.string().email() });
  const pipe = new ZodValidationPipe(schema);

  it('retorna o valor parseado quando valido', () => {
    const resultado = pipe.transform({ email: 'a@example.com' }, {} as never);
    expect(resultado).toEqual({ email: 'a@example.com' });
  });

  it('lanca ZodError quando invalido', () => {
    expect(() => pipe.transform({ email: 'nao-e-email' }, {} as never)).toThrow(ZodError);
  });
});
