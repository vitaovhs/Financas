import { useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useApp } from '../state/app'
import { mesAtual, mesIgual, somaMes, tituloMes, MESES, type Mes } from '../lib/format'
import { corCat, Faixa, Folha, Icone } from './ui'
import { repo } from '../data'
import type { Ambiente } from '../data/types'

const SECOES = [
  { to: '/', rotulo: 'Início', icone: 'home' },
  { to: '/lancamentos', rotulo: 'Lançamentos', icone: 'receipt_long' },
  { to: '/relatorios', rotulo: 'Relatórios', icone: 'bar_chart' },
  { to: '/mais', rotulo: 'Mais', icone: 'menu' },
]

/** Estrutura das telas logadas: navegação por largura (barra inferior / trilho / menu lateral). */
export function Casca({ children }: { children: ReactNode }) {
  const { online, ambiente, abrirLancamento } = useApp()
  const loc = useLocation()
  const ativo = (to: string) => to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to)
  const item = (s: typeof SECOES[number], cls: string) => (
    <NavLink key={s.to} to={s.to} end={s.to === '/'} className={cls} aria-current={ativo(s.to) ? 'page' : undefined}>
      <Icone n={s.icone} f={ativo(s.to)} />
      <span>{s.rotulo}</span>
    </NavLink>
  )
  return (
    <div className="casca">
      {!online && <div className="sem-conexao" role="status"><Icone n="cloud_off" s={20} />Sem conexão. Os dados não podem ser salvos agora.</div>}
      <aside className="menu-lateral" aria-label="Navegação principal">
        <div className="menu-topo"><PilulaAmbiente /></div>
        <button type="button" className="btn btn-primario" style={{ margin: '0 12px 12px' }} onClick={() => abrirLancamento({ modo: 'novo' })}>
          <Icone n="add" s={20} />Novo lançamento
        </button>
        <nav className="menu-itens">{SECOES.map(s => item(s, 'menu-item'))}</nav>
      </aside>
      <nav className="trilho" aria-label="Navegação principal">
        <button type="button" className="trilho-mais" aria-label={`Novo lançamento em ${ambiente.name}`} onClick={() => abrirLancamento({ modo: 'novo' })}>
          <Icone n="add" />
        </button>
        {SECOES.map(s => item(s, 'trilho-item'))}
      </nav>
      <main className="conteudo">{children}</main>
      <nav className="barra-inferior" aria-label="Navegação principal">
        {item(SECOES[0], 'barra-item')}
        {item(SECOES[1], 'barra-item')}
        <div className="barra-mais-slot">
          <button type="button" className="barra-mais" aria-label={`Novo lançamento em ${ambiente.name}`} onClick={() => abrirLancamento({ modo: 'novo' })}>
            <Icone n="add" />
          </button>
        </div>
        {item(SECOES[2], 'barra-item')}
        {item(SECOES[3], 'barra-item')}
      </nav>
      <SeletorAmbiente />
    </div>
  )
}

export function FaixaAmbiente() {
  const { ambiente } = useApp()
  return <div className="faixa-ambiente" style={{ background: corCat(ambiente.color) }} />
}

export function PilulaAmbiente({ informativa }: { informativa?: boolean }) {
  const { ambiente, ambientes, setSeletorAberto } = useApp()
  const unico = ambientes.length < 2
  const conteudo = (
    <>
      <span className="ponto" style={{ background: corCat(ambiente.color) }} />
      <span className="nome">{ambiente.name}</span>
      {!informativa && !unico && <Icone n="expand_more" s={20} style={{ color: 'var(--texto-secundario)' }} />}
    </>
  )
  if (informativa) return <span className="pilula-ambiente" style={{ boxShadow: 'none', background: 'var(--fundo)' }}>{conteudo}</span>
  return (
    <button type="button" className="pilula-ambiente" onClick={() => setSeletorAberto(true)}
      aria-label={`Ambiente atual: ${ambiente.name}. ${unico ? 'Gerenciar ambientes' : 'Trocar ambiente'}`}>
      {conteudo}
    </button>
  )
}

/** Barra superior: ambiente à esquerda, ações à direita. */
export function BarraTopo({ acoes }: { acoes?: ReactNode }) {
  return (
    <header className="barra-topo">
      <FaixaAmbiente />
      <div className="barra-topo-in">
        <span className="so-compacto-medio"><PilulaAmbiente /></span>
        <span style={{ flex: 1 }} />
        {acoes}
      </div>
    </header>
  )
}

