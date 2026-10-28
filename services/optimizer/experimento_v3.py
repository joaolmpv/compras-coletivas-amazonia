"""
Experimento OE1 v3 -- ultima iteracao. Mudancas em relacao a v2 (ver
PARAMETROS.md, secao "Historico de versoes", para o detalhamento):

  1. 30 INSTANCIAS distintas por tamanho (seed por instancia), nao uma
     instancia fixa reusada em 30 execucoes -- comparacao pareada: todas as
     5 estrategias rodam sobre a MESMA instancia em cada run.
  2. GA_GERACOES aumentado de 60 para 90 (nao estabilizava em n=50,m=4 nas
     seeds de ajuste -- ver verificacao em PARAMETROS.md).
  3. kmeans_ga e ag_direto agora usam NSGA-II (aptidao multiobjetivo: custo +
     tempo de espera medio), nao mais soma ponderada. Reportam a fronteira de
     Pareto; a tabela comparativa usa o PONTO DE MENOR CUSTO da fronteira de
     cada execucao (regra fixada antes de rodar -- consistente com o criterio
     de sucesso do OE1, que e definido em termos de custo), reportando
     tambem o tempo de espera DESSE MESMO ponto.
  4. Baseline "sem consolidacao" (pedido a pedido) reintroduzida.
  5. Custo E espera reportados para as 5 estrategias, sem selecionar metrica
     a posteriori.

m e limiar_fracao (greedy_volume) sao ajustados DO ZERO aqui, com o RNG
corrigido -- NAO herdados da v2 (o m escolhido na v2 rodou com o bug de seed
e nao e confiavel; ver ERRATA em PARAMETROS.md).

Uso:
    .venv/bin/python experimento_v3.py
"""

import csv
import json
import os
import subprocess
import sys
from importlib.metadata import version

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

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
from parametros import N_RUNS, OFFSET_SEED_AVALIACAO, TAMANHOS_INSTANCIA
from tuning import ajustar_limiar_volume, ajustar_m

RAIZ = os.path.dirname(os.path.abspath(__file__))
DIR_RESULTADOS = os.path.join(RAIZ, "resultados")
DIR_DOCS = os.path.join(RAIZ, "..", "..", "docs")

ESTRATEGIAS_BASELINE = ("greedy_volume", "greedy_temporal", "sem_consolidacao")
ESTRATEGIAS_GA = ("kmeans_ga", "ag_direto")
TODAS_ESTRATEGIAS = ESTRATEGIAS_GA + ESTRATEGIAS_BASELINE


def media(valores):
    return sum(valores) / len(valores)


def desvio(valores):
    m = media(valores)
    return (sum((v - m) ** 2 for v in valores) / len(valores)) ** 0.5


def gravar_metadados():
    try:
        commit_hash = (
            subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=RAIZ)
            .decode()
            .strip()
        )
    except Exception:
        commit_hash = "desconhecido (git rev-parse falhou)"

    metadados = {
        "commit_hash": commit_hash,
        "commit_hash_nota": (
            "HEAD no momento da execucao -- e o commit ANTERIOR ao que "
            "adiciona estes resultados, ja que os proprios resultados ainda "
            "nao estavam commitados quando o experimento rodou."
        ),
        "python_version": sys.version,
        "bibliotecas": {
            "deap": version("deap"),
            "numpy": version("numpy"),
            "scikit-learn": version("scikit-learn"),
            "matplotlib": version("matplotlib"),
        },
    }
    caminho = os.path.join(DIR_RESULTADOS, "oe1_v3_metadados.json")
    with open(caminho, "w") as f:
        json.dump(metadados, f, indent=2)
    print(f"Metadados salvos em {caminho}")


