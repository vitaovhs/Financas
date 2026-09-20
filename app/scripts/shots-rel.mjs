import { chromium } from 'playwright'
const OUT = process.env.OUT
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const erros = []
for (const [w, h, nome] of [[390, 844, 'cel'], [1366, 900, 'desk']]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })).newPage()
  p.on('pageerror', e => erros.push(nome + ': ' + e.message))
  await p.goto('file://' + process.cwd() + '/dist/index.html')
  await p.fill('#email', 'a@b.com'); await p.fill('#senha', 'x'); await p.click('button[type=submit]')
  await p.waitForSelector('text=Para onde foi')
  await p.click(nome === 'cel' ? '.barra-inferior >> text=Relatórios' : '.menu-lateral >> text=Relatórios')
  await p.waitForSelector('text=Entradas e saídas por mês'); await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/rel-${nome}-1-ano.png`, fullPage: true })
  await p.click('.segmentos >> text=Mês'); await p.waitForSelector('text=Ritmo de gastos'); await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/rel-${nome}-2-mes.png`, fullPage: true })
  await p.click('.ranking li button >> nth=0'); await p.waitForSelector('text=Últimos 12 meses'); await p.waitForTimeout(400)
  await p.screenshot({ path: `${OUT}/rel-${nome}-3-cat.png`, fullPage: true })
  if (nome === 'desk') {
    await p.goBack(); await p.waitForTimeout(300)
    await p.click('.segmentos >> text=Período'); await p.waitForTimeout(600)
    await p.hover('.grafico svg >> nth=0', { position: { x: 300, y: 100 } }); await p.waitForTimeout(200)
    await p.screenshot({ path: `${OUT}/rel-${nome}-4-periodo.png`, fullPage: true })
  }
}
console.log(erros.join('\n') || 'sem erros')
await b.close()
