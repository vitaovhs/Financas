"""Gera um subconjunto da fonte Material Symbols Rounded só com os ícones usados no app.
Uso: python3 scripts/subset-icons.py
Lê os nomes de ícones em src/ e na migração SQL + lista extra (seletor de ícones de categorias),
fixa peso 400 e GRAD 0, mantém o eixo FILL (contorno/preenchido) e opsz 20–24.
"""
import re, pathlib, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ORIGEM = RAIZ / 'node_modules/material-symbols/material-symbols-rounded.woff2'
DESTINO = RAIZ / 'src/assets/material-symbols-rounded.woff2'

# Ícones do seletor de categorias (Entrega 3) e genéricos — já incluídos para não precisar regerar.
EXTRAS = '''
pets redeem cake checkroom spa fitness_center local_pharmacy local_hospital child_care celebration
local_cafe local_bar fastfood local_pizza bakery_dining icecream liquor sports_soccer sports_esports
theaters music_note movie book menu_book local_library smartphone computer wifi bolt water_drop
local_fire_department electric_bolt propane_tank cleaning_services local_laundry_service chair bed
construction handyman plumbing yard park beach_access hotel luggage train directions_bus
two_wheeler local_taxi local_parking ev_station directions_car car_repair tire_repair
account_balance savings paid attach_money request_quote receipt_long credit_card wallet
card_giftcard volunteer_activism church family_restroom elderly face diamond brush content_cut
checkroom dry_cleaning shopping_basket storefront store local_mall local_grocery_store
medical_services medication vaccines dentistry visibility psychology school work business_center
engineering badge groups apartment home house cottage security gavel description label
more_horiz person folder category calculate campaign cloud devices inventory_2 local_shipping
handshake sell payments trending_up trending_down percent move_to_inbox account_balance_wallet
subscriptions flight toll build restaurant shopping_cart shopping_bag local_gas_station receipt
'''.split()

def nomes_usados():
    achados = set(EXTRAS)
    padroes = [r"""n=["']([a-z0-9_]+)["']""", r"""icone[:=]\s*["']([a-z0-9_]+)["']""", r"""'([a-z0-9_]+)'""", r'"([a-z0-9_]+)"', r'>([a-z0-9_]+)<']
    arquivos = list((RAIZ / 'src').rglob('*.ts*')) + list((RAIZ.parent / 'supabase/migrations').glob('*.sql'))
    for arq in arquivos:
        txt = arq.read_text(encoding='utf-8')
        for p in padroes:
            achados.update(re.findall(p, txt))
    return achados

def main():
    fonte = TTFont(str(ORIGEM))
    # 1) mapa ligadura -> glifo
    cmap = fonte.getBestCmap()
    glifo_de = {v: chr(k) for k, v in cmap.items()}
    candidatos = nomes_usados()
    gsub = fonte['GSUB'].table
    mantidos = set()
    for lookup in gsub.LookupList.Lookup:
        subtabelas = [st.ExtSubTable if lookup.LookupType == 7 else st for st in lookup.SubTable]
        for st in subtabelas:
            if getattr(st, 'LookupType', lookup.LookupType) != 4 or not hasattr(st, 'ligatures'):
                continue
            novas = {}
            for primeiro, ligas in st.ligatures.items():
                ficam = []
                for lg in ligas:
                    nome = glifo_de.get(primeiro, '') + ''.join(glifo_de.get(c, '?') for c in lg.Component)
                    if nome in candidatos:
                        ficam.append(lg)
                        mantidos.add(nome)
                if ficam:
                    novas[primeiro] = ficam
            st.ligatures = novas
    faltando = sorted(n for n in candidatos if n in set(EXTRAS) and n not in mantidos)
    if faltando:
        print('Aviso: sem glifo para', ', '.join(faltando), file=sys.stderr)
    # 3) subconjunto: letras, dígitos e _ + glifos alcançados pelas ligaduras restantes
    opcoes = subset.Options()
    opcoes.layout_features = ['liga', 'rlig', 'calt', 'ccmp']
    opcoes.flavor = 'woff2'
    opcoes.name_IDs = ['*']
    opcoes.notdef_outline = True
    sub = subset.Subsetter(opcoes)
    sub.populate(text='abcdefghijklmnopqrstuvwxyz0123456789_ ')
    sub.subset(fonte)
    # 3b) fixar eixos para reduzir tamanho (peso 400, GRAD 0; FILL e opsz 20–24 continuam)
    fonte = instancer.instantiateVariableFont(fonte, {'wght': 400, 'GRAD': 0, 'opsz': (20, 24)})
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    fonte.flavor = 'woff2'
    fonte.save(str(DESTINO))
    print(f'{len(mantidos)} ícones · {DESTINO.stat().st_size // 1024} KB → {DESTINO.relative_to(RAIZ)}')

if __name__ == '__main__':
    main()