def rodar():
    os.makedirs(DIR_RESULTADOS, exist_ok=True)
    os.makedirs(DIR_DOCS, exist_ok=True)
    gravar_metadados()

    # m / limiar_fracao ajustados DO ZERO aqui (RNG corrigido -- ver ERRATA em
    # PARAMETROS.md). NAO herdados da v2: o m escolhido na v2 rodou com o bug
    # de seed e nao e confiavel.
    parametros_congelados = {}
    for n in TAMANHOS_INSTANCIA:
        pedidos_ajuste = gerar_pedidos(n, seed=n)
        melhor_m, _ = ajustar_m(pedidos_ajuste, n)
        melhor_fracao, _ = ajustar_limiar_volume(pedidos_ajuste, n)
        parametros_congelados[n] = {"m": melhor_m, "limiar_fracao": melhor_fracao}
        print(f"n={n}: ajuste (RNG corrigido) -- m={melhor_m}, limiar_fracao={melhor_fracao}")

    linhas_csv = []
    pontos_pareto = {n: {"kmeans_ga": [], "ag_direto": []} for n in TAMANHOS_INSTANCIA}
    curvas_convergencia = {n: {"kmeans_ga": [], "ag_direto": []} for n in TAMANHOS_INSTANCIA}

    for n in TAMANHOS_INSTANCIA:
        m = parametros_congelados[n]["m"]
        limiar_fracao = parametros_congelados[n]["limiar_fracao"]

        for run in range(N_RUNS):
            seed = n * 1000 + OFFSET_SEED_AVALIACAO + run
            pedidos = gerar_pedidos(n, seed=seed)  # instancia NOVA por run (pareado)

            resultados_run = {}

            frente_ga, minimos_ga, geracao_ga = estrategia_kmeans_ga_nsga2(pedidos, seed, m)
            pontos_pareto[n]["kmeans_ga"].extend(
                (p["custo"] / n, p["espera_media"]) for p in frente_ga
            )
            curvas_convergencia[n]["kmeans_ga"].append(minimos_ga)
            ponto_ga = min(frente_ga, key=lambda p: p["custo"])
            resultados_run["kmeans_ga"] = {
                "custo": ponto_ga["custo"],
                "espera": ponto_ga["espera_media"],
                "geracoes_convergencia": geracao_ga,
            }

            frente_direto, minimos_direto, geracao_direto = estrategia_ag_direto_nsga2(
                pedidos, seed
            )
            pontos_pareto[n]["ag_direto"].extend(
                (p["custo"] / n, p["espera_media"]) for p in frente_direto
            )
            curvas_convergencia[n]["ag_direto"].append(minimos_direto)
            ponto_direto = min(frente_direto, key=lambda p: p["custo"])
            resultados_run["ag_direto"] = {
                "custo": ponto_direto["custo"],
                "espera": ponto_direto["espera_media"],
                "geracoes_convergencia": geracao_direto,
            }

            lotes_volume = estrategia_greedy_volume(pedidos, limiar_fracao)
            resultados_run["greedy_volume"] = {
                "custo": custo_total_particao(lotes_volume),
                "espera": media(tempo_espera_particao(lotes_volume)),
                "geracoes_convergencia": "",
            }

            lotes_temporal = estrategia_greedy_temporal(pedidos)
            resultados_run["greedy_temporal"] = {
                "custo": custo_total_particao(lotes_temporal),
                "espera": media(tempo_espera_particao(lotes_temporal)),
                "geracoes_convergencia": "",
            }

            lotes_sem = estrategia_sem_consolidacao(pedidos)
            resultados_run["sem_consolidacao"] = {
                "custo": custo_total_particao(lotes_sem),
                "espera": media(tempo_espera_particao(lotes_sem)),
                "geracoes_convergencia": "",
            }

            for estrategia in TODAS_ESTRATEGIAS:
                r = resultados_run[estrategia]
                linhas_csv.append(
                    {
                        "instancia_n": n,
                        "run": run,
                        "seed": seed,
                        "estrategia": estrategia,
                        "custo_total": r["custo"],
                        "custo_medio_por_comprador": r["custo"] / n,
                        "espera_media_dias": r["espera"],
                        "geracoes_convergencia": r["geracoes_convergencia"],
                    }
                )

        print(f"n={n}: v3 concluida ({N_RUNS} instancias pareadas x 5 estrategias)")

    caminho_csv = os.path.join(DIR_RESULTADOS, "oe1_execucoes-v3-pareado.csv")
    with open(caminho_csv, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(linhas_csv[0].keys()))
        writer.writeheader()
        writer.writerows(linhas_csv)
    print(f"CSV salvo em {caminho_csv}")

    gerar_curva_convergencia(curvas_convergencia)
    gerar_grafico_pareto(pontos_pareto)
    tabela = gerar_tabela_resumo(linhas_csv, parametros_congelados)
    return tabela


