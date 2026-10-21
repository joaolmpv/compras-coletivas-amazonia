"""
Otimizacao de lotes de compra coletiva (B2B) via K-Means + Algoritmo Genetico.

Prototipo do Objetivo Especifico 1 (OE1) do TCC: consolidar pedidos de
multiplos compradores em lotes compartilhados de frete, reduzindo o
"Custo Norte" (frete fluvial/aereo na regiao amazonica).

Os dados de pedidos e de custo de frete abaixo sao SIMULADOS para fins de
prototipagem -- nao representam cotacoes reais. Em producao, os parametros
de custo por hub viriam de uma base historica real de frete.

Uso:
    pip install -r requirements.txt
    python genetic_algorithm.py
"""

import random
from collections import defaultdict

import numpy as np
from deap import base, creator, tools, algorithms
from sklearn.cluster import KMeans

random.seed(42)
np.random.seed(42)

# ---------------------------------------------------------------------------
# 1. Simulacao de dados: pedidos de compradores por hub logistico
# ---------------------------------------------------------------------------

HUBS = {
    # hub: (custo_fixo_por_despacho, custo_variavel_por_m3, capacidade_m3_por_lote)
    "Manaus": (1800.0, 95.0, 40.0),
    "Santarem": (2400.0, 130.0, 30.0),
    "Belem": (2000.0, 110.0, 35.0),
}

N_ORDERS = 60


def gerar_pedidos(n_orders: int):
    pedidos = []
    for i in range(n_orders):
        hub = random.choice(list(HUBS.keys()))
        pedidos.append(
            {
                "id": i,
                "hub": hub,
                "volume_m3": round(random.uniform(0.5, 6.0), 2),
                "janela_dias": random.randint(1, 10),
            }
        )
    return pedidos


# ---------------------------------------------------------------------------
# 2. Etapa 1 -- K-Means: agrupa pedidos do mesmo hub por perfil
#    (volume, janela de entrega), formando clusters candidatos a lote
# ---------------------------------------------------------------------------

def clusterizar_por_hub(pedidos, k_por_hub: int = 4):
    clusters = []  # cada item: {"hub", "pedidos": [...], "volume_total"}
    por_hub = defaultdict(list)
    for p in pedidos:
        por_hub[p["hub"]].append(p)

    for hub, lista in por_hub.items():
        features = np.array([[p["volume_m3"], p["janela_dias"]] for p in lista])
        k = min(k_por_hub, len(lista))
        labels = KMeans(n_clusters=k, n_init=10, random_state=42).fit_predict(features)

        grupos = defaultdict(list)
        for pedido, label in zip(lista, labels):
            grupos[label].append(pedido)

        for grupo in grupos.values():
            clusters.append(
                {
                    "hub": hub,
                    "pedidos": grupo,
                    "volume_total": sum(p["volume_m3"] for p in grupo),
                }
            )
    return clusters


# ---------------------------------------------------------------------------
# 3. Etapa 2 -- Algoritmo Genetico: decide como agrupar os clusters
#    candidatos em lotes finais de frete, respeitando a capacidade do modal
#    e minimizando custo fixo (despacho) + custo variavel (volume)
# ---------------------------------------------------------------------------

MAX_LOTES_POR_HUB = 6


def custo_total(assignment, clusters):
    lotes = defaultdict(lambda: {"volume": 0.0, "hub": None})
    for gene, cluster in zip(assignment, clusters):
        chave = (cluster["hub"], gene)
        lotes[chave]["volume"] += cluster["volume_total"]
        lotes[chave]["hub"] = cluster["hub"]

    total = 0.0
    for (hub, _slot), lote in lotes.items():
        custo_fixo, custo_var, capacidade = HUBS[hub]
        total += custo_fixo + custo_var * lote["volume"]
        if lote["volume"] > capacidade:
            excedente = lote["volume"] - capacidade
            total += excedente * custo_var * 5  # penalidade por estourar capacidade
    return total


def custo_baseline_sem_consolidacao(pedidos):
    """Custo se cada pedido fosse despachado sozinho (sem compra coletiva)."""
    total = 0.0
    for p in pedidos:
        custo_fixo, custo_var, _cap = HUBS[p["hub"]]
        total += custo_fixo + custo_var * p["volume_m3"]
    return total


def otimizar(clusters):
    n = len(clusters)

    creator.create("FitnessMin", base.Fitness, weights=(-1.0,))
    creator.create("Individual", list, fitness=creator.FitnessMin)

    toolbox = base.Toolbox()
    toolbox.register("gene", random.randint, 0, MAX_LOTES_POR_HUB - 1)
    toolbox.register("individual", tools.initRepeat, creator.Individual, toolbox.gene, n)
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    def avaliar(individuo):
        return (custo_total(individuo, clusters),)

    toolbox.register("evaluate", avaliar)
    toolbox.register("mate", tools.cxTwoPoint)
    toolbox.register("mutate", tools.mutUniformInt, low=0, up=MAX_LOTES_POR_HUB - 1, indpb=0.2)
    toolbox.register("select", tools.selTournament, tournsize=3)

    populacao = toolbox.population(n=80)
    algorithms.eaSimple(
        populacao, toolbox, cxpb=0.6, mutpb=0.3, ngen=60, verbose=False
    )

    melhor = tools.selBest(populacao, k=1)[0]
    return melhor, melhor.fitness.values[0]


def main():
    pedidos = gerar_pedidos(N_ORDERS)
    clusters = clusterizar_por_hub(pedidos)

    baseline = custo_baseline_sem_consolidacao(pedidos)
    melhor_individuo, custo_otimizado = otimizar(clusters)

    economia = baseline - custo_otimizado
    economia_pct = (economia / baseline) * 100

    print(f"Pedidos simulados: {len(pedidos)}")
    print(f"Clusters candidatos (pos K-Means): {len(clusters)}")
    print(f"Custo SEM compra coletiva (baseline): R$ {baseline:,.2f}")
    print(f"Custo COM lotes otimizados (GA):      R$ {custo_otimizado:,.2f}")
    print(f"Economia estimada: R$ {economia:,.2f} ({economia_pct:.1f}%)")


if __name__ == "__main__":
    main()
