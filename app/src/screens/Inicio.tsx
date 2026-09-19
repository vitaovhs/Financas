import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp, useLancamentosMes, useMapaCategorias, useMesAnterior } from '../state/app'
import { BarraTopo, SeletorMes } from '../components/shell'
import { corCat, EstadoVazio, Esqueleto, Icone } from '../components/ui'
import { Donut, type Fatia } from '../components/Donut'
import { ListaPorDia } from '../components/lista'
import { useExcluirLancamento } from '../state/acoes'
import { chaveMes, nomeMes, OCULTO, reais, reaisSaldo, somaMes, type Mes } from '../lib/format'
import type { Lancamento } from '../data/types'

const MES_CURTO = (m: Mes) => nomeMes(m).slice(0, 3)

function totais(ls: Lancamento[] | undefined) {
  let e = 0, s = 0
  ls?.forEach(l => { if (l.kind === 'entrada') e += l.amount_cents; else s += l.amount_cents })
  return { e, s, saldo: e - s }
}

type Leitura = 'bom' | 'ruim' | 'neutro'
function variacao(atual: number, anterior: number, maiorEhBom: boolean): { pct: number; leitura: Leitura; seta: string } | null {
  if (!anterior) return null
  const pct = Math.round(((atual - anterior) / Math.abs(anterior)) * 100)
  if (pct === 0) return { pct: 0, leitura: 'neutro', seta: 'remove' }
  const subiu = pct > 0
  return { pct: Math.abs(pct), leitura: subiu === maiorEhBom ? 'bom' : 'ruim', seta: subiu ? 'arrow_upward' : 'arrow_downward' }
}

function Selo({ v, texto }: { v: NonNullable<ReturnType<typeof variacao>>; texto: string }) {
  return (
    <span className={`selo selo-${v.leitura === 'bom' ? 'bom' : v.leitura === 'ruim' ? 'ruim' : 'neutro'}`}>
      <Icone n={v.seta} s={16} />{texto}
    </span>
  )
}

