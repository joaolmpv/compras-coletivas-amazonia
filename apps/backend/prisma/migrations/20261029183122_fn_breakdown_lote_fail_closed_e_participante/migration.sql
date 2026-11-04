-- E1 -- correcao pos-revisao do PR #1 em fn_breakdown_lote. NAO edita a
-- migration original (fn_breakdown_lote/migration.sql, ja aplicada) -- isto
-- e um CREATE OR REPLACE numa migration nova, mesma assinatura e tipo de
-- retorno, entao nao precisa de DROP antes.
--
-- Correcoes:
--   a) fail-closed: sem app.comprador_id (NULL ou string vazia), retorna
--      zero linhas em vez de comparar contra NULL (que ja daria zero por
--      acaso, mas agora e explicito e testado).
--   b) so retorna linhas se o comprador da sessao PARTICIPA do lote --
--      antes, qualquer comprador autenticado conseguia ver o breakdown de
--      QUALQUER lote (so o compradorId dentro das linhas ficava anonimo,
--      mas os totais/volumes de um lote onde ele nao participa nao
--      deveriam ser visiveis para ele de forma alguma).
--   c) qualifica public."PedidoLote" (nao so "PedidoLote") E inclui
--      pg_temp EXPLICITAMENTE no search_path -- as duas coisas juntas.
--      Isso fecha um vetor de ataque real contra SECURITY DEFINER: o
--      schema de tabelas temporarias (pg_temp) e pesquisado ANTES de
--      qualquer search_path configurado, de forma IMPLICITA, A MENOS que
--      pg_temp apareca explicitamente na lista -- nesse caso Postgres
--      respeita a posicao escrita (aqui, depois de public) em vez de
--      prepende-lo automaticamente. Sem isso, um comprador mal-
--      intencionado poderia fazer `CREATE TEMP TABLE "PedidoLote" (...)`
--      na propria sessao antes de chamar a funcao, e uma referencia NAO
--      qualificada a "PedidoLote" dentro da funcao leria a tabela temp
--      falsa dele, nao a real. A qualificacao com public. por si so ja
--      neutraliza isso (nomes qualificados nunca resolvem via search_path),
--      e o search_path explicito e defesa em profundidade redundante.
CREATE OR REPLACE FUNCTION fn_breakdown_lote(p_lote_id text)
RETURNS TABLE (
  comprador_id text,
  volume_m3 double precision,
  cost_share double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_comprador_id text;
BEGIN
  v_comprador_id := NULLIF(current_setting('app.comprador_id', true), '');

  IF v_comprador_id IS NULL THEN
    RETURN; -- (a) fail-closed
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."PedidoLote" pl
    WHERE pl."loteId" = p_lote_id AND pl."compradorId" = v_comprador_id
  ) THEN
    RETURN; -- (b) comprador nao participa deste lote
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN pl."compradorId" = v_comprador_id THEN pl."compradorId"
      ELSE NULL
    END,
    pl."volumeM3",
    pl."costShare"
  FROM public."PedidoLote" pl
  WHERE pl."loteId" = p_lote_id;
END;
$$;

-- (d) reaplica REVOKE/GRANT -- CREATE OR REPLACE nao reseta privilegios (eles
-- sao ligados ao OID da funcao, que nao muda), entao isto e redundante com o
-- que a migration original ja fez, mas reaplicado aqui por completude e para
-- a verificacao no catalogo pedida na revisao.
REVOKE ALL ON FUNCTION fn_breakdown_lote(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_comprador') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_breakdown_lote(text) TO app_comprador';
  END IF;
END
$$;
