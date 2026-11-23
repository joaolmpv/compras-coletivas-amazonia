import { SetMetadata } from '@nestjs/common';

export const DB_ROLE_KEY = 'dbRole';

/** Roles de banco que o RlsInterceptor sabe assumir via SET LOCAL ROLE. */
export type DbRole = 'app_auth' | 'app_comprador' | 'app_service' | 'app_fornecedor' | 'app_admin';

/**
 * Marca um controller/rota com o role de banco que a requisicao deve
 * assumir. OBRIGATORIO -- decisao revisada em 23/11/2026: antes disso o
 * RlsInterceptor assumia 'app_comprador' em silencio quando a marca
 * faltava; agora a falta dela e erro de configuracao (500), nunca um
 * default implicito. Toda rota publica (catalogo, GET /auth/me) declara
 * @DbRoleMeta('app_comprador') explicitamente, mesmo sendo o mesmo role
 * que seria o "default" antigo.
 */
export const DbRoleMeta = (role: DbRole) => SetMetadata(DB_ROLE_KEY, role);
