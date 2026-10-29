-- E1 -- parte 3: GET /lotes/:id/breakdown (design-backend.md secao 4.3).
--
-- SECURITY DEFINER para contornar a politica pedidolote_own (que so deixa
-- cada comprador ver a propria linha) o suficiente para montar o breakdown
-- agregado -- mas sem vazar QUEM sao os outros participantes: a coluna
-- comprador_id so vem preenchida na linha do PROPRIO chamador (comparada
-- contra app.comprador_id da sessao); nas demais linhas vem NULL.
--
-- Dois cuidados de seguranca que uma SECURITY DEFINER "ingenua" costuma
-- esquecer:
--   1. SET search_path = public FIXO na propria funcao -- sem isso, uma
--      SECURITY DEFINER e vulneravel a um search_path malicioso setado
--      pelo chamador antes de invocar a funcao (ataque documentado no
--      manual do Postgres: "Writing SECURITY DEFINER Functions Safely").
--   2. EXECUTE restrito a app_comprador, nao PUBLIC -- admin usa
--      app_service (BYPASSRLS, ainda nao criado nesta etapa), que nao
--      precisa desta funcao porque ja ve tudo sem RLS.
CREATE OR REPLACE FUNCTION fn_breakdown_lote(p_lote_id text)
RETURNS TABLE (
  comprador_id text,
  volume_m3 double precision,
  cost_share double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    CASE
      WHEN pl."compradorId" = current_setting('app.comprador_id', true)
      THEN pl."compradorId"
      ELSE NULL
    END,
    pl."volumeM3",
    pl."costShare"
  FROM "PedidoLote" pl
  WHERE pl."loteId" = p_lote_id;
END;
$$;

REVOKE ALL ON FUNCTION fn_breakdown_lote(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_comprador') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_breakdown_lote(text) TO app_comprador';
  END IF;
END
$$;
