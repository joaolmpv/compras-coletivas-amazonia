import { HttpExceptionFilter } from './http-exception.filter';
import { AppException } from './app-exception';
import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { z } from 'zod';

function buildHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('formata AppException no envelope padrao', () => {
    const { host, status, json } = buildHost();
    filter.catch(new AppException('VALIDACAO', 'payload invalido', HttpStatus.BAD_REQUEST), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'VALIDACAO', message: 'payload invalido', details: undefined },
    });
  });

  it('formata ZodError como VALIDACAO 400 com os issues em details', () => {
    const { host, status, json } = buildHost();
    const schema = z.object({ email: z.string().email() });
    const resultado = schema.safeParse({ email: 'invalido' });

    filter.catch(resultado.error, host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'VALIDACAO' }) }),
    );
  });

  it('formata erro desconhecido como 500 ERRO_INTERNO', () => {
    const { host, status, json } = buildHost();
    filter.catch(new Error('algo explodiu'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: { code: 'ERRO_INTERNO', message: 'erro interno' } });
  });
});