export function Inicio() {
  const { ambiente, mes, setMes, ocultar, setOcultar, abrirLancamento, recemSalvo } = useApp()
  const nav = useNavigate()
  const q = useLancamentosMes(ambiente.id, mes)
  const qAnt = useMesAnterior(ambiente.id, mes)
  const cats = useMapaCategorias(ambiente.id)
  const excluir = useExcluirLancamento()
  const t = totais(q.data)
  const ta = totais(qAnt.data)
  const ant = somaMes(mes, -1)
  const carregando = q.isLoading || !q.data

  const fatias = useMemo<Fatia[]>(() => {
    const por = new Map<string, number>()
    q.data?.forEach(l => { if (l.kind === 'saida') por.set(l.category_id, (por.get(l.category_id) ?? 0) + l.amount_cents) })
    const lista = [...por.entries()].map(([id, valor]) => ({ id, valor, nome: cats.get(id)?.name ?? '—', cor: cats.get(id)?.color ?? 0 }))
      .sort((a, b) => b.valor - a.valor)
    if (lista.length <= 7) return lista
    const top = lista.slice(0, 6)
    const resto = lista.slice(6).reduce((s, f) => s + f.valor, 0)
    return [...top, { id: 'outras', nome: 'Outras', valor: resto, cor: 0 }]
  }, [q.data, cats])

  const vSaldo = variacao(t.saldo, ta.saldo, true)
  const vEnt = variacao(t.e, ta.e, true)
  const vSai = variacao(t.s, ta.s, false)
  const v = (c: number) => ocultar ? OCULTO : reais(c)
  const pct = (x: number) => ocultar ? '••%' : `${Math.round((x / (t.s || 1)) * 100)}%`
  const irCategoria = (id: string) => {
    if (id === 'outras') nav(`/lancamentos?mes=${chaveMes(mes)}&tipo=saida`)
    else nav(`/lancamentos?mes=${chaveMes(mes)}&cat=${id}`)
  }

  const vazio = !carregando && q.data!.length === 0

  return (
    <div className="pagina inicio">
      <BarraTopo acoes={
        <button type="button" className="btn-icone" onClick={() => setOcultar(!ocultar)} aria-label={ocultar ? 'Mostrar valores' : 'Ocultar valores'} title={ocultar ? 'Mostrar valores' : 'Ocultar valores'}>
          <Icone n={ocultar ? 'visibility' : 'visibility_off'} />
        </button>
      } />
      <SeletorMes mes={mes} aoMudar={setMes} />

      <div className="bloco inicio-grade">
        <section className="card card-saldo" aria-label="Saldo do mês">
          <span className="t-rotulo sec">Saldo de {nomeMes(mes)} · {ambiente.name}</span>
          {carregando ? <Esqueleto w={180} h={40} /> : (
            <span className="t-valor-grande">{ocultar ? OCULTO : reaisSaldo(t.saldo)}</span>
          )}
          {!carregando && !ocultar && (t.saldo < 0
            ? <span className="selo selo-ruim"><Icone n="trending_down" s={16} />Saldo negativo</span>
            : vSaldo && <Selo v={vSaldo} texto={vSaldo.pct === 0 ? `Saldo igual a ${nomeMes(ant)}` : `Saldo ${vSaldo.pct}% ${vSaldo.seta === 'arrow_upward' ? 'maior' : 'menor'} que ${nomeMes(ant)}`} />)}
        </section>

        <section className="card card-ind" aria-label="Entradas do mês">
          <span className="ind-topo"><span className="ind-circ" style={{ background: 'var(--entrada-fundo)', color: 'var(--entrada)' }}><Icone n="arrow_upward" s={20} /></span><span className="t-rotulo sec">Entradas</span></span>
          {carregando ? <Esqueleto w={120} h={28} /> : <span className="t-valor-card">{v(t.e)}</span>}
          {!carregando && !ocultar && vEnt && <Selo v={vEnt} texto={`${vEnt.pct}% vs ${MES_CURTO(ant)}`} />}
        </section>

        <section className="card card-ind" aria-label="Saídas do mês">
          <span className="ind-topo"><span className="ind-circ" style={{ background: 'var(--saida-fundo)', color: 'var(--saida)' }}><Icone n="arrow_downward" s={20} /></span><span className="t-rotulo sec">Saídas</span></span>
          {carregando ? <Esqueleto w={120} h={28} /> : <span className="t-valor-card">{v(t.s)}</span>}
          {!carregando && !ocultar && vSai && <Selo v={vSai} texto={`${vSai.pct}% vs ${MES_CURTO(ant)}`} />}
        </section>

        {vazio ? (
          <section className="card card-largo">
            <EstadoVazio icone="receipt_long" titulo={`Nenhum lançamento em ${nomeMes(mes)}`} texto="Registre uma entrada ou saída para ver o resumo do mês."
              acao={<button type="button" className="btn btn-primario" onClick={() => abrirLancamento({ modo: 'novo' })}><Icone n="add" s={20} />Adicionar</button>} />
          </section>
        ) : (
          <>
            <section className="card card-para-onde" aria-labelledby="t-para-onde">
              <div className="card-cab">
                <h2 id="t-para-onde" className="t-secao">Para onde foi</h2>
                <Link to="/relatorios" className="btn btn-texto" style={{ marginRight: -8 }}>Relatórios<Icone n="chevron_right" s={20} /></Link>
              </div>
              {carregando ? <Esqueleto h={168} /> : fatias.length === 0 ? (
                <p className="t-auxiliar sec" style={{ padding: '24px 0' }}>Nenhum gasto neste mês.</p>
              ) : (
                <div className="para-onde">
                  <Donut fatias={fatias} total={t.s} centro={v(t.s)} sub="gastos" aoTocar={f => irCategoria(f.id)} />
                  <ul className="legenda" aria-label="Gastos por categoria">
                    {fatias.map(f => (
                      <li key={f.id}>
                        <button type="button" onClick={() => irCategoria(f.id)}>
                          <span className="ponto" style={{ background: corCat(f.cor) }} />
                          <span className="nome">{f.nome}</span>
                          <span className="val tab">{v(f.valor)}</span>
                          <span className="pct tab">{pct(f.valor)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <section className="card card-ultimos" aria-labelledby="t-ultimos" style={{ padding: 0 }}>
              <div className="card-cab" style={{ padding: '16px 16px 4px' }}>
                <h2 id="t-ultimos" className="t-secao">Últimos lançamentos</h2>
                <Link to={`/lancamentos?mes=${chaveMes(mes)}`} className="btn btn-texto" style={{ marginRight: -8 }}>Ver todos<Icone n="chevron_right" s={20} /></Link>
              </div>
              {carregando ? <div style={{ padding: 16, display: 'grid', gap: 12 }}><Esqueleto h={48} /><Esqueleto h={48} /><Esqueleto h={48} /></div> : (
                <div style={{ paddingBottom: 4 }}>
                  <ListaPorDia itens={q.data!} limite={6} cats={cats} ocultar={ocultar} recemSalvo={recemSalvo}
                    aoAbrir={l => abrirLancamento({ modo: 'editar', lanc: l })} aoExcluir={excluir} />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}
