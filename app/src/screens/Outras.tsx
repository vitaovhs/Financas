import { useState } from 'react'
import { repo } from '../data'
import { resetarDemo } from '../data/demoRepo'
import { useApp } from '../state/app'
import { BarraTopo } from '../components/shell'
import { Dialogo, Icone } from '../components/ui'

export const VERSAO = '0.2.0 · Entrega 2'

export function Mais() {
  const { perfil, sessao, ambiente, setSeletorAberto, ocultar, setOcultar } = useApp()
  const [sair, setSair] = useState(false)
  const linha = (icone: string, rotulo: string, onClick?: () => void, extra?: React.ReactNode, desab?: boolean) => (
    <button type="button" className="item-lanc" onClick={onClick} disabled={desab} style={{ opacity: desab ? 0.55 : 1 }}>
      <Icone n={icone} style={{ color: 'var(--texto-secundario)' }} />
      <span className="meio"><span className="desc">{rotulo}</span>{extra && <span className="cat">{extra}</span>}</span>
      {onClick && <Icone n="chevron_right" style={{ color: 'var(--texto-secundario)' }} />}
    </button>
  )
  return (
    <div className="pagina">
      <BarraTopo />
      <div className="lanc-cab"><h1 className="t-titulo">Mais</h1></div>
      <div className="bloco" style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 48, height: 48, borderRadius: 24, background: 'var(--acao)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 18 }}>
            {(perfil.name ?? sessao.email).trim()[0]?.toUpperCase()}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="t-corpo-forte">{perfil.name ?? 'Sem nome'}</span>
            <span className="t-auxiliar sec" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sessao.email}</span>
          </span>
        </div>
        <div className="lista-card" style={{ paddingBottom: 0 }}>
          <div className="cab-dia"><span>Ajustes</span></div>
          {linha('swap_horiz', 'Ambientes', () => setSeletorAberto(true), `Atual: ${ambiente.name}`)}
          {linha(ocultar ? 'visibility' : 'visibility_off', ocultar ? 'Mostrar valores' : 'Ocultar valores', () => setOcultar(!ocultar), 'Esconde valores na tela, útil em público')}
          {linha('category', 'Categorias', undefined, 'Em breve: criar, editar, reordenar e arquivar', true)}
          {linha('delete', 'Lixeira', undefined, 'Em breve: restaurar lançamentos excluídos (30 dias)', true)}
          {linha('person', 'Perfil e segurança', undefined, 'Em breve: alterar senha e sair de todos os aparelhos', true)}
          {perfil.is_admin && linha('group_add', 'Usuários e convites', undefined, 'Em breve: convidar e gerenciar acessos', true)}
        </div>
        <div className="lista-card" style={{ paddingBottom: 0 }}>
          {repo.modo === 'demo' && linha('restart_alt', 'Recomeçar demonstração', () => { resetarDemo(); location.reload() }, 'Volta aos dados fictícios iniciais')}
          <button type="button" className="item-lanc" onClick={() => setSair(true)}>
            <Icone n="logout" style={{ color: 'var(--erro)' }} />
            <span className="meio"><span className="desc" style={{ color: 'var(--erro)' }}>Sair</span></span>
          </button>
        </div>
        <p className="t-auxiliar sec" style={{ textAlign: 'center' }}>Finanças · versão {VERSAO}{repo.modo === 'demo' ? ' · demonstração' : ''}</p>
      </div>
      <Dialogo aberto={sair} titulo="Sair deste aparelho?" texto="Você vai precisar do e-mail e da senha para entrar de novo." confirmar="Sair"
        aoCancelar={() => setSair(false)} aoConfirmar={() => { setSair(false); repo.sair() }} />
    </div>
  )
}
