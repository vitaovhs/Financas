// Gráficos do Design System (seção 12): marcas finas, uma escala por gráfico, grade discreta,
// texto nunca na cor da série, legenda sempre com 2+ séries, dica ao tocar/passar o mouse.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { OCULTO, reais, reaisCurto, reaisSaldo } from '../lib/format'
import { corCat, Icone } from './ui'

function useLargura<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(320)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(es => setW(Math.max(240, Math.floor(es[0].contentRect.width))))
    ro.observe(el)
    setW(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Escala "bonita" de 0 até o máximo (3–4 linhas de grade). */
function escala(max: number, min = 0) {
  const alcance = Math.max(1, max - min)
  const bruto = alcance / 4
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)))
  const passo = [1, 2, 2.5, 5, 10].map(f => f * mag).find(p => p >= bruto) ?? mag * 10
  const lo = Math.floor(min / passo) * passo
  const hi = Math.ceil(max / passo) * passo || passo
  const ticks: number[] = []
  for (let v = lo; v <= hi + 1e-6; v += passo) ticks.push(Math.round(v))
  return { lo, hi, ticks }
}

function Dica({ x, y, largura, children }: { x: number; y: number; largura: number; children: ReactNode }) {
  const esq = Math.min(Math.max(8, x - 90), largura - 188)
  return (
    <div className="grafico-dica" style={{ left: esq, top: Math.max(0, y - 8) }} role="status">
      {children}
    </div>
  )
}

export function Legenda({ itens }: { itens: { rot: string; cor: string; tipo?: 'barra' | 'linha' | 'tracejada'; icone?: string }[] }) {
  return (
    <div className="grafico-legenda">
      {itens.map(i => (
        <span key={i.rot}>
          {i.icone ? <Icone n={i.icone} s={16} style={{ color: i.cor }} />
            : i.tipo === 'linha' ? <span style={{ width: 14, height: 2, background: i.cor, display: 'inline-block' }} />
            : i.tipo === 'tracejada' ? <span style={{ width: 14, height: 0, borderTop: `2px dashed ${i.cor}`, display: 'inline-block' }} />
            : <span style={{ width: 10, height: 10, borderRadius: 2, background: i.cor, display: 'inline-block' }} />}
          {i.rot}
        </span>
      ))}
    </div>
  )
}

