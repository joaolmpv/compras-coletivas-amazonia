import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { DbRoleMeta } from './common/db-role.decorator';

// Scaffold original do Nest ("Hello World"), nunca parte do produto --
// precisou de @DbRoleMeta so porque o RlsInterceptor e global e passou a
// exigir a marca em TODA rota desde 23/11/2026 (sem default implicito).
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @DbRoleMeta('app_comprador')
  getHello(): string {
    return this.appService.getHello();
  }
}
