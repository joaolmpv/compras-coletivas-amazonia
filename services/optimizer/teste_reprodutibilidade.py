"""
Teste automatizado de reprodutibilidade (ver ERRATA em PARAMETROS.md).

Roda o MESMO calculo (instancia -> 5 estrategias, incluindo os dois nucleos
de AG) duas vezes, em DOIS PROCESSOS SEPARADOS do sistema operacional (nao
duas chamadas de funcao no mesmo processo Python) -- isso e deliberado: um
processo novo tem estado global (`random`, `numpy`, threads de BLAS, hash
seed) proprio, diferente do processo anterior. Se o resultado dependesse de
qualquer estado nao controlado pela seed, os dois processos dariam valores
diferentes mesmo com a mesma seed.

Uso:
    .venv/bin/python teste_reprodutibilidade.py
Saida: PASS (CSV identico, byte a byte) ou FAIL (com o diff).
"""

import json
import subprocess
import sys

SEED_TESTE = 999
N_TESTE = 50
M_TESTE = 3


def calcular():
    """Roda a instancia completa (5 estrategias) para uma seed fixa e
    imprime um JSON deterministico em stdout -- chamado como subprocesso."""
    from estrategias import (
        custo_total_particao,
        estrategia_ag_direto_nsga2,
        estrategia_greedy_temporal,
        estrategia_greedy_volume,
        estrategia_kmeans_ga_nsga2,
        estrategia_sem_consolidacao,
        tempo_espera_particao,
    )
    from instancias import gerar_pedidos

    pedidos = gerar_pedidos(N_TESTE, seed=SEED_TESTE)

    frente_ga, minimos_ga, geracao_ga = estrategia_kmeans_ga_nsga2(pedidos, SEED_TESTE, M_TESTE)
    frente_direto, minimos_direto, geracao_direto = estrategia_ag_direto_nsga2(pedidos, SEED_TESTE)

    lotes_volume = estrategia_greedy_volume(pedidos, 1.0)
    lotes_temporal = estrategia_greedy_temporal(pedidos)
    lotes_sem = estrategia_sem_consolidacao(pedidos)

    resultado = {
        "kmeans_ga_frente": sorted(
            [round(p["custo"], 6), round(p["espera_media"], 6)] for p in frente_ga
        ),
        "kmeans_ga_minimos_geracao": [round(v, 6) for v in minimos_ga],
        "kmeans_ga_geracao_convergencia": geracao_ga,
        "ag_direto_frente": sorted(
            [round(p["custo"], 6), round(p["espera_media"], 6)] for p in frente_direto
        ),
        "ag_direto_minimos_geracao": [round(v, 6) for v in minimos_direto],
        "ag_direto_geracao_convergencia": geracao_direto,
        "greedy_volume_custo": round(custo_total_particao(lotes_volume), 6),
        "greedy_volume_espera": round(sum(tempo_espera_particao(lotes_volume)), 6),
        "greedy_temporal_custo": round(custo_total_particao(lotes_temporal), 6),
        "greedy_temporal_espera": round(sum(tempo_espera_particao(lotes_temporal)), 6),
        "sem_consolidacao_custo": round(custo_total_particao(lotes_sem), 6),
    }
    print(json.dumps(resultado, sort_keys=True))


def rodar_subprocesso():
    saida = subprocess.run(
        [sys.executable, __file__, "--worker"],
        capture_output=True,
        text=True,
        check=True,
    )
    return saida.stdout.strip()


if __name__ == "__main__":
    if "--worker" in sys.argv:
        calcular()
    else:
        saida1 = rodar_subprocesso()
        saida2 = rodar_subprocesso()

        if saida1 == saida2:
            print("PASS -- dois processos separados, mesma seed, saida byte-a-byte identica.")
        else:
            print("FAIL -- saidas diferentes entre processos com a mesma seed:")
            print("processo 1:", saida1)
            print("processo 2:", saida2)
            sys.exit(1)
