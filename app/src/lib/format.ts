// Formatação de dinheiro e datas (pt-BR, BRL). Valores sempre em centavos inteiros.

const nf = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const OCULTO = 'R$ •••'

/** 123456 → "R$ 1.234,56" */
export function reais(cents: number): string {
  return 'R$ ' + nf.format(Math.abs(cents) / 100)
}

/** Com sinal de lista: saída "−R$ 230,00", entrada "+R$ 8.000,00" */
export function reaisSinal(cents: number, kind: 'entrada' | 'saida'): string {
  return (kind === 'saida' ? '−' : '+') + reais(cents)
}

/** Saldo: negativo leva "−" */
export function reaisSaldo(cents: number): string {
  return (cents < 0 ? '−' : '') + reais(cents)
}

/** Total de um dia/grupo: "+R$ 10,00" ou "−R$ 10,00" */
export function reaisLiquido(cents: number): string {
  if (cents === 0) return reais(0)
  return (cents < 0 ? '−' : '+') + reais(cents)
}

/** Abreviado para eixos: "R$ 8 mil", "R$ 1,2 mi" */
export function reaisCurto(cents: number): string {
  const v = Math.abs(cents) / 100
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (v >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `R$ ${Math.round(v)}`
}

/** Valor por extenso simplificado para leitores de tela */
export function reaisFalado(cents: number): string {
  const r = Math.floor(Math.abs(cents) / 100)
  const c = Math.abs(cents) % 100
  return `${r.toLocaleString('pt-BR')} ${r === 1 ? 'real' : 'reais'}${c ? ` e ${c} ${c === 1 ? 'centavo' : 'centavos'}` : ''}`
}

// ---------------- Datas ----------------
// Datas de lançamento são datas de calendário "YYYY-MM-DD" (sem fuso).

export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export type Mes = { ano: number; mes: number } // mes 1..12

const pad = (n: number) => String(n).padStart(2, '0')

export function isoData(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function hojeIso(): string { return isoData(new Date()) }
export function ontemIso(): string { const d = new Date(); d.setDate(d.getDate() - 1); return isoData(d) }
export function parseIso(s: string): Date { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }

export function mesAtual(): Mes { const d = new Date(); return { ano: d.getFullYear(), mes: d.getMonth() + 1 } }
export function mesDe(iso: string): Mes { const [y, m] = iso.split('-').map(Number); return { ano: y, mes: m } }
export function somaMes(m: Mes, n: number): Mes {
  const t = m.ano * 12 + (m.mes - 1) + n
  return { ano: Math.floor(t / 12), mes: (t % 12) + 1 }
}
export function mesIgual(a: Mes, b: Mes) { return a.ano === b.ano && a.mes === b.mes }
export function inicioMes(m: Mes): string { return `${m.ano}-${pad(m.mes)}-01` }
export function fimMes(m: Mes): string { return isoData(new Date(m.ano, m.mes, 0)) }
export function nomeMes(m: Mes): string { return MESES[m.mes - 1] }
export function tituloMes(m: Mes): string { const n = nomeMes(m); return n[0].toUpperCase() + n.slice(1) + ' ' + m.ano }
export function chaveMes(m: Mes): string { return `${m.ano}-${pad(m.mes)}` }
export function parseChaveMes(s: string | null): Mes | null {
  if (!s || !/^\d{4}-\d{2}$/.test(s)) return null
  const [ano, mes] = s.split('-').map(Number)
  return mes >= 1 && mes <= 12 ? { ano, mes } : null
}

/** Cabeçalho de dia: "Hoje", "Ontem", "Ter, 16 set", ou "Ter, 16 set 2025" em outro ano */
export function rotuloDia(iso: string): string {
  if (iso === hojeIso()) return 'Hoje'
  if (iso === ontemIso()) return 'Ontem'
  const d = parseIso(iso)
  const base = `${DIAS_CURTOS[d.getDay()]}, ${d.getDate()} ${MESES_CURTOS[d.getMonth()]}`
  return d.getFullYear() === new Date().getFullYear() ? base : `${base} ${d.getFullYear()}`
}

/** "18/09/2026" */
export function dataCurta(iso: string): string { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

/** "18/09/2026 às 10:42" (de timestamp) */
export function dataHora(ts: string): string {
  const d = new Date(ts)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} às ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function diasEntre(aIso: string, bIso: string): number {
  return Math.round((parseIso(bIso).getTime() - parseIso(aIso).getTime()) / 86400000)
}
