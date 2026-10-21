"""
Experimento OE1 v2: regra de k derivada por principio (k = m * volume/capacidade),
m e limiar de greedy_volume escolhidos por ajuste em seeds separadas das de
avaliacao, quatro estrategias (kmeans_ga, ag_direto, greedy_volume,
greedy_temporal), custo E tempo de espera.

Gera:
  - docs/oe1-tabela-ajuste-v2.md            (todos os valores de m/limiar testados)
  - resultados/oe1_execucoes-v2-k-por-m.csv (uma linha por execucao, 4 estrategias)
  - docs/oe1-convergencia-ga-v2-k-por-m.png (kmeans_ga e ag_direto)
  - docs/oe1-tabela-resumo-v2-k-por-m.md    (custo + espera, reducao % vs baselines)

Uso:
    .venv/bin/python experimento_v2.py
"""

import csv
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from estrategias import (
    custo_total_particao,
    estrategia_ag_direto,
    estrategia_greedy_temporal,
    estrategia_greedy_volume,
    estrategia_kmeans_ga,
    tempo_espera_particao,
)
from instancias import gerar_pedidos
from parametros import N_RUNS, OFFSET_SEED_AVALIACAO, TAMANHOS_INSTANCIA
from tuning import ajustar_limiar_volume, ajustar_m, gerar_tabela_ajuste_md

RAIZ = os.path.dirname(os.path.abspath(__file__))
DIR_RESULTADOS = os.path.join(RAIZ, "resultados")
DIR_DOCS = os.path.join(RAIZ, "..", "..", "docs")


def media(valores):
    return sum(valores) / len(valores)


def desvio(valores):
    m = media(valores)
    return (sum((v - m) ** 2 for v in valores) / len(valores)) ** 0.5


