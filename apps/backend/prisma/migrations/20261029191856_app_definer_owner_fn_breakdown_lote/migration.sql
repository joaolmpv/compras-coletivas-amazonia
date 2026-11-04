-- app_definer passa a ser o dono de fn_breakdown_lote, substituindo
-- postgres (superuser) -- a funcao e SECURITY DEFINER e so precisa de
-- SELECT em PedidoLote, nao de privilegio de superuser algum. Ate aqui
-- (E1), ela rodava com privilegios de superuser so porque foi criada por
-- quem roda as migrations -- classico excesso de privilegio numa
-- SECURITY DEFINER.
ALTER FUNCTION fn_breakdown_lote(text) OWNER TO app_definer;

GRANT SELECT ON "PedidoLote" TO app_definer;

-- PedidoLote tem FORCE ROW LEVEL SECURITY -- sem politica, app_definer
-- (nao superuser) nao veria nenhuma linha mesmo tendo SELECT, e a funcao
-- (que roda com os privilegios de app_definer por ser SECURITY DEFINER)
-- precisa ver TODAS as linhas do lote pra montar o agregado.
CREATE POLICY app_definer_select ON "PedidoLote"
  FOR SELECT TO app_definer USING (true);

-- Nota: EXECUTE em fn_breakdown_lote para app_comprador ja foi concedido
-- nas migrations anteriores (fn_breakdown_lote,
-- fn_breakdown_lote_fail_closed_e_participante) e nao muda com a troca de
-- dono -- privilegio de EXECUTE e independente de ownership.
