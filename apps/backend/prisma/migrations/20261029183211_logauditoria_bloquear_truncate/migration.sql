-- Fecha o gap apontado na revisao do PR #1: os triggers BEFORE UPDATE/DELETE
-- (migration usuario_check_papel_perfil_e_logauditoria_imutavel) sao de LINHA
-- (FOR EACH ROW) -- triggers de linha NAO disparam em TRUNCATE no Postgres.
-- Precisa de um trigger de ESTATEMENT dedicado, com uma funcao propria (a
-- funcao de UPDATE/DELETE referencia OLD.id, que nao existe em contexto de
-- TRUNCATE).
CREATE OR REPLACE FUNCTION fn_log_auditoria_bloquear_truncate()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'LogAuditoria e append-only: TRUNCATE em % nao e permitido', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER trg_log_auditoria_bloquear_truncate
  BEFORE TRUNCATE ON "LogAuditoria"
  FOR EACH STATEMENT EXECUTE FUNCTION fn_log_auditoria_bloquear_truncate();

-- REVOKE de TRUNCATE -- antes, a tabela so estava protegida de TRUNCATE por
-- NINGUEM ter recebido esse privilegio ainda (protecao incidental); isto
-- torna explicito, no mesmo padrao defensivo do REVOKE de UPDATE/DELETE.
REVOKE TRUNCATE ON "LogAuditoria" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_comprador') THEN
    EXECUTE 'REVOKE TRUNCATE ON "LogAuditoria" FROM app_comprador';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_service') THEN
    EXECUTE 'REVOKE TRUNCATE ON "LogAuditoria" FROM app_service';
  END IF;
END
$$;
