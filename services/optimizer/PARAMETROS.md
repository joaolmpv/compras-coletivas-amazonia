# Parâmetros do experimento OE1 — fonte ou premissa

Todo parâmetro usado em `custo.py` e `instancias.py` está listado aqui. Nenhum
valor com impacto no resultado foi inventado silenciosamente: ou tem fonte
citável, ou está marcado como premissa (e por quê é uma premissa razoável).

## Custo por modal

| Parâmetro | Valor | Status | Fonte / justificativa |
|---|---|---|---|
| Rodoviário — R$/tonelada-km | 0,620 | **Fonte** | [ILOS — Preços de Frete Rodoviário no Brasil](https://ilos.com.br/artigos-precos-de-frete-rodoviario-no-brasil/): caminhão baú, carga geral, ago/2026. Usamos o valor de carga geral (não siderúrgica R$0,513 nem graneleiro R$0,347) por ser o mais próximo do perfil de carga B2B deste TCC. |
| Fluvial — R$/tonelada-km | 0,970 | **Fonte (fornecida pelo autor)** | Valor de referência do TCC, repassado pelo usuário nesta tarefa. |
| Fluvial — multiplicador sazonal (cheia) | 1,0 | Premissa | Nível de água normal/alto adotado como baseline (sem sobretaxa). |
| Fluvial — multiplicador sazonal (seca) | 1,35 | Premissa (ordem de grandeza com fonte) | Reportagens sobre a seca histórica de 2023–2024 no Amazonas registram reajustes de frete de **25% a 50%** sobre o valor normal ([d24am — Impactos da seca histórica no Amazonas afetam logística e comércio exterior](https://d24am.com/amazonas/impactos-da-seca-historica-no-amazonas-afetam-logistica-e-comercio-exterior/)). Adotamos 1,35 (ponto médio da faixa) como premissa conservadora — não o cenário extremo de +147% citado em casos de calado crítico ([Portos e Navios — Quando o rio baixa, o custo sobe](https://www.portosenavios.com.br/artigos/artigos-de-opiniao/artigo-quando-o-rio-baixa-o-custo-para-todos-sobe)), para não inflar artificialmente a vantagem do algoritmo. |
| Aéreo expresso — até 50 kg | R$ 70/kg | **Fonte (fornecida pelo autor)** | Limite superior da faixa do TCC repassada pelo usuário. |
| Aéreo expresso — 50 a 200 kg | R$ 50/kg | Premissa | Ponto intermediário da faixa R$30–70/kg, assumindo desconto por volume em faixas intermediárias (estrutura de tarifa aérea expressa típica — cobrança decrescente por faixa de peso). |
| Aéreo expresso — acima de 200 kg | R$ 30/kg | **Fonte (fornecida pelo autor)** | Limite inferior da faixa do TCC repassada pelo usuário. |
| Aéreo expresso — capacidade máx. por lote | 500 kg | Premissa | Limite prático assumido para carga aérea expressa regional (não cotado no TCC); sem este limite o modal aéreo nunca seria eliminado por capacidade, o que não reflete a realidade operacional. |
| Custo fixo de despacho por hub (Manaus/Santarém/Belém) | R$ 1800 / 2400 / 2000 | Premissa (herdada do protótipo original) | Mesmos valores simulados já presentes em `genetic_algorithm.py` desde a versão anterior do protótipo — mantidos para não introduzir uma nova variável sem fonte adicional. Aplicado a rodoviário e fluvial; aéreo expresso não soma custo fixo porque a tarifa por kg já é "porta a porta" (prática comum de courier aéreo). |
| Distância hub → ponto de consolidação (km) | Manaus 80 / Santarém 850 / Belém 1300 | Premissa | Ordem de grandeza da geografia real da bacia amazônica (Manaus mais próxima do hub de consolidação simulado; Belém e Santarém mais distantes), **não é uma cotação de distância navegável exata** — o TCC não fornece essas distâncias, e o conjunto de hubs em si já é simulado desde a versão original do protótipo. |

## Geração de instâncias

| Parâmetro | Valor | Status | Fonte / justificativa |
|---|---|---|---|
| Tamanhos de instância | 10, 50, 200 compradores | **Fonte** | Critério de aceite exato do OE1 (CLAUDE.md §2). |
| Seed de geração por instância | `10`, `50`, `200` (= o próprio tamanho da instância) | Decisão de design | Fixa e documentada — garante que a mesma instância (mesmos pedidos) seja usada nas 30 execuções de cada estratégia, isolando a variável que o experimento mede (desempenho do algoritmo) da variável que ele não mede (composição da instância). |
| Densidade de carga (kg/m³) | 250, com ruído uniforme ±15% por pedido | Premissa | Densidade média assumida para carga geral paletizada B2B — não há fonte no TCC para peso dos pedidos (o protótipo original só usava volume_m3); o ruído evita que peso seja uma função determinística exata do volume. |
| Período sazonal do pedido (cheia/seca) | 50% / 50% | Premissa | Simplificação — o TCC não especifica a proporção real de pedidos em cada período; 50/50 evita favorecer artificialmente um cenário sazonal sobre o outro. |
| Dia de chegada do pedido (para a baseline de limiar temporal) | uniforme em `[0, max(10, n/2))` | Premissa | Atributo novo, necessário para simular ordem cronológica de chegada (o protótipo original não tinha "quando o pedido chegou", só "janela de entrega"). Horizonte escala com `n` para manter densidade de chegada comparável entre instâncias de tamanhos diferentes. |

## Estratégias de referência (baselines)

| Parâmetro | Valor | Status |
|---|---|---|
| Limiar de volume fixo (greedy por volume) | = capacidade do hub (`capacidade_m3`) | Reaproveita o mesmo parâmetro de capacidade já usado no modelo de custo, em vez de inventar um segundo limiar sem relação com o resto do modelo. |
| Limiar temporal fixo (fechamento por tempo) | 3 dias | Premissa — período de consolidação "ingênuo" razoável para comparação; não foi ajustado para produzir um resultado específico. |

## O que **não** foi alterado para favorecer o resultado

Os hiperparâmetros do Algoritmo Genético (`pop=80, ngen=60, cxpb=0.6, mutpb=0.3,
tournsize=3`) são os mesmos do protótipo original (`genetic_algorithm.py`) e
**não foram retunados** durante este experimento, conforme instrução explícita
de não ajustar parâmetros para atingir o critério de sucesso do OE1.
