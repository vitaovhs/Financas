import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { repo } from '../data'
import type { Anexo, Categoria, FotoPreparada, Lancamento, LancamentoEntrada, Tipo } from '../data/types'
import { useApp, useCategorias, type AberturaLancamento } from '../state/app'
import { PilulaAmbiente } from '../components/shell'
import { CirculoCategoria, Dialogo, Faixa, Folha, Icone } from '../components/ui'
import { dataCurta, dataHora, diasEntre, hojeIso, isoData, mesDe, ontemIso, reais, type Mes } from '../lib/format'
import { prepararFoto } from '../lib/foto'
import { Visualizador } from './Visualizador'

type Foto =
  | { t: 'nenhuma' }
  | { t: 'existente'; anexo: Anexo }
  | { t: 'preparando' }
  | { t: 'nova'; prep: FotoPreparada; url: string }

interface Form {
  id: string
  kind: Tipo
  digitos: string
  categoria: string | null
  data: string
  descricao: string
  obs: string
}

const novoId = () => crypto.randomUUID()
const centavos = (d: string) => (d ? parseInt(d, 10) : 0)
const digitosDe = (c: number) => (c > 0 ? String(c) : '')

// Data padrão: hoje, se o mês aberto na tela for o atual; senão, o mesmo dia dentro do mês aberto
function dataPadrao(m: Mes): string {
  const hoje = new Date()
  if (m.ano === hoje.getFullYear() && m.mes === hoje.getMonth() + 1) return hojeIso()
  const ultimo = new Date(m.ano, m.mes, 0).getDate()
  return isoData(new Date(m.ano, m.mes - 1, Math.min(hoje.getDate(), ultimo)))
}

function formInicial(a: AberturaLancamento, m: Mes): Form {
  if (a.modo === 'novo') return { id: novoId(), kind: a.tipo ?? 'saida', digitos: '', categoria: a.categoria ?? null, data: a.data ?? dataPadrao(m), descricao: '', obs: '' }
  const l = a.lanc
  return {
    id: a.modo === 'editar' ? l.id : novoId(),
    kind: l.kind, digitos: digitosDe(l.amount_cents), categoria: l.category_id,
    data: l.date, descricao: l.description ?? '', obs: l.note ?? '',
  }
}

export function LancamentoFolha() {
  const { lancamentoAberto, fecharLancamento } = useApp()
  if (!lancamentoAberto) return null
  // key garante estado limpo a cada abertura
  const k = lancamentoAberto.modo === 'novo' ? 'novo' : lancamentoAberto.modo + lancamentoAberto.lanc.id
  return <FolhaLancamento key={k} abertura={lancamentoAberto} aoFechar={fecharLancamento} />
}

