-- Decisao tecnica da E4 ("Avaliacao verificada", DEVELOPMENT.md): uma
-- avaliacao so pode existir ligada a um PedidoLote especifico (1:1, FK
-- unica), e so quando o Lote daquele pedido estiver ENTREGUE -- ou
-- CANCELADO por FORNECEDOR_NAO_DESPACHOU especificamente (nao qualquer
-- cancelamento -- revisado apos a primeira versao desta migration, que
-- liberava tambem FORNECEDOR_RECUSOU e EXPIRACAO_SEM_CONFIRMACAO; esses
-- dois acontecem com o lote ainda CANDIDATO, antes de existir PedidoLote,
-- e recusar/demorar pra responder nao e falha equivalente a aceitar e
-- depois nao despachar -- a demora entra no OE4 pela metrica "tempo medio
-- de resposta", nao por avaliacao textual). Escrita a mao (nao via
-- `prisma migrate dev` interativo): as tabelas Avaliacao/Lote estao
-- vazias no banco local agora, sem risco de dado existente, mas o comando
-- precisa de confirmacao interativa por ser uma coluna NOT NULL nova --
-- mesmo fluxo manual ja usado nas migrations de RLS/roles.

-- CreateEnum
CREATE TYPE "MotivoCancelamento" AS ENUM (
  'FORNECEDOR_RECUSOU',
  'FORNECEDOR_NAO_DESPACHOU',
  'EXPIRACAO_SEM_CONFIRMACAO',
  'DEMANDA_INSUFICIENTE',
  'ADMIN_OVERRIDE'
);

-- AlterTable: motivo so preenchido quando status = CANCELADO -- a maquina
-- de estados completa (quem pode setar isso e quando) e da propria etapa
-- "maquina de estados" da E4, ainda nao implementada; aqui so a coluna.
ALTER TABLE "Lote" ADD COLUMN "motivoCancelamento" "MotivoCancelamento";

-- AlterTable
ALTER TABLE "Avaliacao" ADD COLUMN "pedidoLoteId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Avaliacao_pedidoLoteId_key" ON "Avaliacao"("pedidoLoteId");

-- AddForeignKey
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_pedidoLoteId_fkey" FOREIGN KEY ("pedidoLoteId") REFERENCES "PedidoLote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================================
-- Trigger fn_avaliacao_requer_entregue -- defesa ESTRUTURAL (nao so
-- checagem na aplicacao): libera avaliacao com o lote ENTREGUE, ou
-- CANCELADO especificamente por FORNECEDOR_NAO_DESPACHOU (ver nota no
-- topo do arquivo sobre por que FORNECEDOR_RECUSOU/EXPIRACAO_SEM_
-- CONFIRMACAO/DEMANDA_INSUFICIENTE/ADMIN_OVERRIDE NAO liberam). Roda em
-- qualquer INSERT/UPDATE em Avaliacao,
-- venha de onde vier (app_comprador hoje; app_service no futuro, quando a
-- OE4 ganhar GRANT UPDATE em sentimentScore -- AINDA NAO CONCEDIDO, ver
-- nota abaixo).
--
-- Qualificacao public."Tabela" + SET search_path = public, pg_temp: MESMA
-- defesa de fn_breakdown_lote (migration
-- 20261029183122_fn_breakdown_lote_fail_closed_e_participante) contra uma
-- sessao criar `CREATE TEMP TABLE "PedidoLote" (...)` pra enganar a
-- funcao -- as duas tecnicas juntas (nomes qualificados + search_path
-- explicito) sao redundantes de proposito.
--
-- BEFORE INSERT OR UPDATE (nao so INSERT): cobre o dia em que algum role
-- ganhar UPDATE nesta tabela. Na UPDATE, alem de reexigir a mesma
-- elegibilidade do Lote, TRAVA pedidoLoteId/compradorId/fornecedorId/
-- rating/comment como imutaveis -- so sentimentScore pode mudar depois do
-- INSERT. Isso reforca no banco o que o GRANT por coluna (quando existir)
-- vai dizer, em vez de confiar so nele.
CREATE OR REPLACE FUNCTION fn_avaliacao_requer_entregue()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status "StatusLote";
  v_motivo "MotivoCancelamento";
  v_comprador_id TEXT;
  v_fornecedor_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."pedidoLoteId" IS DISTINCT FROM OLD."pedidoLoteId"
       OR NEW."compradorId" IS DISTINCT FROM OLD."compradorId"
       OR NEW."fornecedorId" IS DISTINCT FROM OLD."fornecedorId"
       OR NEW."rating" IS DISTINCT FROM OLD."rating"
       OR NEW."comment" IS DISTINCT FROM OLD."comment" THEN
      RAISE EXCEPTION 'avaliacao: so sentimentScore pode ser alterado depois da criacao';
    END IF;
  END IF;

  SELECT l.status, l."motivoCancelamento", pl."compradorId", p."fornecedorId"
    INTO v_status, v_motivo, v_comprador_id, v_fornecedor_id
  FROM public."PedidoLote" pl
  JOIN public."Lote" l ON l.id = pl."loteId"
  JOIN public."Produto" p ON p.id = l."produtoId"
  WHERE pl.id = NEW."pedidoLoteId";

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'avaliacao: pedidoLoteId invalido';
  END IF;

  IF NOT (
    v_status = 'ENTREGUE'
    OR (v_status = 'CANCELADO' AND v_motivo = 'FORNECEDOR_NAO_DESPACHOU')
  ) THEN
    RAISE EXCEPTION 'avaliacao so e permitida com o lote ENTREGUE, ou CANCELADO por FORNECEDOR_NAO_DESPACHOU (status atual: %, motivo: %)', v_status, v_motivo;
  END IF;

  IF NEW."compradorId" <> v_comprador_id THEN
    RAISE EXCEPTION 'avaliacao: compradorId nao corresponde ao dono do pedidoLoteId';
  END IF;

  IF NEW."fornecedorId" <> v_fornecedor_id THEN
    RAISE EXCEPTION 'avaliacao: fornecedorId nao corresponde ao produto do lote';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_avaliacao_requer_entregue
  BEFORE INSERT OR UPDATE ON "Avaliacao"
  FOR EACH ROW EXECUTE FUNCTION fn_avaliacao_requer_entregue();

-- Nota (ponto 2 pedido): app_service hoje NAO tem GRANT algum em Avaliacao
-- -- nem SELECT, nem UPDATE em sentimentScore. A migration
-- 20261029191836_app_service_grants_pedidolote_pagamento_repasse_logauditoria
-- reduziu esse grant explicitamente na aprovacao ("sem Avaliacao.
-- sentimentScore... ficam para E4/OE4, cada um com seu proprio GRANT+teste
-- quando o codigo que os usa existir"). Nao concedido aqui -- fica para a
-- OE4 (secao 6 do DEVELOPMENT.md), quando o calculo de sentimento for
-- implementado de verdade.
