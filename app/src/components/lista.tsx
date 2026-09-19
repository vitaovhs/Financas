import { useRef, useState, type PointerEvent as RPE } from 'react'
import type { Categoria, Lancamento } from '../data/types'
import { OCULTO, reais, reaisFalado, reaisLiquido, reaisSinal, rotuloDia } from '../lib/format'
import { CirculoCategoria, Icone } from './ui'

export function ItemLancamento({ l, cat, ocultar, recem, aoAbrir, aoExcluir }: {
  l: Lancamento; cat?: Categoria; ocultar: boolean; recem?: boolean
  aoAbrir: () => void; aoExcluir?: () => void
}) {
  const [dx, setDx] = useState(0)
  const ini = useRef<{ x: number; y: number; arrastando: boolean; cancelado: boolean; base: number } | null>(null)
  const LIMITE = 88
  const onDown = (e: RPE) => {
    if (!aoExcluir || e.pointerType === 'mouse') return
    ini.current = { x: e.clientX, y: e.clientY, arrastando: false, cancelado: false, base: dx }
  }
  const onMove = (e: RPE) => {
    const s = ini.current
    if (!s || s.cancelado) return
    const mx = e.clientX - s.x, my = e.clientY - s.y
    if (!s.arrastando) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { s.cancelado = true; return }
      if (Math.abs(mx) > 10) { s.arrastando = true; (e.currentTarget as Element).setPointerCapture(e.pointerId) }
    }
    if (s.arrastando) setDx(Math.min(0, Math.max(-160, s.base + mx)))
  }
  const onUp = () => {
    const s = ini.current
    ini.current = null
    if (!s?.arrastando) return
    if (dx <= -140) { setDx(0); aoExcluir?.() }
    else setDx(dx < -LIMITE / 2 ? -LIMITE : 0)
  }
  const nome = l.description?.trim() || cat?.name || 'Lançamento'
  const valor = ocultar ? OCULTO : reaisSinal(l.amount_cents, l.kind)
  const falado = `${nome}, ${cat?.name ?? ''}, ${l.kind === 'saida' ? 'saída' : 'entrada'} de ${ocultar ? 'valor oculto' : reaisFalado(l.amount_cents)}${l.anexo ? ', com foto' : ''}`
  return (
    <div style={{ position: 'relative', overflow: 'hidden' }}>
      {aoExcluir && dx < 0 && (
        <button type="button" onClick={() => { setDx(0); aoExcluir() }} tabIndex={-1}
          style={{ position: 'absolute', inset: 0, border: 0, background: 'var(--erro)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, paddingRight: 20, fontWeight: 600, fontSize: 14 }}>
          <Icone n="delete" s={20} />Excluir
        </button>
      )}
      <button type="button" className={'item-lanc' + (recem ? ' recem' : '')} onClick={() => { if (dx < 0) { setDx(0); return } aoAbrir() }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        aria-label={falado}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: ini.current?.arrastando ? 'none' : 'transform .18s ease-out', touchAction: 'pan-y' }}>
        <CirculoCategoria icone={cat?.icon ?? 'label'} cor={cat?.color ?? 0} />
        <span className="meio">
          <span className="desc">{nome}</span>
          <span className="cat">{cat?.name ?? '—'}{l.anexo && <> · <Icone n="attach_file" s={16} /></>}</span>
        </span>
        <span className={'valor ' + (l.kind === 'saida' ? 'v-saida' : 'v-entrada')}>{valor}</span>
      </button>
    </div>
  )
}

export function ListaPorDia({ itens, cats, ocultar, recemSalvo, aoAbrir, aoExcluir, limite }: {
  itens: Lancamento[]; cats: Map<string, Categoria>; ocultar: boolean; recemSalvo?: string | null
  aoAbrir: (l: Lancamento) => void; aoExcluir?: (l: Lancamento) => void; limite?: number
}) {
  const lista = limite ? itens.slice(0, limite) : itens
  const grupos: { dia: string; itens: Lancamento[]; total: number }[] = []
  for (const l of lista) {
    let g = grupos[grupos.length - 1]
    if (!g || g.dia !== l.date) { g = { dia: l.date, itens: [], total: 0 }; grupos.push(g) }
    g.itens.push(l)
    g.total += l.kind === 'entrada' ? l.amount_cents : -l.amount_cents
  }
  return (
    <>
      {grupos.map(g => (
        <section key={g.dia} aria-label={rotuloDia(g.dia)}>
          <div className="cab-dia"><span>{rotuloDia(g.dia)}</span><span className="tab">{ocultar ? OCULTO : reaisLiquido(g.total)}</span></div>
          {g.itens.map(l => (
            <ItemLancamento key={l.id} l={l} cat={cats.get(l.category_id)} ocultar={ocultar} recem={recemSalvo === l.id}
              aoAbrir={() => aoAbrir(l)} aoExcluir={aoExcluir ? () => aoExcluir(l) : undefined} />
          ))}
        </section>
      ))}
    </>
  )
}

/** Resumo Entradas · Saídas · Saldo em 3 colunas. */
export function Resumo3({ entradas, saidas, ocultar }: { entradas: number; saidas: number; ocultar: boolean }) {
  const col = (rot: React.ReactNode, v: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span className="t-auxiliar sec" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{rot}</span>
      <span className="t-corpo-forte tab resumo3-valor" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
    </div>
  )
  const saldo = entradas - saidas
  return (
    <div className="card" style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
      {col(<><Icone n="arrow_upward" s={16} style={{ color: 'var(--entrada)' }} />Entradas</>, ocultar ? OCULTO : reais(entradas))}
      {col(<><Icone n="arrow_downward" s={16} style={{ color: 'var(--saida)' }} />Saídas</>, ocultar ? OCULTO : reais(saidas))}
      {col('Saldo', ocultar ? OCULTO : (saldo < 0 ? '−' : '') + reais(saldo))}
    </div>
  )
}
