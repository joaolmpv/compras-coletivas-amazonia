"""
Modelo de custo multimodal (rodoviario, fluvial, aereo expresso).

O algoritmo e as baselines escolhem, por lote, o modal de MENOR custo entre os
modais viaveis -- nunca assumem um modal fixo (criterio 3 do OE1).
"""

from parametros import (
    AEREO_CAPACIDADE_MAX_KG,
    AEREO_FAIXAS_RS_POR_KG,
    FLUVIAL_MULTIPLICADOR,
    FLUVIAL_RS_POR_TON_KM,
    HUB_CUSTO_FIXO_DESPACHO,
    HUB_DISTANCIA_KM,
    RODOVIARIO_RS_POR_TON_KM,
)


def custo_rodoviario(peso_kg, hub):
    peso_ton = peso_kg / 1000.0
    distancia = HUB_DISTANCIA_KM[hub]
    custo_fixo = HUB_CUSTO_FIXO_DESPACHO[hub]
    return custo_fixo + RODOVIARIO_RS_POR_TON_KM * peso_ton * distancia


def custo_fluvial(peso_kg, hub, periodo):
    peso_ton = peso_kg / 1000.0
    distancia = HUB_DISTANCIA_KM[hub]
    custo_fixo = HUB_CUSTO_FIXO_DESPACHO[hub]
    multiplicador = FLUVIAL_MULTIPLICADOR[periodo]
    return custo_fixo + FLUVIAL_RS_POR_TON_KM * peso_ton * distancia * multiplicador


def custo_aereo(peso_kg):
    if peso_kg > AEREO_CAPACIDADE_MAX_KG:
        return None
    for limite_kg, tarifa_rs_kg in AEREO_FAIXAS_RS_POR_KG:
        if peso_kg <= limite_kg:
            return tarifa_rs_kg * peso_kg
    return None


def menor_custo_modal(peso_kg, hub, periodo):
    """Retorna (modal, custo) -- o modal viavel de menor custo para o lote."""
    candidatos = {
        "rodoviario": custo_rodoviario(peso_kg, hub),
        "fluvial": custo_fluvial(peso_kg, hub, periodo),
    }
    custo_aereo_valor = custo_aereo(peso_kg)
    if custo_aereo_valor is not None:
        candidatos["aereo"] = custo_aereo_valor

    modal = min(candidatos, key=candidatos.get)
    return modal, candidatos[modal]
