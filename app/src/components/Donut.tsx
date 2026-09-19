import { useState } from 'react'
import { corCat } from './ui'

export interface Fatia { id: string; nome: string; valor: number; cor: number }

/** Donut "para onde foi": no máximo 7 fatias, 2 px de espaço, começa no topo, maiores primeiro no sentido horário. */
export function Donut({ fatias, total, centro, sub, tamanho = 168, aoTocar, destaque }: {
  fatias: Fatia[]; total: number; centro: string; sub: string; tamanho?: number
  aoTocar?: (f: Fatia) => void; destaque?: string | null
}) {
  const [hover, setHover] = useState<string | null>(null)
  const esp = 20
  const r = (tamanho - esp) / 2
  const C = 2 * Math.PI * r
  const gap = fatias.length > 1 ? 2 : 0
  let acumulado = 0
  const ativo = hover ?? destaque ?? null
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} role="img" aria-label={`${centro} ${sub}`} style={{ flex: 'none' }}>
      <circle cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none" stroke="var(--fundo)" strokeWidth={esp} />
      <g transform={`rotate(-90 ${tamanho / 2} ${tamanho / 2})`}>
        {total > 0 && fatias.map(f => {
          const comp = (f.valor / total) * C
          const el = (
            <circle key={f.id} cx={tamanho / 2} cy={tamanho / 2} r={r} fill="none"
              stroke={corCat(f.cor)} strokeWidth={ativo === f.id ? esp + 4 : esp}
              strokeDasharray={`${Math.max(0.5, comp - gap)} ${C}`} strokeDashoffset={-acumulado}
              style={{ cursor: aoTocar ? 'pointer' : undefined, opacity: ativo && ativo !== f.id ? 0.55 : 1, transition: 'opacity .15s, stroke-width .15s' }}
              onMouseEnter={() => setHover(f.id)} onMouseLeave={() => setHover(null)}
              onClick={() => aoTocar?.(f)}>
              <title>{f.nome}</title>
            </circle>
          )
          acumulado += comp
          return el
        })}
      </g>
      <text x="50%" y="47%" textAnchor="middle" style={{ fontSize: centro.length > 12 ? 15 : 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums', fill: 'var(--texto)' }}>{centro}</text>
      <text x="50%" y="60%" textAnchor="middle" style={{ fontSize: 12, fontWeight: 500, fill: 'var(--texto-secundario)' }}>{sub}</text>
    </svg>
  )
}
