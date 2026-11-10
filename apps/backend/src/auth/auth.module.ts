import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      // `as any`: @nestjs/jwt tipa expiresIn com o StringValue da lib `ms`,
      // mais estrito que `string` -- aceita o mesmo formato em runtime.
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any },
    }),
  ],
  controllers: [AuthController],
  // DbContextService NAO e provido aqui -- vem do CommonModule (@Global(),
  // importado uma unica vez em AppModule) para garantir a mesma instancia
  // request-scoped que o RlsInterceptor usa.
  providers: [AuthService, JwtAuthGuard],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
