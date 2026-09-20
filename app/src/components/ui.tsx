import { useEffect, useId, useRef, type ReactNode } from 'react'

export function Icone({ n, s, f, className, style, rotulo }: { n: string; s?: 16 | 20 | 24; f?: boolean; className?: string; style?: React.CSSProperties; rotulo?: string }) {
  if (n.startsWith('txt:')) {
    const t = n.slice(4, 6)
    return <span className={['ms-txt', s === 20 ? 's20' : s === 16 ? 's16' : '', className ?? ''].filter(Boolean).join(' ')} style={style} aria-hidden={rotulo ? undefined : true} aria-label={rotulo} role={rotulo ? 'img' : undefined}>{t}</span>
  }
  const cls = ['ms', s === 20 ? 's20' : s === 16 ? 's16' : '', f ? 'f' : '', className ?? ''].filter(Boolean).join(' ')
  return <span className={cls} style={style} aria-hidden={rotulo ? undefined : true} aria-label={rotulo} role={rotulo ? 'img' : undefined}>{n}</span>
}

export const CORES = Array.from({ length: 24 }, (_, i) => i + 1)
export const corCat = (c: number) => `var(--cat-${Math.max(0, Math.min(24, c))})`

export function CirculoCategoria({ icone, cor, g48 }: { icone: string; cor: number; g48?: boolean }) {
  return (
    <span className={'circulo-cat' + (g48 ? ' g48' : '')} style={{ background: corCat(cor) }}>
      <Icone n={icone} s={20} f />
    </span>
  )
}

/** Folha inferior no celular; diálogo centralizado a partir de 600 px. */
export function Folha({ aberta, aoFechar, rotulo, children, alta, rodape, cabecalho, fecharAoTocarFora = true }: {
  aberta: boolean; aoFechar: () => void; rotulo: string; children: ReactNode; alta?: boolean
  rodape?: ReactNode; cabecalho?: ReactNode; fecharAoTocarFora?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const ultimoFoco = useRef<Element | null>(null)
  useEffect(() => {
    if (!aberta) return
    ultimoFoco.current = document.activeElement
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); aoFechar() } }
    document.addEventListener('keydown', onKey)
    const html = document.documentElement
    const antes = html.style.overflow
    html.style.overflow = 'hidden'
    setTimeout(() => {
      const alvo = ref.current?.querySelector<HTMLElement>('[data-autofoco]') ?? ref.current
      alvo?.focus({ preventScroll: true })
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      html.style.overflow = antes
      ;(ultimoFoco.current as HTMLElement | null)?.focus?.({ preventScroll: true })
    }
  }, [aberta]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!aberta) return null
  return (
    <div className="sobreposicao" onMouseDown={e => { if (fecharAoTocarFora && e.target === e.currentTarget) aoFechar() }}>
      <div ref={ref} className={'folha' + (alta ? ' alta' : '')} role="dialog" aria-modal="true" aria-label={rotulo} tabIndex={-1}>
        <div className="alca" />
        {cabecalho}
        <div className="folha-corpo">{children}</div>
        {rodape && <div className="folha-rodape">{rodape}</div>}
      </div>
    </div>
  )
}

export function Dialogo({ aberto, titulo, texto, confirmar, cancelar = 'Cancelar', destrutivo, aoConfirmar, aoCancelar, ocupado }: {
  aberto: boolean; titulo: string; texto: ReactNode; confirmar: string; cancelar?: string; destrutivo?: boolean
  aoConfirmar: () => void; aoCancelar: () => void; ocupado?: boolean
}) {
  const id = useId()
  useEffect(() => {
    if (!aberto) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') aoCancelar() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [aberto, aoCancelar])
  if (!aberto) return null
  return (
    <div className="sobreposicao" style={{ zIndex: 150, alignItems: 'center' }} onMouseDown={e => { if (e.target === e.currentTarget) aoCancelar() }}>
      <div className="dialogo" role="alertdialog" aria-modal="true" aria-labelledby={id}>
        <h2 id={id} className="t-secao">{titulo}</h2>
        <div className="t-corpo sec">{texto}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-secundario" onClick={aoCancelar} autoFocus>{cancelar}</button>
          <button type="button" className={'btn ' + (destrutivo ? 'btn-destrutivo' : 'btn-primario')} onClick={aoConfirmar} disabled={ocupado}>
            {ocupado ? <span className="spinner" /> : confirmar}
          </button>
        </div>
      </div>
    </div>
  )
}

export function EstadoVazio({ icone, titulo, texto, acao }: { icone: string; titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <span className="circ"><Icone n={icone} /></span>
      <h2 className="t-secao">{titulo}</h2>
      {texto && <p className="t-auxiliar sec" style={{ maxWidth: 320 }}>{texto}</p>}
      {acao}
    </div>
  )
}

export function Esqueleto({ w = '100%', h = 16, r }: { w?: number | string; h?: number; r?: number }) {
  return <span className="esqueleto" style={{ display: 'block', width: w, height: h, borderRadius: r }} />
}

export function Faixa({ tipo, icone, children, acao }: { tipo: 'erro' | 'aviso' | 'info' | 'sucesso'; icone?: string; children: ReactNode; acao?: ReactNode }) {
  const ic = icone ?? (tipo === 'erro' ? 'error' : tipo === 'aviso' ? 'warning' : tipo === 'sucesso' ? 'check_circle' : 'info')
  return (
    <div className={`faixa faixa-${tipo}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      <Icone n={ic} s={20} />
      <div style={{ flex: 1 }}>{children}</div>
      {acao}
    </div>
  )
}