def rodar():
    os.makedirs(DIR_RESULTADOS, exist_ok=True)
    os.makedirs(DIR_DOCS, exist_ok=True)

    # --- 1. Ajuste (seeds separadas da avaliacao) ---------------------------
    resultados_ajuste = {}
    pedidos_por_n = {}

    for n in TAMANHOS_INSTANCIA:
        pedidos = gerar_pedidos(n, seed=n)
        pedidos_por_n[n] = pedidos

        melhor_m, linhas_m = ajustar_m(pedidos, n)
        melhor_fracao, linhas_fracao = ajustar_limiar_volume(pedidos, n)
        resultados_ajuste[n] = {"m": (melhor_m, linhas_m), "limiar": (melhor_fracao, linhas_fracao)}
        print(f"n={n}: ajuste concluido -- m={melhor_m}, limiar_fracao={melhor_fracao}")

    tabela_ajuste_md = gerar_tabela_ajuste_md(resultados_ajuste)
    caminho_ajuste = os.path.join(DIR_DOCS, "oe1-tabela-ajuste-v2.md")
    with open(caminho_ajuste, "w") as f:
        f.write(tabela_ajuste_md)
    print(f"Tabela de ajuste salva em {caminho_ajuste}")

    # --- 2. Avaliacao (seeds de avaliacao, m e limiar congelados) ----------
    linhas_csv = []
    curvas_kmeans_ga = {}
    curvas_ag_direto = {}

    for n in TAMANHOS_INSTANCIA:
        pedidos = pedidos_por_n[n]
        m = resultados_ajuste[n]["m"][0]
        limiar_fracao = resultados_ajuste[n]["limiar"][0]

        lotes_volume = estrategia_greedy_volume(pedidos, limiar_fracao)
        custo_volume = custo_total_particao(lotes_volume)
        espera_volume = tempo_espera_particao(lotes_volume)

        lotes_temporal = estrategia_greedy_temporal(pedidos)
        custo_temporal = custo_total_particao(lotes_temporal)
        espera_temporal = tempo_espera_particao(lotes_temporal)

        curvas_kmeans_ga[n] = []
        curvas_ag_direto[n] = []

        for run in range(N_RUNS):
            seed = n * 1000 + OFFSET_SEED_AVALIACAO + run

            lotes_ga, custo_ga, minimos_ga, geracao_ga = estrategia_kmeans_ga(pedidos, seed, m)
            curvas_kmeans_ga[n].append(minimos_ga)
            espera_ga = tempo_espera_particao(lotes_ga)

            lotes_direto, custo_direto, minimos_direto, geracao_direto = estrategia_ag_direto(
                pedidos, seed
            )
            curvas_ag_direto[n].append(minimos_direto)
            espera_direto = tempo_espera_particao(lotes_direto)

            linhas_csv.append(
                {
                    "instancia_n": n,
                    "estrategia": "kmeans_ga",
                    "run_seed": seed,
                    "parametro": f"m={m}",
                    "custo_total": custo_ga,
                    "custo_medio_por_comprador": custo_ga / n,
                    "espera_media_dias": media(espera_ga),
                    "espera_dp_dias": desvio(espera_ga),
                    "geracoes_convergencia": geracao_ga,
                }
            )
            linhas_csv.append(
                {
                    "instancia_n": n,
                    "estrategia": "ag_direto",
                    "run_seed": seed,
                    "parametro": "",
                    "custo_total": custo_direto,
                    "custo_medio_por_comprador": custo_direto / n,
                    "espera_media_dias": media(espera_direto),
                    "espera_dp_dias": desvio(espera_direto),
                    "geracoes_convergencia": geracao_direto,
                }
            )
            linhas_csv.append(
                {
                    "instancia_n": n,
                    "estrategia": "greedy_volume",
                    "run_seed": seed,
                    "parametro": f"limiar_fracao={limiar_fracao}",
                    "custo_total": custo_volume,
                    "custo_medio_por_comprador": custo_volume / n,
                    "espera_media_dias": media(espera_volume),
                    "espera_dp_dias": desvio(espera_volume),
                    "geracoes_convergencia": "",
                }
            )
            linhas_csv.append(
                {
                    "instancia_n": n,
                    "estrategia": "greedy_temporal",
                    "run_seed": seed,
                    "parametro": "",
                    "custo_total": custo_temporal,
                    "custo_medio_por_comprador": custo_temporal / n,
                    "espera_media_dias": media(espera_temporal),
                    "espera_dp_dias": desvio(espera_temporal),
                    "geracoes_convergencia": "",
                }
            )

        print(f"n={n}: avaliacao concluida ({N_RUNS} runs x 4 estrategias)")

    caminho_csv = os.path.join(DIR_RESULTADOS, "oe1_execucoes-v2-k-por-m.csv")
    with open(caminho_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(linhas_csv[0].keys()))
        writer.writeheader()
        writer.writerows(linhas_csv)
    print(f"CSV salvo em {caminho_csv}")

    gerar_curva_convergencia(curvas_kmeans_ga, curvas_ag_direto)
    tabela_resumo = gerar_tabela_resumo(linhas_csv, resultados_ajuste)
    return tabela_resumo


def gerar_curva_convergencia(curvas_kmeans_ga, curvas_ag_direto):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5), dpi=150)
    for fig_ax in (ax1, ax2):
        fig_ax.set_facecolor("#0f172a")
    fig.patch.set_facecolor("#0f172a")

    cores = {10: "#60a5fa", 50: "#22c55e", 200: "#f97316"}

    for n, curvas in curvas_kmeans_ga.items():
        comprimento = min(len(c) for c in curvas)
        matriz = [c[:comprimento] for c in curvas]
        media_por_geracao = [sum(col) / len(col) for col in zip(*matriz)]
        ax1.plot(media_por_geracao, label=f"n={n}", color=cores.get(n, "white"))

    for n, curvas in curvas_ag_direto.items():
        comprimento = min(len(c) for c in curvas)
        matriz = [c[:comprimento] for c in curvas]
        media_por_geracao = [sum(col) / len(col) for col in zip(*matriz)]
        ax2.plot(media_por_geracao, label=f"n={n}", color=cores.get(n, "white"))

    ax1.set_title("kmeans_ga (k por m)", color="white")
    ax2.set_title("ag_direto (sem K-Means)", color="white")
    for ax in (ax1, ax2):
        ax.set_xlabel("Geracao", color="white")
        ax.set_ylabel("Custo (melhor da populacao, R$)", color="white")
        ax.tick_params(colors="white")
        ax.legend(facecolor="#1e293b", labelcolor="white")
        for spine in ax.spines.values():
            spine.set_visible(False)

    caminho = os.path.join(DIR_DOCS, "oe1-convergencia-ga-v2-k-por-m.png")
    fig.tight_layout()
    fig.savefig(caminho, facecolor=fig.get_facecolor())
    print(f"Curva de convergencia salva em {caminho}")