// ---------------- Barras agrupadas: entradas × saídas por mês ----------------
export function BarrasMensais({ dados, ocultar, aoTocar, altura = 200 }: {
  dados: { rot: string; titulo: string; e: number; s: number }[]; ocultar: boolean; aoTocar?: (i: number) => void; altura?: number
}) {
  const [ref, w] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const eixoE = 44, base = 22, topo = 8
  const max = Math.max(1, ...dados.flatMap(d => [d.e, d.s]))
  const { hi, ticks } = escala(max)
  const h = altura - base - topo
  const larg = (w - eixoE) / Math.max(1, dados.length)
  const barra = Math.max(3, Math.min(18, (larg - 10) / 2))
  const y = (v: number) => topo + h - (v / hi) * h
  const d = ativo != null ? dados[ativo] : null
  const rotulosVisiveis = larg < 26 ? 2 : 1
  return (
    <div ref={ref} className="grafico" onMouseLeave={() => setAtivo(null)}>
      <svg width={w} height={altura} role="img" aria-label={`Entradas e saídas por mês. ${dados.map(x => `${x.titulo}: entradas ${ocultar ? 'ocultas' : reais(x.e)}, saídas ${ocultar ? 'ocultas' : reais(x.s)}`).join('; ')}`}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={eixoE} x2={w} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--texto-secundario)' : 'var(--divisoria)'} strokeWidth={1} />
            <text x={eixoE - 6} y={y(t) + 4} textAnchor="end" className="grafico-eixo">{ocultar ? '•••' : reaisCurto(t)}</text>
          </g>
        ))}
        {dados.map((m, i) => {
          const x0 = eixoE + i * larg + (larg - (barra * 2 + 2)) / 2
          const barraRet = (v: number, x: number, cor: string) => {
            const alt = Math.max(v > 0 ? 2 : 0, (v / hi) * h)
            const r = Math.min(4, barra / 2, alt)
            const yb = topo + h
            return <path d={`M${x},${yb} V${yb - alt + r} Q${x},${yb - alt} ${x + r},${yb - alt} H${x + barra - r} Q${x + barra},${yb - alt} ${x + barra},${yb - alt + r} V${yb} Z`} fill={cor} opacity={ativo == null || ativo === i ? 1 : 0.45} />
          }
          return (
            <g key={m.rot + i}>
              {barraRet(m.e, x0, 'var(--entrada)')}
              {barraRet(m.s, x0 + barra + 2, 'var(--saida)')}
              {i % rotulosVisiveis === 0 && <text x={eixoE + i * larg + larg / 2} y={altura - 6} textAnchor="middle" className="grafico-eixo" style={{ fontWeight: ativo === i ? 600 : 500 }}>{m.rot}</text>}
              <rect x={eixoE + i * larg} y={topo} width={larg} height={h + base} fill="transparent" tabIndex={0}
                aria-label={`${m.titulo}: entradas ${ocultar ? 'ocultas' : reais(m.e)}, saídas ${ocultar ? 'ocultas' : reais(m.s)}`}
                onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)}
                onClick={() => { setAtivo(i); aoTocar?.(i) }} style={{ cursor: aoTocar ? 'pointer' : undefined, outline: 'none' }} />
            </g>
          )
        })}
      </svg>
      {d && ativo != null && (
        <Dica x={eixoE + ativo * larg + larg / 2} y={0} largura={w}>
          <strong className="t-rotulo">{d.titulo}</strong>
          <span><i style={{ background: 'var(--entrada)' }} />Entradas <b>{ocultar ? OCULTO : reais(d.e)}</b></span>
          <span><i style={{ background: 'var(--saida)' }} />Saídas <b>{ocultar ? OCULTO : reais(d.s)}</b></span>
          <span className="sec">Saldo <b>{ocultar ? OCULTO : reaisSaldo(d.e - d.s)}</b></span>
          {aoTocar && <span className="sec t-mini">Toque para abrir o mês</span>}
        </Dica>
      )}
      <Legenda itens={[{ rot: 'Entradas', cor: 'var(--entrada)', icone: 'arrow_upward' }, { rot: 'Saídas', cor: 'var(--saida)', icone: 'arrow_downward' }]} />
    </div>
  )
}

