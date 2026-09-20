import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { repo } from '../data'
import type { Categoria, Lancamento } from '../data/types'
import { useApp, useMapaCategorias } from '../state/app'
import { BarraTopo, SeletorMes } from '../components/shell'
import { CirculoCategoria, EstadoVazio, Esqueleto, Icone } from '../components/ui'
import { Donut } from '../components/Donut'
import { BarrasCategoria, BarrasMensais, Linhas, Ranking } from '../components/graficos'
import { ItemLancamento, ListaPorDia } from '../components/lista'
import {
  chaveMes, dataCurta, fimMes, hojeIso, inicioMes, mesAtual, mesDe, mesIgual, nomeMes, OCULTO,
  parseChaveMes, reais, reaisSaldo, somaMes, tituloMes, type Mes,
} from '../lib/format'
import { baixarArquivo, gerarCsv, maioresDespesas, porCategoria, porMes, ritmoDiario, rotMes, totais } from '../lib/agregar'

type Visao = 'ano' | 'mes' | 'periodo'

function useLancamentos(ws: string, de: string, ate: string, ativo = true) {
  return useQuery({
    queryKey: ['lanc', ws, 'periodo', de, ate],
    queryFn: () => repo.lancamentosPeriodo(ws, de, ate),
    enabled: ativo && !!de && !!ate && de <= ate,
    placeholderData: (prev, q) => (q?.queryKey[1] === ws ? prev : undefined),
  })
}

function Card({ titulo, acao, children, className, sub }: { titulo?: string; acao?: ReactNode; children: ReactNode; className?: string; sub?: string }) {
  return (
    <section className={'card rel-card ' + (className ?? '')}>
      {titulo && (
        <div className="card-cab">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 className="t-secao">{titulo}</h2>
            {sub && <span className="t-auxiliar sec">{sub}</span>}
          </div>
          {acao}
        </div>
      )}
      {children}
    </section>
  )
}

function Indicador({ rot, valor, icone, cor, fundo, extra }: { rot: string; valor: string; icone?: string; cor?: string; fundo?: string; extra?: ReactNode }) {
  return (
    <section className="card card-ind">
      <span className="ind-topo">
        {icone && <span className="ind-circ" style={{ background: fundo, color: cor }}><Icone n={icone} s={20} /></span>}
        <span className="t-rotulo sec">{rot}</span>
      </span>
      <span className="t-valor-card">{valor}</span>
      {extra}
    </section>
  )
}

