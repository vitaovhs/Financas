import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Ambiente, Anexo, Categoria, Convite, EventoAuth, UsuarioAdmin, Filtros, FotoPreparada, Lancamento, LancamentoEntrada, Repositorio, Sessao, Totais } from './types'

// Captura o tipo do link (convite/recuperação) antes que o cliente limpe a URL.
const hashInicial = typeof window !== 'undefined' ? window.location.hash : ''
export const tipoLinkInicial: 'invite' | 'recovery' | null =
  /type=invite/.test(hashInicial) ? 'invite' : /type=recovery/.test(hashInicial) ? 'recovery' : null

const BUCKET = 'comprovantes'

function erro(e: unknown): never {
  const msg = (e as { message?: string })?.message ?? String(e)
  const code = (e as { code?: string })?.code
  const err = new Error(msg) as Error & { code?: string }
  err.code = code
  throw err
}

function mapLanc(r: Record<string, unknown>): Lancamento {
  const a = r.attachments as Anexo | Anexo[] | null | undefined
  const anexo = Array.isArray(a) ? (a[0] ?? null) : (a ?? null)
  return {
    id: r.id as string,
    workspace_id: r.workspace_id as string,
    kind: r.kind as Lancamento['kind'],
    amount_cents: Number(r.amount_cents),
    category_id: r.category_id as string,
    date: r.date as string,
    description: (r.description as string) ?? null,
    note: (r.note as string) ?? null,
    created_at: r.created_at as string,
    updated_at: r.updated_at as string,
    version: r.version as number,
    deleted_at: (r.deleted_at as string) ?? null,
    anexo,
  }
}

function paramsFiltro(ws: string, f: Filtros) {
  return {
    p_workspace: ws,
    p_texto: f.texto?.trim() || null,
    p_tipo: f.tipo ?? null,
    p_categorias: f.categorias?.length ? f.categorias : null,
    p_de: f.de ?? null,
    p_ate: f.ate ?? null,
    p_min: f.min ?? null,
    p_max: f.max ?? null,
    p_com_foto: f.comFoto ?? null,
  }
}

