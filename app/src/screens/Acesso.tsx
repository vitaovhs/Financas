import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { repo } from '../data'
import { Faixa, Icone } from '../components/ui'
import { useOnline } from '../state/app'

function Marca() {
  return (
    <div className="marca">
      <div className="logo"><Icone n="account_balance_wallet" f /></div>
      <span className="t-secao">Finanças</span>
    </div>
  )
}

function Tela({ children }: { children: ReactNode }) {
  return <div className="acesso"><div className="acesso-in">{children}</div></div>
}

export function CampoSenha({ id, valor, aoMudar, rotulo = 'Senha', novo, erro, ajuda }: {
  id: string; valor: string; aoMudar: (v: string) => void; rotulo?: string; novo?: boolean; erro?: string | null; ajuda?: ReactNode
}) {
  const [ver, setVer] = useState(false)
  return (
    <div className="campo">
      <label htmlFor={id}>{rotulo}</label>
      <div style={{ position: 'relative' }}>
        <input id={id} className={'input' + (erro ? ' com-erro' : '')} type={ver ? 'text' : 'password'} value={valor} onChange={e => aoMudar(e.target.value)}
          autoComplete={novo ? 'new-password' : 'current-password'} style={{ paddingRight: 52 }} aria-invalid={!!erro} aria-describedby={erro ? id + '-erro' : undefined} />
        <button type="button" className="btn-icone" onClick={() => setVer(v => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
          style={{ position: 'absolute', right: 0, top: 0, height: 48, width: 48, borderRadius: 8 }}>
          <Icone n={ver ? 'visibility_off' : 'visibility'} />
        </button>
      </div>
      {erro && <span id={id + '-erro'} className="erro-campo"><Icone n="error" s={16} />{erro}</span>}
      {ajuda}
    </div>
  )
}

function traduzErro(e: unknown, online: boolean): string {
  const m = ((e as Error)?.message ?? '').toLowerCase()
  if (!online || /failed to fetch|network/.test(m)) return 'Sem conexão. Verifique a internet e tente de novo.'
  if (/invalid login|invalid_credentials|invalid.*credentials/.test(m)) return 'E-mail ou senha incorretos.'
  if (/banned|disabled/.test(m)) return 'Seu acesso está desativado. Fale com o administrador.'
  if (/email not confirmed/.test(m)) return 'Seu acesso ainda não foi confirmado. Use o link do convite.'
  if (/rate|too many|security purposes/.test(m)) return 'Muitas tentativas. Aguarde um minuto e tente de novo.'
  if (/weak|pwned|leaked/.test(m)) return 'Essa senha é muito comum ou já apareceu em vazamentos. Escolha outra.'
  if (/same.*password|different from the old/.test(m)) return 'A nova senha precisa ser diferente da atual.'
  return 'Não foi possível concluir. Tente novamente.'
}

export function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const online = useOnline()
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !senha) { setErro('Informe e-mail e senha.'); return }
    setOcupado(true); setErro(null)
    try { await repo.entrar(email, senha) } catch (x) { setErro(traduzErro(x, online)) } finally { setOcupado(false) }
  }
  return (
    <Tela>
      <Marca />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="t-titulo">Entrar</h1>
        <p className="sec">Acesse seu controle financeiro.</p>
      </div>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }} noValidate>
        {erro && <Faixa tipo="erro">{erro}</Faixa>}
        {repo.modo === 'demo' && <Faixa tipo="info">Modo demonstração: use qualquer e-mail e senha. Os dados são fictícios e ficam só neste navegador.</Faixa>}
        <div className="campo">
          <label htmlFor="email">E-mail</label>
          <input id="email" className="input" type="email" inputMode="email" autoComplete="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        <CampoSenha id="senha" valor={senha} aoMudar={setSenha} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
          <Link to="/recuperar" className="btn btn-texto" style={{ marginRight: -8 }}>Esqueci minha senha</Link>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
          <button type="submit" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Entrar'}</button>
          <span className="t-auxiliar sec" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icone n="lock" s={16} />Acesso somente por convite.</span>
        </div>
      </form>
    </Tela>
  )
}

export function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [enviado, setEnviado] = useState(false)
  const [espera, setEspera] = useState(0)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const online = useOnline()
  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])
  const enviar = async (e?: FormEvent) => {
    e?.preventDefault()
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErro('Informe um e-mail válido.'); return }
    setOcupado(true); setErro(null)
    try { await repo.enviarRecuperacao(email); setEnviado(true); setEspera(60) }
    catch (x) {
      const m = traduzErro(x, online)
      // Nunca revela se o e-mail existe: só mostra erros de conexão ou limite.
      if (/conexão|tentativas/.test(m)) setErro(m); else { setEnviado(true); setEspera(60) }
    } finally { setOcupado(false) }
  }
  const nav = useNavigate()
  return (
    <Tela>
      <div style={{ marginLeft: -12, marginTop: -40 }}>
        <button type="button" className="btn-icone" aria-label="Voltar" onClick={() => nav('/entrar')}><Icone n="arrow_back" /></button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="t-titulo">Recuperar senha</h1>
        <p className="sec">{enviado ? 'Se houver um acesso com este e-mail, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.' : 'Informe o e-mail do seu acesso. Enviaremos um link para criar uma nova senha.'}</p>
      </div>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }} noValidate>
        {erro && <Faixa tipo="erro">{erro}</Faixa>}
        {enviado && <Faixa tipo="sucesso">Link enviado para {email.trim()}.</Faixa>}
        <div className="campo">
          <label htmlFor="email-r">E-mail</label>
          <input id="email-r" className="input" type="email" inputMode="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} disabled={enviado && espera > 0} />
        </div>
        <div style={{ flex: 1 }} />
        {!enviado
          ? <button type="submit" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Enviar link'}</button>
          : <button type="button" className="btn btn-secundario btn-largo" disabled={espera > 0 || ocupado} onClick={() => enviar()}>{espera > 0 ? `Reenviar em ${espera} s` : 'Reenviar link'}</button>}
      </form>
    </Tela>
  )
}

