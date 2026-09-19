import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { repo } from '../data'
import type { Ambiente, Categoria, Lancamento, Perfil, Sessao } from '../data/types'
import { fimMes, inicioMes, mesAtual, somaMes, type Mes } from '../lib/format'
import { Icone } from '../components/ui'

// ---------------- Preferências locais (nenhum dado financeiro) ----------------
const pref = {
  ler(k: string): string | null { try { return localStorage.getItem('fin.' + k) } catch { return null } },
  gravar(k: string, v: string) { try { localStorage.setItem('fin.' + k, v) } catch { /* ok */ } },
}

// ---------------- Aviso flutuante ----------------
interface Toast { id: number; texto: string; sub?: string; icone?: string; acao?: { rotulo: string; fn: () => void }; ms: number }

// ---------------- Lançamento (folha) ----------------
export type AberturaLancamento =
  | { modo: 'novo'; data?: string; categoria?: string; tipo?: 'entrada' | 'saida' }
  | { modo: 'editar'; lanc: Lancamento }
  | { modo: 'duplicar'; lanc: Lancamento }

interface AppCtx {
  sessao: Sessao
  perfil: Perfil
  ambientes: Ambiente[]
  ambiente: Ambiente
  trocarAmbiente: (id: string) => void
  mes: Mes
  setMes: (m: Mes) => void
  ocultar: boolean
  setOcultar: (v: boolean) => void
  online: boolean
  toast: (t: Omit<Toast, 'id' | 'ms'> & { ms?: number }) => void
  abrirLancamento: (a: AberturaLancamento) => void
  lancamentoAberto: AberturaLancamento | null
  fecharLancamento: () => void
  seletorAberto: boolean
  setSeletorAberto: (v: boolean) => void
  recemSalvo: string | null
  marcarRecemSalvo: (id: string) => void
  invalidar: () => void
}

const Ctx = createContext<AppCtx | null>(null)
export const useApp = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useApp fora do provedor')
  return c
}

export function useOnline() {
  const [on, setOn] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false)
    window.addEventListener('online', a); window.addEventListener('offline', b)
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b) }
  }, [])
  return on
}

export function AppProvider({ sessao, perfil, ambientes, children }: { sessao: Sessao; perfil: Perfil; ambientes: Ambiente[]; children: ReactNode }) {
  const qc = useQueryClient()
  const [wsId, setWsId] = useState<string>(() => {
    const salvo = pref.ler('ambiente')
    if (salvo && ambientes.some(a => a.id === salvo)) return salvo
    return perfil.default_workspace_id && ambientes.some(a => a.id === perfil.default_workspace_id) ? perfil.default_workspace_id : ambientes[0].id
  })
  const ambiente = ambientes.find(a => a.id === wsId) ?? ambientes[0]
  const [mes, setMes] = useState<Mes>(mesAtual)
  const [ocultar, setOcultarSt] = useState(() => pref.ler('ocultar') === '1')
  const online = useOnline()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [lancamentoAberto, setLanc] = useState<AberturaLancamento | null>(null)
  const [seletorAberto, setSeletorAberto] = useState(false)
  const [recemSalvo, setRecem] = useState<string | null>(null)
  const seq = useRef(0)

  const trocarAmbiente = useCallback((id: string) => { setWsId(id); pref.gravar('ambiente', id) }, [])
  const setOcultar = useCallback((v: boolean) => { setOcultarSt(v); pref.gravar('ocultar', v ? '1' : '0') }, [])
  const toast = useCallback((t: Omit<Toast, 'id' | 'ms'> & { ms?: number }) => {
    const id = ++seq.current
    const ms = t.ms ?? (t.acao ? 6000 : 4000)
    setToasts([{ ...t, id, ms }]) // um por vez
    setTimeout(() => setToasts(ts => ts.filter(x => x.id !== id)), ms)
  }, [])
  const marcarRecemSalvo = useCallback((id: string) => { setRecem(id); setTimeout(() => setRecem(r => r === id ? null : r), 1500) }, [])
  const invalidar = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['lanc'] })
    qc.invalidateQueries({ queryKey: ['uso'] })
  }, [qc])

  // Limpeza da Lixeira (itens com mais de 30 dias), uma vez por ambiente por sessão
  useEffect(() => { repo.limparLixeiraVencida(ambiente.id).catch(() => {}) }, [ambiente.id])

  // Atalho N para novo lançamento (web)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement
      if (e.key.toLowerCase() !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      if (alvo.closest('input, textarea, [contenteditable], [role=dialog]')) return
      e.preventDefault(); setLanc({ modo: 'novo' })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const v: AppCtx = {
    sessao, perfil, ambientes, ambiente, trocarAmbiente, mes, setMes, ocultar, setOcultar, online, toast,
    abrirLancamento: setLanc, lancamentoAberto, fecharLancamento: () => setLanc(null),
    seletorAberto, setSeletorAberto, recemSalvo, marcarRecemSalvo, invalidar,
  }
  return (
    <Ctx.Provider value={v}>
      {children}
      <div className="toast-area" aria-live="polite">
        {toasts.map(t => (
          <div className="toast" key={t.id} role="status">
            <Icone n={t.icone ?? 'check_circle'} s={20} style={{ color: t.icone === 'delete' || t.icone === 'cloud_off' || t.icone === 'error' ? '#fff' : 'var(--sucesso-escuro)' }} />
            <span className="txt">{t.texto}{t.sub && <small>{t.sub}</small>}</span>
            {t.acao && <button type="button" onClick={() => { t.acao!.fn(); setToasts([]) }}>{t.acao.rotulo}</button>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

// ---------------- Consultas ----------------
export function useCategorias(ws: string) {
  return useQuery({ queryKey: ['cats', ws], queryFn: () => repo.categorias(ws), staleTime: 60_000 })
}

export function useMapaCategorias(ws: string) {
  const q = useCategorias(ws)
  return useMemo(() => {
    const m = new Map<string, Categoria>()
    q.data?.forEach(c => m.set(c.id, c))
    return m
  }, [q.data])
}

export function useLancamentosMes(ws: string, mes: Mes) {
  return useQuery({
    queryKey: ['lanc', ws, 'mes', mes.ano, mes.mes],
    queryFn: () => repo.lancamentosPeriodo(ws, inicioMes(mes), fimMes(mes)),
    // Mantém o mês anterior na tela durante a troca de mês, nunca dados de outro ambiente.
    placeholderData: (prev, q) => (q?.queryKey[1] === ws ? prev : undefined),
  })
}

export function useMesAnterior(ws: string, mes: Mes) {
  return useLancamentosMes(ws, somaMes(mes, -1))
}
