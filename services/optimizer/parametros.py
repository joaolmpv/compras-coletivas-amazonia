"""
Parametros do experimento OE1 (10/50/200 compradores, 3 modais).
Fonte ou premissa de cada valor documentada em PARAMETROS.md -- nao altere um
numero aqui sem atualizar a linha correspondente naquele arquivo.
"""

HUBS = ["Manaus", "Santarem", "Belem"]

HUB_DISTANCIA_KM = {
    "Manaus": 80,
    "Santarem": 850,
    "Belem": 1300,
}

HUB_CUSTO_FIXO_DESPACHO = {
    "Manaus": 1800.0,
    "Santarem": 2400.0,
    "Belem": 2000.0,
}

HUB_CAPACIDADE_M3 = {
    "Manaus": 40.0,
    "Santarem": 30.0,
    "Belem": 35.0,
}

DENSIDADE_CARGA_KG_POR_M3 = 250.0

RODOVIARIO_RS_POR_TON_KM = 0.620

FLUVIAL_RS_POR_TON_KM = 0.970
FLUVIAL_MULTIPLICADOR = {"cheia": 1.0, "seca": 1.35}

# Faixas tarifarias do aereo expresso: (limite_superior_kg, tarifa_rs_por_kg),
# em ordem crescente de limite.
AEREO_FAIXAS_RS_POR_KG = [
    (50, 70.0),
    (200, 50.0),
    (float("inf"), 30.0),
]
AEREO_CAPACIDADE_MAX_KG = 500.0

MAX_LOTES_POR_GRUPO = 6  # genes disponiveis para o AG agrupar clusters por (hub, periodo)

GA_POPULACAO = 80
GA_GERACOES = 60  # usado por v1/v2 (_rodar_ga) -- NAO mude, quebraria a reprodutibilidade das duas ja commitadas
GA_CXPB = 0.6
GA_MUTPB = 0.3
GA_TOURNSIZE = 3

# v3: 60 nao estabilizava nas seeds de ajuste para n=50,m=4 (2.47% de variacao
# nas ultimas 10 geracoes, acima do limiar de 1% fixado a priori, calculado
# ANTES de rodar o experimento v3). Com 90, o mesmo caso estabiliza (0.61%).
# Usado apenas pelo nucleo NSGA-II (_rodar_ga_nsga2) -- ver PARAMETROS.md,
# secao "v3 -- verificacao de convergencia".
GA_GERACOES_V3 = 90

LIMIAR_TEMPORAL_DIAS = 3

TAMANHOS_INSTANCIA = [10, 50, 200]
N_RUNS = 30

# --- v2: protocolo de ajuste (ver PARAMETROS.md) ---------------------------

M_CANDIDATOS = [2, 3, 4, 6, 8]
LIMIAR_VOLUME_FRACOES_CANDIDATAS = [0.5, 0.6, 0.75, 0.9, 1.0]
N_TUNING_RUNS = 10

# Offsets de seed: ajuste e avaliacao usam faixas disjuntas de seed, para que
# nenhuma seed usada para ESCOLHER m/limiar seja reusada para MEDIR o
# resultado final.
OFFSET_SEED_AVALIACAO = 0       # seeds n*1000 + 0..N_RUNS-1
OFFSET_SEED_AJUSTE = 500        # seeds n*1000 + 500..500+N_TUNING_RUNS-1
