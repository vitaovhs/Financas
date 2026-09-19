-- =====================================================================
-- Finanças — migração 0001 (estrutura inicial do MVP)
-- Aplicar no Supabase: Dashboard → SQL Editor → colar tudo → Run.
-- Idempotente o suficiente para rodar uma vez num projeto novo.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------
-- Utilitários
-- ---------------------------------------------------------------------
create or replace function public.f_unaccent(t text)
returns text language sql immutable parallel safe strict
set search_path = ''
as $$ select extensions.unaccent('extensions.unaccent'::regdictionary, t) $$;

create or replace function public.normaliza(t text)
returns text language sql immutable parallel safe
set search_path = ''
as $$ select lower(public.f_unaccent(coalesce(t, ''))) $$;

-- ---------------------------------------------------------------------
-- Perfis e papéis da plataforma
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text check (char_length(name) <= 80),
  default_workspace_id uuid,
  onboarded_at timestamptz,
  disabled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);

-- ---------------------------------------------------------------------
-- Ambientes (cofres financeiros) e membros
-- ---------------------------------------------------------------------
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  kind text not null default 'pessoal' check (kind in ('pessoal', 'empresa', 'outro')),
  icon text not null default 'person',
  color smallint not null default 1 check (color between 1 and 10),
  currency text not null default 'BRL',
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('dono', 'administrador', 'editor', 'leitor')),
  joined_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

alter table public.profiles
  add constraint profiles_default_ws_fk
  foreign key (default_workspace_id) references public.workspaces(id) on delete set null;

-- ---------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('entrada', 'saida')),
  name text not null check (char_length(name) between 1 and 40),
  icon text not null default 'label',
  color smallint not null default 1 check (color between 0 and 10), -- 0 = Outros (grafite)
  sort integer not null default 0,
  is_other boolean not null default false,
  parent_id uuid references public.categories(id) on delete set null, -- futuro: subcategorias
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index categories_nome_unico
  on public.categories (workspace_id, kind, public.normaliza(name));
create unique index categories_um_outros
  on public.categories (workspace_id, kind) where is_other;
create index on public.categories (workspace_id, kind, sort);

-- ---------------------------------------------------------------------
-- Lançamentos
-- ---------------------------------------------------------------------
create table public.transactions (
  id uuid primary key,                         -- gerado no aparelho (proteção contra duplicidade)
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('entrada', 'saida')),
  amount_cents bigint not null check (amount_cents > 0 and amount_cents < 100000000000),
  currency text not null default 'BRL',
  category_id uuid not null references public.categories(id),
  date date not null,
  description text check (char_length(description) <= 120),
  note text check (char_length(note) <= 1000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1,
  deleted_at timestamptz,
  -- reservados para versões futuras
  account_id uuid,
  recurrence_id uuid,
  installment_group_id uuid,
  installment_n smallint,
  search_norm text generated always as (
    public.normaliza(coalesce(description, '') || ' ' || coalesce(note, ''))
  ) stored
);
create index transactions_ws_data on public.transactions (workspace_id, date desc) where deleted_at is null;
create index transactions_ws_cat_data on public.transactions (workspace_id, category_id, date) where deleted_at is null;
create index transactions_lixeira on public.transactions (workspace_id, deleted_at) where deleted_at is not null;
create index transactions_busca on public.transactions using gin (search_norm extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- Anexos (MVP: no máximo 1 por lançamento)
-- ---------------------------------------------------------------------
create table public.attachments (
  id uuid primary key,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  path text not null,
  thumb_path text not null,
  mime text not null default 'image/jpeg',
  size_bytes integer,
  width integer,
  height integer,
  ocr_status text,                              -- futuro
  created_at timestamptz not null default now()
);
create unique index attachments_um_por_lancamento on public.attachments (transaction_id);
create index on public.attachments (workspace_id);

-- ---------------------------------------------------------------------
-- Funções de acesso (usadas pelas regras RLS)
-- ---------------------------------------------------------------------
create or replace function public.papel_no_ambiente(ws uuid)
returns text language sql stable security definer
set search_path = ''
as $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid()
$$;

create or replace function public.pode_ver(ws uuid)
returns boolean language sql stable
set search_path = ''
as $$ select public.papel_no_ambiente(ws) is not null $$;

create or replace function public.pode_lancar(ws uuid)
returns boolean language sql stable
set search_path = ''
as $$ select coalesce(public.papel_no_ambiente(ws) in ('dono', 'administrador', 'editor'), false) $$;

create or replace function public.pode_gerir(ws uuid)
returns boolean language sql stable
set search_path = ''
as $$ select coalesce(public.papel_no_ambiente(ws) in ('dono', 'administrador'), false) $$;

create or replace function public.eh_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.platform_roles r where r.user_id = auth.uid() and r.role = 'admin') $$;