def gerar_tabela_resumo(linhas, resultados_ajuste):
    estrategias = ("kmeans_ga", "ag_direto", "greedy_volume", "greedy_temporal")
    agregados = {}
    for n in TAMANHOS_INSTANCIA:
        agregados[n] = {}
        for estrategia in estrategias:
            subset = [l for l in linhas if l["instancia_n"] == n and l["estrategia"] == estrategia]
            custos = [l["custo_medio_por_comprador"] for l in subset]
            esperas = [l["espera_media_dias"] for l in subset]
            agregados[n][estrategia] = {
                "custo_media": media(custos),
                "custo_dp": desvio(custos),
                "espera_media": media(esperas),
                "espera_dp": desvio(esperas),
            }

    linhas_md = [
        "# OE1 -- tabela resumo -- v2, k = ceil(m * volume/capacidade) (30 execucoes por celula)",
        "",
        "m e limiar_fracao (greedy_volume) escolhidos por ajuste em seeds "
        "separadas das de avaliacao -- ver docs/oe1-tabela-ajuste-v2.md para "
        "todos os valores testados. m escolhido por instancia:",
        "",
    ]
    for n in TAMANHOS_INSTANCIA:
        linhas_md.append(
            f"- n={n}: m={resultados_ajuste[n]['m'][0]}, "
            f"limiar_fracao={resultados_ajuste[n]['limiar'][0]}"
        )

    linhas_md += [
        "",
        "## Custo medio por comprador (R$) e reducao % vs cada baseline",
        "",
        "| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | AG vs volume | AG vs temporal | ag_direto vs volume | ag_direto vs temporal |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for n in TAMANHOS_INSTANCIA:
        a = agregados[n]
        red = lambda base, alvo: (base["custo_media"] - alvo["custo_media"]) / base["custo_media"] * 100
        linhas_md.append(
            f"| {n} "
            f"| {a['kmeans_ga']['custo_media']:.2f} (dp {a['kmeans_ga']['custo_dp']:.2f}) "
            f"| {a['ag_direto']['custo_media']:.2f} (dp {a['ag_direto']['custo_dp']:.2f}) "
            f"| {a['greedy_volume']['custo_media']:.2f} (dp {a['greedy_volume']['custo_dp']:.2f}) "
            f"| {a['greedy_temporal']['custo_media']:.2f} (dp {a['greedy_temporal']['custo_dp']:.2f}) "
            f"| {red(a['greedy_volume'], a['kmeans_ga']):.1f}% "
            f"| {red(a['greedy_temporal'], a['kmeans_ga']):.1f}% "
            f"| {red(a['greedy_volume'], a['ag_direto']):.1f}% "
            f"| {red(a['greedy_temporal'], a['ag_direto']):.1f}% |"
        )

    linhas_md += [
        "",
        "## Tempo de espera medio por pedido (dias)",
        "",
        "| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal |",
        "|---|---|---|---|---|",
    ]
    for n in TAMANHOS_INSTANCIA:
        a = agregados[n]
        linhas_md.append(
            f"| {n} "
            f"| {a['kmeans_ga']['espera_media']:.2f} (dp {a['kmeans_ga']['espera_dp']:.2f}) "
            f"| {a['ag_direto']['espera_media']:.2f} (dp {a['ag_direto']['espera_dp']:.2f}) "
            f"| {a['greedy_volume']['espera_media']:.2f} (dp {a['greedy_volume']['espera_dp']:.2f}) "
            f"| {a['greedy_temporal']['espera_media']:.2f} (dp {a['greedy_temporal']['espera_dp']:.2f}) |"
        )

    texto = "\n".join(linhas_md) + "\n"
    caminho = os.path.join(DIR_DOCS, "oe1-tabela-resumo-v2-k-por-m.md")
    with open(caminho, "w") as f:
        f.write(texto)
    print(f"Tabela resumo salva em {caminho}")
    return texto


if __name__ == "__main__":
    print(rodar())
