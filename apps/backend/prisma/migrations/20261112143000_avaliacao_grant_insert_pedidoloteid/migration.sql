-- Bug encontrado na revisao desta etapa (nao em producao): a migration
-- 20261029183151_avaliacao_grant_insert_por_coluna concedeu INSERT por
-- coluna em Avaliacao ANTES de pedidoLoteId existir (migration
-- 20261112140512). GRANT por coluna nao se estende automaticamente a
-- colunas novas -- sem este fix, app_comprador nao conseguiria inserir
-- NENHUMA Avaliacao, porque pedidoLoteId e NOT NULL e nunca foi
-- concedido. GRANT incremental (soma a coluna ao privilegio de INSERT que
-- app_comprador ja tem nas outras, nao substitui).
GRANT INSERT ("pedidoLoteId") ON "Avaliacao" TO app_comprador;
