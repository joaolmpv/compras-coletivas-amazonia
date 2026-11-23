-- Decisao de produto 23/11/2026: fornecedor e comprador sempre expressam
-- quantidade em UNIDADE COMERCIAL do produto (ex: "20 sacos"), nunca
-- direto em m3/kg. O sistema converte nos dois pontos que precisam de
-- unidade fisica: rateio (m3) e custo de frete do otimizador (kg, peso
-- cubado = max(pesoReal, volumeM3 x fator_cubagem) -- essa formula fica
-- no microsservico de otimizacao, nao aqui).
--
-- Escrita a mao (nao via `prisma migrate dev` interativo): colunas NOT
-- NULL novas pedem confirmacao interativa, e Produto/DisponibilidadeFornecedor/
-- PedidoLote estao vazias no banco local -- sem risco de dado real em
-- nenhuma das operacoes abaixo (rename, add column, recriacao de funcao).

-- =============================================================================
-- Produto: preco renomeado pra deixar explicito que e por unidadeComercial
-- (nao por kg/m3), e os 3 campos novos que definem essa unidade.
-- =============================================================================
ALTER TABLE "Produto" RENAME COLUMN "unitPrice" TO "precoPorUnidade";

ALTER TABLE "Produto" ADD COLUMN "unidadeComercial" TEXT NOT NULL;
ALTER TABLE "Produto" ADD COLUMN "pesoPorUnidadeKg" DOUBLE PRECISION NOT NULL;
ALTER TABLE "Produto" ADD COLUMN "volumePorUnidadeM3" DOUBLE PRECISION NOT NULL;

ALTER TABLE "Produto" ADD CONSTRAINT "Produto_pesoPorUnidadeKg_positivo" CHECK ("pesoPorUnidadeKg" > 0);
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_volumePorUnidadeM3_positivo" CHECK ("volumePorUnidadeM3" > 0);

-- =============================================================================
-- DisponibilidadeFornecedor: quantidadeMinimaM3/quantidadeMaximaM3 (migration
-- 20261112150000) ficou errado -- essas colunas passam a guardar uma
-- CONTAGEM de unidadeComercial do produto, nao m3 direto. RENAME COLUMN
-- preserva o CHECK (DisponibilidadeFornecedor_min_le_max) e o GRANT por
-- coluna automaticamente -- Postgres rastreia os dois por attnum, nao por
-- texto do nome (mesmo raciocinio da migration anterior que fez este
-- mesmo tipo de rename).
-- =============================================================================
ALTER TABLE "DisponibilidadeFornecedor" RENAME COLUMN "quantidadeMinimaM3" TO "quantidadeMinima";
ALTER TABLE "DisponibilidadeFornecedor" RENAME COLUMN "quantidadeMaximaM3" TO "quantidadeMaxima";

-- =============================================================================
-- PedidoLote: volumeM3 (E1) tambem ficou errado pelo mesmo motivo -- o
-- comprador declara "quero 10 sacos" na adesao, nao "quero 2 m3" direto.
-- costShare (R$) nao muda. GRANT por coluna em "volumeM3"
-- (migrations 20261028174729 e 20261028174929) e preservado automaticamente
-- pelo RENAME, igual ao CHECK acima.
-- =============================================================================
ALTER TABLE "PedidoLote" RENAME COLUMN "volumeM3" TO "quantidade";

-- =============================================================================
-- fn_breakdown_lote (SECURITY DEFINER) le PedidoLote."volumeM3" direto no
-- corpo -- precisa ser recriada, senao quebra em runtime (coluna nao
-- existe mais com esse nome). Coluna de SAIDA tambem renomeada de
-- volume_m3 pra quantidade -- deixar o alias antigo seria mentir sobre o
-- que o dado representa agora (nao e mais m3, e uma contagem de unidade
-- comercial). Conversao pra m3 de verdade (via produto.volumePorUnidadeM3)
-- fica para quando o endpoint de breakdown for exposto na aplicacao (E4) --
-- nao faz parte desta migration.
--
-- DROP + CREATE (nao CREATE OR REPLACE): mudar o nome de uma coluna de
-- RETURNS TABLE e tratado como mudanca de tipo de retorno pelo Postgres,
-- que CREATE OR REPLACE FUNCTION nao permite -- precisa dropar antes.
-- Isso perde ownership/grants do objeto antigo, por isso sao reaplicados
-- depois, exatamente como estavam (ver prisma/tests/rls-isolation.sql
-- caso 11a, que confere isso).
DROP FUNCTION fn_breakdown_lote(text);

CREATE FUNCTION fn_breakdown_lote(p_lote_id text)
RETURNS TABLE (
  comprador_id text,
  quantidade double precision,
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
    RETURN; -- fail-closed
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public."PedidoLote" pl
    WHERE pl."loteId" = p_lote_id AND pl."compradorId" = v_comprador_id
  ) THEN
    RETURN; -- comprador nao participa deste lote
  END IF;

  RETURN QUERY
  SELECT
    CASE
      WHEN pl."compradorId" = v_comprador_id THEN pl."compradorId"
      ELSE NULL
    END,
    pl."quantidade",
    pl."costShare"
  FROM public."PedidoLote" pl
  WHERE pl."loteId" = p_lote_id;
END;
$$;

ALTER FUNCTION fn_breakdown_lote(text) OWNER TO app_definer;
REVOKE ALL ON FUNCTION fn_breakdown_lote(text) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_comprador') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION fn_breakdown_lote(text) TO app_comprador';
  END IF;
END
$$;
