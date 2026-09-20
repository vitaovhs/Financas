import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { repo } from '../data'
import { resetarDemo } from '../data/demoRepo'
import type { Ambiente, Categoria, Lancamento, Tipo } from '../data/types'
import { useApp, useCategorias } from '../state/app'
import { BarraTopo } from '../components/shell'
import { CirculoCategoria, corCat, Dialogo, EstadoVazio, Esqueleto, Faixa, Folha, Icone } from '../components/ui'
import { ItemLancamento } from '../components/lista'
import { CampoSenha } from './Acesso'
import { ICONES_AMBIENTE, ICONES_CATEGORIA } from '../lib/icones'
import { dataCurta, dataHora } from '../lib/format'

export const VERSAO = '0.3.3 · Entrega 3'

function msgErro(e: unknown): string {
  const m = ((e as Error)?.message ?? '').toLowerCase()
  if (/failed to fetch|network/.test(m)) return 'Sem conexão. Tente de novo.'
  if (/duplicate|unique|unico/.test(m)) return 'Já existe um item com esse nome.'
  if (/foreign key/.test(m)) return 'Há lançamentos usando este item.'
  if (/apenas administradores|42501/.test(m)) return 'Você não tem permissão para isso.'
  if (/já existe um acesso/.test(m)) return 'Já existe um acesso com este e-mail.'
  if (/e-mail inválido/.test(m)) return 'Informe um e-mail válido.'
  return (e as Error)?.message || 'Não foi possível concluir. Tente novamente.'
}

function Subtela({ titulo, children, acoes }: { titulo: string; children: ReactNode; acoes?: ReactNode }) {
  const nav = useNavigate()
  return (
    <div className="pagina">
      <BarraTopo acoes={acoes} />
      <div className="lanc-cab" style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: -12 }}>
        <button type="button" className="btn-icone" aria-label="Voltar" onClick={() => nav('/mais')}><Icone n="arrow_back" /></button>
        <h1 className="t-titulo">{titulo}</h1>
      </div>
      <div className="bloco mais-conteudo">{children}</div>
    </div>
  )
}

function Linha({ icone, rotulo, sub, onClick, to, cor, destaque }: { icone: string; rotulo: string; sub?: ReactNode; onClick?: () => void; to?: string; cor?: string; destaque?: boolean }) {
  const conteudo = (
    <>
      <Icone n={icone} style={{ color: cor ?? 'var(--texto-secundario)' }} />
      <span className="meio"><span className="desc" style={{ color: cor, fontWeight: destaque ? 600 : undefined }}>{rotulo}</span>{sub && <span className="cat">{sub}</span>}</span>
      {(to || onClick) && !cor && <Icone n="chevron_right" style={{ color: 'var(--texto-secundario)' }} />}
    </>
  )
  return to ? <Link to={to} className="item-lanc">{conteudo}</Link> : <button type="button" className="item-lanc" onClick={onClick}>{conteudo}</button>
}

// ======================= Menu "Mais" =======================
export function Mais() {
  const { perfil, sessao, ambiente, ocultar, setOcultar } = useApp()
  const [sair, setSair] = useState(false)
  return (
    <div className="pagina">
      <BarraTopo />
      <div className="lanc-cab"><h1 className="t-titulo">Mais</h1></div>
      <div className="bloco mais-conteudo" style={{ marginTop: 16 }}>
        <Link to="/mais/perfil" className="card" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'var(--texto)' }}>
          <span className="avatar">{(perfil.name ?? sessao.email).trim()[0]?.toUpperCase()}</span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
            <span className="t-corpo-forte">{perfil.name ?? 'Sem nome'}</span>
            <span className="t-auxiliar sec" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessao.email}</span>
          </span>
          <Icone n="chevron_right" style={{ color: 'var(--texto-secundario)' }} />
        </Link>
        <div className="lista-card" style={{ paddingBottom: 0 }}>
          <div className="cab-dia"><span>{ambiente.name}</span></div>
          <Linha icone="category" rotulo="Categorias" sub="Criar, editar, reordenar e arquivar" to="/mais/categorias" />
          <Linha icone="delete" rotulo="Lixeira" sub="Lançamentos excluídos nos últimos 30 dias" to="/mais/lixeira" />
        </div>
        <div className="lista-card" style={{ paddingBottom: 0 }}>
          <div className="cab-dia"><span>Geral</span></div>
          <Linha icone="swap_horiz" rotulo="Ambientes" sub="Pessoal, Empresa e outros" to="/mais/ambientes" />
          <Linha icone={ocultar ? 'visibility' : 'visibility_off'} rotulo={ocultar ? 'Mostrar valores' : 'Ocultar valores'} sub="Esconde os valores na tela, útil em público" onClick={() => setOcultar(!ocultar)} />
          <Linha icone="lock" rotulo="Perfil e segurança" sub="Nome, senha e aparelhos conectados" to="/mais/perfil" />
          {perfil.is_admin && <Linha icone="group_add" rotulo="Usuários e convites" sub="Convidar e gerenciar acessos" to="/mais/usuarios" />}
        </div>
        <div className="lista-card" style={{ paddingBottom: 0 }}>
          {repo.modo === 'demo' && <Linha icone="restart_alt" rotulo="Recomeçar demonstração" sub="Volta aos dados fictícios iniciais" onClick={() => { resetarDemo(); location.reload() }} />}
          <Linha icone="logout" rotulo="Sair" cor="var(--erro)" onClick={() => setSair(true)} />
        </div>
        <p className="t-auxiliar sec" style={{ textAlign: 'center' }}>Finanças · versão {VERSAO}{repo.modo === 'demo' ? ' · demonstração' : ''}</p>
      </div>
      <Dialogo aberto={sair} titulo="Sair deste aparelho?" texto="Você vai precisar do e-mail e da senha para entrar de novo." confirmar="Sair"
        aoCancelar={() => setSair(false)} aoConfirmar={() => { setSair(false); repo.sair() }} />
    </div>
  )
}