export function Relatorios() {
  const { ambiente, mes, setMes, ocultar, setOcultar, abrirLancamento } = useApp()
  const nav = useNavigate()
  const cats = useMapaCategorias(ambiente.id)
  const [params, setParams] = useSearchParams()
  const visao = (['ano', 'mes', 'periodo'].includes(params.get('visao') ?? '') ? params.get('visao') : 'ano') as Visao
  const setVisao = (v: Visao) => setParams(p => { p.set('visao', v); return p }, { replace: true })
  const [ano, setAno] = useState(mes.ano)
  const hoje = mesAtual()
  const [perDe, setPerDe] = useState(() => inicioMes(somaMes(hoje, -5)))
  const [perAte, setPerAte] = useState(() => hojeIso())

  // Intervalo carregado conforme a visão
  const [de, ate] = visao === 'ano' ? [`${ano}-01-01`, `${ano}-12-31`]
    : visao === 'mes' ? [inicioMes(somaMes(mes, -1)), fimMes(mes)] // mês anterior para comparação
    : [perDe, perAte]
  const q = useLancamentos(ambiente.id, de, ate)
  const todos = q.data
  const doPeriodo = useMemo(() => {
    if (!todos) return undefined
    if (visao === 'mes') return todos.filter(l => l.date >= inicioMes(mes))
    return todos
  }, [todos, visao, mes])

  const exportar = () => {
    if (!doPeriodo?.length) return
    const nomeArq = `financas-${ambiente.name.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}-${visao === 'ano' ? ano : visao === 'mes' ? chaveMes(mes) : `${perDe}_a_${perAte}`}.csv`
    baixarArquivo(nomeArq, gerarCsv(doPeriodo, cats))
  }
  const irCategoria = (id: string, v: 'mes' | 'ano' = visao === 'mes' ? 'mes' : 'ano', ref?: Mes) => {
    const r = ref ?? (visao === 'ano' ? (ano === hoje.ano ? hoje : { ano, mes: 12 }) : visao === 'mes' ? mes : mesDe(perAte))
    nav(`/relatorios/categoria/${id}?ref=${chaveMes(r)}&visao=${v}`)
  }
  const abrirMes = (m: Mes) => { setMes(m); setVisao('mes') }

  return (
    <div className="pagina">
      <BarraTopo acoes={<>
        <button type="button" className="btn-icone" onClick={exportar} disabled={!doPeriodo?.length} aria-label="Exportar para Excel (CSV)" title="Exportar para Excel (CSV)"><Icone n="download" /></button>
        <button type="button" className="btn-icone" onClick={() => setOcultar(!ocultar)} aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'}><Icone n={ocultar ? 'visibility' : 'visibility_off'} /></button>
      </>} />
      <div className="lanc-cab" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h1 className="t-titulo">Relatórios</h1>
        <div className="segmentos" role="group" aria-label="Visão" style={{ maxWidth: 420 }}>
          <button type="button" aria-pressed={visao === 'ano'} onClick={() => setVisao('ano')}>Ano</button>
          <button type="button" aria-pressed={visao === 'mes'} onClick={() => setVisao('mes')}>Mês</button>
          <button type="button" aria-pressed={visao === 'periodo'} onClick={() => setVisao('periodo')}>Período</button>
        </div>
      </div>

      {visao === 'ano' && (
        <div className="seletor-mes">
          <button type="button" className="btn-icone" aria-label="Ano anterior" onClick={() => setAno(a => a - 1)}><Icone n="chevron_left" /></button>
          <span className="seletor-mes-nome" style={{ display: 'inline-flex', alignItems: 'center' }}>{ano}</span>
          <button type="button" className="btn-icone" aria-label="Próximo ano" onClick={() => setAno(a => a + 1)} disabled={ano >= hoje.ano + 1}><Icone n="chevron_right" /></button>
        </div>
      )}
      {visao === 'mes' && <SeletorMes mes={mes} aoMudar={setMes} />}
      {visao === 'periodo' && (
        <div className="bloco rel-periodo">
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {([['3 meses', 2], ['6 meses', 5], ['12 meses', 11]] as [string, number][]).map(([r, n]) => {
              const d = inicioMes(somaMes(hoje, -n))
              return <button key={r} type="button" className="chip" aria-pressed={perDe === d && perAte === hojeIso()} onClick={() => { setPerDe(d); setPerAte(hojeIso()) }}>Últimos {r}</button>
            })}
            <button type="button" className="chip" aria-pressed={perDe === `${hoje.ano - 1}-01-01` && perAte === `${hoje.ano - 1}-12-31`} onClick={() => { setPerDe(`${hoje.ano - 1}-01-01`); setPerAte(`${hoje.ano - 1}-12-31`) }}>Ano de {hoje.ano - 1}</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 420 }}>
            <div className="campo"><label htmlFor="p-de">De</label><input id="p-de" className="input" type="date" value={perDe} max={perAte} onChange={e => e.target.value && setPerDe(e.target.value)} /></div>
            <div className="campo"><label htmlFor="p-ate">Até</label><input id="p-ate" className="input" type="date" value={perAte} min={perDe} onChange={e => e.target.value && setPerAte(e.target.value)} /></div>
          </div>
        </div>
      )}

      <div className="bloco" style={{ marginTop: 8 }}>
        {q.isError ? (
          <div className="lista-card"><EstadoVazio icone="cloud_off" titulo="Não foi possível carregar" texto="Verifique a conexão e tente de novo." acao={<button type="button" className="btn btn-secundario" onClick={() => q.refetch()}>Tentar de novo</button>} /></div>
        ) : !doPeriodo ? (
          <div className="rel-grade">{[0, 1, 2].map(i => <div key={i} className="card"><Esqueleto h={120} /></div>)}</div>
        ) : doPeriodo.length === 0 ? (
          <div className="lista-card">
            <EstadoVazio icone="bar_chart" titulo={visao === 'ano' ? `Nenhum lançamento em ${ano}` : visao === 'mes' ? `Nenhum lançamento em ${nomeMes(mes)}` : 'Nenhum lançamento neste período'}
              texto="Os relatórios aparecem assim que houver entradas ou saídas." acao={<button type="button" className="btn btn-primario" onClick={() => abrirLancamento({ modo: 'novo' })}><Icone n="add" s={20} />Adicionar</button>} />
          </div>
        ) : visao === 'mes' ? (
          <PainelMes ls={doPeriodo} anteriores={todos!.filter(l => l.date < inicioMes(mes))} mes={mes} cats={cats} ocultar={ocultar} irCategoria={irCategoria} />
        ) : (
          <PainelPeriodo ls={doPeriodo} cats={cats} ocultar={ocultar} irCategoria={irCategoria} abrirMes={abrirMes}
            de={visao === 'ano' ? primeiroMesComDados(doPeriodo, { ano, mes: 1 }) : mesDe(perDe)}
            ate={visao === 'ano' ? ultimoMesComDados(doPeriodo, { ano, mes: ano === hoje.ano ? hoje.mes : 12 }) : mesDe(perAte)}
            rotuloPeriodo={visao === 'ano' ? String(ano) : `${dataCurta(perDe)} a ${dataCurta(perAte)}`} />
        )}
      </div>
    </div>
  )
}

