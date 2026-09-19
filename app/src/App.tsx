import { useEffect, useState } from 'react'
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { repo } from './data'
import { tipoLinkInicial } from './data/supabaseRepo'
import type { Sessao } from './data/types'
import { AppProvider } from './state/app'
import { Casca } from './components/shell'
import { CriarAcesso, Login, NovaSenha, RecuperarSenha, TudoPronto } from './screens/Acesso'
import { Inicio } from './screens/Inicio'
import { Lancamentos } from './screens/Lancamentos'
import { LancamentoFolha } from './screens/LancamentoFolha'
import { Mais, Relatorios } from './screens/Outras'
import { EstadoVazio } from './components/ui'

type Estado = { t: 'carregando' } | { t: 'fora' } | { t: 'dentro'; s: Sessao } | { t: 'recuperacao'; s: Sessao }

export default function App() {
  const [st, setSt] = useState<Estado>({ t: 'carregando' })
  const qc = useQueryClient()
  const nav = useNavigate()

  useEffect(() => {
    let vivo = true
    repo.sessaoAtual().then(s => {
      if (!vivo) return
      if (!s) setSt({ t: 'fora' })
      else setSt(tipoLinkInicial === 'recovery' ? { t: 'recuperacao', s } : { t: 'dentro', s })
    })
    const off = repo.aoMudarSessao((ev, s) => {
      if (ev === 'PASSWORD_RECOVERY' && s) setSt({ t: 'recuperacao', s })
      else if (ev === 'SIGNED_OUT' || !s) { qc.clear(); setSt({ t: 'fora' }); nav('/entrar', { replace: true }) }
      else if (ev === 'SIGNED_IN') setSt(atual => atual.t === 'recuperacao' ? atual : atual.t === 'dentro' && atual.s.userId === s.userId ? atual : { t: 'dentro', s })
    })
    return () => { vivo = false; off() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (st.t === 'carregando') return <Abertura />
  if (st.t === 'recuperacao') return <NovaSenha aoConcluir={() => { setSt({ t: 'dentro', s: st.s }); nav('/', { replace: true }) }} />
  if (st.t === 'fora') {
    return (
      <Routes>
        <Route path="/recuperar" element={<RecuperarSenha />} />
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }
  return <Logado sessao={st.s} />
}

function Abertura() {
  return (
    <div className="acesso" style={{ alignItems: 'center' }}>
      <div className="marca" aria-label="Carregando">
        <div className="logo"><span className="ms f" aria-hidden>account_balance_wallet</span></div>
      </div>
    </div>
  )
}

function Logado({ sessao }: { sessao: Sessao }) {
  const nav = useNavigate()
  const qPerfil = useQuery({ queryKey: ['perfil', sessao.userId], queryFn: () => repo.perfil() })
  const qAmb = useQuery({ queryKey: ['ambientes'], queryFn: () => repo.ambientes() })
  const [pronto, setPronto] = useState<string | null>(null)

  if (qPerfil.isError || qAmb.isError) {
    return (
      <div className="acesso"><div className="acesso-in">
        <EstadoVazio icone="cloud_off" titulo="Não foi possível carregar" texto="Verifique a conexão com a internet e tente de novo."
          acao={<button type="button" className="btn btn-primario" onClick={() => { qPerfil.refetch(); qAmb.refetch() }}>Tentar de novo</button>} />
        <button type="button" className="btn btn-texto" onClick={() => repo.sair()}>Sair</button>
      </div></div>
    )
  }
  if (!qPerfil.data || !qAmb.data) return <Abertura />
  if (pronto) return <TudoPronto nome={pronto} aoIr={() => { setPronto(null); nav('/', { replace: true }) }} />
  if (!qPerfil.data.onboarded_at || tipoLinkInicial === 'invite' && !qPerfil.data.name) {
    return <CriarAcesso email={sessao.email} aoConcluir={async nome => { await qPerfil.refetch(); setPronto(nome) }} />
  }
  if (qAmb.data.length === 0) {
    return <div className="acesso"><div className="acesso-in"><EstadoVazio icone="folder_off" titulo="Nenhum ambiente encontrado" texto="Fale com o administrador do aplicativo." /></div></div>
  }
  return (
    <AppProvider sessao={sessao} perfil={qPerfil.data} ambientes={qAmb.data}>
      <Casca>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/relatorios" element={<Relatorios />} />
          <Route path="/mais" element={<Mais />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Casca>
      <LancamentoFolha />
    </AppProvider>
  )
}