// ======================= Categorias =======================
export function Categorias() {
  const { ambiente, toast, online } = useApp()
  const qc = useQueryClient()
  const q = useCategorias(ambiente.id)
  const [tipo, setTipo] = useState<Tipo>('saida')
  const [reordenar, setReordenar] = useState(false)
  const [editando, setEditando] = useState<Categoria | 'nova' | null>(null)
  const atualizar = () => { qc.invalidateQueries({ queryKey: ['cats', ambiente.id] }); qc.invalidateQueries({ queryKey: ['lanc'] }) }
  const ativas = (q.data ?? []).filter(c => c.kind === tipo && !c.archived_at).sort((a, b) => a.sort - b.sort)
  const arquivadas = (q.data ?? []).filter(c => c.kind === tipo && c.archived_at)
  const mover = async (i: number, dir: -1 | 1) => {
    const normais = ativas.filter(c => !c.is_other)
    const j = i + dir
    if (j < 0 || j >= normais.length) return
    const nova = [...normais];[nova[i], nova[j]] = [nova[j], nova[i]]
    qc.setQueryData<Categoria[]>(['cats', ambiente.id], old => old?.map(c => { const k = nova.findIndex(x => x.id === c.id); return k >= 0 ? { ...c, sort: k + 1 } : c }))
    try { await repo.reordenarCategorias(nova.map(c => c.id)) } catch (e) { toast({ texto: msgErro(e), icone: 'error' }); atualizar() }
  }
  const restaurar = async (c: Categoria) => {
    if (!online) { toast({ texto: 'Sem conexão', icone: 'cloud_off' }); return }
    try { await repo.editarCategoria(c.id, { archived_at: null }); atualizar(); toast({ texto: `${c.name} restaurada` }) } catch (e) { toast({ texto: msgErro(e), icone: 'error' }) }
  }
  return (
    <Subtela titulo="Categorias" acoes={
      <button type="button" className="btn btn-texto" onClick={() => setReordenar(r => !r)} aria-pressed={reordenar}>{reordenar ? 'Concluir' : 'Reordenar'}</button>
    }>
      <p className="t-auxiliar sec">Categorias do ambiente <strong>{ambiente.name}</strong>. Cada ambiente tem as suas.</p>
      <div className="segmentos" role="group" aria-label="Tipo" style={{ maxWidth: 360 }}>
        <button type="button" aria-pressed={tipo === 'saida'} onClick={() => setTipo('saida')}><Icone n="arrow_downward" s={16} style={{ color: 'var(--saida)' }} />Saídas</button>
        <button type="button" aria-pressed={tipo === 'entrada'} onClick={() => setTipo('entrada')}><Icone n="arrow_upward" s={16} style={{ color: 'var(--entrada)' }} />Entradas</button>
      </div>
      {!q.data ? <div className="lista-card" style={{ padding: 16 }}><Esqueleto h={200} /></div> : (
        <div className="lista-card">
          {ativas.map(c => {
            const normais = ativas.filter(x => !x.is_other)
            const i = normais.findIndex(x => x.id === c.id)
            return (
              <div key={c.id} className="item-cat">
                <button type="button" className="item-lanc" onClick={() => !reordenar && setEditando(c)} style={{ borderTop: 0 }} tabIndex={reordenar ? -1 : 0}>
                  <CirculoCategoria icone={c.icon} cor={c.color} />
                  <span className="meio"><span className="desc">{c.name}</span>{c.is_other && <span className="cat">Fixa · pode ser renomeada</span>}</span>
                  {!reordenar && <Icone n="chevron_right" style={{ color: 'var(--texto-secundario)' }} />}
                </button>
                {reordenar && !c.is_other && (
                  <span className="reordenar">
                    <button type="button" className="btn-icone" aria-label={`Subir ${c.name}`} disabled={i === 0} onClick={() => mover(i, -1)}><Icone n="arrow_upward" s={20} /></button>
                    <button type="button" className="btn-icone" aria-label={`Descer ${c.name}`} disabled={i === normais.length - 1} onClick={() => mover(i, 1)}><Icone n="arrow_downward" s={20} /></button>
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
      {!reordenar && <button type="button" className="btn btn-secundario" onClick={() => setEditando('nova')} style={{ alignSelf: 'flex-start' }}><Icone n="add" s={20} />Nova categoria de {tipo === 'saida' ? 'saída' : 'entrada'}</button>}
      {arquivadas.length > 0 && (
        <div className="lista-card">
          <div className="cab-dia"><span>Arquivadas</span><span>Não aparecem ao lançar; o histórico continua</span></div>
          {arquivadas.map(c => (
            <div key={c.id} className="item-lanc" style={{ opacity: 0.85 }}>
              <CirculoCategoria icone={c.icon} cor={0} />
              <span className="meio"><span className="desc sec">{c.name}</span></span>
              <button type="button" className="btn btn-texto" onClick={() => restaurar(c)}>Restaurar</button>
            </div>
          ))}
        </div>
      )}
      {editando && <EditarCategoria categoria={editando === 'nova' ? null : editando} tipo={tipo} todas={q.data ?? []} aoFechar={() => setEditando(null)} aoSalvar={atualizar} />}
    </Subtela>
  )
}

function EditarCategoria({ categoria, tipo, todas, aoFechar, aoSalvar }: { categoria: Categoria | null; tipo: Tipo; todas: Categoria[]; aoFechar: () => void; aoSalvar: () => void }) {
  const { ambiente, toast, online } = useApp()
  const nova = !categoria
  const usadasCores = new Set(todas.filter(c => c.kind === tipo && !c.archived_at).map(c => c.color))
  const [nome, setNome] = useState(categoria?.name ?? '')
  const [cor, setCor] = useState(categoria?.color ?? ([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].find(c => !usadasCores.has(c)) ?? 1))
  const [icone, setIcone] = useState(categoria?.icon ?? 'label')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [excluir, setExcluir] = useState<null | { uso: number }>(null)
  const [destino, setDestino] = useState<string>('')
  const kind = categoria?.kind ?? tipo
  const outras = todas.filter(c => c.kind === kind && c.id !== categoria?.id && !c.archived_at)

  const salvar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!nome.trim()) { setErro('Dê um nome à categoria.'); return }
    if (!online) { setErro('Sem conexão.'); return }
    setOcupado(true); setErro(null)
    try {
      if (nova) await repo.criarCategoria(ambiente.id, { kind, name: nome, icon: icone, color: cor })
      else await repo.editarCategoria(categoria!.id, { name: nome.trim(), icon: icone, ...(categoria!.is_other ? {} : { color: cor }) })
      aoSalvar(); aoFechar(); toast({ texto: nova ? `Categoria ${nome.trim()} criada` : 'Categoria salva' })
    } catch (x) { setErro(msgErro(x)) } finally { setOcupado(false) }
  }
  const arquivar = async () => {
    setOcupado(true)
    try { await repo.editarCategoria(categoria!.id, { archived_at: new Date().toISOString() }); aoSalvar(); aoFechar(); toast({ texto: `${categoria!.name} arquivada`, sub: 'O histórico continua nos relatórios' }) }
    catch (x) { setErro(msgErro(x)) } finally { setOcupado(false) }
  }
  const pedirExclusao = async () => {
    setOcupado(true)
    try { const uso = await repo.usoCategoria(categoria!.id); setExcluir({ uso }); setDestino(outras.find(c => c.is_other)?.id ?? outras[0]?.id ?? '') }
    catch (x) { setErro(msgErro(x)) } finally { setOcupado(false) }
  }
  const confirmarExclusao = async () => {
    setOcupado(true)
    try {
      if (excluir!.uso > 0) await repo.moverLancamentos(categoria!.id, destino)
      await repo.excluirCategoria(categoria!.id)
      aoSalvar(); aoFechar(); toast({ texto: `${categoria!.name} excluída`, sub: excluir!.uso ? `${excluir!.uso} lançamentos movidos para ${outras.find(c => c.id === destino)?.name}` : undefined })
    } catch (x) { setErro(msgErro(x)); setExcluir(null) } finally { setOcupado(false) }
  }
  return (
    <>
      <Folha aberta aoFechar={aoFechar} rotulo={nova ? 'Nova categoria' : 'Editar categoria'} alta
        cabecalho={<div className="lanc-folha-cab"><div className="titulo"><h2 className="t-secao">{nova ? `Nova categoria de ${kind === 'saida' ? 'saída' : 'entrada'}` : 'Editar categoria'}</h2></div><button type="button" className="btn-icone" aria-label="Fechar" onClick={aoFechar}><Icone n="close" /></button></div>}
        rodape={<button type="submit" form="form-cat" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : nova ? 'Criar categoria' : 'Salvar'}</button>}>
        <form id="form-cat" onSubmit={salvar} style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CirculoCategoria icone={icone} cor={categoria?.is_other ? 0 : cor} g48 />
            <div className="campo" style={{ flex: 1 }}>
              <label htmlFor="cat-nome">Nome</label>
              <input id="cat-nome" data-autofoco className="input" maxLength={40} value={nome} onChange={e => setNome(e.target.value)} />
            </div>
          </div>
          {erro && <Faixa tipo="erro">{erro}</Faixa>}
          {!categoria?.is_other && (
            <div className="campo">
              <span className="rotulo">Cor</span>
              <div className="cores" role="radiogroup" aria-label="Cor">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                  <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={`Cor ${c}`} onClick={() => setCor(c)} style={{ background: corCat(c) }}>
                    {cor === c && <Icone n="check" s={20} />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="campo">
            <span className="rotulo">Ícone</span>
            {ICONES_CATEGORIA.map(g => (
              <div key={g.grupo} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span className="t-auxiliar sec">{g.grupo}</span>
                <div className="grade-icones">
                  {g.icones.map(i => (
                    <button key={i} type="button" aria-pressed={icone === i} aria-label={i.replace(/_/g, ' ')} onClick={() => setIcone(i)}><Icone n={i} s={20} f={icone === i} /></button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {!nova && !categoria!.is_other && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--divisoria)', paddingTop: 16 }}>
              <button type="button" className="btn btn-secundario" onClick={arquivar} disabled={ocupado}><Icone n="inventory_2" s={20} />Arquivar</button>
              <button type="button" className="btn btn-texto" style={{ color: 'var(--erro)' }} onClick={pedirExclusao} disabled={ocupado}><Icone n="delete" s={20} />Excluir</button>
            </div>
          )}
        </form>
      </Folha>
      {excluir && (
        <Dialogo aberto titulo={`Excluir ${categoria!.name}?`} destrutivo ocupado={ocupado}
          confirmar={excluir.uso ? 'Mover e excluir' : 'Excluir'}
          texto={excluir.uso ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <span>{excluir.uso} {excluir.uso === 1 ? 'lançamento usa' : 'lançamentos usam'} esta categoria. Eles serão movidos para:</span>
              <select className="input" value={destino} onChange={e => setDestino(e.target.value)} aria-label="Categoria de destino">
                {outras.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <span className="t-auxiliar">Prefere manter o histórico como está? Use Arquivar.</span>
            </div>
          ) : 'Nenhum lançamento usa esta categoria. Esta ação não pode ser desfeita.'}
          aoCancelar={() => setExcluir(null)} aoConfirmar={confirmarExclusao} />
      )}
    </>
  )
}

// ======================= Ambientes =======================
export function Ambientes() {
  const { ambiente, trocarAmbiente, setSeletorAberto, toast } = useApp()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['ambientes', 'todos'], queryFn: () => repo.todosAmbientes() })
  const [editando, setEditando] = useState<Ambiente | null>(null)
  const ativos = (q.data ?? []).filter(a => !a.archived_at)
  const arquivados = (q.data ?? []).filter(a => a.archived_at)
  const atualizar = () => qc.invalidateQueries({ queryKey: ['ambientes'] })
  const restaurar = async (a: Ambiente) => {
    try { await repo.editarAmbiente(a.id, { archived_at: null }); atualizar(); toast({ texto: `${a.name} restaurado` }) } catch (e) { toast({ texto: msgErro(e), icone: 'error' }) }
  }
  return (
    <Subtela titulo="Ambientes">
      <p className="t-auxiliar sec">Cada ambiente é um financeiro separado, com lançamentos, categorias e relatórios próprios.</p>
      {!q.data ? <div className="lista-card" style={{ padding: 16 }}><Esqueleto h={120} /></div> : (
        <div className="lista-card">
          {ativos.map(a => (
            <button key={a.id} type="button" className="item-lanc" onClick={() => setEditando(a)}>
              <span className="circulo-cat" style={{ background: corCat(a.color) }}><Icone n={a.icon} s={20} f /></span>
              <span className="meio"><span className="desc">{a.name}</span><span className="cat">{a.kind === 'empresa' ? 'Empresa' : a.kind === 'pessoal' ? 'Pessoal' : 'Outro'}{a.id === ambiente.id ? ' · ambiente atual' : ''}</span></span>
              <Icone n="chevron_right" style={{ color: 'var(--texto-secundario)' }} />
            </button>
          ))}
        </div>
      )}
      <button type="button" className="btn btn-secundario" style={{ alignSelf: 'flex-start' }} onClick={() => setSeletorAberto(true)}><Icone n="add" s={20} />Novo ambiente</button>
      {arquivados.length > 0 && (
        <div className="lista-card">
          <div className="cab-dia"><span>Arquivados</span></div>
          {arquivados.map(a => (
            <div key={a.id} className="item-lanc">
              <span className="circulo-cat" style={{ background: corCat(0) }}><Icone n={a.icon} s={20} f /></span>
              <span className="meio"><span className="desc sec">{a.name}</span><span className="cat">Arquivado em {dataCurta(a.archived_at!.slice(0, 10))}</span></span>
              <button type="button" className="btn btn-texto" onClick={() => restaurar(a)}>Restaurar</button>
            </div>
          ))}
        </div>
      )}
      {editando && <EditarAmbiente amb={editando} podeArquivar={ativos.length > 1} aoFechar={() => setEditando(null)}
        aoSalvar={arquivou => { atualizar(); if (arquivou && editando.id === ambiente.id) trocarAmbiente(ativos.find(a => a.id !== editando.id)!.id) }} />}
    </Subtela>
  )
}

function EditarAmbiente({ amb, podeArquivar, aoFechar, aoSalvar }: { amb: Ambiente; podeArquivar: boolean; aoFechar: () => void; aoSalvar: (arquivou: boolean) => void }) {
  const { toast } = useApp()
  const [nome, setNome] = useState(amb.name)
  const [cor, setCor] = useState(amb.color)
  const [icone, setIcone] = useState(amb.icon)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const salvar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!nome.trim()) { setErro('Dê um nome ao ambiente.'); return }
    setOcupado(true)
    try { await repo.editarAmbiente(amb.id, { name: nome.trim(), color: cor, icon: icone }); aoSalvar(false); aoFechar(); toast({ texto: 'Ambiente salvo' }) }
    catch (x) { setErro(msgErro(x)) } finally { setOcupado(false) }
  }
  const arquivar = async () => {
    setOcupado(true)
    try { await repo.editarAmbiente(amb.id, { archived_at: new Date().toISOString() }); aoSalvar(true); aoFechar(); toast({ texto: `${amb.name} arquivado`, sub: 'Os dados continuam guardados; você pode restaurar quando quiser' }) }
    catch (x) { setErro(msgErro(x)) } finally { setOcupado(false); setConfirmar(false) }
  }
  return (
    <>
      <Folha aberta aoFechar={aoFechar} rotulo="Editar ambiente"
        cabecalho={<div className="lanc-folha-cab"><div className="titulo"><h2 className="t-secao">Editar ambiente</h2></div><button type="button" className="btn-icone" aria-label="Fechar" onClick={aoFechar}><Icone n="close" /></button></div>}
        rodape={<button type="submit" form="form-amb" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Salvar'}</button>}>
        <form id="form-amb" onSubmit={salvar} style={{ padding: '4px 16px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="circulo-cat g48" style={{ background: corCat(cor) }}><Icone n={icone} s={20} f /></span>
            <div className="campo" style={{ flex: 1 }}><label htmlFor="amb-nome">Nome</label><input id="amb-nome" className="input" maxLength={40} value={nome} onChange={e => setNome(e.target.value)} /></div>
          </div>
          {erro && <Faixa tipo="erro">{erro}</Faixa>}
          <div className="campo">
            <span className="rotulo">Cor</span>
            <div className="cores" role="radiogroup" aria-label="Cor">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(c => (
                <button key={c} type="button" role="radio" aria-checked={cor === c} aria-label={`Cor ${c}`} onClick={() => setCor(c)} style={{ background: corCat(c) }}>{cor === c && <Icone n="check" s={20} />}</button>
              ))}
            </div>
            <span className="ajuda">A cor aparece no topo das telas, para você nunca lançar no ambiente errado.</span>
          </div>
          <div className="campo">
            <span className="rotulo">Ícone</span>
            <div className="grade-icones">
              {ICONES_AMBIENTE.map(i => <button key={i} type="button" aria-pressed={icone === i} aria-label={i.replace(/_/g, ' ')} onClick={() => setIcone(i)}><Icone n={i} s={20} f={icone === i} /></button>)}
            </div>
          </div>
          {podeArquivar && (
            <div style={{ borderTop: '1px solid var(--divisoria)', paddingTop: 16 }}>
              <button type="button" className="btn btn-secundario" onClick={() => setConfirmar(true)}><Icone n="inventory_2" s={20} />Arquivar ambiente</button>
            </div>
          )}
        </form>
      </Folha>
      <Dialogo aberto={confirmar} titulo={`Arquivar ${amb.name}?`} texto="O ambiente some do seletor, mas nada é apagado. Você pode restaurá-lo em Mais → Ambientes." confirmar="Arquivar"
        ocupado={ocupado} aoCancelar={() => setConfirmar(false)} aoConfirmar={arquivar} />
    </>
  )
}

// ======================= Lixeira =======================
export function Lixeira() {
  const { ambiente, ocultar, toast, invalidar } = useApp()
  const qc = useQueryClient()
  const cats = useCategorias(ambiente.id)
  const mapa = new Map((cats.data ?? []).map(c => [c.id, c]))
  const q = useQuery({ queryKey: ['lanc', ambiente.id, 'lixeira'], queryFn: () => repo.lixeira(ambiente.id) })
  const [sel, setSel] = useState<Lancamento | null>(null)
  const [apagar, setApagar] = useState<Lancamento | 'todos' | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const diasRestantes = (l: Lancamento) => Math.max(0, 30 - Math.floor((Date.now() - Date.parse(l.deleted_at!)) / 86400000))
  const restaurar = async (l: Lancamento) => {
    setSel(null)
    try { await repo.restaurar(l.id); invalidar(); qc.invalidateQueries({ queryKey: ['lanc', ambiente.id, 'lixeira'] }); toast({ texto: 'Lançamento restaurado' }) }
    catch (e) { toast({ texto: msgErro(e), icone: 'error' }) }
  }
  const confirmarApagar = async () => {
    setOcupado(true)
    try {
      const alvos = apagar === 'todos' ? q.data ?? [] : [apagar as Lancamento]
      for (const l of alvos) await repo.apagarDefinitivo(l.id)
      qc.invalidateQueries({ queryKey: ['lanc', ambiente.id, 'lixeira'] })
      toast({ texto: apagar === 'todos' ? 'Lixeira esvaziada' : 'Lançamento excluído definitivamente', icone: 'delete' })
    } catch (e) { toast({ texto: msgErro(e), icone: 'error' }) }
    finally { setOcupado(false); setApagar(null); setSel(null) }
  }
  return (
    <Subtela titulo="Lixeira" acoes={q.data?.length ? <button type="button" className="btn btn-texto" style={{ color: 'var(--erro)' }} onClick={() => setApagar('todos')}>Esvaziar</button> : undefined}>
      <p className="t-auxiliar sec">Lançamentos excluídos do ambiente <strong>{ambiente.name}</strong> ficam aqui por 30 dias e depois são apagados.</p>
      {!q.data ? <div className="lista-card" style={{ padding: 16 }}><Esqueleto h={120} /></div>
        : q.data.length === 0 ? <div className="lista-card"><EstadoVazio icone="delete" titulo="A Lixeira está vazia" texto="Lançamentos excluídos aparecem aqui por 30 dias." /></div>
        : (
          <div className="lista-card">
            {q.data.map(l => (
              <div key={l.id} style={{ position: 'relative' }}>
                <ItemLancamento l={l} cat={mapa.get(l.category_id)} ocultar={ocultar} aoAbrir={() => setSel(l)} />
                <span className="selo selo-neutro" style={{ position: 'absolute', right: 16, bottom: 6, pointerEvents: 'none' }}>{diasRestantes(l)} {diasRestantes(l) === 1 ? 'dia' : 'dias'}</span>
              </div>
            ))}
          </div>
        )}
      <Folha aberta={!!sel} aoFechar={() => setSel(null)} rotulo="Lançamento excluído">
        {sel && (
          <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h2 className="t-secao" style={{ padding: '8px 0 0' }}>{sel.description || mapa.get(sel.category_id)?.name}</h2>
            <p className="t-auxiliar sec" style={{ paddingBottom: 8 }}>Lançado em {dataCurta(sel.date)} · excluído em {dataHora(sel.deleted_at!)} · apagado em {diasRestantes(sel)} dias</p>
            <button type="button" className="item-ambiente" onClick={() => restaurar(sel)}><Icone n="restore_from_trash" />Restaurar</button>
            <button type="button" className="item-ambiente" style={{ color: 'var(--erro)' }} onClick={() => setApagar(sel)}><Icone n="delete_forever" />Excluir definitivamente</button>
          </div>
        )}
      </Folha>
      <Dialogo aberto={!!apagar} destrutivo ocupado={ocupado}
        titulo={apagar === 'todos' ? 'Esvaziar a Lixeira?' : 'Excluir definitivamente?'}
        texto={apagar === 'todos' ? `${q.data?.length ?? 0} lançamentos e suas fotos serão apagados para sempre. Esta ação não pode ser desfeita.` : 'O lançamento e a foto serão apagados para sempre. Esta ação não pode ser desfeita.'}
        confirmar={apagar === 'todos' ? 'Esvaziar' : 'Excluir definitivamente'}
        aoCancelar={() => setApagar(null)} aoConfirmar={confirmarApagar} />
    </Subtela>
  )
}

// ======================= Perfil e segurança =======================
export function Perfil() {
  const { perfil, sessao, toast } = useApp()
  const qc = useQueryClient()
  const [nome, setNome] = useState(perfil.name ?? '')
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState<null | 'nome' | 'senha'>(null)
  const [sairTodos, setSairTodos] = useState(false)
  const salvarNome = async (e: FormEvent) => {
    e.preventDefault()
    if (!nome.trim()) { setErroNome('Informe seu nome.'); return }
    setOcupado('nome'); setErroNome(null)
    try { await repo.atualizarPerfil({ name: nome.trim() }); await qc.invalidateQueries({ queryKey: ['perfil'] }); toast({ texto: 'Nome atualizado' }) }
    catch (x) { setErroNome(msgErro(x)) } finally { setOcupado(null) }
  }
  const trocar = async (e: FormEvent) => {
    e.preventDefault()
    if (!atual) { setErroSenha('Informe a senha atual.'); return }
    if (nova.length < 10) { setErroSenha('A nova senha precisa ter pelo menos 10 caracteres.'); return }
    if (nova === atual) { setErroSenha('A nova senha precisa ser diferente da atual.'); return }
    setOcupado('senha'); setErroSenha(null)
    try { await repo.trocarSenha(atual, nova); setAtual(''); setNova(''); toast({ texto: 'Senha alterada' }) }
    catch (x) {
      const c = (x as { code?: string }).code
      const m = ((x as Error).message ?? '').toLowerCase()
      setErroSenha(c === 'senha_atual' ? 'Senha atual incorreta.' : /weak|pwned|leaked/.test(m) ? 'Essa senha é muito comum ou já apareceu em vazamentos. Escolha outra.' : msgErro(x))
    } finally { setOcupado(null) }
  }
  return (
    <Subtela titulo="Perfil e segurança">
      <form className="card" onSubmit={salvarNome} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 className="t-secao">Seus dados</h2>
        <div className="campo"><label htmlFor="p-nome">Nome</label><input id="p-nome" className="input" maxLength={80} value={nome} onChange={e => setNome(e.target.value)} autoComplete="name" /></div>
        <div className="campo"><label htmlFor="p-email">E-mail</label><input id="p-email" className="input" value={sessao.email} disabled /><span className="ajuda">Para trocar o e-mail, fale com o administrador.</span></div>
        {erroNome && <Faixa tipo="erro">{erroNome}</Faixa>}
        <button type="submit" className="btn btn-secundario" style={{ alignSelf: 'flex-start' }} disabled={ocupado === 'nome' || nome.trim() === (perfil.name ?? '')}>{ocupado === 'nome' ? <span className="spinner" /> : 'Salvar nome'}</button>
      </form>
      <form className="card" onSubmit={trocar} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 className="t-secao">Alterar senha</h2>
        <input type="text" autoComplete="username" value={sessao.email} readOnly hidden />
        <CampoSenha id="s-atual" rotulo="Senha atual" valor={atual} aoMudar={setAtual} />
        <CampoSenha id="s-nova" rotulo="Nova senha" valor={nova} aoMudar={setNova} novo
          ajuda={<span className="t-auxiliar" style={{ display: 'flex', alignItems: 'center', gap: 4, color: nova.length >= 10 ? 'var(--entrada)' : 'var(--texto-secundario)' }}><Icone n={nova.length >= 10 ? 'check_circle' : 'radio_button_unchecked'} s={16} />Pelo menos 10 caracteres</span>} />
        {erroSenha && <Faixa tipo="erro">{erroSenha}</Faixa>}
        <button type="submit" className="btn btn-primario" style={{ alignSelf: 'flex-start' }} disabled={ocupado === 'senha'}>{ocupado === 'senha' ? <span className="spinner" /> : 'Alterar senha'}</button>
      </form>
      <div className="lista-card" style={{ paddingBottom: 0 }}>
        <Linha icone="devices" rotulo="Sair de todos os aparelhos" sub="Use se perdeu o celular ou entrou em um computador de outra pessoa" onClick={() => setSairTodos(true)} />
      </div>
      <Dialogo aberto={sairTodos} titulo="Sair de todos os aparelhos?" texto="Você e qualquer outro aparelho conectado precisarão entrar de novo com e-mail e senha." confirmar="Sair de todos"
        aoCancelar={() => setSairTodos(false)} aoConfirmar={() => { setSairTodos(false); repo.sairDeTodos() }} />
    </Subtela>
  )
}

// ======================= Usuários e convites (administrador) =======================
export function linkConvite(token: string) {
  return `${window.location.origin}${import.meta.env.BASE_URL}convite?t=${token}`
}

async function compartilharConvite(email: string, url: string, toast: ReturnType<typeof useApp>['toast']) {
  const texto = `Olá! Criei seu acesso ao Finanças, nosso app de controle financeiro. Toque no link para criar sua senha (vale por 7 dias). Use o e-mail ${email}.`
  if (navigator.share) {
    try { await navigator.share({ title: 'Convite para o Finanças', text: texto, url }); return } catch { /* cancelado */ return }
  }
  try { await navigator.clipboard.writeText(`${texto}\n${url}`); toast({ texto: 'Convite copiado', sub: 'Cole no WhatsApp ou no e-mail' }) }
  catch { toast({ texto: 'Não foi possível copiar', sub: 'Copie o link mostrado na tela', icone: 'error' }) }
}

export function Usuarios() {
  const { perfil, sessao, toast, online } = useApp()
  const qc = useQueryClient()
  const qU = useQuery({ queryKey: ['admin', 'usuarios'], queryFn: () => repo.usuarios(), enabled: perfil.is_admin })
  const qC = useQuery({ queryKey: ['admin', 'convites'], queryFn: () => repo.convites(), enabled: perfil.is_admin })
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [criado, setCriado] = useState<{ email: string; url: string } | null>(null)
  const [desativar, setDesativar] = useState<{ id: string; nome: string; desativar: boolean } | null>(null)
  if (!perfil.is_admin) return <Subtela titulo="Usuários e convites"><EstadoVazio icone="lock" titulo="Somente administradores" /></Subtela>
  const convidar = async (e: FormEvent, para?: string) => {
    e.preventDefault()
    const alvo = (para ?? email).trim()
    if (!/^\S+@\S+\.\S+$/.test(alvo)) { setErro('Informe um e-mail válido.'); return }
    if (!online) { setErro('Sem conexão.'); return }
    setOcupado(true); setErro(null)
    try {
      const c = await repo.criarConvite(alvo)
      setCriado({ email: c.email, url: linkConvite(c.token) }); setEmail('')
      qc.invalidateQueries({ queryKey: ['admin', 'convites'] })
    } catch (x) { setErro(msgErro(x)) } finally { setOcupado(false) }
  }
  const revogar = async (id: string) => {
    try { await repo.revogarConvite(id); qc.invalidateQueries({ queryKey: ['admin', 'convites'] }); toast({ texto: 'Convite revogado' }) } catch (x) { toast({ texto: msgErro(x), icone: 'error' }) }
  }
  const confirmarDesativar = async () => {
    try { await repo.desativarUsuario(desativar!.id, desativar!.desativar); qc.invalidateQueries({ queryKey: ['admin', 'usuarios'] }); toast({ texto: desativar!.desativar ? 'Acesso desativado' : 'Acesso reativado' }) }
    catch (x) { toast({ texto: msgErro(x), icone: 'error' }) } finally { setDesativar(null) }
  }
  const pendentes = (qC.data ?? []).filter(c => c.situacao === 'pendente' || c.situacao === 'vencido')
  return (
    <Subtela titulo="Usuários e convites">
      <form className="card" onSubmit={convidar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 className="t-secao">Convidar alguém</h2>
        <p className="t-auxiliar sec">A pessoa recebe um link para criar a própria senha. Cada pessoa tem o seu ambiente Pessoal, separado do seu.</p>
        <div className="campo"><label htmlFor="c-email">E-mail da pessoa</label><input id="c-email" className="input" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.com" /></div>
        {erro && <Faixa tipo="erro">{erro}</Faixa>}
        <button type="submit" className="btn btn-primario" style={{ alignSelf: 'flex-start' }} disabled={ocupado}>{ocupado ? <span className="spinner" /> : <><Icone n="group_add" s={20} />Criar convite</>}</button>
      </form>

      <div className="lista-card" style={{ paddingBottom: 0 }}>
        <div className="cab-dia"><span>Convites pendentes</span></div>
        {!qC.data ? <div style={{ padding: 16 }}><Esqueleto h={40} /></div> : pendentes.length === 0 ? <p className="t-auxiliar sec" style={{ padding: '4px 16px 16px' }}>Nenhum convite pendente.</p> : pendentes.map(c => (
          <div key={c.id} className="item-lanc" style={{ flexWrap: 'wrap' }}>
            <Icone n="mail" style={{ color: 'var(--texto-secundario)' }} />
            <span className="meio" style={{ flex: '1 1 60%' }}><span className="desc">{c.email}</span><span className="cat">{c.situacao === 'vencido' ? 'Vencido' : `Vence em ${dataCurta(c.expires_at.slice(0, 10))}`}</span></span>
            <span style={{ display: 'flex', marginLeft: 'auto' }}><button type="button" className="btn btn-texto" onClick={e => convidar(e as unknown as FormEvent, c.email)}>Gerar novo link</button>
            <button type="button" className="btn btn-texto" style={{ color: 'var(--erro)' }} onClick={() => revogar(c.id)}>Revogar</button></span>
          </div>
        ))}
      </div>

      <div className="lista-card" style={{ paddingBottom: 0 }}>
        <div className="cab-dia"><span>Pessoas com acesso</span></div>
        {!qU.data ? <div style={{ padding: 16 }}><Esqueleto h={40} /></div> : qU.data.map(u => (
          <div key={u.id} className="item-lanc">
            <span className="avatar" style={{ width: 40, height: 40, fontSize: 16, background: u.disabled_at ? 'var(--texto-secundario)' : undefined }}>{(u.name ?? u.email)[0]?.toUpperCase()}</span>
            <span className="meio">
              <span className="desc">{u.name ?? u.email}{u.id === sessao.userId ? ' (você)' : ''}</span>
              <span className="cat">{u.email}{u.is_admin ? ' · administrador' : ''}{u.disabled_at ? ' · desativado' : u.last_sign_in_at ? ` · último acesso ${dataCurta(u.last_sign_in_at.slice(0, 10))}` : ' · ainda não entrou'}</span>
            </span>
            {u.id !== sessao.userId && (
              <button type="button" className="btn btn-texto" style={{ color: u.disabled_at ? undefined : 'var(--erro)' }}
                onClick={() => setDesativar({ id: u.id, nome: u.name ?? u.email, desativar: !u.disabled_at })}>{u.disabled_at ? 'Reativar' : 'Desativar'}</button>
            )}
          </div>
        ))}
      </div>
      <p className="t-auxiliar sec">Ser administrador permite convidar e desativar pessoas, mas não dá acesso ao financeiro de ninguém.</p>

      <Folha aberta={!!criado} aoFechar={() => setCriado(null)} rotulo="Convite criado">
        {criado && (
          <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h2 className="t-secao" style={{ paddingTop: 8 }}>Convite criado para {criado.email}</h2>
            <p className="t-auxiliar sec">Envie o link para a pessoa. Ele vale por 7 dias e só funciona uma vez. Por segurança, este link não aparece de novo; se precisar, gere outro.</p>
            <div className="link-convite tab">{criado.url}</div>
            <button type="button" className="btn btn-primario btn-largo" onClick={() => compartilharConvite(criado.email, criado.url, toast)}><Icone n="share" s={20} />Enviar pelo WhatsApp ou outro app</button>
            <button type="button" className="btn btn-secundario btn-largo" onClick={async () => { try { await navigator.clipboard.writeText(criado.url); toast({ texto: 'Link copiado' }) } catch { toast({ texto: 'Selecione e copie o link acima', icone: 'error' }) } }}><Icone n="content_copy" s={20} />Copiar link</button>
          </div>
        )}
      </Folha>
      <Dialogo aberto={!!desativar} titulo={desativar?.desativar ? `Desativar ${desativar?.nome}?` : `Reativar ${desativar?.nome}?`}
        texto={desativar?.desativar ? 'A pessoa deixa de ver e alterar os dados dela. Nada é apagado; você pode reativar depois.' : 'A pessoa volta a ter acesso aos dados dela.'}
        confirmar={desativar?.desativar ? 'Desativar' : 'Reativar'} destrutivo={desativar?.desativar}
        aoCancelar={() => setDesativar(null)} aoConfirmar={confirmarDesativar} />
    </Subtela>
  )
}
