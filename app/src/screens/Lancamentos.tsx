import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { repo } from '../data'
import type { Filtros, Tipo } from '../data/types'
import { useApp, useCategorias, useLancamentosMes, useMapaCategorias } from '../state/app'
import { useExcluirLancamento } from '../state/acoes'
import { BarraTopo, SeletorMes } from '../components/shell'
import { ListaPorDia, Resumo3 } from '../components/lista'
import { corCat, EstadoVazio, Esqueleto, Folha, Icone } from '../components/ui'
import { dataCurta, fimMes, inicioMes, parseChaveMes, tituloMes, type Mes } from '../lib/format'

type Periodo = 'mes' | 'ano' | 'tudo' | 'intervalo'
interface FiltrosTela {
  periodo: Periodo
  de: string
  ate: string
  categorias: string[]
  min: string
  max: string
  comFoto: boolean
}
const FILTROS_VAZIOS: FiltrosTela = { periodo: 'mes', de: '', ate: '', categorias: [], min: '', max: '', comFoto: false }
const temAvancado = (f: FiltrosTela) => f.periodo !== 'mes' || f.categorias.length > 0 || !!f.min || !!f.max || f.comFoto

const paraCentavos = (s: string): number | null => {
  const limpo = s.replace(/[^\d,.]/g, '').replace(/\./g, '').replace(',', '.')
  if (!limpo) return null
  const n = Math.round(parseFloat(limpo) * 100)
  return Number.isFinite(n) ? n : null
}

function usarDebounce<T>(v: T, ms: number) {
  const [d, setD] = useState(v)
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t) }, [v, ms])
  return d
}