def gerar_curva_convergencia(curvas_convergencia):
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5), dpi=150)
    fig.patch.set_facecolor("#0f172a")
    cores = {10: "#60a5fa", 50: "#22c55e", 200: "#f97316"}

    for ax, estrategia, titulo in (
        (ax1, "kmeans_ga", "kmeans_ga (NSGA-II)"),
        (ax2, "ag_direto", "ag_direto (NSGA-II, sem K-Means)"),
    ):
        ax.set_facecolor("#0f172a")
        for n, curvas in curvas_convergencia.items():
            serie = curvas[estrategia]
            comprimento = min(len(c) for c in serie)
            matriz = [c[:comprimento] for c in serie]
            media_por_geracao = [sum(col) / len(col) for col in zip(*matriz)]
            ax.plot(media_por_geracao, label=f"n={n}", color=cores.get(n, "white"))
        ax.set_title(titulo, color="white")
        ax.set_xlabel("Geracao", color="white")
        ax.set_ylabel("Custo minimo na populacao (R$)", color="white")
        ax.tick_params(colors="white")
        ax.legend(facecolor="#1e293b", labelcolor="white")
        for spine in ax.spines.values():
            spine.set_visible(False)

    caminho = os.path.join(DIR_DOCS, "oe1-convergencia-ga-v3.png")
    fig.tight_layout()
    fig.savefig(caminho, facecolor=fig.get_facecolor())
    print(f"Curva de convergencia salva em {caminho}")


def gerar_grafico_pareto(pontos_pareto):
    fig, axes = plt.subplots(1, 3, figsize=(16, 5), dpi=150)
    fig.patch.set_facecolor("#0f172a")

    for ax, n in zip(axes, TAMANHOS_INSTANCIA):
        ax.set_facecolor("#0f172a")
        xs_ga, ys_ga = zip(*pontos_pareto[n]["kmeans_ga"])
        xs_direto, ys_direto = zip(*pontos_pareto[n]["ag_direto"])
        ax.scatter(xs_ga, ys_ga, s=8, color="#22c55e", alpha=0.4, label="kmeans_ga")
        ax.scatter(xs_direto, ys_direto, s=8, color="#f97316", alpha=0.4, label="ag_direto")
        ax.set_title(f"n={n} -- fronteiras de Pareto (30 execucoes)", color="white", fontsize=10)
        ax.set_xlabel("Custo/comprador (R$)", color="white")
        ax.set_ylabel("Espera media (dias)", color="white")
        ax.tick_params(colors="white")
        ax.legend(facecolor="#1e293b", labelcolor="white", fontsize=8)
        for spine in ax.spines.values():
            spine.set_visible(False)

    caminho = os.path.join(DIR_DOCS, "oe1-pareto-v3.png")
    fig.tight_layout()
    fig.savefig(caminho, facecolor=fig.get_facecolor())
    print(f"Grafico da fronteira de Pareto salvo em {caminho}")