export function SeletorMes({ mes, aoMudar }: { mes: Mes; aoMudar: (m: Mes) => void }) {
  const [grade, setGrade] = useState(false)
  const [anoGrade, setAnoGrade] = useState(mes.ano)
  const atual = mesAtual()
  return (
    <div className="seletor-mes">
      <button type="button" className="btn-icone" aria-label="Mês anterior" onClick={() => aoMudar(somaMes(mes, -1))}><Icone n="chevron_left" /></button>
      <button type="button" className="seletor-mes-nome" onClick={() => { setAnoGrade(mes.ano); setGrade(true) }} aria-label={`${tituloMes(mes)}. Escolher mês`}>
        {tituloMes(mes)}
      </button>
      <button type="button" className="btn-icone" aria-label="Próximo mês" onClick={() => aoMudar(somaMes(mes, 1))}><Icone n="chevron_right" /></button>
      <Folha aberta={grade} aoFechar={() => setGrade(false)} rotulo="Escolher mês">
        <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="button" className="btn-icone" aria-label="Ano anterior" onClick={() => setAnoGrade(a => a - 1)}><Icone n="chevron_left" /></button>
            <h2 className="t-secao tab">{anoGrade}</h2>
            <button type="button" className="btn-icone" aria-label="Próximo ano" onClick={() => setAnoGrade(a => a + 1)}><Icone n="chevron_right" /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {MESES.map((nome, i) => {
              const m = { ano: anoGrade, mes: i + 1 }
              const sel = mesIgual(m, mes)
              return (
                <button key={i} type="button" className={'chip' + (sel ? ' sel' : '')} style={{ height: 48, justifyContent: 'center', textTransform: 'capitalize', fontWeight: mesIgual(m, atual) ? 600 : 500 }}
                  aria-pressed={sel} onClick={() => { aoMudar(m); setGrade(false) }}>
                  {nome.slice(0, 3)}
                </button>
              )
            })}
          </div>
          {!mesIgual(mes, atual) && (
            <button type="button" className="btn btn-secundario" onClick={() => { aoMudar(atual); setGrade(false) }}>
              <Icone n="calendar_today" s={20} />Ir para o mês atual
            </button>
          )}
        </div>
      </Folha>
    </div>
  )
}

function SeletorAmbiente() {
  const { ambientes, ambiente, trocarAmbiente, seletorAberto, setSeletorAberto, online } = useApp()
  const nav = useNavigate()
  const loc = useLocation()
  const qc = useQueryClient()
  const [criando, setCriando] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<Ambiente['kind']>('empresa')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const fechar = () => { setSeletorAberto(false); setCriando(false); setErro(null); setNome('') }
  const escolher = (id: string) => {
    trocarAmbiente(id); fechar()
    if (loc.pathname !== '/' && loc.pathname !== '/lancamentos') nav('/')
  }
  const criar = async () => {
    if (!nome.trim()) { setErro('Dê um nome ao ambiente.'); return }
    if (!online) { setErro('Sem conexão. É necessário estar conectado para criar um ambiente.'); return }
    setOcupado(true); setErro(null)
    try {
      const a = await repo.criarAmbiente(nome.trim(), tipo)
      await qc.invalidateQueries({ queryKey: ['ambientes'] })
      trocarAmbiente(a.id); fechar(); nav('/')
    } catch (e) {
      const m = (e as Error).message
      setErro(/unico|unique|duplicate/i.test(m) ? 'Já existe um ambiente com esse nome.' : /Limite/.test(m) ? 'Limite de 10 ambientes atingido.' : 'Não foi possível criar o ambiente. Tente novamente.')
    } finally { setOcupado(false) }
  }
  return (
    <Folha aberta={seletorAberto} aoFechar={fechar} rotulo="Ambientes">
      {!criando ? (
        <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0 4px' }}>
            <h2 className="t-secao">Ambientes</h2>
            <p className="t-auxiliar sec">Cada ambiente tem lançamentos, categorias e relatórios próprios. Os dados de um não aparecem no outro.</p>
          </div>
          {ambientes.map(a => {
            const atual = a.id === ambiente.id
            return (
              <button key={a.id} type="button" className={'item-ambiente' + (atual ? ' atual' : '')} aria-current={atual ? 'true' : undefined} onClick={() => escolher(a.id)}>
                <span className="circulo-cat" style={{ background: corCat(a.color) }}><Icone n={a.icon} s={20} f /></span>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span className="t-corpo-forte">{a.name}</span>
                  <span className="t-auxiliar sec">{atual ? 'Ambiente atual' : 'Toque para abrir'}</span>
                </span>
                <Icone n={atual ? 'check_circle' : 'chevron_right'} style={{ color: atual ? 'var(--texto)' : 'var(--texto-secundario)' }} />
              </button>
            )
          })}
          <button type="button" className="item-ambiente-acao" onClick={() => { setCriando(true); setTipo(ambientes.some(a => a.kind === 'empresa') ? 'outro' : 'empresa') }}>
            <Icone n="add_circle" />Novo ambiente
          </button>
        </div>
      ) : (
        <form style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={e => { e.preventDefault(); criar() }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: -12 }}>
            <button type="button" className="btn-icone" aria-label="Voltar" onClick={() => { setCriando(false); setErro(null) }}><Icone n="arrow_back" /></button>
            <h2 className="t-secao">Novo ambiente</h2>
          </div>
          <p className="t-auxiliar sec">Um financeiro separado, com categorias iniciais próprias. Ex.: Empresa.</p>
          <div className="campo">
            <label htmlFor="nome-amb">Nome</label>
            <input id="nome-amb" data-autofoco className="input" maxLength={40} value={nome} onChange={e => setNome(e.target.value)} placeholder="Empresa" />
          </div>
          <div className="campo">
            <span className="rotulo">Tipo</span>
            <div className="segmentos" role="group" aria-label="Tipo do ambiente">
              {(['pessoal', 'empresa', 'outro'] as const).map(t => (
                <button key={t} type="button" aria-pressed={tipo === t} onClick={() => setTipo(t)}>{t === 'pessoal' ? 'Pessoal' : t === 'empresa' ? 'Empresa' : 'Outro'}</button>
              ))}
            </div>
            <span className="ajuda">{tipo === 'empresa' ? 'Começa com categorias de empresa (impostos, pró-labore, fornecedores…).' : 'Começa com categorias pessoais (mercado, lazer, contas…).'}</span>
          </div>
          {erro && <Faixa tipo="erro">{erro}</Faixa>}
          <button type="submit" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Criar ambiente'}</button>
        </form>
      )}
    </Folha>
  )
}