// ---------------- Linhas (saldo acumulado, ritmo de gastos) ----------------
export function Linhas({ series, rotulos, titulos, ocultar, altura = 180, zero = false, rotuloFinal }: {
  series: { nome: string; valores: (number | null)[]; cor: string; tracejada?: boolean }[]
  rotulos: string[]; titulos: string[]; ocultar: boolean; altura?: number; zero?: boolean; rotuloFinal?: boolean
}) {
  const [ref, w] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const eixoE = 44, base = 22, topo = 10, dir = 10
  const todos = series.flatMap(s => s.valores.filter((v): v is number => v != null))
  const min = Math.min(0, ...todos), max = Math.max(1, ...todos)
  const { lo, hi, ticks } = escala(max, min)
  const h = altura - base - topo
  const n = rotulos.length
  const x = (i: number) => eixoE + (n <= 1 ? (w - eixoE - dir) / 2 : (i / (n - 1)) * (w - eixoE - dir))
  const y = (v: number) => topo + h - ((v - lo) / (hi - lo)) * h
  const passoRot = Math.ceil(n / Math.max(2, Math.floor((w - eixoE) / 44)))
  const mover = (cx: number) => {
    const i = Math.round(((cx - eixoE) / Math.max(1, w - eixoE - dir)) * (n - 1))
    setAtivo(Math.max(0, Math.min(n - 1, i)))
  }
  return (
    <div ref={ref} className="grafico" onMouseLeave={() => setAtivo(null)}>
      <svg width={w} height={altura} role="img" aria-label={series.map(s => `${s.nome}: ${ocultar ? 'valores ocultos' : titulos.map((t, i) => s.valores[i] != null ? `${t} ${reaisSaldo(s.valores[i]!)}` : '').filter(Boolean).slice(-3).join(', ')}`).join('. ')}
        onPointerMove={e => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); mover(e.clientX - r.left) }}
        onPointerDown={e => { const r = (e.currentTarget as SVGElement).getBoundingClientRect(); mover(e.clientX - r.left) }}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={eixoE} x2={w - dir} y1={y(t)} y2={y(t)} stroke={t === 0 && zero ? 'var(--texto-secundario)' : 'var(--divisoria)'} strokeWidth={1} />
            <text x={eixoE - 6} y={y(t) + 4} textAnchor="end" className="grafico-eixo">{ocultar ? '•••' : (t < 0 ? '−' : '') + reaisCurto(t)}</text>
          </g>
        ))}
        {rotulos.map((r, i) => i % passoRot === 0 || i === n - 1 ? <text key={i} x={x(i)} y={altura - 6} textAnchor="middle" className="grafico-eixo">{r}</text> : null)}
        {ativo != null && <line x1={x(ativo)} x2={x(ativo)} y1={topo} y2={topo + h} stroke="var(--texto-secundario)" strokeWidth={1} />}
        {series.map(s => {
          let d = ''
          s.valores.forEach((v, i) => { if (v == null) return; d += (d && s.valores[i - 1] != null ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(v).toFixed(1) })
          const ultimo = s.valores.reduce<number>((u, v, i) => v != null ? i : u, -1)
          return (
            <g key={s.nome}>
              <path d={d} fill="none" stroke={s.cor} strokeWidth={2} strokeDasharray={s.tracejada ? '5 4' : undefined} strokeLinejoin="round" strokeLinecap="round" />
              {ultimo >= 0 && !s.tracejada && <circle cx={x(ultimo)} cy={y(s.valores[ultimo]!)} r={4} fill={s.cor} stroke="var(--superficie)" strokeWidth={2} />}
              {ativo != null && s.valores[ativo] != null && <circle cx={x(ativo)} cy={y(s.valores[ativo]!)} r={4} fill={s.cor} stroke="var(--superficie)" strokeWidth={2} />}
              {rotuloFinal && ultimo >= 0 && !s.tracejada && !ocultar && ativo == null && (
                <text x={Math.min(x(ultimo), w - dir - 4)} y={y(s.valores[ultimo]!) - 10} textAnchor="end" className="grafico-rotulo">{reaisSaldo(s.valores[ultimo]!)}</text>
              )}
            </g>
          )
        })}
      </svg>
      {ativo != null && (
        <Dica x={x(ativo)} y={0} largura={w}>
          <strong className="t-rotulo">{titulos[ativo]}</strong>
          {series.map(s => (
            <span key={s.nome}><i style={{ background: s.cor }} />{s.nome} <b>{s.valores[ativo] == null ? '—' : ocultar ? OCULTO : reaisSaldo(s.valores[ativo]!)}</b></span>
          ))}
        </Dica>
      )}
      {series.length > 1 && <Legenda itens={series.map(s => ({ rot: s.nome, cor: s.cor, tipo: s.tracejada ? 'tracejada' : 'linha' }))} />}
    </div>
  )
}

// ---------------- Ranking de categorias (barras horizontais) ----------------
export function Ranking({ itens, total, ocultar, aoTocar, limite }: {
  itens: { id: string; nome: string; icone: string; cor: number; valor: number }[]
  total: number; ocultar: boolean; aoTocar?: (id: string) => void; limite?: number
}) {
  const [todos, setTodos] = useState(false)
  const lista = limite && !todos ? itens.slice(0, limite) : itens
  const max = Math.max(1, ...itens.map(i => i.valor))
  return (
    <div className="ranking">
      <ul>
        {lista.map(i => (
          <li key={i.id}>
            <button type="button" onClick={() => aoTocar?.(i.id)} disabled={!aoTocar}
              aria-label={`${i.nome}: ${ocultar ? 'valor oculto' : reais(i.valor)}, ${Math.round((i.valor / (total || 1)) * 100)}% do total`}>
              <span className="circulo-cat" style={{ background: corCat(i.cor), width: 32, height: 32 }}><Icone n={i.icone} s={16} f /></span>
              <span className="rk-meio">
                <span className="rk-linha"><span className="rk-nome">{i.nome}</span><span className="rk-val tab">{ocultar ? OCULTO : reais(i.valor)}</span></span>
                <span className="rk-linha">
                  <span className="rk-trilho"><span style={{ width: `${Math.max(2, (i.valor / max) * 100)}%`, background: corCat(i.cor) }} /></span>
                  <span className="rk-pct tab">{ocultar ? '••%' : `${Math.round((i.valor / (total || 1)) * 100)}%`}</span>
                </span>
              </span>
              {aoTocar && <Icone n="chevron_right" s={20} style={{ color: 'var(--texto-secundario)' }} />}
            </button>
          </li>
        ))}
      </ul>
      {limite && itens.length > limite && (
        <button type="button" className="btn btn-texto" onClick={() => setTodos(t => !t)}>{todos ? 'Mostrar menos' : `Ver todas (${itens.length})`}</button>
      )}
    </div>
  )
}

