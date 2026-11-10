import { Body, Controller, Get, Inject, Post, UseGuards, UsePipes } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DbRoleMeta } from '../common/db-role.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import {
  CadastroCompradorSchema,
  CadastroFornecedorSchema,
  type CadastroCompradorDto,
  type CadastroFornecedorDto,
} from './dto/cadastro.dto';
import { LoginSchema, type LoginDto } from './dto/login.dto';
import { RefreshSchema, type RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentPrincipal, type Principal } from '../common/principal';

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('cadastro/comprador')
  @DbRoleMeta('app_auth')
  @UsePipes(new ZodValidationPipe(CadastroCompradorSchema))
  cadastrarComprador(@Body() dto: CadastroCompradorDto) {
    return this.auth.cadastrarComprador(dto);
  }

  @Post('cadastro/fornecedor')
  @DbRoleMeta('app_auth')
  @UsePipes(new ZodValidationPipe(CadastroFornecedorSchema))
  cadastrarFornecedor(@Body() dto: CadastroFornecedorDto) {
    return this.auth.cadastrarFornecedor(dto);
  }

  @Post('login')
  @DbRoleMeta('app_auth')
  @UsePipes(new ZodValidationPipe(LoginSchema))
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @DbRoleMeta('app_auth')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @DbRoleMeta('app_auth')
  @UsePipes(new ZodValidationPipe(RefreshSchema))
  async logout(@Body() dto: RefreshDto) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  // Sem @DbRoleMeta -- usa o padrao do interceptor (app_comprador), que e
  // exatamente o que este endpoint precisa provar: login -> token -> RLS
  // validado na mesma chamada.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentPrincipal() principal: Principal) {
    return this.auth.meComprador(principal.perfilId!);
  }
}
