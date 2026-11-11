import { SetMetadata } from '@nestjs/common';

export const DB_ROLE_KEY = 'dbRole';

/** Roles de banco que o RlsInterceptor sabe assumir via SET LOCAL ROLE. */
export type DbRole = 'app_auth' | 'app_comprador' | 'app_service' | 'app_fornecedor';

/**
 * Marca um controller/rota com o role de banco que a requisicao deve
 * assumir. Sem essa marca, o RlsInterceptor assume 'app_comprador' (o
 * caminho mais comum -- rotas de negocio autenticadas como comprador).
 */
export const DbRoleMeta = (role: DbRole) => SetMetadata(DB_ROLE_KEY, role);
