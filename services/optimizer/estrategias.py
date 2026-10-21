"""
Tres estrategias de consolidacao de lotes, comparadas no experimento OE1:

  (a) kmeans_ga       -- K-Means (agrupamento) + Algoritmo Genetico (alocacao)
  (b) greedy_volume   -- fecha um lote sempre que a capacidade fixa do hub e atingida
  (c) greedy_temporal -- fecha um lote a cada LIMIAR_TEMPORAL_DIAS, independente do volume

As tres avaliam o custo final com a MESMA funcao `custo_total_particao`, que
escolhe o modal de menor custo por lote (rodoviario/fluvial/aereo) -- a unica
diferenca entre estrategias e como os pedidos sao agrupados em lotes, nao
como o lote e precificado.
"""

from collections import defaultdict

import numpy as np
from deap import algorithms, base, creator, tools
from sklearn.cluster import KMeans

from custo import menor_custo_modal
from parametros import (
    DENSIDADE_CARGA_KG_POR_M3,
    GA_CXPB,
    GA_GERACOES,
    GA_MUTPB,
    GA_POPULACAO,
    GA_TOURNSIZE,
    HUB_CAPACIDADE_M3,
    HUB_DISTANCIA_KM,
    LIMIAR_TEMPORAL_DIAS,
    MAX_LOTES_POR_GRUPO,
    RODOVIARIO_RS_POR_TON_KM,
)


def agrupar_por_hub_periodo(pedidos):
    grupos = defaultdict(list)
    for p in pedidos:
        grupos[(p["hub"], p["periodo"])].append(p)
    return grupos


def custo_total_particao(lotes):
    """lotes: lista de lotes, cada lote uma lista de pedidos do MESMO (hub, periodo)."""
    total = 0.0
    for lote in lotes:
        if not lote:
            continue
        hub = lote[0]["hub"]
        periodo = lote[0]["periodo"]
        peso_kg = sum(p["peso_kg"] for p in lote)
        volume_m3 = sum(p["volume_m3"] for p in lote)

        _modal, custo = menor_custo_modal(peso_kg, hub, periodo)
        total += custo

        capacidade = HUB_CAPACIDADE_M3[hub]
        if volume_m3 > capacidade:
            excedente_kg = (volume_m3 - capacidade) * DENSIDADE_CARGA_KG_POR_M3
            total += (
                (excedente_kg / 1000.0)
                * HUB_DISTANCIA_KM[hub]
                * RODOVIARIO_RS_POR_TON_KM
                * 5  # penalidade por estourar capacidade, mesmo fator do prototipo original
            )
    return total


# ---------------------------------------------------------------------------
# (a) K-Means + Algoritmo Genetico
# ---------------------------------------------------------------------------

def _clusterizar(pedidos, k_por_grupo=4):
    clusters = []
    for (hub, periodo), lista in agrupar_por_hub_periodo(pedidos).items():
        features = np.array([[p["volume_m3"], p["janela_dias"]] for p in lista])
        k = min(k_por_grupo, len(lista))
        # random_state fixo: a decomposicao em clusters fica estavel entre as
        # N_RUNS execucoes de uma mesma instancia -- a variabilidade que o
        # experimento mede e a do AG (populacao/crossover/mutacao), nao a do
        # K-Means, e isso mantem o tamanho do genoma do AG constante por instancia.
        labels = KMeans(n_clusters=k, n_init=10, random_state=0).fit_predict(features)

        grupos_label = defaultdict(list)
        for pedido, label in zip(lista, labels):
            grupos_label[label].append(pedido)

        for grupo in grupos_label.values():
            clusters.append({"hub": hub, "periodo": periodo, "pedidos": grupo})
    return clusters


def _montar_lotes_de_assignment(assignment, clusters):
    lotes = defaultdict(list)
    for gene, cluster in zip(assignment, clusters):
        chave = (cluster["hub"], cluster["periodo"], gene)
        lotes[chave].extend(cluster["pedidos"])
    return list(lotes.values())


def estrategia_kmeans_ga(pedidos, seed):
    clusters = _clusterizar(pedidos)
    n = len(clusters)

    if not hasattr(creator, "FitnessMin"):
        creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
        creator.create("Individual", list, fitness=creator.FitnessMin)

    rng_random = __import__("random").Random(seed)

    toolbox = base.Toolbox()
    toolbox.register("gene", rng_random.randint, 0, MAX_LOTES_POR_GRUPO - 1)
    toolbox.register("individual", tools.initRepeat, creator.Individual, toolbox.gene, n)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    def avaliar(individuo):
        lotes = _montar_lotes_de_assignment(individuo, clusters)
        return (custo_total_particao(lotes),)

    toolbox.register("evaluate", avaliar)
    toolbox.register("mate", tools.cxTwoPoint)
    toolbox.register(
        "mutate", tools.mutUniformInt, low=0, up=MAX_LOTES_POR_GRUPO - 1, indpb=0.2
    )
    toolbox.register("select", tools.selTournament, tournsize=GA_TOURNSIZE)

    populacao = toolbox.population(n=GA_POPULACAO)

    stats = tools.Statistics(lambda ind: ind.fitness.values[0])
    stats.register("min", np.min)

    populacao, logbook = algorithms.eaSimple(
        populacao,
        toolbox,
        cxpb=GA_CXPB,
        mutpb=GA_MUTPB,
        ngen=GA_GERACOES,
        stats=stats,
        verbose=False,
    )

    melhor = tools.selBest(populacao, k=1)[0]
    custo_final = melhor.fitness.values[0]

    minimos_por_geracao = logbook.select("min")
    geracao_convergencia = next(
        g for g, valor in enumerate(minimos_por_geracao) if np.isclose(valor, custo_final)
    )

    return custo_final, minimos_por_geracao, geracao_convergencia


# ---------------------------------------------------------------------------
# (b) Greedy por volume fixo
# ---------------------------------------------------------------------------

def estrategia_greedy_volume(pedidos):
    custo_acumulado_lotes = []
    for (hub, _periodo), lista in agrupar_por_hub_periodo(pedidos).items():
        lista_ordenada = sorted(lista, key=lambda p: p["dia_chegada"])
        capacidade = HUB_CAPACIDADE_M3[hub]

        lote_atual = []
        volume_atual = 0.0
        for pedido in lista_ordenada:
            if volume_atual + pedido["volume_m3"] > capacidade and lote_atual:
                custo_acumulado_lotes.append(lote_atual)
                lote_atual = []
                volume_atual = 0.0
            lote_atual.append(pedido)
            volume_atual += pedido["volume_m3"]
        if lote_atual:
            custo_acumulado_lotes.append(lote_atual)

    return custo_total_particao(custo_acumulado_lotes)


# ---------------------------------------------------------------------------
# (c) Fechamento por limiar temporal fixo
# ---------------------------------------------------------------------------

def estrategia_greedy_temporal(pedidos):
    buckets = defaultdict(list)
    for p in pedidos:
        bucket = p["dia_chegada"] // LIMIAR_TEMPORAL_DIAS
        buckets[(p["hub"], p["periodo"], bucket)].append(p)

    return custo_total_particao(list(buckets.values()))