/** Nova senha (link de recuperação). */
export function NovaSenha({ aoConcluir }: { aoConcluir: () => void }) {
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const online = useOnline()
  const ok = senha.length >= 10
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!ok) { setErro('A senha precisa ter pelo menos 10 caracteres.'); return }
    setOcupado(true); setErro(null)
    try { await repo.definirSenha(senha); aoConcluir() } catch (x) { setErro(traduzErro(x, online)) } finally { setOcupado(false) }
  }
  return (
    <Tela>
      <Marca />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="t-titulo">Criar nova senha</h1>
        <p className="sec">Use a nova senha sempre que entrar. Os outros aparelhos conectados serão desconectados.</p>
      </div>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }} noValidate>
        <CampoSenha id="nova" rotulo="Nova senha" valor={senha} aoMudar={setSenha} novo erro={erro}
          ajuda={<span className="t-auxiliar" style={{ display: 'flex', alignItems: 'center', gap: 4, color: ok ? 'var(--entrada)' : 'var(--texto-secundario)' }}><Icone n={ok ? 'check_circle' : 'radio_button_unchecked'} s={16} />Pelo menos 10 caracteres</span>} />
        <div style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Salvar nova senha'}</button>
      </form>
    </Tela>
  )
}

/** Primeiro acesso: nome + senha (após convite ou conta criada pelo administrador). */
export function CriarAcesso({ email, aoConcluir }: { email: string; aoConcluir: (nome: string) => void }) {
  const [nome, setNome] = useState('')
  const [senha, setSenha] = useState('')
  const [erroNome, setErroNome] = useState<string | null>(null)
  const [erroSenha, setErroSenha] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const online = useOnline()
  const ok = senha.length >= 10
  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    const n = nome.trim()
    setErroNome(n ? null : 'Informe seu nome.')
    setErroSenha(ok ? null : 'A senha precisa ter pelo menos 10 caracteres.')
    if (!n || !ok) return
    setOcupado(true); setErro(null)
    try {
      await repo.definirSenha(senha)
      await repo.atualizarPerfil({ name: n, onboarded_at: new Date().toISOString() })
      aoConcluir(n)
    } catch (x) { setErro(traduzErro(x, online)) } finally { setOcupado(false) }
  }
  return (
    <Tela>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="t-titulo">Criar seu acesso</h1>
        <p className="sec">Falta pouco. Use este e-mail e esta senha sempre que entrar.</p>
      </div>
      <form onSubmit={enviar} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }} noValidate>
        {erro && <Faixa tipo="erro">{erro}</Faixa>}
        <div className="campo">
          <label htmlFor="email-c">E-mail</label>
          <input id="email-c" className="input" value={email} disabled />
          <span className="ajuda" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Icone n="lock" s={16} />Definido pelo convite</span>
        </div>
        <div className="campo">
          <label htmlFor="nome-c">Seu nome</label>
          <input id="nome-c" className={'input' + (erroNome ? ' com-erro' : '')} autoComplete="given-name" maxLength={80} value={nome} onChange={e => setNome(e.target.value)} />
          {erroNome && <span className="erro-campo"><Icone n="error" s={16} />{erroNome}</span>}
        </div>
        <CampoSenha id="senha-c" valor={senha} aoMudar={setSenha} novo erro={erroSenha}
          ajuda={!erroSenha && <span className="t-auxiliar" style={{ display: 'flex', alignItems: 'center', gap: 4, color: ok ? 'var(--entrada)' : 'var(--texto-secundario)' }}><Icone n={ok ? 'check_circle' : 'radio_button_unchecked'} s={16} />Pelo menos 10 caracteres</span>} />
        <div style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primario btn-largo" disabled={ocupado}>{ocupado ? <span className="spinner" /> : 'Criar acesso'}</button>
        <button type="button" className="btn btn-texto" onClick={() => repo.sair()}>Sair</button>
      </form>
    </Tela>
  )
}

export function TudoPronto({ nome, aoIr }: { nome: string; aoIr: () => void }) {
  return (
    <Tela>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 16 }}>
        <span style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--entrada-fundo)', color: 'var(--entrada)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icone n="check_circle" f style={{ fontSize: 40, width: 40, height: 40 }} />
        </span>
        <h1 className="t-titulo">Tudo pronto, {nome}</h1>
        <p className="sec" style={{ maxWidth: 320 }}>Seu acesso foi criado e seu ambiente Pessoal já está pronto para usar.</p>
      </div>
      <button type="button" className="btn btn-primario btn-largo" onClick={aoIr} autoFocus>Ir para o Início</button>
    </Tela>
  )
}
