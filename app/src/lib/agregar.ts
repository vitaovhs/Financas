// Cálculos dos relatórios — sempre a partir dos lançamentos (nada é gravado como total).
import type { Categoria, Lancamento } from '../data/types'
import { chaveMes, mesDe, parseIso, isoData, type Mes } from './format'

export interface TotaisSimples { e: number; s: number; saldo: number; n: number }

export function totais(ls: Lancamento[]): TotaisSimples {
  let e = 0, s = 0
  for (const l of ls) { if (l.kind === 'entrada') e += l.amount_cents; else s += l.amount_cents }
  return { e, s, saldo: e - s, n: ls.length }
}

export interface ItemCategoria { id: string; nome: string; icone: string; cor: number; valor: number; n: number }

/** Total por categoria de um tipo, do maior para o menor. */
export function porCategoria(ls: Lancamento[], cats: Map<string, Categoria>, kind: 'entrada' | 'saida'): ItemCategoria[] {
  const m = new Map<string, ItemCategoria>()
  for (const l of ls) {
    if (l.kind !== kind) continue
    const c = cats.get(l.category_id)
    const it = m.get(l.category_id) ?? { id: l.category_id, nome: c?.name ?? '—', icone: c?.icon ?? 'label', cor: c?.color ?? 0, valor: 0, n: 0 }
    it.valor += l.amount_cents; it.n++
    m.set(l.category_id, it)
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor)
}

export interface Mensal { mes: Mes; chave: string; e: number; s: number; saldo: number; acumulado: number; n: number }

/** Lista de meses de `de` até `ate` (inclusive), com totais e saldo acumulado. */
export function porMes(ls: Lancamento[], de: Mes, ate: Mes): Mensal[] {
  const out: Mensal[] = []
  const idx = new Map<string, Mensal>()
  let m = { ...de }
  while (m.ano * 12 + m.mes <= ate.ano * 12 + ate.mes) {
    const it: Mensal = { mes: m, chave: chaveMes(m), e: 0, s: 0, saldo: 0, acumulado: 0, n: 0 }
    out.push(it); idx.set(it.chave, it)
    m = m.mes === 12 ? { ano: m.ano + 1, mes: 1 } : { ano: m.ano, mes: m.mes + 1 }
  }
  for (const l of ls) {
    const it = idx.get(chaveMes(mesDe(l.date)))
    if (!it) continue
    if (l.kind === 'entrada') it.e += l.amount_cents; else it.s += l.amount_cents
    it.n++
  }
  let acc = 0
  for (const it of out) { it.saldo = it.e - it.s; acc += it.saldo; it.acumulado = acc }
  return out
}

/** Gasto acumulado dia a dia (1..último dia) de um mês. */
export function ritmoDiario(ls: Lancamento[], m: Mes): number[] {
  const dias = new Date(m.ano, m.mes, 0).getDate()
  const porDia = new Array(dias).fill(0)
  for (const l of ls) {
    if (l.kind !== 'saida') continue
    const d = parseIso(l.date)
    if (d.getFullYear() !== m.ano || d.getMonth() + 1 !== m.mes) continue
    porDia[d.getDate() - 1] += l.amount_cents
  }
  let acc = 0
  return porDia.map(v => (acc += v))
}

export function maioresDespesas(ls: Lancamento[], n: number): Lancamento[] {
  return ls.filter(l => l.kind === 'saida').sort((a, b) => b.amount_cents - a.amount_cents).slice(0, n)
}

export const MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
export const rotMes = (m: Mes) => MES_CURTO[m.mes - 1]

// ---------------- CSV (abre no Excel: separador ";", vírgula decimal, UTF-8 com BOM) ----------------
export function gerarCsv(ls: Lancamento[], cats: Map<string, Categoria>): string {
  const esc = (s: string) => /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  const dec = (c: number) => (c / 100).toFixed(2).replace('.', ',')
  const linhas = [['Data', 'Tipo', 'Categoria', 'Descrição', 'Observação', 'Valor (R$)', 'Valor com sinal (R$)', 'Tem foto'].join(';')]
  const ord = [...ls].sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
  for (const l of ord) {
    const [y, m, d] = l.date.split('-')
    linhas.push([
      `${d}/${m}/${y}`, l.kind === 'entrada' ? 'Entrada' : 'Saída', esc(cats.get(l.category_id)?.name ?? ''),
      esc(l.description ?? ''), esc(l.note ?? ''), dec(l.amount_cents), (l.kind === 'saida' ? '-' : '') + dec(l.amount_cents), l.anexo ? 'Sim' : 'Não',
    ].join(';'))
  }
  return '﻿' + linhas.join('\r\n')
}

export function baixarArquivo(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export const hojeMes = (): Mes => mesDe(isoData(new Date()))