export function criarRepoSupabase(url: string, chave: string): Repositorio {
  const sb: SupabaseClient = createClient(url, chave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  })

  const sessao = (s: { user: { id: string; email?: string } } | null): Sessao | null =>
    s ? { userId: s.user.id, email: s.user.email ?? '' } : null

  const uid = async () => {
    const { data } = await sb.auth.getSession()
    if (!data.session) throw new Error('Sessão expirada')
    return data.session.user
  }

  return {
    modo: 'supabase',

    async sessaoAtual() {
      const { data } = await sb.auth.getSession()
      return sessao(data.session)
    },
    aoMudarSessao(cb) {
      const { data } = sb.auth.onAuthStateChange((ev, s) => {
        let e: EventoAuth = 'OTHER'
        if (ev === 'SIGNED_IN') e = 'SIGNED_IN'
        else if (ev === 'SIGNED_OUT') e = 'SIGNED_OUT'
        else if (ev === 'PASSWORD_RECOVERY') e = 'PASSWORD_RECOVERY'
        // supabase-js chama o callback de forma síncrona; adiar evita travas.
        setTimeout(() => cb(e, sessao(s)), 0)
      })
      return () => data.subscription.unsubscribe()
    },
    async entrar(email, senha) {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha })
      if (error) erro(error)
    },
    async sair() {
      await sb.auth.signOut()
    },
    async enviarRecuperacao(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname })
      if (error) erro(error)
    },
    async definirSenha(senha) {
      const { error } = await sb.auth.updateUser({ password: senha })
      if (error) erro(error)
    },

    async perfil() {
      const u = await uid()
      const [{ data: p, error }, { data: r }] = await Promise.all([
        sb.from('profiles').select('*').eq('id', u.id).single(),
        sb.from('platform_roles').select('role').eq('user_id', u.id).maybeSingle(),
      ])
      if (error) erro(error)
      return {
        id: u.id,
        email: u.email ?? '',
        name: p.name,
        default_workspace_id: p.default_workspace_id,
        onboarded_at: p.onboarded_at,
        is_admin: r?.role === 'admin',
        disabled_at: p.disabled_at ?? null,
      }
    },
    async atualizarPerfil(dados) {
      const u = await uid()
      const { error } = await sb.from('profiles').update(dados).eq('id', u.id)
      if (error) erro(error)
    },
    async ambientes() {
      const { data, error } = await sb.from('workspaces').select('*').is('archived_at', null).order('created_at')
      if (error) erro(error)
      return data as Ambiente[]
    },
    async criarAmbiente(nome, tipo) {
      const { data, error } = await sb.rpc('criar_ambiente', { p_nome: nome, p_tipo: tipo })
      if (error) erro(error)
      return data as Ambiente
    },
    async categorias(ws) {
      const { data, error } = await sb.from('categories').select('*').eq('workspace_id', ws).order('sort').order('name')
      if (error) erro(error)
      return data as Categoria[]
    },
    async usoCategorias(ws) {
      const { data, error } = await sb.from('transactions').select('category_id')
        .eq('workspace_id', ws).is('deleted_at', null).order('date', { ascending: false }).limit(300)
      if (error) erro(error)
      const uso: Record<string, number> = {}
      for (const r of data as { category_id: string }[]) uso[r.category_id] = (uso[r.category_id] ?? 0) + 1
      return uso
    },

    async lancamentosPeriodo(ws, de, ate) {
      const { data, error } = await sb.from('transactions').select('*, attachments(*)')
        .eq('workspace_id', ws).is('deleted_at', null).gte('date', de).lte('date', ate)
        .order('date', { ascending: false }).order('created_at', { ascending: false })
      if (error) erro(error)
      return (data as Record<string, unknown>[]).map(mapLanc)
    },
    async buscar(ws, f, limite, deslocamento) {
      const { data, error } = await sb.rpc('buscar_lancamentos', { ...paramsFiltro(ws, f), p_limite: limite, p_deslocamento: deslocamento })
        .select('*, attachments(*)')
      if (error) erro(error)
      return (data as Record<string, unknown>[]).map(mapLanc)
    },
    async totais(ws, f): Promise<Totais> {
      const { data, error } = await sb.rpc('totais_lancamentos', paramsFiltro(ws, f))
      if (error) erro(error)
      const r = (data as { quantidade: number; entradas: number; saidas: number }[])[0]
      return { quantidade: Number(r?.quantidade ?? 0), entradas: Number(r?.entradas ?? 0), saidas: Number(r?.saidas ?? 0) }
    },
    async salvarNovo(l: LancamentoEntrada) {
      // Mesmo id enviado duas vezes (toque duplo, rede instável) não cria dois lançamentos.
      const { error } = await sb.from('transactions').upsert(l, { onConflict: 'id', ignoreDuplicates: true })
      if (error) erro(error)
    },
    async salvarEdicao(l: LancamentoEntrada) {
      const { id, ...resto } = l
      const { error } = await sb.from('transactions').update(resto).eq('id', id)
      if (error) erro(error)
    },
    async excluir(id) {
      const { error } = await sb.from('transactions').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      if (error) erro(error)
    },
    async restaurar(id) {
      const { error } = await sb.from('transactions').update({ deleted_at: null }).eq('id', id)
      if (error) erro(error)
    },
    async apagarDefinitivo(id) {
      const { data } = await sb.from('attachments').select('path, thumb_path').eq('transaction_id', id)
      const arquivos = (data ?? []).flatMap((a: { path: string; thumb_path: string }) => [a.path, a.thumb_path])
      if (arquivos.length) await sb.storage.from(BUCKET).remove(arquivos)
      const { error } = await sb.from('transactions').delete().eq('id', id)
      if (error) erro(error)
    },
    async limparLixeiraVencida(ws) {
      const limite = new Date(Date.now() - 30 * 86400000).toISOString()
      const { data } = await sb.from('transactions').select('id, attachments(path, thumb_path)')
        .eq('workspace_id', ws).lt('deleted_at', limite).limit(100)
      if (!data?.length) return
      const arquivos = data.flatMap((r: { attachments: unknown }) => {
        const a = r.attachments as { path: string; thumb_path: string }[] | { path: string; thumb_path: string } | null
        const lista = Array.isArray(a) ? a : a ? [a] : []
        return lista.flatMap(x => [x.path, x.thumb_path])
      })
      if (arquivos.length) await sb.storage.from(BUCKET).remove(arquivos)
      await sb.from('transactions').delete().in('id', data.map((r: { id: string }) => r.id))
    },

    // ---------------- Categorias ----------------
    async criarCategoria(ws, c) {
      const { data: ult } = await sb.from('categories').select('sort').eq('workspace_id', ws).eq('kind', c.kind).eq('is_other', false).order('sort', { ascending: false }).limit(1)
      const sort = ((ult?.[0] as { sort: number } | undefined)?.sort ?? 0) + 1
      const { data, error } = await sb.from('categories').insert({ workspace_id: ws, kind: c.kind, name: c.name.trim(), icon: c.icon, color: c.color, sort }).select().single()
      if (error) erro(error)
      return data as Categoria
    },
    async editarCategoria(id, patch) {
      const { error } = await sb.from('categories').update(patch).eq('id', id)
      if (error) erro(error)
    },
    async reordenarCategorias(ids) {
      const res = await Promise.all(ids.map((id, i) => sb.from('categories').update({ sort: i + 1 }).eq('id', id)))
      const e = res.find(r => r.error)?.error
      if (e) erro(e)
    },
    async usoCategoria(id) {
      const { data, error } = await sb.rpc('contar_uso_categoria', { p_categoria: id })
      if (error) erro(error)
      return Number(data ?? 0)
    },
    async moverLancamentos(de, para) {
      const { error } = await sb.rpc('mover_lancamentos_categoria', { p_de: de, p_para: para })
      if (error) erro(error)
    },
    async excluirCategoria(id) {
      const { error } = await sb.from('categories').delete().eq('id', id)
      if (error) erro(error)
    },
    // ---------------- Ambientes ----------------
    async todosAmbientes() {
      const { data, error } = await sb.from('workspaces').select('*').order('created_at')
      if (error) erro(error)
      return data as Ambiente[]
    },
    async editarAmbiente(id, patch) {
      const { error } = await sb.from('workspaces').update(patch).eq('id', id)
      if (error) erro(error)
    },
    // ---------------- Lixeira ----------------
    async lixeira(ws) {
      const { data, error } = await sb.from('transactions').select('*, attachments(*)')
        .eq('workspace_id', ws).not('deleted_at', 'is', null).order('deleted_at', { ascending: false }).limit(300)
      if (error) erro(error)
      return (data as Record<string, unknown>[]).map(mapLanc)
    },
    // ---------------- Conta ----------------
    async trocarSenha(atual, nova) {
      const u = await uid()
      const { error: e1 } = await sb.auth.signInWithPassword({ email: u.email ?? '', password: atual })
      if (e1) { const x = new Error('Senha atual incorreta') as Error & { code?: string }; x.code = 'senha_atual'; throw x }
      const { error } = await sb.auth.updateUser({ password: nova })
      if (error) erro(error)
    },
    async sairDeTodos() {
      await sb.auth.signOut({ scope: 'global' })
    },
    // ---------------- Convites e administração ----------------
    async validarConvite(token) {
      const { data, error } = await sb.rpc('validar_convite', { p_token: token })
      if (error) erro(error)
      const r = (data as { email: string; situacao: 'valido' | 'usado' | 'revogado' | 'vencido' }[])[0]
      return r ?? null
    },
    async aceitarConvite(token, email, nome, senha) {
      const { data, error } = await sb.auth.signUp({ email, password: senha, options: { data: { name: nome.trim(), convite: token } } })
      if (error) erro(error)
      if (!data.session) {
        // Projeto com confirmação de e-mail ligada: tenta entrar direto
        const { error: e2 } = await sb.auth.signInWithPassword({ email, password: senha })
        if (e2) { const x = new Error('Acesso criado. Confirme o e-mail recebido para entrar.') as Error & { code?: string }; x.code = 'confirmar_email'; throw x }
      }
    },
    async criarConvite(email) {
      const { data, error } = await sb.rpc('criar_convite', { p_email: email })
      if (error) erro(error)
      return (data as { id: string; email: string; token: string; expires_at: string }[])[0]
    },
    async convites() {
      const { data, error } = await sb.rpc('listar_convites')
      if (error) erro(error)
      return data as Convite[]
    },
    async revogarConvite(id) {
      const { error } = await sb.rpc('revogar_convite', { p_id: id })
      if (error) erro(error)
    },
    async usuarios() {
      const { data, error } = await sb.rpc('admin_usuarios')
      if (error) erro(error)
      return data as UsuarioAdmin[]
    },
    async desativarUsuario(id, desativar) {
      const { error } = await sb.rpc('admin_desativar', { p_user: id, p_desativar: desativar })
      if (error) erro(error)
    },

    async anexarFoto(ws, txId, foto: FotoPreparada, substituir) {
      const id = crypto.randomUUID()
      const path = `${ws}/${txId}/${id}.jpg`
      const thumb = `${ws}/${txId}/${id}_t.jpg`
      const up1 = await sb.storage.from(BUCKET).upload(path, foto.full, { contentType: 'image/jpeg', upsert: false })
      if (up1.error) erro(up1.error)
      const up2 = await sb.storage.from(BUCKET).upload(thumb, foto.thumb, { contentType: 'image/jpeg', upsert: false })
      if (up2.error) { await sb.storage.from(BUCKET).remove([path]); erro(up2.error) }
      if (substituir) {
        await sb.from('attachments').delete().eq('id', substituir.id)
      }
      const row = { id, transaction_id: txId, workspace_id: ws, path, thumb_path: thumb, mime: 'image/jpeg', size_bytes: foto.full.size, width: foto.width, height: foto.height }
      const { data, error } = await sb.from('attachments').insert(row).select().single()
      if (error) { await sb.storage.from(BUCKET).remove([path, thumb]); erro(error) }
      if (substituir) await sb.storage.from(BUCKET).remove([substituir.path, substituir.thumb_path])
      return data as Anexo
    },
    async removerFoto(anexo) {
      const { error } = await sb.from('attachments').delete().eq('id', anexo.id)
      if (error) erro(error)
      await sb.storage.from(BUCKET).remove([anexo.path, anexo.thumb_path])
    },
    async urlFoto(path) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 600)
      if (error) erro(error)
      return data.signedUrl
    },
  }
}
