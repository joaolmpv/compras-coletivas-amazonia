"""
Protocolo de ajuste (v2) -- roda ANTES da avaliação final, em seeds
DISTINTAS das seeds de avaliação (ver OFFSET_SEED_AJUSTE em parametros.py).

  - kmeans_ga: varre m em M_CANDIDATOS, escolhe o m de menor custo medio por
    comprador nas seeds de ajuste.
  - greedy_volume: varre limiar_fracao em LIMIAR_VOLUME_FRACOES_CANDIDATAS.
    E deterministico (nao depende de seed), entao cada fracao e avaliada uma
    unica vez por instancia -- "rodar em varias seeds" nao mudaria o
    resultado, e repetir seria so redundancia, nao rigor.

Critério de escolha (fixado antes de rodar, igual para os dois): menor custo
médio por comprador no conjunto de ajuste.

Retorna, para cada instancia, o m e o limiar_fracao escolhidos, e a tabela
completa com TODOS os valores testados (nenhum e descartado do relatorio).
"""

from estrategias import custo_total_particao, estrategia_greedy_volume, estrategia_kmeans_ga
from parametros import (
    LIMIAR_VOLUME_FRACOES_CANDIDATAS,
    M_CANDIDATOS,
    N_TUNING_RUNS,
    OFFSET_SEED_AJUSTE,
)


def ajustar_m(pedidos, n):
    linhas = []
    for m in M_CANDIDATOS:
        custos = []
        for run in range(N_TUNING_RUNS):
            seed = n * 1000 + OFFSET_SEED_AJUSTE + run
            _lotes, custo_total, _logbook, _geracao = estrategia_kmeans_ga(pedidos, seed, m)
            custos.append(custo_total / n)
        media = sum(custos) / len(custos)
        linhas.append({"m": m, "custo_medio_por_comprador": media})

    melhor = min(linhas, key=lambda l: l["custo_medio_por_comprador"])
    return melhor["m"], linhas


def ajustar_limiar_volume(pedidos, n):
    linhas = []
    for fracao in LIMIAR_VOLUME_FRACOES_CANDIDATAS:
        lotes = estrategia_greedy_volume(pedidos, fracao)
        custo = custo_total_particao(lotes) / n
        linhas.append({"limiar_fracao": fracao, "custo_medio_por_comprador": custo})

    melhor = min(linhas, key=lambda l: l["custo_medio_por_comprador"])
    return melhor["limiar_fracao"], linhas


def gerar_tabela_ajuste_md(resultados_ajuste):
    """resultados_ajuste: {n: {"m": (melhor, linhas), "limiar": (melhor, linhas)}}"""
    linhas_md = [
        "# OE1 -- tabela completa de ajuste (v2)",
        "",
        "Seeds de ajuste disjuntas das seeds de avaliacao (ver parametros.py,"
        " OFFSET_SEED_AJUSTE vs OFFSET_SEED_AVALIACAO). Critério de escolha:"
        " menor custo médio por comprador nas seeds de ajuste. Todos os"
        " valores testados estão listados -- nenhum foi omitido.",
        "",
        "## kmeans_ga -- varredura de m (media de {} seeds de ajuste)".format(N_TUNING_RUNS),
        "",
        "| n | m | custo médio/comprador (ajuste) | escolhido |",
        "|---|---|---|---|",
    ]
    for n, dados in resultados_ajuste.items():
        melhor_m, linhas_m = dados["m"]
        for linha in linhas_m:
            marca = "**sim**" if linha["m"] == melhor_m else ""
            linhas_md.append(
                f"| {n} | {linha['m']} | {linha['custo_medio_por_comprador']:.2f} | {marca} |"
            )

    linhas_md += [
        "",
        "## greedy_volume -- varredura de limiar_fracao (deterministico, 1 avaliação por valor)",
        "",
        "| n | limiar_fracao | custo médio/comprador | escolhido |",
        "|---|---|---|---|",
    ]
    for n, dados in resultados_ajuste.items():
        melhor_fracao, linhas_fracao = dados["limiar"]
        for linha in linhas_fracao:
            marca = "**sim**" if linha["limiar_fracao"] == melhor_fracao else ""
            linhas_md.append(
                f"| {n} | {linha['limiar_fracao']} | {linha['custo_medio_por_comprador']:.2f} | {marca} |"
            )

    return "\n".join(linhas_md) + "\n"
