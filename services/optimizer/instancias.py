"""
Geracao de instancias sinteticas de pedidos (OE1): 10, 50 e 200 compradores.

A seed de geracao e fixa POR INSTANCIA (== o tamanho da instancia) -- a mesma
instancia (mesmos pedidos) e reutilizada nas N_RUNS execucoes de cada
estrategia, para isolar o desempenho do algoritmo da composicao da instancia.
Veja PARAMETROS.md para a justificativa de cada constante usada aqui.
"""

import random

import numpy as np

from parametros import DENSIDADE_CARGA_KG_POR_M3, HUBS


def gerar_pedidos(n_pedidos: int, seed: int):
    rng = random.Random(seed)
    np_rng = np.random.RandomState(seed)

    horizonte_dias = max(10, n_pedidos // 2)

    pedidos = []
    for i in range(n_pedidos):
        volume_m3 = round(float(np_rng.uniform(0.5, 6.0)), 2)
        ruido_densidade = float(np_rng.uniform(0.85, 1.15))
        peso_kg = round(volume_m3 * DENSIDADE_CARGA_KG_POR_M3 * ruido_densidade, 1)

        pedidos.append(
            {
                "id": i,
                "hub": rng.choice(HUBS),
                "periodo": rng.choice(["cheia", "seca"]),
                "volume_m3": volume_m3,
                "peso_kg": peso_kg,
                "janela_dias": rng.randint(1, 10),
                "dia_chegada": rng.randint(0, horizonte_dias),
            }
        )
    return pedidos
