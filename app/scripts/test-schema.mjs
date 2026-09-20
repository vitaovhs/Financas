import { PGlite } from '@electric-sql/pglite'
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm'
import { unaccent } from '@electric-sql/pglite/contrib/unaccent'
import fs from 'node:fs'
const db = new PGlite({ extensions: { pg_trgm, unaccent } })
const dir = new URL('../../supabase/tests/', import.meta.url).pathname
await db.exec(fs.readFileSync(dir + 'stub.sql', 'utf8'))
await db.exec(fs.readFileSync(dir + '../migrations/0001_inicial.sql', 'utf8'))
await db.exec(`alter table auth.users add column if not exists created_at timestamptz default now(), add column if not exists last_sign_in_at timestamptz;`)
await db.exec(`grant all on all tables in schema storage to authenticated; revoke all on all tables in schema public from anon;`)
const q = (s, p) => db.query(s, p).then(r => r.rows)
let ok = 0, fail = 0
const t = async (name, fn) => { try { await fn(); ok++; console.log('ok  ', name) } catch (e) { fail++; console.log('FAIL', name, '-', e.message) } }
const as = async (uid, fn) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`); try { return await fn() } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`) } }
const expectErr = async (p) => { let e; try { await p } catch (x) { e = x } if (!e) throw new Error('esperava erro') }
const [a] = await q(`insert into auth.users (email, raw_user_meta_data) values ('ana@x.com', '{"name":"Ana"}') returning id`)
const [b] = await q(`insert into auth.users (email) values ('bia@x.com') returning id`)
const A = a.id, B = b.id
await db.exec(fs.readFileSync(dir + '../migrations/0002_convites_admin.sql', 'utf8'))
await db.exec(fs.readFileSync(dir + '../migrations/0003_mais_cores.sql', 'utf8'))
await db.exec(fs.readFileSync(dir + '../migrations/0004_cinquenta_cores.sql', 'utf8'))
await db.exec(fs.readFileSync(dir + '../migrations/0005_cores_escuras.sql', 'utf8'))
const uuid = () => crypto.randomUUID()
await t('novo usuário ganha perfil, Pessoal e categorias', async () => {
  const r = await as(A, () => q(`select w.name, (select count(*) from categories c where c.workspace_id=w.id)::int n, p.name pn from workspaces w, profiles p`))
  if (r.length !== 1 || r[0].name !== 'Pessoal' || r[0].n !== 23 || r[0].pn !== 'Ana') throw new Error(JSON.stringify(r))
})
let wsA, catA, catAent
await t('A cria Empresa via RPC', async () => {
  const r = await as(A, () => q(`select * from criar_ambiente('Empresa','empresa')`))
  const all = await as(A, () => q(`select id, name from workspaces order by created_at`))
  if (all.length !== 2) throw new Error('esperava 2')
  wsA = all.find(w => w.name === 'Pessoal').id
  const n = await as(A, () => q(`select count(*)::int n from categories where workspace_id=$1`, [r[0].id]))
  if (n[0].n !== 22) throw new Error('categorias empresa ' + n[0].n)
  catA = (await as(A, () => q(`select id from categories where workspace_id=$1 and name='Mercado'`, [wsA])))[0].id
  catAent = (await as(A, () => q(`select id from categories where workspace_id=$1 and name='Salário'`, [wsA])))[0].id
})
const tx1 = uuid()
await t('A lança saída', async () => {
  await as(A, () => q(`insert into transactions (id, workspace_id, kind, amount_cents, category_id, date, description) values ($1,$2,'saida',23000,$3,'2026-09-18','Mercado São José')`, [tx1, wsA, catA]))
})
await t('duplicidade: mesmo id não cria dois', async () => {
  await as(A, () => q(`insert into transactions (id, workspace_id, kind, amount_cents, category_id, date) values ($1,$2,'saida',23000,$3,'2026-09-18') on conflict (id) do nothing`, [tx1, wsA, catA]))
  const n = await as(A, () => q(`select count(*)::int n from transactions`)); if (n[0].n !== 1) throw new Error('n=' + n[0].n)
})
await t('categoria de outro tipo é recusada', () => expectErr(as(A, () => q(`insert into transactions (id, workspace_id, kind, amount_cents, category_id, date) values ($1,$2,'entrada',100,$3,'2026-09-18')`, [uuid(), wsA, catA]))))
await t('valor zero é recusado', () => expectErr(as(A, () => q(`insert into transactions (id, workspace_id, kind, amount_cents, category_id, date) values ($1,$2,'saida',0,$3,'2026-09-18')`, [uuid(), wsA, catA]))))
await t('B não vê nada de A', async () => {
  const r = await as(B, () => q(`select (select count(*) from transactions)::int t, (select count(*) from workspaces where id=$1)::int w, (select count(*) from categories where workspace_id=$1)::int c`, [wsA]))
  if (r[0].t || r[0].w || r[0].c) throw new Error(JSON.stringify(r))
})
await t('B não consegue lançar no ambiente de A', () => expectErr(as(B, () => q(`insert into transactions (id, workspace_id, kind, amount_cents, category_id, date) values ($1,$2,'saida',100,$3,'2026-09-18')`, [uuid(), wsA, catA]))))
await t('B não consegue alterar lançamento de A', async () => {
  await as(B, () => q(`update transactions set amount_cents=1 where id=$1`, [tx1]))
  const r = await q(`select amount_cents from transactions where id=$1`, [tx1]); if (r[0].amount_cents != 23000) throw new Error('alterou!')
})
await t('B não consegue apagar lançamento de A', async () => {
  await as(B, () => q(`delete from transactions where id=$1`, [tx1]))
  const r = await q(`select count(*)::int n from transactions`); if (r[0].n !== 1) throw new Error('apagou!')
})
await t('B não consegue usar categoria de A no próprio ambiente', async () => {
  const wsB = (await as(B, () => q(`select id from workspaces`)))[0].id
  await expectErr(as(B, () => q(`insert into transactions (id, workspace_id, kind, amount_cents, category_id, date) values ($1,$2,'saida',100,$3,'2026-09-18')`, [uuid(), wsB, catA])))
})
await t('editar sobe versão e mantém autor', async () => {
  await as(A, () => q(`update transactions set amount_cents=24000, created_by=$2 where id=$1`, [tx1, B]))
  const r = await q(`select version, created_by from transactions where id=$1`, [tx1]); if (r[0].version !== 2 || r[0].created_by !== A) throw new Error(JSON.stringify(r))
})
await t('busca ignora acento e maiúsculas', async () => {
  const r = await as(A, () => q(`select * from buscar_lancamentos($1, 'sao jose')`, [wsA])); if (r.length !== 1) throw new Error('n=' + r.length)
  const r2 = await as(A, () => q(`select * from buscar_lancamentos($1, 'MERCADO')`, [wsA])); if (r2.length !== 1) throw new Error('cat n=' + r2.length)
  const tot = await as(A, () => q(`select * from totais_lancamentos($1, 'merc')`, [wsA])); if (tot[0].saidas != 24000) throw new Error(JSON.stringify(tot))
})
await t('lixeira: exclusão lógica some da busca', async () => {
  await as(A, () => q(`update transactions set deleted_at=now() where id=$1`, [tx1]))
  const r = await as(A, () => q(`select * from buscar_lancamentos($1)`, [wsA])); if (r.length) throw new Error('ainda aparece')
  await as(A, () => q(`update transactions set deleted_at=null where id=$1`, [tx1]))
})
await t('anexo: caminho fora do ambiente é recusado', () => expectErr(as(A, () => q(`insert into attachments (id, transaction_id, workspace_id, path, thumb_path) values ($1,$2,$3,'outro/x.jpg','outro/t.jpg')`, [uuid(), tx1, wsA]))))
await t('anexo: 1 por lançamento', async () => {
  await as(A, () => q(`insert into attachments (id, transaction_id, workspace_id, path, thumb_path) values ($1,$2,$3,$4,$5)`, [uuid(), tx1, wsA, `${wsA}/${tx1}/a.jpg`, `${wsA}/${tx1}/t.jpg`]))
  await expectErr(as(A, () => q(`insert into attachments (id, transaction_id, workspace_id, path, thumb_path) values ($1,$2,$3,$4,$5)`, [uuid(), tx1, wsA, `${wsA}/${tx1}/b.jpg`, `${wsA}/${tx1}/u.jpg`])))
})
await t('storage: B não lê arquivo de A', async () => {
  await q(`insert into storage.objects (bucket_id, name) values ('comprovantes', $1)`, [`${wsA}/${tx1}/a.jpg`])
  const r = await as(B, () => q(`select * from storage.objects`)); if (r.length) throw new Error('vazou')
  const r2 = await as(A, () => q(`select * from storage.objects`)); if (r2.length !== 1) throw new Error('A não vê')
})
await t('Outros não pode ser excluída', async () => {
  const o = (await as(A, () => q(`select id from categories where workspace_id=$1 and is_other and kind='saida'`, [wsA])))[0].id
  await expectErr(as(A, () => q(`delete from categories where id=$1`, [o])))
})
await t('categoria em uso não pode ser excluída', () => expectErr(as(A, () => q(`delete from categories where id=$1`, [catA]))))
await t('anon não lê nada', () => expectErr((async () => { await db.exec('set role anon'); try { await q('select * from transactions') } finally { await db.exec('reset role') } })()))
await t('excluir ambiente em cascata funciona', async () => {
  const w = (await as(A, () => q(`select id from workspaces where name='Empresa'`)))[0].id
  await q(`delete from workspaces where id=$1`, [w])
})
await t('0002: primeiro usuário vira admin', async () => {
  const r = await q(`select user_id from platform_roles`); if (r.length !== 1 || r[0].user_id !== A) throw new Error(JSON.stringify(r))
})
await t('0002: cadastro sem convite é bloqueado', () => expectErr(q(`insert into auth.users (email) values ('x@x.com')`)))
let token
await t('0002: B (não admin) não cria convite', () => expectErr(as(B, () => q(`select * from criar_convite('pai@x.com')`))))
await t('0002: admin cria convite e token valida', async () => {
  const r = await as(A, () => q(`select * from criar_convite('Pai@X.com ')`)); token = r[0].token
  if (r[0].email !== 'pai@x.com' || token.length !== 64) throw new Error(JSON.stringify(r))
  await db.exec('set role anon'); const v = await q(`select * from validar_convite($1)`, [token]); await db.exec('reset role')
  if (v[0]?.situacao !== 'valido') throw new Error(JSON.stringify(v))
})
await t('0002: convite de outro e-mail é recusado', () => expectErr(q(`insert into auth.users (email, raw_user_meta_data) values ('outro@x.com', $1)`, [JSON.stringify({ convite: token })])))
let C
await t('0002: cadastro com convite cria acesso já concluído, sem guardar o token', async () => {
  const [c] = await q(`insert into auth.users (email, raw_user_meta_data) values ('pai@x.com', $1) returning id, raw_user_meta_data`, [JSON.stringify({ convite: token, name: 'Pai' })]); C = c.id
  if (c.raw_user_meta_data.convite) throw new Error('token guardado')
  const p = await q(`select name, onboarded_at from profiles where id=$1`, [C]); if (p[0].name !== 'Pai' || !p[0].onboarded_at) throw new Error(JSON.stringify(p))
})
await t('0002: convite não pode ser usado duas vezes', () => expectErr(q(`insert into auth.users (email, raw_user_meta_data) values ('pai@x.com', $1)`, [JSON.stringify({ convite: token })])))
await t('0002: admin lista usuários; B não', async () => {
  const r = await as(A, () => q(`select * from admin_usuarios()`)); if (r.length !== 3) throw new Error('n=' + r.length)
  const r2 = await as(B, () => q(`select * from admin_usuarios()`)); if (r2.length) throw new Error('B viu usuários')
})
await t('0002: usuário não reativa a si mesmo', async () => {
  await as(A, () => q(`select admin_desativar($1, true)`, [C]))
  await as(C, () => q(`update profiles set disabled_at = null, name='Pai 2' where id=$1`, [C]))
  const p = await q(`select name, disabled_at from profiles where id=$1`, [C]); if (!p[0].disabled_at || p[0].name !== 'Pai 2') throw new Error(JSON.stringify(p))
})
await t('0002: desativado não vê o próprio ambiente', async () => {
  const r = await as(C, () => q(`select count(*)::int n from workspaces`)); if (r[0].n) throw new Error('viu')
  await as(A, () => q(`select admin_desativar($1, false)`, [C]))
  const r2 = await as(C, () => q(`select count(*)::int n from workspaces`)); if (r2[0].n !== 1) throw new Error('não voltou')
})
await t('0002: mover lançamentos entre categorias e excluir a antiga', async () => {
  const outra = (await as(A, () => q(`select id from categories where workspace_id=$1 and name='Alimentação'`, [wsA])))[0].id
  const n = await as(A, () => q(`select mover_lancamentos_categoria($1,$2) n`, [catA, outra])); if (n[0].n !== 1) throw new Error('n=' + n[0].n)
  await as(A, () => q(`delete from categories where id=$1`, [catA]))
})
await t('0002: B não move lançamentos de A', async () => {
  const cats = await as(A, () => q(`select id from categories where workspace_id=$1 and kind='saida' limit 2`, [wsA]))
  const n = await as(B, () => q(`select mover_lancamentos_categoria($1,$2) n`, [cats[0].id, cats[1].id])); if (n[0].n !== 0) throw new Error('moveu')
})
console.log(`\n${ok} ok, ${fail} falhas`); process.exit(fail ? 1 : 0)