-- ---------------------------------------------------------------------
-- Gatilhos de integridade
-- ---------------------------------------------------------------------
-- Lançamento: servidor controla autoria, datas e versão; categoria precisa
-- ser do mesmo ambiente e do mesmo tipo.
create or replace function public.tg_transactions_integridade()
returns trigger language plpgsql
set search_path = ''
as $$
declare c record;
begin
  select workspace_id, kind into c from public.categories where id = new.category_id;
  if c.workspace_id is distinct from new.workspace_id then
    raise exception 'Categoria de outro ambiente' using errcode = '23514';
  end if;
  if c.kind is distinct from new.kind then
    raise exception 'Categoria de outro tipo' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
    new.updated_at := now();
    new.version := 1;
  else
    new.id := old.id;
    new.workspace_id := old.workspace_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
    new.version := old.version + 1;
  end if;
  return new;
end $$;

create trigger transactions_integridade
  before insert or update on public.transactions
  for each row execute function public.tg_transactions_integridade();

-- Anexo: o ambiente do anexo é sempre o do lançamento.
create or replace function public.tg_attachments_integridade()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  select workspace_id into new.workspace_id from public.transactions where id = new.transaction_id;
  if new.path not like new.workspace_id::text || '/%' or new.thumb_path not like new.workspace_id::text || '/%' then
    raise exception 'Caminho do arquivo fora do ambiente' using errcode = '23514';
  end if;
  return new;
end $$;

create trigger attachments_integridade
  before insert or update on public.attachments
  for each row execute function public.tg_attachments_integridade();

-- Categoria: "Outros" não pode ser arquivada nem mudar de tipo.
create or replace function public.tg_categories_integridade()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.workspace_id := old.workspace_id;
    new.kind := old.kind;
    new.is_other := old.is_other;
    if old.is_other and new.archived_at is not null then
      raise exception 'A categoria Outros não pode ser arquivada' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

create trigger categories_integridade
  before insert or update on public.categories
  for each row execute function public.tg_categories_integridade();

create or replace function public.tg_categories_bloqueia_outros()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if old.is_other and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    raise exception 'A categoria Outros não pode ser excluída' using errcode = '23514';
  end if;
  return old;
end $$;

create trigger categories_bloqueia_outros
  before delete on public.categories
  for each row execute function public.tg_categories_bloqueia_outros();

