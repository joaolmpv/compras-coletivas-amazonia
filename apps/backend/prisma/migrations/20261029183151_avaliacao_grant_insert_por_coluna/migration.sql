-- GRANT INSERT por coluna em Avaliacao: app_comprador registra uma avaliacao,
-- mas nao preenche sentimentScore -- esse campo e calculado de forma
-- assincrona pela analise de sentimento (OE4) e escrito pelo backend
-- (app_service, quando existir), nunca pelo comprador na hora do POST
-- /avaliacoes. Mesmo padrao de PedidoLote/costShare (ver
-- pedidolote_grants_por_coluna).
--
-- Colunas que ficam (tudo exceto sentimentScore): id, fornecedorId,
-- compradorId, rating, comment, createdAt. createdAt tem DEFAULT
-- CURRENT_TIMESTAMP no Postgres, mas incluimos no GRANT mesmo assim --
-- diferente de "id" (sem default no banco, sempre enviado explicito pelo
-- Prisma Client), createdAt normalmente nao seria enviado explicitamente,
-- mas conceder a coluna nao tem custo de seguranca (nao e um dado sensivel
-- como costShare/sentimentScore) e evita depender de nunca enviar esse
-- campo no futuro.
REVOKE INSERT ON "Avaliacao" FROM app_comprador;
GRANT INSERT ("id", "fornecedorId", "compradorId", "rating", "comment", "createdAt")
  ON "Avaliacao" TO app_comprador;
-- sentimentScore fica de fora.
