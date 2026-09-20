// Modo demonstração: mesmos contratos do Supabase, dados fictícios na memória do navegador.
// Serve para experimentar o app sem conta e para testes visuais.
import { INICIAIS } from './categoriasIniciais'
import type { Ambiente, Anexo, Categoria, Convite, EventoAuth, Filtros, Lancamento, Perfil, Repositorio, Sessao } from './types'
import { hojeIso, isoData, parseIso } from '../lib/format'

interface Estado {
  sessao: Sessao | null
  perfil: Omit<Perfil, 'email' | 'is_admin' | 'disabled_at'>
  ambientes: Ambiente[]
  categorias: Categoria[]
  lancamentos: Lancamento[]
  fotos: Record<string, string> // path → data URL
  convites?: (Convite & { token: string })[]
}

const CHAVE = 'financas-demo-v1'
const USER = '00000000-0000-4000-8000-000000000001'
const EMAIL = 'ana@exemplo.com'
const uuid = () => crypto.randomUUID()
const espera = (ms = 120) => new Promise(r => setTimeout(r, ms))
const normaliza = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function criarCategorias(ws: string, tipo: 'pessoal' | 'empresa'): Categoria[] {
  const out: Categoria[] = []
  for (const kind of ['saida', 'entrada'] as const) {
    INICIAIS[tipo][kind].forEach(([name, icon], i) =>
      out.push({ id: uuid(), workspace_id: ws, kind, name, icon, color: (i % 10) + 1, sort: i + 1, is_other: false, archived_at: null }))
    out.push({ id: uuid(), workspace_id: ws, kind, name: 'Outros', icon: 'more_horiz', color: 0, sort: 1000, is_other: true, archived_at: null })
  }
  return out
}