export function Lancamentos() {
  const { ambiente, mes, setMes, ocultar, abrirLancamento, recemSalvo } = useApp()
  const cats = useMapaCategorias(ambiente.id)
  const excluir = useExcluirLancamento()
  const [params, setParams] = useSearchParams()
  const [tipo, setTipo] = useState<Tipo | null>(null)
  const [texto, setTexto] = useState('')
  const [filtros, setFiltros] = useState<FiltrosTela>(FILTROS_VAZIOS)
  const [folhaFiltros, setFolhaFiltros] = useState(false)
  const busca = usarDebounce(texto.trim(), 250)
  const buscando = busca.length >= 2

  // Parâmetros vindos do Início (categoria, mês, tipo)
  useEffect(() => {
    const m = parseChaveMes(params.get('mes'))
    const cat = params.get('cat')
    const tp = params.get('tipo')
    if (!m && !cat && !tp) return
    if (m) setMes(m)
    if (cat) setFiltros({ ...FILTROS_VAZIOS, categorias: [cat] })
    if (tp === 'entrada' || tp === 'saida') setTipo(tp)
    setParams({}, { replace: true })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Trocar de ambiente limpa filtros de categoria (categorias são do ambiente)
  const wsAnterior = useRef(ambiente.id)
  useEffect(() => {
    if (wsAnterior.current !== ambiente.id) { setFiltros(FILTROS_VAZIOS); setTexto(''); wsAnterior.current = ambiente.id }
  }, [ambiente.id])

  const avancado = temAvancado(filtros)
  const modoFiltrado = buscando || avancado

  const filtrosRepo: Filtros = useMemo(() => {
    let de: string | null = null, ate: string | null = null
    // Busca pesquisa todos os meses automaticamente, a menos que um período tenha sido escolhido
    const periodo = buscando && filtros.periodo === 'mes' ? 'tudo' : filtros.periodo
    if (periodo === 'mes') { de = inicioMes(mes); ate = fimMes(mes) }
    else if (periodo === 'ano') { de = `${mes.ano}-01-01`; ate = `${mes.ano}-12-31` }
    else if (periodo === 'intervalo') { de = filtros.de || null; ate = filtros.ate || null }
    return {
      texto: buscando ? busca : undefined, tipo, categorias: filtros.categorias.length ? filtros.categorias : null,
      de, ate, min: paraCentavos(filtros.min), max: paraCentavos(filtros.max), comFoto: filtros.comFoto ? true : null,
    }
  }, [buscando, busca, tipo, filtros, mes])

  const qMes = useLancamentosMes(ambiente.id, mes)
  const qBusca = useInfiniteQuery({
    queryKey: ['lanc', ambiente.id, 'busca', filtrosRepo],
    queryFn: ({ pageParam }) => repo.buscar(ambiente.id, filtrosRepo, 50, pageParam),
    initialPageParam: 0,
    getNextPageParam: (ult, todas) => ult.length === 50 ? todas.length * 50 : undefined,
    enabled: modoFiltrado,
  })
  const qTotais = useQuery({
    queryKey: ['lanc', ambiente.id, 'totais', filtrosRepo],
    queryFn: () => repo.totais(ambiente.id, filtrosRepo),
    enabled: modoFiltrado,
  })

  const itens = modoFiltrado
    ? (qBusca.data?.pages.flat() ?? [])
    : (qMes.data ?? []).filter(l => !tipo || l.kind === tipo)
  const carregando = modoFiltrado ? qBusca.isLoading : (qMes.isLoading || !qMes.data)

  const totaisMes = useMemo(() => {
    let e = 0, s = 0
    qMes.data?.forEach(l => { if (l.kind === 'entrada') e += l.amount_cents; else s += l.amount_cents })
    return { e, s }
  }, [qMes.data])

  // Rolagem infinita
  const sentinela = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinela.current
    if (!el || !modoFiltrado) return
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting && qBusca.hasNextPage && !qBusca.isFetchingNextPage) qBusca.fetchNextPage() }, { rootMargin: '400px' })
    io.observe(el)
    return () => io.disconnect()
  }, [modoFiltrado, qBusca])

  const periodoEfetivo = buscando && filtros.periodo === 'mes' ? 'tudo' : filtros.periodo
  const rotuloPeriodo = periodoEfetivo === 'mes' ? tituloMes(mes) : periodoEfetivo === 'ano' ? `Ano ${mes.ano}` : periodoEfetivo === 'tudo' ? 'Todo o período'
    : `${filtros.de ? dataCurta(filtros.de) : 'início'} a ${filtros.ate ? dataCurta(filtros.ate) : 'hoje'}`

  const chipsAtivos: { rot: string; remover: () => void }[] = []
  if (filtros.periodo !== 'mes') chipsAtivos.push({ rot: rotuloPeriodo, remover: () => setFiltros(f => ({ ...f, periodo: 'mes', de: '', ate: '' })) })
  filtros.categorias.forEach(id => chipsAtivos.push({ rot: cats.get(id)?.name ?? 'Categoria', remover: () => setFiltros(f => ({ ...f, categorias: f.categorias.filter(c => c !== id) })) }))
  if (filtros.min || filtros.max) chipsAtivos.push({ rot: `${filtros.min ? 'de R$ ' + filtros.min : ''}${filtros.min && filtros.max ? ' ' : ''}${filtros.max ? 'até R$ ' + filtros.max : ''}`, remover: () => setFiltros(f => ({ ...f, min: '', max: '' })) })
  if (filtros.comFoto) chipsAtivos.push({ rot: 'Com foto', remover: () => setFiltros(f => ({ ...f, comFoto: false })) })

  const mostrarSeletorMes = !buscando && filtros.periodo === 'mes'
  const t = modoFiltrado ? qTotais.data : null

  return (
    <div className="pagina">
      <BarraTopo acoes={
        <button type="button" className="btn-icone" aria-label={avancado ? `Filtros (${chipsAtivos.length} ativos)` : 'Filtros'} onClick={() => setFolhaFiltros(true)} style={{ position: 'relative' }}>
          <Icone n="tune" />
          {avancado && <span style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, background: 'var(--acao)' }} />}
        </button>
      } />
      <div className="lanc-cab"><h1 className="t-titulo">Lançamentos</h1></div>
      {mostrarSeletorMes ? <SeletorMes mes={mes} aoMudar={setMes} /> : <div style={{ height: 12 }} />}

      <div className="bloco lanc-layout">
        <div className="lanc-conteudo" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="lanc-resumo-compacto">
            {modoFiltrado
              ? <Resumo3 entradas={t?.entradas ?? 0} saidas={t?.saidas ?? 0} ocultar={ocultar} />
              : <Resumo3 entradas={totaisMes.e} saidas={totaisMes.s} ocultar={ocultar} />}
          </div>
          <label className="busca">
            <Icone n="search" s={20} />
            <span className="sr-only">Buscar</span>
            <input type="search" placeholder="Buscar em todos os meses" value={texto} onChange={e => setTexto(e.target.value)} enterKeyHint="search" />
            {texto && <button type="button" className="btn-icone" aria-label="Limpar busca" onClick={() => setTexto('')} style={{ width: 40, height: 40 }}><Icone n="close" s={20} /></button>}
          </label>
          <div className="chips" role="group" aria-label="Tipo">
            <button type="button" className="chip" aria-pressed={!tipo} onClick={() => setTipo(null)}>Todos</button>
            <button type="button" className="chip" aria-pressed={tipo === 'entrada'} onClick={() => setTipo(tipo === 'entrada' ? null : 'entrada')}>
              <Icone n="arrow_upward" s={16} style={{ color: tipo === 'entrada' ? '#fff' : 'var(--entrada)' }} />Entradas
            </button>
            <button type="button" className="chip" aria-pressed={tipo === 'saida'} onClick={() => setTipo(tipo === 'saida' ? null : 'saida')}>
              <Icone n="arrow_downward" s={16} style={{ color: tipo === 'saida' ? '#fff' : 'var(--saida)' }} />Saídas
            </button>
          </div>
          {chipsAtivos.length > 0 && (
            <div className="chips" aria-label="Filtros ativos">
              {chipsAtivos.map((c, i) => (
                <button key={i} type="button" className="chip sel" onClick={c.remover} aria-label={`Remover filtro ${c.rot}`}>{c.rot}<Icone n="close" s={16} /></button>
              ))}
              <button type="button" className="chip" onClick={() => setFiltros(FILTROS_VAZIOS)}>Limpar</button>
            </div>
          )}
          {modoFiltrado && (
            <div className="contexto-busca" aria-live="polite">
              {buscando && <span className="t-rotulo">Busca: {busca}</span>}
              <span className="t-auxiliar sec">{rotuloPeriodo}{qTotais.data ? ` · ${qTotais.data.quantidade} ${qTotais.data.quantidade === 1 ? 'lançamento' : 'lançamentos'}` : ''}</span>
            </div>
          )}

          {carregando ? (
            <div className="lista-card" style={{ padding: 16, display: 'grid', gap: 16 }}>{[0, 1, 2, 3].map(i => <Esqueleto key={i} h={44} />)}</div>
          ) : itens.length === 0 ? (
            <div className="lista-card">
              {modoFiltrado
                ? <EstadoVazio icone="search_off" titulo={buscando ? `Nada encontrado para “${busca}”` : 'Nenhum lançamento com esses filtros'} texto="Tente outro termo ou limpe os filtros."
                    acao={<button type="button" className="btn btn-secundario" onClick={() => { setTexto(''); setFiltros(FILTROS_VAZIOS); setTipo(null) }}>Limpar busca e filtros</button>} />
                : <EstadoVazio icone="receipt_long" titulo={`Nenhum lançamento em ${tituloMes(mes).toLowerCase()}`} texto="Toque em + para registrar uma entrada ou saída."
                    acao={<button type="button" className="btn btn-primario" onClick={() => abrirLancamento({ modo: 'novo' })}><Icone n="add" s={20} />Adicionar</button>} />}
            </div>
          ) : (
            <div className="lista-card">
              <ListaPorDia itens={itens} cats={cats} ocultar={ocultar} recemSalvo={recemSalvo}
                aoAbrir={l => abrirLancamento({ modo: 'editar', lanc: l })} aoExcluir={excluir} />
              {modoFiltrado && <div ref={sentinela} style={{ height: 1 }} />}
              {qBusca.isFetchingNextPage && <div style={{ padding: 16, display: 'flex', justifyContent: 'center' }}><span className="spinner" /></div>}
            </div>
          )}
        </div>
      </div>

      <FolhaFiltros aberta={folhaFiltros} aoFechar={() => setFolhaFiltros(false)} valor={filtros} tipo={tipo} mes={mes}
        aoAplicar={(f, tp) => { setFiltros(f); setTipo(tp); setFolhaFiltros(false) }} />
    </div>
  )
}