function primeiroMesComDados(ls: Lancamento[], padrao: Mes): Mes {
  const menor = ls.reduce((m, l) => !m || l.date < m ? l.date : m, '')
  return menor ? mesDe(menor) : padrao
}

function ultimoMesComDados(ls: Lancamento[], limite: Mes): Mes {
  const maior = ls.reduce((m, l) => l.date > m ? l.date : m, '')
  const m = maior ? mesDe(maior) : limite
  return m.ano * 12 + m.mes > limite.ano * 12 + limite.mes ? m : limite
}

// ---------------- Ano / Período ----------------
function PainelPeriodo({ ls, cats, ocultar, irCategoria, abrirMes, de, ate, rotuloPeriodo }: {
  ls: Lancamento[]; cats: Map<string, Categoria>; ocultar: boolean; rotuloPeriodo: string
  irCategoria: (id: string) => void; abrirMes: (m: Mes) => void; de: Mes; ate: Mes
}) {
  const { abrirLancamento } = useApp()
  const t = totais(ls)
  const meses = porMes(ls, de, ate)
  const comGasto = meses.filter(m => m.n > 0).length || 1
  const saidas = porCategoria(ls, cats, 'saida')
  const entradas = porCategoria(ls, cats, 'entrada')
  const maiores = maioresDespesas(ls, 10)
  const v = (c: number) => ocultar ? OCULTO : reais(c)
  const titulo = (m: Mes) => tituloMes(m)
  return (
    <div className="rel-grade">
      <div className="rel-ind">
        <Indicador rot="Entradas" valor={v(t.e)} icone="arrow_upward" cor="var(--entrada)" fundo="var(--entrada-fundo)" />
        <Indicador rot="Saídas" valor={v(t.s)} icone="arrow_downward" cor="var(--saida)" fundo="var(--saida-fundo)" />
        <Indicador rot={`Saldo · ${rotuloPeriodo}`} valor={ocultar ? OCULTO : reaisSaldo(t.saldo)}
          extra={!ocultar && t.saldo < 0 ? <span className="selo selo-ruim"><Icone n="trending_down" s={16} />Saldo negativo</span> : undefined} />
        <Indicador rot="Média mensal de gastos" valor={v(Math.round(t.s / comGasto))} extra={<span className="t-auxiliar sec">{comGasto} {comGasto === 1 ? 'mês com lançamentos' : 'meses com lançamentos'} · {t.n} lançamentos</span>} />
      </div>

      <Card titulo="Entradas e saídas por mês" sub={`${rotMes(de)}–${rotMes(ate)} ${ate.ano}`} className="rel-largo">
        <BarrasMensais dados={meses.map(m => ({ rot: rotMes(m.mes), titulo: titulo(m.mes), e: m.e, s: m.s }))} ocultar={ocultar} aoTocar={i => abrirMes(meses[i].mes)} />
      </Card>

      <Card titulo="Saldo acumulado" sub="Soma dos saldos mês a mês" className="rel-largo">
        <Linhas series={[{ nome: 'Saldo acumulado', valores: meses.map(m => m.acumulado), cor: 'var(--texto)' }]}
          rotulos={meses.map(m => rotMes(m.mes))} titulos={meses.map(m => titulo(m.mes))} ocultar={ocultar} zero rotuloFinal />
      </Card>

      <Card titulo="Para onde foi" sub={`Saídas por categoria · ${v(t.s)}`}>
        {saidas.length ? <Ranking itens={saidas} total={t.s} ocultar={ocultar} aoTocar={id => irCategoria(id)} limite={8} /> : <p className="t-auxiliar sec">Nenhuma saída no período.</p>}
      </Card>

      <Card titulo="De onde veio" sub={`Entradas por categoria · ${v(t.e)}`}>
        {entradas.length ? <Ranking itens={entradas} total={t.e} ocultar={ocultar} aoTocar={id => irCategoria(id)} limite={6} /> : <p className="t-auxiliar sec">Nenhuma entrada no período.</p>}
      </Card>

      <Card titulo="Maiores despesas" className="rel-sem-pad">
        {maiores.length ? maiores.map(l => <ItemLancamento key={l.id} l={l} cat={cats.get(l.category_id)} ocultar={ocultar} aoAbrir={() => abrirLancamento({ modo: 'editar', lanc: l })} />)
          : <p className="t-auxiliar sec" style={{ padding: 16 }}>Nenhuma saída no período.</p>}
      </Card>

      <Card titulo="Resumo por mês" className="rel-sem-pad">
        <div className="tabela-rol">
          <table className="tabela-meses">
            <thead><tr><th scope="col">Mês</th><th scope="col">Entradas</th><th scope="col">Saídas</th><th scope="col">Saldo</th><th aria-hidden /></tr></thead>
            <tbody>
              {meses.map(m => (
                <tr key={m.chave} onClick={() => abrirMes(m.mes)} tabIndex={0} onKeyDown={e => { if (e.key === 'Enter') abrirMes(m.mes) }} aria-label={`Abrir ${titulo(m.mes)}`}>
                  <th scope="row">{rotMes(m.mes)}{m.mes.ano !== ate.ano ? ` ${m.mes.ano}` : ''}</th>
                  <td>{m.n ? v(m.e) : '—'}</td>
                  <td>{m.n ? v(m.s) : '—'}</td>
                  <td className={m.saldo < 0 ? 'neg' : ''}>{m.n ? (ocultar ? OCULTO : reaisSaldo(m.saldo)) : '—'}</td>
                  <td><Icone n="chevron_right" s={16} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><th scope="row">Total</th><td>{v(t.e)}</td><td>{v(t.s)}</td><td className={t.saldo < 0 ? 'neg' : ''}>{ocultar ? OCULTO : reaisSaldo(t.saldo)}</td><td /></tr></tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ---------------- Mês ----------------
function PainelMes({ ls, anteriores, mes, cats, ocultar, irCategoria }: {
  ls: Lancamento[]; anteriores: Lancamento[]; mes: Mes; cats: Map<string, Categoria>; ocultar: boolean
  irCategoria: (id: string, v?: 'mes' | 'ano') => void
}) {
  const { abrirLancamento } = useApp()
  const t = totais(ls)
  const ta = totais(anteriores)
  const ant = somaMes(mes, -1)
  const saidas = porCategoria(ls, cats, 'saida')
  const entradas = porCategoria(ls, cats, 'entrada')
  const maiores = maioresDespesas(ls, 5)
  const v = (c: number) => ocultar ? OCULTO : reais(c)
  const atual = ritmoDiario(ls, mes)
  const antR = ritmoDiario(anteriores, ant)
  const dias = Math.max(atual.length, antR.length)
  const ehAtual = mesIgual(mes, mesAtual())
  const diaHoje = new Date().getDate()
  const serieAtual = Array.from({ length: dias }, (_, i) => i < atual.length && (!ehAtual || i < diaHoje) ? atual[i] : null)
  const serieAnt = Array.from({ length: dias }, (_, i) => i < antR.length ? antR[i] : null)
  const fatias = saidas.length <= 7 ? saidas : [...saidas.slice(0, 6), { id: 'outras', nome: 'Outras', icone: 'more_horiz', cor: 0, valor: saidas.slice(6).reduce((s, x) => s + x.valor, 0), n: 0 }]
  const comparaGasto = ta.s ? Math.round(((t.s - ta.s) / ta.s) * 100) : null
  return (
    <div className="rel-grade">
      <div className="rel-ind">
        <Indicador rot="Entradas" valor={v(t.e)} icone="arrow_upward" cor="var(--entrada)" fundo="var(--entrada-fundo)" />
        <Indicador rot="Saídas" valor={v(t.s)} icone="arrow_downward" cor="var(--saida)" fundo="var(--saida-fundo)"
          extra={!ocultar && comparaGasto != null ? <span className={`selo ${comparaGasto > 0 ? 'selo-ruim' : comparaGasto < 0 ? 'selo-bom' : 'selo-neutro'}`}><Icone n={comparaGasto > 0 ? 'arrow_upward' : comparaGasto < 0 ? 'arrow_downward' : 'remove'} s={16} />{Math.abs(comparaGasto)}% vs {rotMes(ant)}</span> : undefined} />
        <Indicador rot={`Saldo de ${nomeMes(mes)}`} valor={ocultar ? OCULTO : reaisSaldo(t.saldo)}
          extra={!ocultar && t.saldo < 0 ? <span className="selo selo-ruim"><Icone n="trending_down" s={16} />Saldo negativo</span> : undefined} />
        <Indicador rot="Lançamentos" valor={String(t.n)} extra={<span className="t-auxiliar sec">{ta.n} em {nomeMes(ant)}</span>} />
      </div>

      <Card titulo="Ritmo de gastos" sub={`Gasto acumulado dia a dia · ${nomeMes(mes)} × ${nomeMes(ant)}`} className="rel-largo">
        <Linhas series={[
          { nome: tituloMes(mes), valores: serieAtual, cor: 'var(--texto)' },
          { nome: tituloMes(ant), valores: serieAnt, cor: 'var(--texto-secundario)', tracejada: true },
        ]} rotulos={Array.from({ length: dias }, (_, i) => String(i + 1))}
          titulos={Array.from({ length: dias }, (_, i) => `Até o dia ${i + 1}`)} ocultar={ocultar} rotuloFinal />
      </Card>

      <Card titulo="Para onde foi" sub={`Saídas por categoria · ${v(t.s)}`}>
        {saidas.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <Donut fatias={fatias} total={t.s} centro={v(t.s)} sub="gastos" aoTocar={f => f.id !== 'outras' && irCategoria(f.id, 'mes')} />
            <div style={{ width: '100%' }}><Ranking itens={saidas} total={t.s} ocultar={ocultar} aoTocar={id => irCategoria(id, 'mes')} limite={6} /></div>
          </div>
        ) : <p className="t-auxiliar sec">Nenhuma saída neste mês.</p>}
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }} className="rel-coluna">
        <Card titulo="De onde veio" sub={`Entradas por categoria · ${v(t.e)}`}>
          {entradas.length ? <Ranking itens={entradas} total={t.e} ocultar={ocultar} aoTocar={id => irCategoria(id, 'mes')} /> : <p className="t-auxiliar sec">Nenhuma entrada neste mês.</p>}
        </Card>
        <Card titulo="Maiores despesas" className="rel-sem-pad">
          {maiores.length ? maiores.map(l => <ItemLancamento key={l.id} l={l} cat={cats.get(l.category_id)} ocultar={ocultar} aoAbrir={() => abrirLancamento({ modo: 'editar', lanc: l })} />)
            : <p className="t-auxiliar sec" style={{ padding: 16 }}>Nenhuma saída neste mês.</p>}
        </Card>
      </div>
    </div>
  )
}

// ---------------- Detalhe da categoria ----------------
export function DetalheCategoria() {
  const { id } = useParams()
  const { ambiente, ocultar, abrirLancamento, recemSalvo } = useApp()
  const nav = useNavigate()
  const cats = useMapaCategorias(ambiente.id)
  const [params, setParams] = useSearchParams()
  const ref = parseChaveMes(params.get('ref')) ?? mesAtual()
  const visao: 'mes' | 'ano' = params.get('visao') === 'ano' ? 'ano' : 'mes'
  const set = (r: Mes, v: 'mes' | 'ano') => setParams({ ref: chaveMes(r), visao: v }, { replace: true })
  const cat = id ? cats.get(id) : undefined
  const inicio12 = somaMes(ref, -11)
  const de = inicio12.ano < ref.ano ? inicioMes(inicio12) : `${ref.ano}-01-01`
  const ate = `${ref.ano}-12-31` > fimMes(ref) ? `${ref.ano}-12-31` : fimMes(ref)
  const q = useLancamentos(ambiente.id, de, ate)
  const daCat = useMemo(() => (q.data ?? []).filter(l => l.category_id === id), [q.data, id])
  const meses12 = porMes(daCat, inicio12, ref)
  const noAno = daCat.filter(l => l.date.startsWith(String(ref.ano)))
  const doMes = daCat.filter(l => l.date >= inicioMes(ref) && l.date <= fimMes(ref))
  const lista = visao === 'mes' ? doMes : noAno
  const totalLista = lista.reduce((s, l) => s + l.amount_cents, 0)
  const totalAno = noAno.reduce((s, l) => s + l.amount_cents, 0)
  const mesAnt = meses12[meses12.length - 2]
  const v = (c: number) => ocultar ? OCULTO : reais(c)
  const mesesAno = Math.max(1, (ref.ano === mesAtual().ano ? mesAtual().mes : 12))

  if (!cat && cats.size > 0) {
    return <div className="pagina"><BarraTopo /><div className="bloco"><div className="lista-card"><EstadoVazio icone="category" titulo="Categoria não encontrada" texto="Ela pode ser de outro ambiente." acao={<button type="button" className="btn btn-secundario" onClick={() => nav('/relatorios')}>Voltar aos relatórios</button>} /></div></div></div>
  }
  return (
    <div className="pagina">
      <BarraTopo />
      <div className="lanc-cab" style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: -12 }}>
        <button type="button" className="btn-icone" aria-label="Voltar" onClick={() => nav(-1)}><Icone n="arrow_back" /></button>
        {cat && <CirculoCategoria icone={cat.icon} cor={cat.color} />}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <h1 className="t-titulo" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat?.name ?? '…'}</h1>
          <span className="t-auxiliar sec">{cat?.kind === 'entrada' ? 'Categoria de entrada' : 'Categoria de saída'}{cat?.archived_at ? ' · arquivada' : ''}</span>
        </div>
      </div>
      <div className="bloco" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
        <div className="segmentos" role="group" aria-label="Período" style={{ maxWidth: 320 }}>
          <button type="button" aria-pressed={visao === 'mes'} onClick={() => set(ref, 'mes')}>Mês</button>
          <button type="button" aria-pressed={visao === 'ano'} onClick={() => set(ref, 'ano')}>Ano</button>
        </div>
      </div>
      {visao === 'mes' ? <SeletorMes mes={ref} aoMudar={m => set(m, 'mes')} /> : (
        <div className="seletor-mes">
          <button type="button" className="btn-icone" aria-label="Ano anterior" onClick={() => set({ ano: ref.ano - 1, mes: 12 }, 'ano')}><Icone n="chevron_left" /></button>
          <span className="seletor-mes-nome" style={{ display: 'inline-flex', alignItems: 'center' }}>{ref.ano}</span>
          <button type="button" className="btn-icone" aria-label="Próximo ano" onClick={() => { const a = ref.ano + 1; set(a === mesAtual().ano ? mesAtual() : { ano: a, mes: 12 }, 'ano') }}><Icone n="chevron_right" /></button>
        </div>
      )}
      <div className="bloco rel-grade">
        {!q.data ? <div className="card"><Esqueleto h={160} /></div> : <>
          <section className="card rel-largo cat-resumo">
            <div>
              <span className="t-rotulo sec">{visao === 'mes' ? tituloMes(ref) : `Ano ${ref.ano}`}</span>
              <span className="t-valor-grande" style={{ display: 'block' }}>{v(totalLista)}</span>
              <span className="t-auxiliar sec">{lista.length} {lista.length === 1 ? 'lançamento' : 'lançamentos'}</span>
            </div>
            <div className="cat-comparativos">
              {visao === 'mes' && mesAnt && <span><span className="t-auxiliar sec">{tituloMes(mesAnt.mes)}</span><strong className="tab">{v(cat?.kind === 'entrada' ? mesAnt.e : mesAnt.s)}</strong></span>}
              <span><span className="t-auxiliar sec">No ano {ref.ano}</span><strong className="tab">{v(totalAno)}</strong></span>
              <span><span className="t-auxiliar sec">Média mensal no ano</span><strong className="tab">{v(Math.round(totalAno / mesesAno))}</strong></span>
            </div>
          </section>
          <Card titulo="Últimos 12 meses" className="rel-largo" sub="Toque em uma barra para ver o mês">
            <BarrasCategoria dados={meses12.map(m => ({ rot: rotMes(m.mes), titulo: tituloMes(m.mes), v: cat?.kind === 'entrada' ? m.e : m.s }))}
              cor={cat?.color ?? 0} selecionado={11} ocultar={ocultar} aoTocar={i => set(meses12[i].mes, 'mes')} />
          </Card>
          <Card titulo="Lançamentos" className="rel-largo rel-sem-pad" acao={cat && !cat.archived_at && (
            <button type="button" className="btn btn-texto" onClick={() => abrirLancamento({ modo: 'novo', categoria: cat.id, tipo: cat.kind, data: mesIgual(ref, mesAtual()) || visao === 'ano' ? undefined : fimMes(ref) })}><Icone n="add" s={20} />Lançar nesta categoria</button>
          )}>
            {lista.length ? <ListaPorDia itens={[...lista].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))} cats={cats} ocultar={ocultar} recemSalvo={recemSalvo} aoAbrir={l => abrirLancamento({ modo: 'editar', lanc: l })} />
              : <p className="t-auxiliar sec" style={{ padding: 16 }}>Nenhum lançamento em {visao === 'mes' ? nomeMes(ref) : ref.ano}.</p>}
            {totalLista > 0 && <div className="cab-dia" style={{ borderTop: '1px solid var(--divisoria)', paddingBottom: 12 }}><span>Total</span><span className="tab">{v(totalLista)}</span></div>}
          </Card>
        </>}
      </div>
    </div>
  )
}
