import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const p = await b.newPage()
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" ${pad ? '' : 'rx="0"'} fill="#0e0f13"/><g transform="translate(${pad ? 9.6 : 0} ${pad ? 9.6 : 0}) scale(${pad ? 0.7 : 1})"><g fill="none" stroke="#fff" stroke-width="4" stroke-linejoin="round"><rect x="14" y="20" width="36" height="28" rx="5"/><path d="M14 26h30a6 6 0 0 1 6 6"/></g><circle cx="41" cy="36" r="3" fill="#fff"/></g></svg>`
for (const [nome, t, pad] of [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, false]]) {
  await p.setViewportSize({ width: t, height: t })
  await p.setContent(`<body style="margin:0">${svg(pad)}</body>`)
  await p.screenshot({ path: 'public/' + nome })
}
await b.close()