function FolhaLancamento({ abertura, aoFechar }: { abertura: AberturaLancamento; aoFechar: () => void }) {
  const { ambiente, online, toast, invalidar, marcarRecemSalvo, setMes, mes, abrirLancamento } = useApp()
  const editando = abertura.modo === 'editar'
  const original: Lancamento | null = abertura.modo === 'novo' ? null : abertura.lanc
  const [f, setF] = useState<Form>(() => formInicial(abertura, mes))
  const inicial = useRef(f)
  const [foto, setFoto] = useState<Foto>(() => editando && original?.anexo ? { t: 'existente', anexo: original.anexo } : { t: 'nenhuma' })
  const [detalhes, setDetalhes] = useState(() => !!(original?.note || (editando && original?.anexo)))
  const [todas, setTodas] = useState(false)
  const [erros, setErros] = useState<{ valor?: string; categoria?: string }>({})
  const [falha, setFalha] = useState<string | null>(null)
  const [salvando, setSalvando] = useState<null | 'salvando' | 'foto'>(null)
  const [menu, setMenu] = useState(false)
  const [folhaFoto, setFolhaFoto] = useState(false)
  const [ver, setVer] = useState(false)
  const [descartar, setDescartar] = useState(false)
  const [focoValor, setFocoValor] = useState(false)
  const inputCamera = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)
  const inputData = useRef<HTMLInputElement>(null)
  const valorRef = useRef<HTMLInputElement>(null)

  const qCats = useCategorias(ambiente.id)
  const qUso = useQuery({ queryKey: ['uso', ambiente.id], queryFn: () => repo.usoCategorias(ambiente.id), staleTime: 60_000 })

  const fotoMudou = foto.t === 'nova' || (editando && !!original?.anexo && foto.t === 'nenhuma')
  const alterado = JSON.stringify(f) !== JSON.stringify(inicial.current) || fotoMudou
  const temDados = abertura.modo === 'novo' ? (!!f.digitos || !!f.descricao || !!f.obs || foto.t === 'nova') : alterado

  // Libera URLs temporárias de fotos
  useEffect(() => () => { if (foto.t === 'nova') URL.revokeObjectURL(foto.url) }, [foto])

  const listaCats = useMemo(() => {
    const uso = qUso.data ?? {}
    const doTipo = (qCats.data ?? []).filter(c => c.kind === f.kind && (!c.archived_at || c.id === f.categoria))
    const ordenadas = [...doTipo].sort((a, b) => (uso[b.id] ?? 0) - (uso[a.id] ?? 0) || a.sort - b.sort)
    return { todas: [...doTipo].sort((a, b) => a.sort - b.sort), recentes: ordenadas }
  }, [qCats.data, qUso.data, f.kind, f.categoria])

  let visiveis: Categoria[] = listaCats.recentes.slice(0, 7)
  if (todas) visiveis = listaCats.todas
  else if (f.categoria && !visiveis.some(c => c.id === f.categoria)) {
    const sel = listaCats.todas.find(c => c.id === f.categoria)
    if (sel) visiveis = [sel, ...visiveis.slice(0, 6)]
  }
  const temMais = !todas && listaCats.todas.length > visiveis.length

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => ({ ...x, [k]: v }))

  const trocarTipo = (k: Tipo) => {
    if (k === f.kind) return
    const cat = qCats.data?.find(c => c.id === f.categoria)
    setF(x => ({ ...x, kind: k, categoria: cat && cat.kind === k ? x.categoria : null }))
    setErros(e => ({ ...e, categoria: undefined }))
  }

  const escolherArquivo = async (arq: File | undefined) => {
    setFolhaFoto(false)
    if (!arq) return
    const anterior = foto
    setFoto({ t: 'preparando' })
    setDetalhes(true)
    try {
      const prep = await prepararFoto(arq)
      setFoto({ t: 'nova', prep, url: URL.createObjectURL(prep.full) })
    } catch (e) {
      setFoto(anterior)
      toast({ texto: 'Não foi possível usar esta foto', sub: (e as Error).message, icone: 'error' })
    }
  }

  const validar = () => {
    const e: typeof erros = {}
    if (centavos(f.digitos) <= 0) e.valor = 'Informe um valor maior que zero.'
    if (!f.categoria) e.categoria = 'Escolha uma categoria.'
    setErros(e)
    if (e.valor) valorRef.current?.focus()
    else if (e.categoria) document.getElementById('grade-cat')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    return !e.valor && !e.categoria
  }

  const salvar = async (criarOutro = false) => {
    if (salvando) return
    setFalha(null)
    if (!validar()) return
    if (foto.t === 'preparando') { setFalha('Aguarde a foto terminar de ser preparada.'); return }
    if (!online) { setFalha('Sem conexão. É necessário estar conectado à internet para salvar. O que você digitou continua aqui.'); return }
    const entrada: LancamentoEntrada = {
      id: f.id, workspace_id: ambiente.id, kind: f.kind, amount_cents: centavos(f.digitos), category_id: f.categoria!,
      date: f.data, description: f.descricao.trim() || null, note: f.obs.trim() || null,
    }
    setSalvando('salvando')
    try {
      if (editando) await repo.salvarEdicao(entrada)
      else await repo.salvarNovo(entrada)
    } catch (e) {
      setSalvando(null)
      const m = (e as Error).message ?? ''
      setFalha(/fetch|network/i.test(m) ? 'Sem conexão. Tente de novo; o que você digitou continua aqui.' : 'Não foi possível salvar. Tente novamente.')
      return
    }
    let fotoFalhou = false
    try {
      if (foto.t === 'nova') {
        setSalvando('foto')
        await repo.anexarFoto(ambiente.id, f.id, foto.prep, editando ? original?.anexo ?? null : null)
      } else if (editando && original?.anexo && foto.t === 'nenhuma') {
        await repo.removerFoto(original.anexo)
      }
    } catch { fotoFalhou = true }
    setSalvando(null)
    invalidar()
    marcarRecemSalvo(f.id)
    const cat = qCats.data?.find(c => c.id === f.categoria)
    const resumo = `${cat?.name ?? 'Lançamento'} · ${reais(entrada.amount_cents)}`
    const mesDoLanc = mesDe(f.data)
    const outroMes = mesDoLanc.ano !== mes.ano || mesDoLanc.mes !== mes.mes
    const desfazer = editando ? undefined : {
      rotulo: 'Desfazer',
      fn: async () => {
        try { await repo.apagarDefinitivo(entrada.id); invalidar(); toast({ texto: 'Lançamento desfeito' }) }
        catch { toast({ texto: 'Não foi possível desfazer', icone: 'error' }) }
      },
    }
    if (fotoFalhou) {
      toast({ texto: `${resumo} salvo`, sub: 'Mas a foto não foi enviada. Abra o lançamento para tentar de novo.', icone: 'error', ms: 7000 })
    } else if (criarOutro) {
      toast({ texto: `${resumo} salvo`, sub: 'Novo lançamento aberto em branco', acao: desfazer })
    } else {
      toast({
        texto: editando ? 'Alterações salvas' : `${resumo} salvo`,
        sub: outroMes && !editando ? `Registrado em ${dataCurta(f.data)}` : undefined,
        acao: desfazer ?? (outroMes ? { rotulo: 'Ver mês', fn: () => setMes(mesDoLanc) } : undefined),
      })
    }
    if (criarOutro) {
      const n: Form = { id: novoId(), kind: 'saida', digitos: '', categoria: null, data: f.data, descricao: '', obs: '' }
      inicial.current = n
      setF(n); setFoto({ t: 'nenhuma' }); setErros({}); setDetalhes(false); setTodas(false)
      setTimeout(() => valorRef.current?.focus(), 50)
    } else {
      aoFechar()
    }
  }

  const tentarFechar = () => { if (salvando) return; if (temDados) setDescartar(true); else aoFechar() }

  const duplicar = () => { setMenu(false); if (original) abrirLancamento({ modo: 'duplicar', lanc: original }) }
  const excluirAgora = async () => {
    setMenu(false)
    if (!original) return
    if (!online) { setFalha('Sem conexão. É necessário estar conectado à internet para excluir.'); return }
    try { await repo.excluir(original.id) } catch { setFalha('Não foi possível excluir. Tente novamente.'); return }
    invalidar(); aoFechar()
    toast({
      texto: 'Lançamento excluído', sub: 'Fica na Lixeira por 30 dias', icone: 'delete',
      acao: { rotulo: 'Desfazer', fn: async () => { await repo.restaurar(original.id); invalidar(); toast({ texto: 'Lançamento restaurado' }) } },
    })
  }

  const titulo = editando ? 'Editar lançamento' : abertura.modo === 'duplicar' ? 'Duplicar lançamento' : 'Novo lançamento'
  const valorTxt = reais(centavos(f.digitos)).replace('R$ ', '')
  const futuroLongo = diasEntre(hojeIso(), f.data) > 365
  const dataOutra = f.data !== hojeIso() && f.data !== ontemIso()

  const cab = (
    <>
      <div className="faixa-ambiente" style={{ background: `var(--cat-${ambiente.color})`, position: 'absolute', top: 0, left: 0, right: 0 }} />
      <div className="lanc-folha-cab">
        <PilulaAmbiente informativa />
        <span style={{ flex: 1 }} />
        {editando && (
          <button type="button" className="btn-icone" aria-label="Mais ações" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Icone n="more_horiz" /></button>
        )}
        <button type="button" className="btn-icone" aria-label="Fechar" onClick={tentarFechar}><Icone n="close" /></button>
        {menu && (
          <div className="menu-flutuante" role="menu">
            <button type="button" role="menuitem" onClick={duplicar}><Icone n="content_copy" s={20} />Duplicar</button>
            <button type="button" role="menuitem" onClick={excluirAgora} style={{ color: 'var(--erro)' }}><Icone n="delete" s={20} />Excluir</button>
          </div>
        )}
      </div>
      <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column' }}>
        <h2 className="t-secao">{titulo}</h2>
        {editando && original && <span className="t-auxiliar sec">Criado em {dataHora(original.created_at)}{original.version > 1 ? ` · alterado em ${dataHora(original.updated_at)}` : ''}</span>}
      </div>
    </>
  )

  const rodape = (
    <>
      {falha && <div style={{ marginBottom: 8 }}><Faixa tipo="erro" icone={/conexão/.test(falha) ? 'cloud_off' : undefined}>{falha}</Faixa></div>}
      {editando && !alterado ? (
        <p className="t-auxiliar sec" style={{ textAlign: 'center', padding: '12px 0' }}>Toque em um campo para alterar</p>
      ) : (
        <button type="submit" form="form-lanc" className="btn btn-primario btn-largo" disabled={!!salvando} aria-live="polite">
          {salvando ? <><span className="spinner" />{salvando === 'foto' ? 'Enviando foto...' : 'Salvando...'}</> : editando ? 'Salvar alterações' : 'Salvar'}
        </button>
      )}
      {!editando && (
        <button type="button" className="btn btn-texto" onClick={() => salvar(true)} disabled={!!salvando}><Icone n="add" s={20} />Salvar e criar outro</button>
      )}
    </>
  )

  return (
    <>
      <Folha aberta aoFechar={tentarFechar} rotulo={titulo} alta cabecalho={cab} rodape={rodape} fecharAoTocarFora={!temDados}>
        <form id="form-lanc" className="form-lanc" onSubmit={e => { e.preventDefault(); salvar(false) }} noValidate onClick={() => menu && setMenu(false)}>
          {abertura.modo === 'duplicar' && (
            <Faixa tipo="info" icone="content_copy">
              Cópia de “{abertura.lanc.description || listaCats.todas.find(c => c.id === abertura.lanc.category_id)?.name || 'lançamento'}”, com a mesma data do original e sem foto. Você pode alterar a data e os demais dados. Nada é salvo até você tocar em Salvar.
            </Faixa>
          )}

          <div className="segmentos" role="group" aria-label="Tipo de lançamento">
            <button type="button" aria-pressed={f.kind === 'saida'} onClick={() => trocarTipo('saida')}><Icone n="arrow_downward" s={20} style={{ color: 'var(--saida)' }} />Saída</button>
            <button type="button" aria-pressed={f.kind === 'entrada'} onClick={() => trocarTipo('entrada')}><Icone n="arrow_upward" s={20} style={{ color: 'var(--entrada)' }} />Entrada</button>
          </div>

          <div className={'campo-valor' + (focoValor ? ' focado' : '') + (erros.valor ? ' com-erro' : '')}>
            <label htmlFor="valor" className="t-rotulo sec">Valor</label>
            <div className="linha" onClick={() => valorRef.current?.focus()}>
              <span className="rs">R$</span>
              <span className={'num' + (f.digitos ? '' : ' zero')} aria-hidden>{valorTxt}</span>
            </div>
            <input id="valor" ref={valorRef} data-autofoco={!editando ? true : undefined} inputMode="numeric" pattern="[0-9]*" autoComplete="off"
              value={f.digitos} aria-label={`Valor: ${reais(centavos(f.digitos))}`} aria-invalid={!!erros.valor}
              onFocus={() => setFocoValor(true)} onBlur={() => setFocoValor(false)}
              onChange={e => { const d = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 11); set('digitos', d); if (d) setErros(x => ({ ...x, valor: undefined })) }} />
            {erros.valor && <span className="erro-campo" role="alert"><Icone n="error" s={16} />{erros.valor}</span>}
          </div>

          <div className="campo" id="grade-cat">
            <span className="rotulo">Categoria</span>
            {erros.categoria && <span className="erro-campo" role="alert"><Icone n="error" s={16} />{erros.categoria}</span>}
            <div className="grade-cat" role="group" aria-label="Categoria">
              {visiveis.map(c => {
                const sel = c.id === f.categoria
                return (
                  <button key={c.id} type="button" className="cat-op" aria-pressed={sel} onClick={() => { set('categoria', c.id); setErros(x => ({ ...x, categoria: undefined })) }}>
                    <CirculoCategoria icone={c.icon} cor={c.color} g48 />
                    {sel && <span className="check"><Icone n="check" s={16} /></span>}
                    <span className="nm">{c.name}</span>
                  </button>
                )
              })}
              {temMais && (
                <button type="button" className="cat-op todas" onClick={() => setTodas(true)}>
                  <span className="circulo-cat g48" style={{ border: '1px dashed var(--borda-campo)', color: 'var(--texto-secundario)' }}><Icone n="apps" s={20} /></span>
                  <span className="nm">Ver todas</span>
                </button>
              )}
              {!qCats.data && [0, 1, 2, 3].map(i => <span key={i} className="cat-op"><span className="esqueleto" style={{ width: 48, height: 48, borderRadius: 24 }} /></span>)}
            </div>
          </div>

          <div className="campo">
            <span className="rotulo">Data</span>
            <div className="chips" style={{ flexWrap: 'wrap' }}>
              <button type="button" className="chip" aria-pressed={f.data === hojeIso()} onClick={() => set('data', hojeIso())}>Hoje</button>
              <button type="button" className="chip" aria-pressed={f.data === ontemIso()} onClick={() => set('data', ontemIso())}>Ontem</button>
              <button type="button" className="chip" aria-pressed={dataOutra} onClick={() => { const i = inputData.current; if (!i) return; try { i.showPicker() } catch { i.focus(); i.click() } }}>
                <Icone n="calendar_today" s={16} />{dataOutra ? dataCurta(f.data) : 'Outra data'}
              </button>
              <input ref={inputData} type="date" value={f.data} onChange={e => e.target.value && set('data', e.target.value)} aria-label="Escolher data"
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }} tabIndex={-1} />
            </div>
            {futuroLongo && <Faixa tipo="aviso">Data mais de um ano no futuro. Confira se está correta.</Faixa>}
          </div>

          <div className="campo">
            <label htmlFor="descricao">Descrição (opcional)</label>
            <input id="descricao" className="input" maxLength={120} value={f.descricao} onChange={e => set('descricao', e.target.value)} placeholder={listaCats.todas.find(c => c.id === f.categoria)?.name ?? 'Ex.: Mercado São José'} enterKeyHint="done" />
          </div>

          <div>
            <button type="button" className="detalhes-toggle" aria-expanded={detalhes} onClick={() => setDetalhes(d => !d)}>
              <Icone n={detalhes ? 'expand_less' : 'expand_more'} s={20} />Mais detalhes
              {!detalhes && <span className="t-auxiliar sec" style={{ fontWeight: 400 }}>observação, foto{foto.t !== 'nenhuma' || f.obs ? ' · preenchido' : ''}</span>}
            </button>
            {detalhes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 8 }}>
                <div className="campo">
                  <label htmlFor="obs">Observação</label>
                  <textarea id="obs" className="input" maxLength={1000} rows={3} value={f.obs} onChange={e => set('obs', e.target.value)} />
                </div>
                <div className="campo">
                  <span className="rotulo">Foto do comprovante</span>
                  {foto.t === 'nenhuma' ? (
                    <button type="button" className="add-foto" onClick={() => setFolhaFoto(true)}><Icone n="add_a_photo" s={20} />Adicionar foto</button>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <MiniaturaFoto foto={foto} aoAbrir={() => foto.t !== 'preparando' && setVer(true)} />
                      <div style={{ flex: '1 1 140px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span className="t-rotulo">{foto.t === 'preparando' ? 'Preparando foto...' : foto.t === 'nova' ? 'Nova foto' : 'Comprovante'}</span>
                        <span className="t-auxiliar sec">{foto.t === 'nova' ? 'Enviada ao salvar' : 'Toque para ver em tela cheia'}</span>
                      </div>
                      {foto.t !== 'preparando' && <div style={{ display: 'flex', marginLeft: 'auto' }}>
                        <button type="button" className="btn btn-texto" onClick={() => setFolhaFoto(true)}>Substituir</button>
                        <button type="button" className="btn btn-texto" style={{ color: 'var(--erro)' }} onClick={() => setFoto({ t: 'nenhuma' })}>Remover</button>
                      </div>}
                    </div>
                  )}
                  {editando && original?.anexo && foto.t === 'nenhuma' && <span className="ajuda">A foto será removida ao salvar.</span>}
                </div>
              </div>
            )}
          </div>
        </form>
      </Folha>

      <Folha aberta={folhaFoto} aoFechar={() => setFolhaFoto(false)} rotulo="Foto do comprovante">
        <div style={{ padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="t-secao" style={{ padding: '8px 0 0' }}>{foto.t === 'nenhuma' ? 'Adicionar foto' : 'Substituir foto'}</h2>
          <p className="t-auxiliar sec" style={{ paddingBottom: 8 }}>Uma foto por lançamento. Ela é reduzida no aparelho antes do envio, mantendo o texto legível.</p>
          <button type="button" className="item-ambiente" onClick={() => inputCamera.current?.click()}><Icone n="photo_camera" />Tirar foto</button>
          <button type="button" className="item-ambiente" onClick={() => inputGaleria.current?.click()}><Icone n="photo_library" />Escolher da galeria</button>
          <button type="button" className="btn btn-secundario" style={{ marginTop: 8 }} onClick={() => setFolhaFoto(false)}>Cancelar</button>
        </div>
      </Folha>
      <input ref={inputCamera} type="file" accept="image/*" capture="environment" hidden onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={inputGaleria} type="file" accept="image/*" hidden onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = '' }} />

      {ver && (foto.t === 'nova' || foto.t === 'existente') && (
        <Visualizador fonte={foto.t === 'nova' ? { url: foto.url } : { path: foto.anexo.path }}
          aoFechar={() => setVer(false)}
          aoSubstituir={() => { setVer(false); setFolhaFoto(true) }}
          aoRemover={() => { setVer(false); setFoto({ t: 'nenhuma' }) }} />
      )}

      <Dialogo aberto={descartar} titulo={editando ? 'Descartar alterações?' : 'Descartar lançamento?'} texto="O que você digitou será perdido."
        confirmar="Descartar" cancelar="Continuar editando" destrutivo
        aoCancelar={() => setDescartar(false)} aoConfirmar={() => { setDescartar(false); aoFechar() }} />
    </>
  )
}

function MiniaturaFoto({ foto, aoAbrir }: { foto: Foto; aoAbrir: () => void }) {
  const path = foto.t === 'existente' ? foto.anexo.thumb_path : null
  const q = useQuery({ queryKey: ['foto', path], queryFn: () => repo.urlFoto(path!), enabled: !!path, staleTime: 8 * 60_000 })
  const url = foto.t === 'nova' ? foto.url : q.data
  return (
    <button type="button" className="miniatura" onClick={aoAbrir} aria-label="Ver foto em tela cheia" disabled={foto.t === 'preparando'}>
      {foto.t === 'preparando' || !url ? <span className="esqueleto" style={{ display: 'block', width: '100%', height: '100%' }} /> : <img src={url} alt="" />}
      {foto.t === 'nova' && <span style={{ position: 'absolute', right: 2, bottom: 2, width: 20, height: 20, borderRadius: 10, background: 'var(--acao)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icone n="schedule" s={16} /></span>}
    </button>
  )
}
