import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProdutosController } from './produtos.controller';
import { ProdutosService } from './produtos.service';
import { FornecedoresController } from './fornecedores.controller';
import { FornecedoresService } from './fornecedores.service';
import { HubsController } from './hubs.controller';
import { HubsService } from './hubs.service';
import { DisponibilidadesController } from './disponibilidades.controller';
import { DisponibilidadesService } from './disponibilidades.service';

@Module({
  // AuthModule exporta JwtAuthGuard -- os controllers daqui usam
  // @UseGuards(JwtAuthGuard) nas rotas de escrita (fornecedor autenticado),
  // e o guard em si depende de JwtService (registrado dentro de AuthModule).
  imports: [AuthModule],
  controllers: [ProdutosController, FornecedoresController, HubsController, DisponibilidadesController],
  providers: [ProdutosService, FornecedoresService, HubsService, DisponibilidadesService],
})
export class CatalogoModule {}
