import { useQueryClient } from '@tanstack/react-query'
import { repo } from '../data'
import type { Lancamento } from '../data/types'
import { useApp } from './app'

/** Excluir (vai para a Lixeira) com Desfazer por 6 s — sem confirmação (Bloco 3/4). */
export function useExcluirLancamento() {
  const { toast, invalidar, online } = useApp()
  const qc = useQueryClient()
  return async (l: Lancamento) => {
    if (!online) {
      toast({ texto: 'Sem conexão', sub: 'É necessário estar conectado à internet para excluir.', icone: 'cloud_off' })
      return
    }
    // Remove da tela na hora; o servidor confirma em seguida.
    qc.setQueriesData<Lancamento[]>({ queryKey: ['lanc'] }, d => Array.isArray(d) ? d.filter(x => x.id !== l.id) : d)
    try {
      await repo.excluir(l.id)
    } catch {
      invalidar()
      toast({ texto: 'Não foi possível excluir', sub: 'Tente novamente.', icone: 'error' })
      return
    }
    invalidar()
    toast({
      texto: 'Lançamento excluído', sub: 'Fica na Lixeira por 30 dias', icone: 'delete',
      acao: {
        rotulo: 'Desfazer',
        fn: async () => {
          try { await repo.restaurar(l.id); invalidar(); toast({ texto: 'Lançamento restaurado' }) }
          catch { toast({ texto: 'Não foi possível restaurar agora', sub: 'Ele continua na Lixeira por 30 dias.', icone: 'error' }) }
        },
      },
    })
  }
}
