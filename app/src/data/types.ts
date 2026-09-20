export type Tipo = 'entrada' | 'saida'

export interface Perfil {
  id: string
  email: string
  name: string | null
  default_workspace_id: string | null
  onboarded_at: string | null
  is_admin: boolean
  disabled_at: string | null
}

export interface Ambiente {
  id: string
  name: string
  kind: 'pessoal' | 'empresa' | 'outro'
  icon: string
  color: number
  archived_at: string | null
  created_at: string
}

export interface Categoria {
  id: string
  workspace_id: string
  kind: Tipo
  name: string
  icon: string
  color: number
  sort: number
  is_other: boolean
  archived_at: string | null
}

export interface Anexo {
  id: string
  transaction_id: string
  workspace_id: string
  path: string
  thumb_path: string
  width: number | null
  height: number | null
  size_bytes: number | null
}

export interface Lancamento {
  id: string
  workspace_id: string
  kind: Tipo
  amount_cents: number
  category_id: string
  date: string
  description: string | null
  note: string | null
  created_at: string
  updated_at: string
  version: number
  deleted_at: string | null
  anexo: Anexo | null
}

/** Dados editáveis de um lançamento (o que o formulário envia) */
export interface LancamentoEntrada {
  id: string
  workspace_id: string
  kind: Tipo
  amount_cents: number
  category_id: string
  date: string
  description: string | null
  note: string | null
}

export interface Filtros {
  texto?: string
  tipo?: Tipo | null
  categorias?: string[] | null
  de?: string | null
  ate?: string | null
  min?: number | null
  max?: number | null
  comFoto?: boolean | null
}

export interface Totais { quantidade: number; entradas: number; saidas: number }

export interface FotoPreparada {
  full: Blob
  thumb: Blob
  width: number
  height: number
}

export interface Sessao { userId: string; email: string }

export interface Convite { id: string; email: string; created_at: string; expires_at: string; accepted_at: string | null; revoked_at: string | null; situacao: 'pendente' | 'aceito' | 'revogado' | 'vencido' }
export interface UsuarioAdmin { id: string; email: string; name: string | null; created_at: string; last_sign_in_at: string | null; disabled_at: string | null; is_admin: boolean }
export interface NovaCategoria { kind: Tipo; name: string; icon: string; color: number }

export type EventoAuth = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'INVITED' | 'OTHER'

export interface Repositorio {
  modo: 'supabase' | 'demo'
  // Acesso
  sessaoAtual(): Promise<Sessao | null>
  aoMudarSessao(cb: (evento: EventoAuth, s: Sessao | null) => void): () => void
  entrar(email: string, senha: string): Promise<void>
  sair(): Promise<void>
  enviarRecuperacao(email: string): Promise<void>
  definirSenha(senha: string): Promise<void>
  // Perfil e ambientes
  perfil(): Promise<Perfil>
  atualizarPerfil(dados: Partial<Pick<Perfil, 'name' | 'onboarded_at' | 'default_workspace_id'>>): Promise<void>
  ambientes(): Promise<Ambiente[]>
  criarAmbiente(nome: string, tipo: Ambiente['kind']): Promise<Ambiente>
  categorias(ws: string): Promise<Categoria[]>
  usoCategorias(ws: string): Promise<Record<string, number>>
  // Lançamentos
  lancamentosPeriodo(ws: string, de: string, ate: string): Promise<Lancamento[]>
  buscar(ws: string, f: Filtros, limite: number, deslocamento: number): Promise<Lancamento[]>
  totais(ws: string, f: Filtros): Promise<Totais>
  salvarNovo(l: LancamentoEntrada): Promise<void>
  salvarEdicao(l: LancamentoEntrada): Promise<void>
  excluir(id: string): Promise<void>        // vai para a Lixeira
  restaurar(id: string): Promise<void>
  apagarDefinitivo(id: string): Promise<void>
  limparLixeiraVencida(ws: string): Promise<void>
  // Categorias
  criarCategoria(ws: string, c: NovaCategoria): Promise<Categoria>
  editarCategoria(id: string, patch: Partial<Pick<Categoria, 'name' | 'icon' | 'color' | 'sort' | 'archived_at'>>): Promise<void>
  reordenarCategorias(ids: string[]): Promise<void>
  usoCategoria(id: string): Promise<number>
  moverLancamentos(de: string, para: string): Promise<void>
  excluirCategoria(id: string): Promise<void>
  // Ambientes
  todosAmbientes(): Promise<Ambiente[]>
  editarAmbiente(id: string, patch: Partial<Pick<Ambiente, 'name' | 'icon' | 'color' | 'archived_at'>>): Promise<void>
  // Lixeira
  lixeira(ws: string): Promise<Lancamento[]>
  // Conta
  trocarSenha(atual: string, nova: string): Promise<void>
  sairDeTodos(): Promise<void>
  // Convites e administração
  validarConvite(token: string): Promise<{ email: string; situacao: 'valido' | 'usado' | 'revogado' | 'vencido' } | null>
  aceitarConvite(token: string, email: string, nome: string, senha: string): Promise<void>
  criarConvite(email: string): Promise<{ id: string; email: string; token: string; expires_at: string }>
  convites(): Promise<Convite[]>
  revogarConvite(id: string): Promise<void>
  usuarios(): Promise<UsuarioAdmin[]>
  desativarUsuario(id: string, desativar: boolean): Promise<void>
  // Fotos
  anexarFoto(ws: string, txId: string, foto: FotoPreparada, substituir: Anexo | null): Promise<Anexo>
  removerFoto(anexo: Anexo): Promise<void>
  urlFoto(path: string): Promise<string>
}
