import { criarRepoDemo } from './demoRepo'
import { criarRepoSupabase } from './supabaseRepo'
import type { Repositorio } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const forcarDemo = import.meta.env.VITE_MODO === 'demo' ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo'))

export const repo: Repositorio = !forcarDemo && url && chave
  ? criarRepoSupabase(url, chave)
  : criarRepoDemo({ entrarDireto: false })