-- ---------------------------------------------------------------------
-- Categorias iniciais (aprovadas — Decisão 28)
-- ---------------------------------------------------------------------
create or replace function public.criar_categorias_iniciais(ws uuid, tipo_ambiente text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare
  saidas text[][];
  entradas text[][];
  i int;
begin
  if tipo_ambiente = 'empresa' then
    saidas := array[
      ['Impostos e taxas','account_balance'], ['Pró-labore','badge'], ['Salários e encargos','groups'],
      ['Fornecedores','local_shipping'], ['Aluguel','apartment'], ['Contas','receipt'],
      ['Contabilidade','calculate'], ['Combustível e deslocamento','local_gas_station'],
      ['Veículos e manutenção','car_repair'], ['Material de escritório','inventory_2'],
      ['Equipamentos','devices'], ['Software e assinaturas','cloud'], ['Marketing e publicidade','campaign'],
      ['Tarifas bancárias','credit_card'], ['Cursos e treinamentos','school']];
    entradas := array[
      ['Serviços prestados','handshake'], ['Venda de produtos','sell'], ['Recebimento de clientes','payments'],
      ['Rendimentos financeiros','trending_up'], ['Aporte dos sócios','savings']];
  else
    saidas := array[
      ['Mercado','shopping_cart'], ['Alimentação','restaurant'], ['Lazer','sports_esports'],
      ['Gasolina','local_gas_station'], ['Pedágio','toll'], ['Carro','directions_car'],
      ['Manutenção','build'], ['Casa','home'], ['Contas','receipt'], ['Saúde','medical_services'],
      ['Educação','school'], ['Compras','shopping_bag'], ['Supérfluos','redeem'], ['Viagens','flight'],
      ['Assinaturas','subscriptions']];
    entradas := array[
      ['Salário','payments'], ['Pagamento','account_balance_wallet'], ['Comissão','percent'],
      ['Renda extra','savings'], ['Transferência recebida','move_to_inbox'], ['Venda','sell']];
  end if;

  for i in 1 .. array_length(saidas, 1) loop
    insert into public.categories (workspace_id, kind, name, icon, color, sort)
    values (ws, 'saida', saidas[i][1], saidas[i][2], ((i - 1) % 10) + 1, i);
  end loop;
  insert into public.categories (workspace_id, kind, name, icon, color, sort, is_other)
  values (ws, 'saida', 'Outros', 'more_horiz', 0, 1000, true);

  for i in 1 .. array_length(entradas, 1) loop
    insert into public.categories (workspace_id, kind, name, icon, color, sort)
    values (ws, 'entrada', entradas[i][1], entradas[i][2], ((i - 1) % 10) + 1, i);
  end loop;
  insert into public.categories (workspace_id, kind, name, icon, color, sort, is_other)
  values (ws, 'entrada', 'Outros', 'more_horiz', 0, 1000, true);
end $$;
revoke execute on function public.criar_categorias_iniciais(uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Criar ambiente (RPC): ambiente + dono + categorias iniciais
-- ---------------------------------------------------------------------
create or replace function public.criar_ambiente(
  p_nome text, p_tipo text default 'pessoal', p_icone text default null, p_cor smallint default null
) returns public.workspaces
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  w public.workspaces;
begin
  if uid is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  if (select count(*) from public.workspace_members where user_id = uid and role = 'dono') >= 10 then
    raise exception 'Limite de 10 ambientes' using errcode = '23514';
  end if;
  insert into public.workspaces (name, kind, icon, color, created_by)
  values (
    btrim(p_nome), p_tipo,
    coalesce(p_icone, case p_tipo when 'empresa' then 'business_center' when 'outro' then 'folder' else 'person' end),
    coalesce(p_cor, case p_tipo when 'empresa' then 3 else 1 end),
    uid)
  returning * into w;
  insert into public.workspace_members (workspace_id, user_id, role) values (w.id, uid, 'dono');
  perform public.criar_categorias_iniciais(w.id, case when p_tipo = 'empresa' then 'empresa' else 'pessoal' end);
  return w;
end $$;
revoke execute on function public.criar_ambiente(text, text, text, smallint) from public, anon;
grant execute on function public.criar_ambiente(text, text, text, smallint) to authenticated;

-- ---------------------------------------------------------------------
-- Novo usuário: perfil + ambiente "Pessoal"
-- ---------------------------------------------------------------------
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare ws uuid;
begin
  insert into public.profiles (id, name)
  values (new.id, nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''));

  insert into public.workspaces (name, kind, icon, color, created_by)
  values ('Pessoal', 'pessoal', 'person', 1, new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'dono');
  perform public.criar_categorias_iniciais(ws, 'pessoal');
  update public.profiles set default_workspace_id = ws where id = new.id;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_novo_usuario();

-- ---------------------------------------------------------------------
-- Busca e filtros (respeita RLS: security invoker)
-- ---------------------------------------------------------------------
create or replace function public.buscar_lancamentos(
  p_workspace uuid,
  p_texto text default null,
  p_tipo text default null,
  p_categorias uuid[] default null,
  p_de date default null,
  p_ate date default null,
  p_min bigint default null,
  p_max bigint default null,
  p_com_foto boolean default null,
  p_limite int default 50,
  p_deslocamento int default 0
) returns setof public.transactions
language sql stable
set search_path = ''
as $$
  select t.* from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace
    and t.deleted_at is null
    and (p_texto is null or p_texto = ''
         or t.search_norm like '%' || public.normaliza(p_texto) || '%'
         or public.normaliza(c.name) like '%' || public.normaliza(p_texto) || '%')
    and (p_tipo is null or t.kind = p_tipo)
    and (p_categorias is null or t.category_id = any (p_categorias))
    and (p_de is null or t.date >= p_de)
    and (p_ate is null or t.date <= p_ate)
    and (p_min is null or t.amount_cents >= p_min)
    and (p_max is null or t.amount_cents <= p_max)
    and (p_com_foto is null
         or p_com_foto = exists (select 1 from public.attachments a where a.transaction_id = t.id))
  order by t.date desc, t.created_at desc
  limit least(greatest(p_limite, 1), 200) offset greatest(p_deslocamento, 0)
$$;

-- Totais de um conjunto filtrado (mesmos filtros)
create or replace function public.totais_lancamentos(
  p_workspace uuid,
  p_texto text default null,
  p_tipo text default null,
  p_categorias uuid[] default null,
  p_de date default null,
  p_ate date default null,
  p_min bigint default null,
  p_max bigint default null,
  p_com_foto boolean default null
) returns table (quantidade bigint, entradas bigint, saidas bigint)
language sql stable
set search_path = ''
as $$
  select count(*),
         coalesce(sum(t.amount_cents) filter (where t.kind = 'entrada'), 0),
         coalesce(sum(t.amount_cents) filter (where t.kind = 'saida'), 0)
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.workspace_id = p_workspace
    and t.deleted_at is null
    and (p_texto is null or p_texto = ''
         or t.search_norm like '%' || public.normaliza(p_texto) || '%'
         or public.normaliza(c.name) like '%' || public.normaliza(p_texto) || '%')
    and (p_tipo is null or t.kind = p_tipo)
    and (p_categorias is null or t.category_id = any (p_categorias))
    and (p_de is null or t.date >= p_de)
    and (p_ate is null or t.date <= p_ate)
    and (p_min is null or t.amount_cents >= p_min)
    and (p_max is null or t.amount_cents <= p_max)
    and (p_com_foto is null
         or p_com_foto = exists (select 1 from public.attachments a where a.transaction_id = t.id))
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.platform_roles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.attachments enable row level security;

create policy "perfil: ver o próprio" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "perfil: editar o próprio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "papéis: ver o próprio" on public.platform_roles
  for select to authenticated using (user_id = auth.uid());

create policy "ambientes: ver os seus" on public.workspaces
  for select to authenticated using (public.pode_ver(id));
create policy "ambientes: gerir" on public.workspaces
  for update to authenticated using (public.pode_gerir(id)) with check (public.pode_gerir(id));

create policy "membros: ver do ambiente" on public.workspace_members
  for select to authenticated using (public.pode_ver(workspace_id));

create policy "categorias: ver" on public.categories
  for select to authenticated using (public.pode_ver(workspace_id));
create policy "categorias: criar" on public.categories
  for insert to authenticated with check (public.pode_gerir(workspace_id));
create policy "categorias: editar" on public.categories
  for update to authenticated using (public.pode_gerir(workspace_id)) with check (public.pode_gerir(workspace_id));
create policy "categorias: excluir" on public.categories
  for delete to authenticated using (public.pode_gerir(workspace_id));

create policy "lançamentos: ver" on public.transactions
  for select to authenticated using (public.pode_ver(workspace_id));
create policy "lançamentos: criar" on public.transactions
  for insert to authenticated with check (public.pode_lancar(workspace_id));
create policy "lançamentos: editar" on public.transactions
  for update to authenticated using (public.pode_lancar(workspace_id)) with check (public.pode_lancar(workspace_id));
create policy "lançamentos: excluir definitivamente" on public.transactions
  for delete to authenticated using (public.pode_lancar(workspace_id));

create policy "anexos: ver" on public.attachments
  for select to authenticated using (public.pode_ver(workspace_id));
create policy "anexos: criar" on public.attachments
  for insert to authenticated with check (
    public.pode_lancar((select t.workspace_id from public.transactions t where t.id = transaction_id)));
create policy "anexos: editar" on public.attachments
  for update to authenticated using (public.pode_lancar(workspace_id)) with check (public.pode_lancar(workspace_id));
create policy "anexos: excluir" on public.attachments
  for delete to authenticated using (public.pode_lancar(workspace_id));

-- Nada é acessível sem login.
revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;

-- ---------------------------------------------------------------------
-- Storage: bucket privado de comprovantes, caminho {ambiente}/{lançamento}/{arquivo}
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('comprovantes', 'comprovantes', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;

create policy "comprovantes: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'comprovantes' and public.pode_ver(((storage.foldername(name))[1])::uuid));
create policy "comprovantes: enviar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comprovantes' and public.pode_lancar(((storage.foldername(name))[1])::uuid));
create policy "comprovantes: substituir" on storage.objects
  for update to authenticated
  using (bucket_id = 'comprovantes' and public.pode_lancar(((storage.foldername(name))[1])::uuid));
create policy "comprovantes: excluir" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comprovantes' and public.pode_lancar(((storage.foldername(name))[1])::uuid));
