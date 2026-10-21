"""
Gera um grafico comparando o custo de frete SEM compra coletiva (baseline)
com o custo COM os lotes otimizados pelo algoritmo genetico (OE1).

Usado para produzir a imagem em docs/screenshots/otimizacao-resultado.png
referenciada no README -- nao ha interface grafica no protototipo atual
(o frontend em Next.js e o OE3, planejado para out/2026), entao este e o
"screenshot" real e verificavel do que o modulo de otimizacao entrega hoje.

Uso:
    pip install -r requirements.txt
    python plot_result.py
"""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from genetic_algorithm import (
    gerar_pedidos,
    clusterizar_por_hub,
    custo_baseline_sem_consolidacao,
    otimizar,
    N_ORDERS,
)


def main():
    pedidos = gerar_pedidos(N_ORDERS)
    clusters = clusterizar_por_hub(pedidos)

    baseline = custo_baseline_sem_consolidacao(pedidos)
    _melhor, otimizado = otimizar(clusters)
    economia_pct = (baseline - otimizado) / baseline * 100

    fig, ax = plt.subplots(figsize=(6, 4.5), dpi=150)
    fig.patch.set_facecolor("#0f172a")
    ax.set_facecolor("#0f172a")

    labels = ["Sem compra\ncoletiva", "Com lotes\notimizados (GA)"]
    valores = [baseline, otimizado]
    cores = ["#64748b", "#22c55e"]

    bars = ax.bar(labels, valores, color=cores, width=0.5)
    for bar, valor in zip(bars, valores):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            valor + baseline * 0.02,
            f"R$ {valor:,.0f}",
            ha="center",
            color="white",
            fontsize=11,
            fontweight="bold",
        )

    ax.set_title(
        f"Custo de frete — {N_ORDERS} pedidos simulados\nEconomia estimada: {economia_pct:.1f}%",
        color="white",
        fontsize=12,
    )
    ax.tick_params(colors="white")
    for spine in ax.spines.values():
        spine.set_visible(False)
    ax.set_yticks([])

    fig.tight_layout()
    fig.savefig("../../docs/screenshots/otimizacao-resultado.png", facecolor=fig.get_facecolor())
    print("Grafico salvo em docs/screenshots/otimizacao-resultado.png")


if __name__ == "__main__":
    main()