function FolhaFiltros({ aberta, aoFechar, valor, tipo, mes, aoAplicar }: {
  aberta: boolean; aoFechar: () => void; valor: FiltrosTela; tipo: Tipo | null; mes: Mes
  aoAplicar: (f: FiltrosTela, tipo: Tipo | null) => void
}) {
  const { ambiente } = useApp()
  const qc = useCategorias(ambiente.id)
  const [f, setF] = useState(valor)
  const [tp, setTp] = useState<Tipo | null>(tipo)
  useEffect(() => { if (aberta) { setF(valor); setTp(tipo) } }, [aberta]) // eslint-disable-line react-hooks/exhaustive-deps
  const cats = (qc.data ?? []).filter(c => !c.archived_at && (!tp || c.kind === tp))
  const alterna = (id: string) => setF(x => ({ ...x, categorias: x.categorias.includes(id) ? x.categorias.filter(c => c !== id) : [...x.categorias, id] }))
  const erroIntervalo = f.periodo === 'intervalo' && f.de && f.ate && f.de > f.ate
  const minC = paraCentavos(f.min), maxC = paraCentavos(f.max)
  const erroValor = minC != null && maxC != null && minC > maxC
  const secao = (titulo: string, conteudo: React.ReactNode) => (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}><h3 className="t-rotulo">{titulo}</h3>{conteudo}</section>
  )
  return (
    <Folha aberta={aberta} aoFechar={aoFechar} rotulo="Filtros" alta
      cabecalho={
        <div className="lanc-folha-cab">
          <div className="titulo"><h2 className="t-secao">Filtros</h2><span className="t-auxiliar sec">Somente no ambiente {ambiente.name}</span></div>
          <button type="button" className="btn-icone" aria-label="Fechar" onClick={aoFechar}><Icone n="close" /></button>
        </div>
      }
      rodape={
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-secundario" style={{ flex: 1 }} onClick={() => { setF(FILTROS_VAZIOS); setTp(null) }}>Limpar</button>
          <button type="button" className="btn btn-primario" style={{ flex: 2 }} disabled={!!erroIntervalo || erroValor} onClick={() => aoAplicar(f, tp)}>Aplicar</button>
        </div>
      }>
      <div style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {secao('Período', <>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {([['mes', tituloMes(mes)], ['ano', `Ano ${mes.ano}`], ['tudo', 'Todo o período'], ['intervalo', 'Intervalo']] as [Periodo, string][]).map(([k, r]) => (
              <button key={k} type="button" className="chip" aria-pressed={f.periodo === k} onClick={() => setF(x => ({ ...x, periodo: k }))}>{r}</button>
            ))}
          </div>
          {f.periodo === 'intervalo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="campo"><label htmlFor="f-de">De</label><input id="f-de" className="input" type="date" value={f.de} onChange={e => setF(x => ({ ...x, de: e.target.value }))} /></div>
              <div className="campo"><label htmlFor="f-ate">Até</label><input id="f-ate" className="input" type="date" value={f.ate} onChange={e => setF(x => ({ ...x, ate: e.target.value }))} /></div>
            </div>
          )}
          {erroIntervalo && <span className="erro-campo"><Icone n="error" s={16} />A data inicial é depois da final.</span>}
          <span className="ajuda">A busca por texto sempre procura em todos os meses, a menos que você escolha outro período aqui.</span>
        </>)}
        {secao('Tipo', (
          <div className="segmentos" role="group" aria-label="Tipo">
            <button type="button" aria-pressed={!tp} onClick={() => setTp(null)}>Todos</button>
            <button type="button" aria-pressed={tp === 'entrada'} onClick={() => { setTp('entrada'); setF(x => ({ ...x, categorias: x.categorias.filter(id => qc.data?.find(c => c.id === id)?.kind === 'entrada') })) }}><Icone n="arrow_upward" s={16} style={{ color: 'var(--entrada)' }} />Entradas</button>
            <button type="button" aria-pressed={tp === 'saida'} onClick={() => { setTp('saida'); setF(x => ({ ...x, categorias: x.categorias.filter(id => qc.data?.find(c => c.id === id)?.kind === 'saida') })) }}><Icone n="arrow_downward" s={16} style={{ color: 'var(--saida)' }} />Saídas</button>
          </div>
        ))}
        {secao(`Categorias${f.categorias.length ? ` (${f.categorias.length})` : ''}`, (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {cats.map(c => {
              const sel = f.categorias.includes(c.id)
              return (
                <button key={c.id} type="button" className="chip" aria-pressed={sel} onClick={() => alterna(c.id)} style={{ height: 36 }}>
                  <span style={{ width: 20, height: 20, borderRadius: 10, background: corCat(c.color), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6 }}><Icone n={c.icon} s={16} f /></span>
                  {c.name}{!tp && <span style={{ opacity: .7, fontWeight: 400 }}>{c.kind === 'entrada' ? ' · entrada' : ''}</span>}
                </button>
              )
            })}
          </div>
        ))}
        {secao('Valor', <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="campo"><label htmlFor="f-min">Mínimo (R$)</label><input id="f-min" className="input" inputMode="decimal" placeholder="0,00" value={f.min} onChange={e => setF(x => ({ ...x, min: e.target.value }))} /></div>
            <div className="campo"><label htmlFor="f-max">Máximo (R$)</label><input id="f-max" className="input" inputMode="decimal" placeholder="Sem limite" value={f.max} onChange={e => setF(x => ({ ...x, max: e.target.value }))} /></div>
          </div>
          {erroValor && <span className="erro-campo"><Icone n="error" s={16} />O mínimo é maior que o máximo.</span>}
        </>)}
        {secao('Comprovante', (
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 48, cursor: 'pointer' }}>
            <input type="checkbox" checked={f.comFoto} onChange={e => setF(x => ({ ...x, comFoto: e.target.checked }))} style={{ width: 20, height: 20, accentColor: 'var(--acao)' }} />
            <span>Somente lançamentos com foto</span>
          </label>
        ))}
      </div>
    </Folha>
  )
}