// ---------------- Barras de uma categoria (12 meses) ----------------
export function BarrasCategoria({ dados, cor, selecionado, ocultar, aoTocar }: {
  dados: { rot: string; titulo: string; v: number }[]; cor: number; selecionado: number; ocultar: boolean; aoTocar?: (i: number) => void
}) {
  const [ref, w] = useLargura<HTMLDivElement>()
  const [ativo, setAtivo] = useState<number | null>(null)
  const altura = 170, eixoE = 44, base = 22, topo = 22
  const max = Math.max(1, ...dados.map(d => d.v))
  const { hi, ticks } = escala(max)
  const h = altura - base - topo
  const larg = (w - eixoE) / Math.max(1, dados.length)
  const barra = Math.max(4, Math.min(24, larg - 6))
  const y = (v: number) => topo + h - (v / hi) * h
  const foco = ativo ?? selecionado
  return (
    <div ref={ref} className="grafico" onMouseLeave={() => setAtivo(null)}>
      <svg width={w} height={altura} role="img" aria-label={dados.map(d => `${d.titulo}: ${ocultar ? 'oculto' : reais(d.v)}`).join('; ')}>
        {ticks.map(t => (
          <g key={t}>
            <line x1={eixoE} x2={w} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--texto-secundario)' : 'var(--divisoria)'} />
            <text x={eixoE - 6} y={y(t) + 4} textAnchor="end" className="grafico-eixo">{ocultar ? '•••' : reaisCurto(t)}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x = eixoE + i * larg + (larg - barra) / 2
          const alt = Math.max(d.v > 0 ? 2 : 0, (d.v / hi) * h)
          const r = Math.min(4, barra / 2, alt)
          const yb = topo + h
          return (
            <g key={i}>
              <path d={`M${x},${yb} V${yb - alt + r} Q${x},${yb - alt} ${x + r},${yb - alt} H${x + barra - r} Q${x + barra},${yb - alt} ${x + barra},${yb - alt + r} V${yb} Z`}
                fill={corCat(cor)} opacity={i === foco ? 1 : 0.4} />
              {i === foco && !ocultar && d.v > 0 && (
                <text x={Math.min(Math.max(x + barra / 2, eixoE + 30), w - 30)} y={yb - alt - 6} textAnchor="middle" className="grafico-rotulo">{reaisCurto(d.v)}</text>
              )}
              <text x={eixoE + i * larg + larg / 2} y={altura - 6} textAnchor="middle" className="grafico-eixo" style={{ fontWeight: i === foco ? 600 : 500 }}>{larg < 22 ? d.rot[0] : d.rot}</text>
              <rect x={eixoE + i * larg} y={topo} width={larg} height={h + base} fill="transparent" tabIndex={0} aria-label={`${d.titulo}: ${ocultar ? 'oculto' : reais(d.v)}`}
                onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} onClick={() => aoTocar?.(i)}
                style={{ cursor: aoTocar ? 'pointer' : undefined, outline: 'none' }} />
            </g>
          )
        })}
      </svg>
      {ativo != null && (
        <Dica x={eixoE + ativo * larg + larg / 2} y={0} largura={w}>
          <strong className="t-rotulo">{dados[ativo].titulo}</strong>
          <span><i style={{ background: corCat(cor) }} /><b>{ocultar ? OCULTO : reais(dados[ativo].v)}</b></span>
        </Dica>
      )}
    </div>
  )
}
