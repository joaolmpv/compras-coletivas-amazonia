import { Global, Module } from '@nestjs/common';
import { DbContextService } from './db-context.service';

/**
 * @Global() + registrado so AQUI: garante que o RlsInterceptor (global, em
 * AppModule) e os services de cada feature module recebem a MESMA
 * instancia de DbContextService por requisicao -- se fosse declarado em
 * mais de um module, cada um criaria sua propria instancia request-scoped,
 * e o `tx` setado pelo interceptor nunca apareceria pro service.
 */
@Global()
@Module({
  providers: [DbContextService],
  exports: [DbContextService],
})
export class CommonModule {}
