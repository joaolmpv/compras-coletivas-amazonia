"""
Quatro estrategias de consolidacao de lotes, comparadas no experimento OE1:

  (a) kmeans_ga       -- K-Means (agrupamento, k derivado de m) + AG (alocacao)
  (b) ag_direto       -- AG direto sobre os pedidos, sem K-Means (1 pedido = 1 "cluster")
                          -- controle/ablacao: mede o que o K-Means realmente contribui
  (c) greedy_volume   -- fecha um lote quando atinge um limiar de volume (fracao da capacidade)
  (d) greedy_temporal -- fecha um lote a cada LIMIAR_TEMPORAL_DIAS, independente do volume

Todas avaliam o custo final com a MESMA funcao `custo_total_particao` (escolhe
o modal de menor custo por lote) e o mesmo `tempo_espera_particao` -- a unica
diferenca entre estrategias e como os pedidos sao agrupados em lotes.
"""

import math
import random
from collections import defaultdict

import numpy as np
from deap import algorithms, base, creator, tools
from sklearn.cluster import KMeans

from custo import menor_custo_modal
from parametros import (
    DENSIDADE_CARGA_KG_POR_M3,
    GA_CXPB,
    GA_GERACOES,
    GA_GERACOES_V3,
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


def tempo_espera_particao(lotes):
    """Espera (dias) de cada pedido = dia de despacho do seu lote - dia de chegada.

    Dia de despacho = max(dia_chegada) dos pedidos do lote -- o lote so pode
    sair depois que o ultimo pedido que o compoe chegou. Definicao aplicada
    igualmente as quatro estrategias, para a comparacao ser justa.
    """
    esperas = []
    for lote in lotes:
        if not lote:
            continue
        dia_despacho = max(p["dia_chegada"] for p in lote)
        for p in lote:
            esperas.append(dia_despacho - p["dia_chegada"])
    return esperas


# ---------------------------------------------------------------------------
# Nucleo comum do AG (compartilhado por kmeans_ga e ag_direto)
# ---------------------------------------------------------------------------

def _montar_lotes_de_assignment(assignment, clusters):
    lotes = defaultdict(list)
    for gene, cluster in zip(assignment, clusters):
        chave = (cluster["hub"], cluster["periodo"], gene)
        lotes[chave].extend(cluster["pedidos"])
    return list(lotes.values())


def _rodar_ga(clusters, seed):
    n = len(clusters)

    if not hasattr(creator, "FitnessMin"):
        creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
        creator.create("Individual", list, fitness=creator.FitnessMin)

    # Semeia o modulo `random` GLOBAL: os operadores do DEAP (cxTwoPoint,
    # mutUniformInt, selTournament) chamam `random.*` diretamente, nao aceitam
    # uma instancia de RNG separada -- uma instancia local (random.Random(seed))
    # so controlaria a inicializacao da populacao, nao o crossover/mutacao/
    # selecao, que ficariam dependentes do estado global do processo (ordem de
    # chamadas anteriores), e portanto NAO reproduziveis pela seed.
    random.seed(seed)
    np.random.seed(seed)

    toolbox = base.Toolbox()
    toolbox.register("gene", random.randint, 0, MAX_LOTES_POR_GRUPO - 1)
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
    melhores_lotes = _montar_lotes_de_assignment(melhor, clusters)

    minimos_por_geracao = logbook.select("min")
    geracao_convergencia = next(
        g for g, valor in enumerate(minimos_por_geracao) if np.isclose(valor, custo_final)
    )

    return melhores_lotes, custo_final, minimos_por_geracao, geracao_convergencia


# ---------------------------------------------------------------------------
# (a) K-Means + Algoritmo Genetico
#
# k_grupo = min(len(grupo), ceil(m * volume_total_do_grupo / capacidade_do_hub))
#
# "volume_total/capacidade" e o numero minimo de lotes para escoar o grupo;
# multiplicar por m da ao AG, em media, m clusters por lote para recombinar --
# m=1 equivaleria a zero liberdade (cada cluster vira um lote, sem o AG poder
# fazer nada). m e escolhido por ajuste (ver tuning.py), nao fixado aqui.
# ---------------------------------------------------------------------------

def _k_grupo(volume_total_m3, capacidade_hub_m3, tamanho_grupo, m):
    k = math.ceil(m * volume_total_m3 / capacidade_hub_m3)
    return max(1, min(tamanho_grupo, k))


def _clusterizar(pedidos, m):
    clusters = []
    for (hub, periodo), lista in agrupar_por_hub_periodo(pedidos).items():
        volume_total = sum(p["volume_m3"] for p in lista)
        k = _k_grupo(volume_total, HUB_CAPACIDADE_M3[hub], len(lista), m)

        features = np.array([[p["volume_m3"], p["janela_dias"]] for p in lista])
        # random_state fixo: a decomposicao em clusters fica estavel entre as
        # execucoes de uma mesma instancia -- a variabilidade que o experimento
        # mede e a do AG (populacao/crossover/mutacao), nao a do K-Means.
        labels = KMeans(n_clusters=k, n_init=10, random_state=0).fit_predict(features)

        grupos_label = defaultdict(list)
        for pedido, label in zip(lista, labels):
            grupos_label[label].append(pedido)

        for grupo in grupos_label.values():
            clusters.append({"hub": hub, "periodo": periodo, "pedidos": grupo})
    return clusters


def estrategia_kmeans_ga(pedidos, seed, m):
    clusters = _clusterizar(pedidos, m)
    return _rodar_ga(clusters, seed)


# ---------------------------------------------------------------------------
# (b) AG direto -- sem K-Means, cada pedido e seu proprio "cluster" de tamanho 1.
# Controle/ablacao: isola o que o K-Means contribui (ou tira) do resultado do AG.
# ---------------------------------------------------------------------------

def _clusters_identidade(pedidos):
    return [
        {"hub": p["hub"], "periodo": p["periodo"], "pedidos": [p]} for p in pedidos
    ]


def estrategia_ag_direto(pedidos, seed):
    clusters = _clusters_identidade(pedidos)
    return _rodar_ga(clusters, seed)


# ---------------------------------------------------------------------------
# (c) Greedy por volume -- fecha o lote ao atingir limiar_fracao * capacidade do hub.
# limiar_fracao e escolhido por ajuste (ver tuning.py), mesmo orcamento do m do AG.
# ---------------------------------------------------------------------------

def estrategia_greedy_volume(pedidos, limiar_fracao):
    lotes = []
    for (hub, _periodo), lista in agrupar_por_hub_periodo(pedidos).items():
        lista_ordenada = sorted(lista, key=lambda p: p["dia_chegada"])
        limiar = HUB_CAPACIDADE_M3[hub] * limiar_fracao

        lote_atual = []
        volume_atual = 0.0
        for pedido in lista_ordenada:
            if volume_atual + pedido["volume_m3"] > limiar and lote_atual:
                lotes.append(lote_atual)
                lote_atual = []
                volume_atual = 0.0
            lote_atual.append(pedido)
            volume_atual += pedido["volume_m3"]
        if lote_atual:
            lotes.append(lote_atual)

    return lotes


# ---------------------------------------------------------------------------
# (d) Fechamento por limiar temporal fixo -- nao faz parte do protocolo de
# ajuste (so kmeans_ga e greedy_volume recebem orcamento de ajuste).
# ---------------------------------------------------------------------------

def estrategia_greedy_temporal(pedidos):
    buckets = defaultdict(list)
    for p in pedidos:
        bucket = p["dia_chegada"] // LIMIAR_TEMPORAL_DIAS
        buckets[(p["hub"], p["periodo"], bucket)].append(p)

    return list(buckets.values())


# ---------------------------------------------------------------------------
# (e) Sem consolidacao -- cada pedido despachado sozinho (v3, baseline original
# do prototipo, reintroduzida a pedido do protocolo v3).
# ---------------------------------------------------------------------------

def estrategia_sem_consolidacao(pedidos):
    return [[p] for p in pedidos]


# ---------------------------------------------------------------------------
# v3: nucleo NSGA-II (aptidao multiobjetivo: custo + tempo de espera medio).
#
# Mantido SEPARADO de `_rodar_ga` (nucleo mono-objetivo usado pela v1/v2) para
# nao quebrar a reprodutibilidade de `experimento.py`/`experimento_v2.py` --
# aqueles scripts continuam chamando `estrategia_kmeans_ga`/`estrategia_ag_direto`
# exatamente como rodaram originalmente.
# ---------------------------------------------------------------------------

def _rodar_ga_nsga2(clusters, seed):
    n = len(clusters)

    if not hasattr(creator, "FitnessMulti"):
        creator.create("FitnessMulti", base.Fitness, weights=(-1.0, -1.0))
        creator.create("IndividualMulti", list, fitness=creator.FitnessMulti)

    # Ver comentario equivalente em _rodar_ga: os operadores do DEAP usam
    # `random.*` global, nao uma instancia local -- precisa semear o modulo
    # inteiro, nao só os sorteios de cxpb/mutpb escritos explicitamente abaixo.
    random.seed(seed)
    np.random.seed(seed)

    def avaliar(individuo):
        lotes = _montar_lotes_de_assignment(individuo, clusters)
        custo = custo_total_particao(lotes)
        esperas = tempo_espera_particao(lotes)
        espera_media = sum(esperas) / len(esperas) if esperas else 0.0
        return custo, espera_media

    toolbox = base.Toolbox()
    toolbox.register("gene", random.randint, 0, MAX_LOTES_POR_GRUPO - 1)
    toolbox.register(
        "individual", tools.initRepeat, creator.IndividualMulti, toolbox.gene, n
    )
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)
    toolbox.register("evaluate", avaliar)
    toolbox.register("mate", tools.cxTwoPoint)
    toolbox.register(
        "mutate", tools.mutUniformInt, low=0, up=MAX_LOTES_POR_GRUPO - 1, indpb=0.2
    )
    toolbox.register("select", tools.selNSGA2)

    populacao = toolbox.population(n=GA_POPULACAO)
    for ind, fit in zip(populacao, map(toolbox.evaluate, populacao)):
        ind.fitness.values = fit
    populacao = toolbox.select(populacao, len(populacao))

    minimos_custo_por_geracao = [min(ind.fitness.values[0] for ind in populacao)]

    for _gen in range(1, GA_GERACOES_V3):
        descendentes = tools.selTournamentDCD(populacao, len(populacao))
        descendentes = [toolbox.clone(ind) for ind in descendentes]

        for ind1, ind2 in zip(descendentes[::2], descendentes[1::2]):
            if random.random() <= GA_CXPB:
                toolbox.mate(ind1, ind2)
            if random.random() <= GA_MUTPB:
                toolbox.mutate(ind1)
            if random.random() <= GA_MUTPB:
                toolbox.mutate(ind2)
            del ind1.fitness.values
            del ind2.fitness.values

        invalidos = [ind for ind in descendentes if not ind.fitness.valid]
        for ind, fit in zip(invalidos, map(toolbox.evaluate, invalidos)):
            ind.fitness.values = fit

        populacao = toolbox.select(populacao + descendentes, GA_POPULACAO)
        minimos_custo_por_geracao.append(min(ind.fitness.values[0] for ind in populacao))

    custo_final_min = minimos_custo_por_geracao[-1]
    geracao_convergencia = next(
        g for g, valor in enumerate(minimos_custo_por_geracao) if np.isclose(valor, custo_final_min)
    )

    frente = tools.sortNondominated(populacao, len(populacao), first_front_only=True)[0]
    frente_pareto = []
    vistos = set()
    for ind in frente:
        chave = ind.fitness.values
        if chave in vistos:
            continue
        vistos.add(chave)
        custo, espera = ind.fitness.values
        lotes = _montar_lotes_de_assignment(ind, clusters)
        frente_pareto.append({"custo": custo, "espera_media": espera, "lotes": lotes})
    frente_pareto.sort(key=lambda p: p["custo"])

    return frente_pareto, minimos_custo_por_geracao, geracao_convergencia


def estrategia_kmeans_ga_nsga2(pedidos, seed, m):
    clusters = _clusterizar(pedidos, m)
    return _rodar_ga_nsga2(clusters, seed)


def estrategia_ag_direto_nsga2(pedidos, seed):
    clusters = _clusters_identidade(pedidos)
    return _rodar_ga_nsga2(clusters, seed)