def gerar_tabela_resumo(linhas, parametros_congelados):
    agregados = {}
    for n in TAMANHOS_INSTANCIA:
        agregados[n] = {}
        for estrategia in TODAS_ESTRATEGIAS:
            subset = [l for l in linhas if l["instancia_n"] == n and l["estrategia"] == estrategia]
            custos = [l["custo_medio_por_comprador"] for l in subset]
            esperas = [l["espera_media_dias"] for l in subset]
            agregados[n][estrategia] = {
                "custo_media": media(custos),
                "custo_dp": desvio(custos),
                "espera_media": media(esperas),
                "espera_dp": desvio(esperas),
            }

    # Diferencas PAREADAS (mesma instancia/run) entre kmeans_ga e cada baseline
    pareado = {}
    for n in TAMANHOS_INSTANCIA:
        por_run = {}
        for l in linhas:
            if l["instancia_n"] != n:
                continue
            por_run.setdefault(l["run"], {})[l["estrategia"]] = l["custo_medio_por_comprador"]
        pareado[n] = {}
        for baseline in ESTRATEGIAS_BASELINE:
            deltas = [
                dados[baseline] - dados["kmeans_ga"]
                for dados in por_run.values()
                if baseline in dados and "kmeans_ga" in dados
            ]
            pareado[n][baseline] = {"delta_media": media(deltas), "delta_dp": desvio(deltas)}

    linhas_md = [
        "# OE1 -- tabela resumo v3 (30 instancias pareadas por tamanho, NSGA-II)",
        "",
        "m / limiar_fracao ajustados do zero nesta versao, com o RNG corrigido",
        "(nao herdados da v2 -- ver ERRATA em PARAMETROS.md):",
        "",
    ]
    for n in TAMANHOS_INSTANCIA:
        linhas_md.append(
            f"- n={n}: m={parametros_congelados[n]['m']}, "
            f"limiar_fracao={parametros_congelados[n]['limiar_fracao']}"
        )

    linhas_md += [
        "",
        "Para kmeans_ga e ag_direto, cada execucao e o PONTO DE MENOR CUSTO da",
        "fronteira de Pareto NSGA-II daquela execucao (regra fixada antes de",
        "rodar) -- o tempo de espera reportado e o DESSE MESMO ponto, nao o",
        "menor tempo de espera da fronteira. Fronteiras completas em",
        "docs/oe1-pareto-v3.png.",
        "",
        "## Custo medio por comprador (R$) -- 5 estrategias",
        "",
        "| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | sem_consolidacao |",
        "|---|---|---|---|---|---|",
    ]
    for n in TAMANHOS_INSTANCIA:
        a = agregados[n]
        linhas_md.append(
            "| {n} | {ga} | {direto} | {vol} | {temp} | {sem} |".format(
                n=n,
                ga=f"{a['kmeans_ga']['custo_media']:.2f} (dp {a['kmeans_ga']['custo_dp']:.2f})",
                direto=f"{a['ag_direto']['custo_media']:.2f} (dp {a['ag_direto']['custo_dp']:.2f})",
                vol=f"{a['greedy_volume']['custo_media']:.2f} (dp {a['greedy_volume']['custo_dp']:.2f})",
                temp=f"{a['greedy_temporal']['custo_media']:.2f} (dp {a['greedy_temporal']['custo_dp']:.2f})",
                sem=f"{a['sem_consolidacao']['custo_media']:.2f} (dp {a['sem_consolidacao']['custo_dp']:.2f})",
            )
        )

    linhas_md += [
        "",
        "## Tempo de espera medio por pedido (dias) -- 5 estrategias",
        "",
        "| n | kmeans_ga | ag_direto | greedy_volume | greedy_temporal | sem_consolidacao |",
        "|---|---|---|---|---|---|",
    ]
    for n in TAMANHOS_INSTANCIA:
        a = agregados[n]
        linhas_md.append(
            "| {n} | {ga} | {direto} | {vol} | {temp} | {sem} |".format(
                n=n,
                ga=f"{a['kmeans_ga']['espera_media']:.2f} (dp {a['kmeans_ga']['espera_dp']:.2f})",
                direto=f"{a['ag_direto']['espera_media']:.2f} (dp {a['ag_direto']['espera_dp']:.2f})",
                vol=f"{a['greedy_volume']['espera_media']:.2f} (dp {a['greedy_volume']['espera_dp']:.2f})",
                temp=f"{a['greedy_temporal']['espera_media']:.2f} (dp {a['greedy_temporal']['espera_dp']:.2f})",
                sem=f"{a['sem_consolidacao']['espera_media']:.2f} (dp {a['sem_consolidacao']['espera_dp']:.2f})",
            )
        )

    linhas_md += [
        "",
        "## Reducao de custo de kmeans_ga vs cada baseline -- diferenca PAREADA (mesma instancia)",
        "",
        "| n | vs greedy_volume | vs greedy_temporal | vs sem_consolidacao |",
        "|---|---|---|---|",
    ]
    for n in TAMANHOS_INSTANCIA:
        celulas = []
        for baseline in ESTRATEGIAS_BASELINE:
            d = pareado[n][baseline]
            base_media = agregados[n][baseline]["custo_media"]
            reducao_pct = d["delta_media"] / base_media * 100
            celulas.append(f"{reducao_pct:.1f}% (delta medio {d['delta_media']:.2f}, dp {d['delta_dp']:.2f})")
        linhas_md.append(f"| {n} | {celulas[0]} | {celulas[1]} | {celulas[2]} |")

    texto = "\n".join(linhas_md) + "\n"
    caminho = os.path.join(DIR_DOCS, "oe1-tabela-resumo-v3.md")
    with open(caminho, "w") as f:
        f.write(texto)
    print(f"Tabela resumo salva em {caminho}")
    return texto


if __name__ == "__main__":
    print(rodar())
