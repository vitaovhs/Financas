import { chromium } from 'playwright'
const OUT = process.env.OUT
const url = 'file://' + process.cwd() + '/dist/index.html'
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const erros = []
async function sessao(w, h, nome, passos) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  const p = await ctx.newPage()
  p.on('pageerror', e => erros.push(nome + ': ' + e.message))
  p.on('console', m => { if (m.type() === 'error') erros.push(nome + ' console: ' + m.text()) })
  await p.goto(url)
  await p.fill('#email', 'ana@exemplo.com'); await p.fill('#senha', 'x'); await p.click('button[type=submit]')
  await p.waitForSelector('text=Para onde foi')
  await p.waitForTimeout(400)
  await passos(p, async (n, full = false) => { await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}/${nome}-${n}.png`, fullPage: full }) })
  await ctx.close()
}
await sessao(390, 844, 'cel', async (p, snap) => {
  await snap('01-inicio', true)
  await p.click('nav.barra-inferior >> text=Lançamentos'); await p.waitForSelector('text=Buscar'); await snap('02-lancamentos')
  await p.fill('input[type=search]', 'mercado'); await p.waitForTimeout(600); await snap('03-busca')
  await p.fill('input[type=search]', ''); await p.click('[aria-label^=Filtros]'); await snap('04-filtros')
  await p.keyboard.press('Escape')
  await p.click('.barra-mais'); await p.waitForSelector('h2:has-text("Novo lançamento")'); await snap('05-novo')
  await p.click('button[type=submit][form=form-lanc]'); await snap('06-novo-erros')
  await p.fill('#valor', '23000'); await p.click('.cat-op >> nth=0'); await p.fill('#descricao', 'Teste padaria')
  await p.click('text=Mais detalhes'); await snap('07-novo-preenchido')
  await p.click('button[type=submit][form=form-lanc]'); await p.waitForTimeout(700); await snap('08-salvo')
  await p.click('.item-lanc >> nth=0'); await p.waitForSelector('h2:has-text("Editar lançamento")'); await snap('09-editar')
  await p.click('[aria-label="Mais ações"]'); await snap('10-menu')
  await p.click('text=Duplicar'); await snap('11-duplicar')
  await p.keyboard.press('Escape'); await p.waitForTimeout(200)
  const d = await p.$('text=Descartar'); if (d) await d.click()
  await p.click('.barra-topo .pilula-ambiente'); await snap('12-seletor')
  await p.click('[role=dialog] >> text=Empresa'); await p.waitForTimeout(500); await snap('13-empresa', true)
})
await sessao(1366, 900, 'desk', async (p, snap) => {
  await snap('01-inicio', true)
  await p.click('.menu-lateral >> text=Lançamentos'); await p.waitForTimeout(400); await snap('02-lancamentos')
  await p.keyboard.press('n'); await p.waitForTimeout(300); await snap('03-novo')
})
await sessao(820, 1180, 'tab', async (p, snap) => { await snap('01-inicio', true) })
console.log(erros.length ? 'ERROS:\n' + erros.join('\n') : 'sem erros de página')
await browser.close()
