-- E1 -- parte 2: invariantes que o schema.prisma nao consegue expressar.
--
-- (a) Usuario: consistencia papel <-> perfil. Prisma nao tem CHECK
-- cross-column nativo -- ver design-backend.md secao 3.1.
ALTER TABLE "Usuario" ADD CONSTRAINT usuario_papel_perfil_consistente CHECK (
  (role = 'COMPRADOR' AND "compradorId" IS NOT NULL AND "fornecedorId" IS NULL) OR
  (role = 'FORNECEDOR' AND "fornecedorId" IS NOT NULL AND "compradorId" IS NULL) OR
  (role = 'ADMIN' AND "compradorId" IS NULL AND "fornecedorId" IS NULL)
);

-- (b) LogAuditoria: append-only de verdade (design-backend.md secao 6).
-- Duas camadas independentes -- um bug numa nao depende da outra:
--   1. REVOKE: nenhum role usado em runtime pode UPDATE/DELETE.
--   2. Trigger: mesmo que a camada 1 falhe por erro de configuracao futuro,
--      a tentativa de mutar uma linha ainda e bloqueada, e de forma RUIDOSA
--      (lanca excecao), nao silenciosa.
--
-- A logica de ESCRITA (hash encadeado + advisory lock) e aplicacao, nao
-- banco -- fica para a E6. Esta migration so garante que, uma vez escrita,
-- uma linha nunca muda.

REVOKE UPDATE, DELETE ON "LogAuditoria" FROM PUBLIC;
-- app_comprador e app_service sao revogados explicitamente tambem -- o
-- REVOKE FROM PUBLIC acima nao remove privilegios ja concedidos a um role
-- especifico, mas nenhuma migration anterior concedeu UPDATE/DELETE em
-- LogAuditoria a nenhum dos dois, entao isto e defensivo/documentacional.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_comprador') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON "LogAuditoria" FROM app_comprador';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    EXECUTE 'REVOKE UPDATE, DELETE ON "LogAuditoria" FROM app_service';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION fn_log_auditoria_bloquear_mutacao()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'LogAuditoria e append-only: % em % nao e permitido (id=%)',
    TG_OP, TG_TABLE_NAME, OLD.id;
END;
$$;

CREATE TRIGGER trg_log_auditoria_bloquear_update
  BEFORE UPDATE ON "LogAuditoria"
  FOR EACH ROW EXECUTE FUNCTION fn_log_auditoria_bloquear_mutacao();

CREATE TRIGGER trg_log_auditoria_bloquear_delete
  BEFORE DELETE ON "LogAuditoria"
  FOR EACH ROW EXECUTE FUNCTION fn_log_auditoria_bloquear_mutacao();