function reciboSvg(): string {
  const linhas = [['Arroz 5 kg', '28,90'], ['Feijão 1 kg', '8,49'], ['Café 500 g', '18,90'], ['Leite 12 un', '59,88'], ['Frutas e verduras', '41,33'], ['Carnes', '72,50']]
  const y0 = 150
  const itens = linhas.map(([n, v], i) => `<text x="30" y="${y0 + i * 34}">${n}</text><text x="370" y="${y0 + i * 34}" text-anchor="end">${v}</text>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="620" viewBox="0 0 400 620"><rect width="400" height="620" fill="#fbfaf6"/><g font-family="monospace" font-size="18" fill="#222"><text x="200" y="50" text-anchor="middle" font-weight="bold">MERCADO SÃO JOSÉ</text><text x="200" y="78" text-anchor="middle" font-size="14">Rua das Flores, 120</text><text x="200" y="102" text-anchor="middle" font-size="14">${hojeIso().split('-').reverse().join('/')} 10:40</text><line x1="30" y1="118" x2="370" y2="118" stroke="#999" stroke-dasharray="4 4"/>${itens}<line x1="30" y1="${y0 + 6 * 34 - 10}" x2="370" y2="${y0 + 6 * 34 - 10}" stroke="#999" stroke-dasharray="4 4"/><text x="30" y="${y0 + 6 * 34 + 24}" font-weight="bold">TOTAL</text><text x="370" y="${y0 + 6 * 34 + 24}" text-anchor="end" font-weight="bold">R$ 230,00</text><text x="200" y="${y0 + 6 * 34 + 70}" text-anchor="middle" font-size="14">Cartão de débito</text><text x="200" y="${y0 + 6 * 34 + 110}" text-anchor="middle" font-size="14">Obrigado pela preferência</text></g></svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

function semear(): Estado {
  const agora = new Date()
  const wsP = uuid(), wsE = uuid()
  const ambientes: Ambiente[] = [
    { id: wsP, name: 'Pessoal', kind: 'pessoal', icon: 'person', color: 1, archived_at: null, created_at: new Date(2026, 0, 1).toISOString() },
    { id: wsE, name: 'Empresa', kind: 'empresa', icon: 'business_center', color: 3, archived_at: null, created_at: new Date(2026, 0, 2).toISOString() },
  ]
  const categorias = [...criarCategorias(wsP, 'pessoal'), ...criarCategorias(wsE, 'empresa')]
  const cat = (ws: string, nome: string) => categorias.find(c => c.workspace_id === ws && c.name === nome)!
  const lancamentos: Lancamento[] = []
  const fotos: Record<string, string> = {}
  const add = (ws: string, dias: number, nome: string, valor: number, desc: string | null, comFoto = false) => {
    const d = new Date(agora); d.setDate(d.getDate() - dias)
    const c = cat(ws, nome)
    const id = uuid()
    let ts = new Date(d); ts.setHours(10 + (dias % 8), 40 - (dias % 30))
    if (ts.getTime() > Date.now()) ts = new Date(Date.now() - (lancamentos.length + 1) * 600000)
    let anexo: Anexo | null = null
    if (comFoto) {
      const aid = uuid()
      anexo = { id: aid, transaction_id: id, workspace_id: ws, path: `${ws}/${id}/${aid}.jpg`, thumb_path: `${ws}/${id}/${aid}_t.jpg`, width: 400, height: 620, size_bytes: 380000 }
      fotos[anexo.path] = fotos[anexo.thumb_path] = reciboSvg()
    }
    lancamentos.push({ id, workspace_id: ws, kind: c.kind, amount_cents: Math.round(valor * 100), category_id: c.id, date: isoData(d), description: desc, note: null, created_at: ts.toISOString(), updated_at: ts.toISOString(), version: 1, deleted_at: null, anexo })
  }
  // Pessoal — mês atual e dois anteriores (variações nos cards)
  for (const m of [0, 1, 2]) {
    const base = m === 0 ? 0 : agora.getDate() + (m - 1) * 30 + 2
    const f = 1 - m * 0.06
    add(wsP, base + (m === 0 ? 1 : 3), 'Salário', 8000, m === 0 ? 'Salário' : 'Salário')
    add(wsP, base + 3, 'Casa', 1400, 'Aluguel')
    add(wsP, base + 2, 'Contas', 186.3 * f, 'Conta de luz', m === 0)
    add(wsP, base + 2, 'Saúde', 64.9, 'Farmácia')
    add(wsP, base + 4, 'Pedágio', 12.4, 'Pedágio Rodovia')
    add(wsP, base + 6, 'Mercado', 412.35 * f, 'Supermercado Bom Preço')
    add(wsP, base + 9, 'Mercado', 318.6, 'Mercado São José')
    add(wsP, base + 11, 'Alimentação', 132.4 * f, 'Pizzaria')
    add(wsP, base + 12, 'Lazer', 180 * f, 'Cinema e jantar')
    add(wsP, base + 13, 'Gasolina', 250, 'Posto Avenida')
    add(wsP, base + 15, 'Assinaturas', 55.9, 'Streaming')
    add(wsP, base + 16, 'Compras', 239.9 * f, 'Tênis')
    add(wsP, base + 18, 'Alimentação', 88.5, 'Padaria')
    add(wsP, base + 20, 'Carro', 310 * f, 'Troca de óleo')
    if (m === 0) {
      add(wsP, 0, 'Mercado', 230, 'Mercado São José', true)
      add(wsP, 0, 'Gasolina', 82.4, 'Posto Avenida')
      add(wsP, 1, 'Alimentação', 46.9, 'Almoço')
      add(wsP, 5, 'Renda extra', 350, 'Freela site')
    }
  }
  // Empresa
  for (const m of [0, 1, 2]) {
    const base = m === 0 ? 0 : agora.getDate() + (m - 1) * 30 + 2
    add(wsE, base + 1, 'Serviços prestados', 12500 - m * 900, 'Laudo técnico — cliente A')
    add(wsE, base + 4, 'Recebimento de clientes', 4800, 'Treinamento NR-35')
    add(wsE, base + 2, 'Impostos e taxas', 1890, 'DAS Simples Nacional')
    add(wsE, base + 3, 'Pró-labore', 3000, 'Pró-labore')
    add(wsE, base + 5, 'Contabilidade', 450, 'Escritório contábil')
    add(wsE, base + 7, 'Combustível e deslocamento', 620 - m * 40, 'Visitas técnicas')
    add(wsE, base + 9, 'Software e assinaturas', 189.9, 'Sistema de gestão')
    add(wsE, base + 12, 'Material de escritório', 96.4, 'Papelaria')
    add(wsE, base + 14, 'Tarifas bancárias', 39.9, 'Tarifa mensal')
  }
  // Nada no futuro além de hoje
  const hoje = hojeIso()
  return {
    sessao: null,
    perfil: { id: USER, name: 'Ana', default_workspace_id: wsP, onboarded_at: new Date().toISOString() },
    ambientes, categorias,
    lancamentos: lancamentos.filter(l => l.date <= hoje),
    fotos,
  }
}

function carregar(): Estado {
  try {
    const s = localStorage.getItem(CHAVE)
    if (s) return JSON.parse(s)
  } catch { /* sem armazenamento */ }
  return semear()
}

export function criarRepoDemo(opcoes: { entrarDireto?: boolean; persistir?: boolean } = {}): Repositorio {
  let st = carregar()
  if (opcoes.entrarDireto && !st.sessao) st.sessao = { userId: USER, email: EMAIL }
  const ouvintes = new Set<(e: EventoAuth, s: Sessao | null) => void>()
  const salvar = () => {
    if (opcoes.persistir === false) return
    try { localStorage.setItem(CHAVE, JSON.stringify(st)) } catch { /* cheio ou bloqueado */ }
  }
  const emitir = (e: EventoAuth) => ouvintes.forEach(cb => setTimeout(() => cb(e, st.sessao), 0))
  const vivos = (ws: string) => st.lancamentos.filter(l => l.workspace_id === ws && !l.deleted_at)
  const ordenar = (a: Lancamento, b: Lancamento) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)
  const casa = (l: Lancamento, f: Filtros) => {
    if (f.texto?.trim()) {
      const q = normaliza(f.texto.trim())
      const c = st.categorias.find(c => c.id === l.category_id)
      if (!normaliza(`${l.description ?? ''} ${l.note ?? ''}`).includes(q) && !normaliza(c?.name ?? '').includes(q)) return false
    }
    if (f.tipo && l.kind !== f.tipo) return false
    if (f.categorias?.length && !f.categorias.includes(l.category_id)) return false
    if (f.de && l.date < f.de) return false
    if (f.ate && l.date > f.ate) return false
    if (f.min != null && l.amount_cents < f.min) return false
    if (f.max != null && l.amount_cents > f.max) return false
    if (f.comFoto != null && !!l.anexo !== f.comFoto) return false
    return true
  }
  const copia = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

  return {
    modo: 'demo',
    async sessaoAtual() { return st.sessao },
    aoMudarSessao(cb) { ouvintes.add(cb); return () => ouvintes.delete(cb) },
    async entrar(email, senha) {
      await espera(400)
      if (!email.includes('@') || senha.length < 1) throw Object.assign(new Error('Invalid login credentials'), { code: 'invalid_credentials' })
      st.sessao = { userId: USER, email: email.trim() }
      salvar(); emitir('SIGNED_IN')
    },
    async sair() { st.sessao = null; salvar(); emitir('SIGNED_OUT') },
    async enviarRecuperacao() { await espera(500) },
    async definirSenha() { await espera(300) },

    async perfil() { return { ...st.perfil, email: st.sessao?.email ?? EMAIL, is_admin: true, disabled_at: null } },
    async atualizarPerfil(d) { st.perfil = { ...st.perfil, ...d }; salvar() },
    async ambientes() { await espera(60); return copia(st.ambientes.filter(a => !a.archived_at)) },
    async criarAmbiente(nome, tipo) {
      await espera(300)
      const usadas = new Set(st.ambientes.map(a => a.color))
      const cor = [1, 3, 4, 2, 5, 6, 7, 8, 9, 10].find(c => !usadas.has(c)) ?? 1
      const a: Ambiente = { id: uuid(), name: nome.trim(), kind: tipo, icon: tipo === 'empresa' ? 'business_center' : tipo === 'outro' ? 'folder' : 'person', color: cor, archived_at: null, created_at: new Date().toISOString() }
      st.ambientes.push(a)
      st.categorias.push(...criarCategorias(a.id, tipo === 'empresa' ? 'empresa' : 'pessoal'))
      salvar(); return copia(a)
    },
    async categorias(ws) { return copia(st.categorias.filter(c => c.workspace_id === ws).sort((a, b) => a.sort - b.sort)) },
    async usoCategorias(ws) {
      const uso: Record<string, number> = {}
      vivos(ws).sort(ordenar).slice(0, 300).forEach(l => { uso[l.category_id] = (uso[l.category_id] ?? 0) + 1 })
      return uso
    },

    async lancamentosPeriodo(ws, de, ate) {
      await espera()
      return copia(vivos(ws).filter(l => l.date >= de && l.date <= ate).sort(ordenar))
    },
    async buscar(ws, f, limite, desl) {
      await espera()
      return copia(vivos(ws).filter(l => casa(l, f)).sort(ordenar).slice(desl, desl + limite))
    },
    async totais(ws, f) {
      const ls = vivos(ws).filter(l => casa(l, f))
      return {
        quantidade: ls.length,
        entradas: ls.filter(l => l.kind === 'entrada').reduce((s, l) => s + l.amount_cents, 0),
        saidas: ls.filter(l => l.kind === 'saida').reduce((s, l) => s + l.amount_cents, 0),
      }
    },
    async salvarNovo(l) {
      await espera(250)
      if (st.lancamentos.some(x => x.id === l.id)) return
      const agora = new Date().toISOString()
      st.lancamentos.push({ ...l, created_at: agora, updated_at: agora, version: 1, deleted_at: null, anexo: null })
      salvar()
    },
    async salvarEdicao(l) {
      await espera(250)
      const x = st.lancamentos.find(t => t.id === l.id)
      if (!x) throw new Error('Lançamento não encontrado')
      Object.assign(x, l, { updated_at: new Date().toISOString(), version: x.version + 1 })
      salvar()
    },
    async excluir(id) { const x = st.lancamentos.find(t => t.id === id); if (x) x.deleted_at = new Date().toISOString(); salvar() },
    async restaurar(id) { const x = st.lancamentos.find(t => t.id === id); if (x) x.deleted_at = null; salvar() },
    async apagarDefinitivo(id) { st.lancamentos = st.lancamentos.filter(t => t.id !== id); salvar() },
    async limparLixeiraVencida(ws) {
      const limite = Date.now() - 30 * 86400000
      st.lancamentos = st.lancamentos.filter(l => !(l.workspace_id === ws && l.deleted_at && Date.parse(l.deleted_at) < limite))
      salvar()
    },

    async criarCategoria(ws, c) {
      const sort = Math.max(0, ...st.categorias.filter(x => x.workspace_id === ws && x.kind === c.kind && !x.is_other).map(x => x.sort)) + 1
      if (st.categorias.some(x => x.workspace_id === ws && x.kind === c.kind && normaliza(x.name) === normaliza(c.name.trim()))) throw new Error('duplicate key value violates unique constraint')
      const nova: Categoria = { id: uuid(), workspace_id: ws, kind: c.kind, name: c.name.trim(), icon: c.icon, color: c.color, sort, is_other: false, archived_at: null }
      st.categorias.push(nova); salvar(); return copia(nova)
    },
    async editarCategoria(id, patch) {
      const c = st.categorias.find(x => x.id === id); if (!c) return
      if (patch.name && st.categorias.some(x => x.id !== id && x.workspace_id === c.workspace_id && x.kind === c.kind && normaliza(x.name) === normaliza(patch.name!.trim()))) throw new Error('duplicate key value violates unique constraint')
      if (c.is_other && patch.archived_at) throw new Error('A categoria Outros não pode ser arquivada')
      Object.assign(c, patch); salvar()
    },
    async reordenarCategorias(ids) { ids.forEach((id, i) => { const c = st.categorias.find(x => x.id === id); if (c) c.sort = i + 1 }); salvar() },
    async usoCategoria(id) { return st.lancamentos.filter(l => l.category_id === id).length },
    async moverLancamentos(de, para) { st.lancamentos.forEach(l => { if (l.category_id === de) l.category_id = para }); salvar() },
    async excluirCategoria(id) {
      const c = st.categorias.find(x => x.id === id)
      if (c?.is_other) throw new Error('A categoria Outros não pode ser excluída')
      if (st.lancamentos.some(l => l.category_id === id)) throw new Error('violates foreign key constraint')
      st.categorias = st.categorias.filter(x => x.id !== id); salvar()
    },
    async todosAmbientes() { return copia(st.ambientes) },
    async editarAmbiente(id, patch) { const a = st.ambientes.find(x => x.id === id); if (a) Object.assign(a, patch); salvar() },
    async lixeira(ws) { await espera(); return copia(st.lancamentos.filter(l => l.workspace_id === ws && l.deleted_at).sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!))) },
    async trocarSenha(atual) { await espera(300); if (!atual) throw Object.assign(new Error('Senha atual incorreta'), { code: 'senha_atual' }) },
    async sairDeTodos() { st.sessao = null; salvar(); emitir('SIGNED_OUT') },
    async validarConvite(token) {
      const c = st.convites?.find(x => x.token === token)
      if (!c) return null
      const situacao = c.accepted_at ? 'usado' : c.revoked_at ? 'revogado' : Date.parse(c.expires_at) < Date.now() ? 'vencido' : 'valido'
      return { email: c.email, situacao }
    },
    async aceitarConvite(token) {
      await espera(400)
      const c = st.convites?.find(x => x.token === token)
      if (c) c.accepted_at = new Date().toISOString()
      st.sessao = { userId: USER, email: c?.email ?? EMAIL }; salvar(); emitir('SIGNED_IN')
    },
    async criarConvite(email) {
      await espera(300)
      const e = email.trim().toLowerCase()
      const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, '')
      const c = { id: uuid(), email: e, token, created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), accepted_at: null, revoked_at: null, situacao: 'pendente' as const }
      st.convites = [c, ...(st.convites ?? []).map(x => x.email === e && !x.accepted_at ? { ...x, revoked_at: x.revoked_at ?? new Date().toISOString() } : x)]
      salvar(); return { id: c.id, email: e, token, expires_at: c.expires_at }
    },
    async convites() {
      return (st.convites ?? []).map(c => ({ ...c, situacao: c.accepted_at ? 'aceito' : c.revoked_at ? 'revogado' : Date.parse(c.expires_at) < Date.now() ? 'vencido' : 'pendente' } as Convite))
    },
    async revogarConvite(id) { const c = st.convites?.find(x => x.id === id); if (c && !c.accepted_at) c.revoked_at = new Date().toISOString(); salvar() },
    async usuarios() {
      return [{ id: USER, email: st.sessao?.email ?? EMAIL, name: st.perfil.name, created_at: '2026-01-01T12:00:00Z', last_sign_in_at: new Date().toISOString(), disabled_at: null, is_admin: true },
        { id: 'u2', email: 'pai@exemplo.com', name: 'José', created_at: '2026-09-10T12:00:00Z', last_sign_in_at: '2026-09-18T12:00:00Z', disabled_at: null, is_admin: false }]
    },
    async desativarUsuario() { await espera(200) },

    async anexarFoto(ws, txId, foto, substituir) {
      await espera(500)
      const id = uuid()
      const ler = (b: Blob) => new Promise<string>(r => { const fr = new FileReader(); fr.onload = () => r(fr.result as string); fr.readAsDataURL(b) })
      const a: Anexo = { id, transaction_id: txId, workspace_id: ws, path: `${ws}/${txId}/${id}.jpg`, thumb_path: `${ws}/${txId}/${id}_t.jpg`, width: foto.width, height: foto.height, size_bytes: foto.full.size }
      st.fotos[a.path] = await ler(foto.full)
      st.fotos[a.thumb_path] = await ler(foto.thumb)
      if (substituir) { delete st.fotos[substituir.path]; delete st.fotos[substituir.thumb_path] }
      const x = st.lancamentos.find(t => t.id === txId)
      if (x) x.anexo = a
      salvar(); return copia(a)
    },
    async removerFoto(anexo) {
      const x = st.lancamentos.find(t => t.id === anexo.transaction_id)
      if (x) x.anexo = null
      delete st.fotos[anexo.path]; delete st.fotos[anexo.thumb_path]
      salvar()
    },
    async urlFoto(path) { return st.fotos[path] ?? '' },
  }
}

export function resetarDemo() {
  try { localStorage.removeItem(CHAVE) } catch { /* ok */ }
}

// Utilitário para testes: data relativa
export const diasAtras = (n: number) => { const d = parseIso(hojeIso()); d.setDate(d.getDate() - n); return isoData(d) }
