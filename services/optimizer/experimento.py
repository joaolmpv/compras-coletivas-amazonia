"""
Experimento do OE1: 30 execucoes independentes x 3 estrategias x 3 tamanhos de
instancia (10/50/200 compradores). Gera:

  - resultados/oe1_execucoes.csv     (uma linha por execucao)
  - docs/oe1-convergencia-ga.png     (curva de convergencia do AG, por tamanho)
  - docs/oe1-tabela-resumo.md        (custo medio/comprador e reducao % vs baselines)

Uso:
    .venv/bin/python experimento.py
"""

import csv
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

from estrategias import estrategia_greedy_temporal, estrategia_greedy_volume, estrategia_kmeans_ga
from instancias import gerar_pedidos
from parametros import N_RUNS, TAMANHOS_INSTANCIA

RAIZ = os.path.dirname(os.path.abspath(__file__))
DIR_RESULTADOS = os.path.join(RAIZ, "resultados")
DIR_DOCS = os.path.join(RAIZ, "..", "..", "docs")


def rodar_experimento():
    os.makedirs(DIR_RESULTADOS, exist_ok=True)
    os.makedirs(DIR_DOCS, exist_ok=True)

    linhas = []
    curvas_convergencia = {}  # n_instancia -> lista de listas (uma por run) de minimos por geracao

    for n in TAMANHOS_INSTANCIA:
        pedidos = gerar_pedidos(n, seed=n)
        curvas_convergencia[n] = []

        # (b) e (c) sao deterministicas (nao dependem de run_seed) -- calculadas
        # uma vez, mas registradas N_RUNS vezes no CSV para manter a tabela
        # "uma linha por execucao" uniforme entre estrategias, como pedido.
        custo_greedy_volume = estrategia_greedy_volume(pedidos)
        custo_greedy_temporal = estrategia_greedy_temporal(pedidos)

        for run in range(N_RUNS):
            run_seed = n * 1000 + run

            custo_ga, minimos_geracao, geracao_convergencia = estrategia_kmeans_ga(
                pedidos, seed=run_seed
            )
            curvas_convergencia[n].append(minimos_geracao)

            linhas.append(
                {
                    "instancia_n": n,
                    "estrategia": "kmeans_ga",
                    "run_seed": run_seed,
                    "custo_total": custo_ga,
                    "custo_medio_por_comprador": custo_ga / n,
                    "geracoes_convergencia": geracao_convergencia,
                }
            )
            linhas.append(
                {
                    "instancia_n": n,
                    "estrategia": "greedy_volume",
                    "run_seed": run_seed,
                    "custo_total": custo_greedy_volume,
                    "custo_medio_por_comprador": custo_greedy_volume / n,
                    "geracoes_convergencia": "",
                }
            )
            linhas.append(
                {
                    "instancia_n": n,
                    "estrategia": "greedy_temporal",
                    "run_seed": run_seed,
                    "custo_total": custo_greedy_temporal,
                    "custo_medio_por_comprador": custo_greedy_temporal / n,
                    "geracoes_convergencia": "",
                }
            )

        print(f"n={n}: GA concluido ({N_RUNS} runs)")

    caminho_csv = os.path.join(DIR_RESULTADOS, "oe1_execucoes.csv")
    with open(caminho_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(linhas[0].keys()))
        writer.writeheader()
        writer.writerows(linhas)
    print(f"CSV salvo em {caminho_csv}")

    gerar_curva_convergencia(curvas_convergencia)
    tabela = gerar_tabela_resumo(linhas)
    return tabela


def gerar_curva_convergencia(curvas_convergencia):
    fig, ax = plt.subplots(figsize=(7, 5), dpi=150)
    fig.patch.set_facecolor("#0f172a")
    ax.set_facecolor("#0f172a")

    cores = {10: "#60a5fa", 50: "#22c55e", 200: "#f97316"}

    for n, curvas in curvas_convergencia.items():
        comprimento = min(len(c) for c in curvas)
        matriz = [c[:comprimento] for c in curvas]
        media_por_geracao = [sum(col) / len(col) for col in zip(*matriz)]
        ax.plot(media_por_geracao, label=f"n={n}", color=cores.get(n, "white"))

    ax.set_title(
        f"Convergencia do AG (media de {next(iter(curvas_convergencia.values())).__len__()} runs)",
        color="white",
    )
    ax.set_xlabel("Geracao", color="white")
    ax.set_ylabel("Custo (melhor da populacao, R$)", color="white")
    ax.tick_params(colors="white")
    ax.legend(facecolor="#1e293b", labelcolor="white")
    for spine in ax.spines.values():
        spine.set_visible(False)

    caminho = os.path.join(DIR_DOCS, "oe1-convergencia-ga.png")
    fig.tight_layout()
    fig.savefig(caminho, facecolor=fig.get_facecolor())
    print(f"Curva de convergencia salva em {caminho}")


def gerar_tabela_resumo(linhas):
    agregados = {}
    for n in TAMANHOS_INSTANCIA:
        agregados[n] = {}
        for estrategia in ("kmeans_ga", "greedy_volume", "greedy_temporal"):
            valores = [
                l["custo_medio_por_comprador"]
                for l in linhas
                if l["instancia_n"] == n and l["estrategia"] == estrategia
            ]
            media = sum(valores) / len(valores)
            desvio = (sum((v - media) ** 2 for v in valores) / len(valores)) ** 0.5
            agregados[n][estrategia] = {"media": media, "desvio": desvio}

    linhas_md = [
        "# OE1 -- tabela resumo (30 execucoes por celula)",
        "",
        "| n compradores | AG (R$/comprador) | Greedy volume (R$/comprador) | Greedy temporal (R$/comprador) | Reducao AG vs volume | Reducao AG vs temporal |",
        "|---|---|---|---|---|---|",
    ]

    for n in TAMANHOS_INSTANCIA:
        ag = agregados[n]["kmeans_ga"]
        vol = agregados[n]["greedy_volume"]
        tmp = agregados[n]["greedy_temporal"]

        reducao_volume = (vol["media"] - ag["media"]) / vol["media"] * 100
        reducao_temporal = (tmp["media"] - ag["media"]) / tmp["media"] * 100

        linhas_md.append(
            f"| {n} "
            f"| {ag['media']:.2f} (dp {ag['desvio']:.2f}) "
            f"| {vol['media']:.2f} (dp {vol['desvio']:.2f}) "
            f"| {tmp['media']:.2f} (dp {tmp['desvio']:.2f}) "
            f"| {reducao_volume:.1f}% "
            f"| {reducao_temporal:.1f}% |"
        )

    texto = "\n".join(linhas_md) + "\n"
    caminho = os.path.join(DIR_DOCS, "oe1-tabela-resumo.md")
    with open(caminho, "w") as f:
        f.write(texto)
    print(f"Tabela resumo salva em {caminho}")
    return texto


if __name__ == "__main__":
    print(rodar_experimento())
