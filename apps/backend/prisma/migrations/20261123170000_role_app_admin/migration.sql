-- Role app_admin (decisao 23/11/2026, parte c da revisao do
-- RlsInterceptor): precisa existir antes da primeira rota admin
-- (cancelamento com ADMIN_OVERRIDE, maquina de estados da E4). Mesmo
-- padrao dos outros roles de aplicacao -- NOLOGIN (nunca conecta
-- direto), NOBYPASSRLS (politicas explicitas, nao bypass), NOINHERIT
-- (consistente com os demais, ainda que so passe a importar se algo um
-- dia for membro de app_admin).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_admin') THEN
    CREATE ROLE app_admin NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
END
$$;

GRANT app_admin TO app_backend;

-- =============================================================================
-- Escopo MINIMO -- so o que o primeiro caso de uso conhecido precisa
-- (cancelamento de Lote com motivoCancelamento = ADMIN_OVERRIDE). O
-- resto (Pagamento, Repasse, outras transicoes) entra quando a maquina
-- de estados da E4 definir, cada GRANT com seu proprio teste -- mesmo
-- principio ja seguido pra app_service desde a E1.
-- =============================================================================

-- Lote: admin le qualquer lote (pra decidir a transicao) e so pode
-- mudar status/motivoCancelamento -- nao reescreve produtoId, hubId,
-- totalVolumeM3, totalCost ou dispatchDate por essa via.
CREATE POLICY app_admin_select_lote ON "Lote"
  FOR SELECT TO app_admin USING (true);
CREATE POLICY app_admin_update_lote ON "Lote"
  FOR UPDATE TO app_admin USING (true) WITH CHECK (true);

GRANT SELECT ON "Lote" TO app_admin;
GRANT UPDATE ("status", "motivoCancelamento") ON "Lote" TO app_admin;

-- PedidoLote: so leitura -- admin precisa ver quem esta no lote pra
-- decidir/registrar um cancelamento (auditoria, notificacao futura), mas
-- nao escreve nada ali por essa via.
CREATE POLICY app_admin_select_pedidolote ON "PedidoLote"
  FOR SELECT TO app_admin USING (true);

GRANT SELECT ON "PedidoLote" TO app_admin;
