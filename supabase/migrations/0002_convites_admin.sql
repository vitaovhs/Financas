-- =====================================================================
-- Finanças — migração 0002 (Entrega 3): convites pelo app, administração
-- de usuários, desativação de acesso e ajustes de ambientes/categorias.
-- Aplicar no Supabase: SQL Editor → colar tudo → Run (uma única vez).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Convites (uso único, validade de 7 dias, token guardado só como hash)
-- ---------------------------------------------------------------------
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  token_hash text not null unique,
  kind text not null default 'plataforma' check (kind in ('plataforma', 'ambiente')),
  workspace_id uuid references public.workspaces(id) on delete cascade, -- futuro: convite para ambiente
  role text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz
);
create index if not exists invitations_email on public.invitations (email);
alter table public.invitations enable row level security;
-- Sem políticas: ninguém acessa a tabela diretamente; só pelas funções abaixo.

create or replace function public.hash_token(t text)
returns text language sql immutable strict
set search_path = ''
as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;
revoke execute on function public.hash_token(text) from public, anon, authenticated;

-- Admin cria convite; devolve o token (mostrado uma única vez)
create or replace function public.criar_convite(p_email text)
returns table (id uuid, email text, token text, expires_at timestamptz)
language plpgsql security definer
set search_path = ''
as $$
declare
  e text := lower(btrim(p_email));
  t text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  inv public.invitations;
begin
  if not public.eh_admin() then raise exception 'Apenas administradores' using errcode = '42501'; end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido' using errcode = '22023'; end if;
  if exists (select 1 from auth.users u where lower(u.email) = e) then
    raise exception 'Já existe um acesso com este e-mail' using errcode = '23505';
  end if;
  -- Um convite pendente por e-mail: revoga os anteriores
  update public.invitations i set revoked_at = now()
   where i.email = e and i.accepted_at is null and i.revoked_at is null;
  insert into public.invitations (email, token_hash, invited_by)
  values (e, public.hash_token(t), auth.uid())
  returning * into inv;
  return query select inv.id, inv.email, t, inv.expires_at;
end $$;
revoke execute on function public.criar_convite(text) from public, anon;
grant execute on function public.criar_convite(text) to authenticated;

create or replace function public.listar_convites()
returns table (id uuid, email text, created_at timestamptz, expires_at timestamptz, accepted_at timestamptz, revoked_at timestamptz, situacao text)
language sql stable security definer
set search_path = ''
as $$
  select i.id, i.email, i.created_at, i.expires_at, i.accepted_at, i.revoked_at,
         case when i.accepted_at is not null then 'aceito'
              when i.revoked_at is not null then 'revogado'
              when i.expires_at < now() then 'vencido'
              else 'pendente' end
  from public.invitations i
  where public.eh_admin()
  order by i.created_at desc
  limit 100
$$;
revoke execute on function public.listar_convites() from public, anon;
grant execute on function public.listar_convites() to authenticated;

create or replace function public.revogar_convite(p_id uuid)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Apenas administradores' using errcode = '42501'; end if;
  update public.invitations set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null;
end $$;
revoke execute on function public.revogar_convite(uuid) from public, anon;
grant execute on function public.revogar_convite(uuid) to authenticated;

-- Tela "Criar seu acesso": confere o convite antes do cadastro (não revela nada além do e-mail)
create or replace function public.validar_convite(p_token text)
returns table (email text, situacao text)
language sql stable security definer
set search_path = ''
as $$
  select i.email,
         case when i.accepted_at is not null then 'usado'
              when i.revoked_at is not null then 'revogado'
              when i.expires_at < now() then 'vencido'
              else 'valido' end
  from public.invitations i
  where i.token_hash = public.hash_token(p_token)
  limit 1
$$;
revoke execute on function public.validar_convite(text) from public;
grant execute on function public.validar_convite(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Trava do cadastro: só cria conta quem tem convite válido para o e-mail
-- (vale mesmo que "Allow new users to sign up" esteja ligado).
-- ---------------------------------------------------------------------
create or replace function public.tg_exigir_convite()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare
  tok text := new.raw_user_meta_data ->> 'convite';
  inv public.invitations;
begin
  if tok is null or tok = '' then
    raise exception 'Cadastro somente por convite' using errcode = '42501';
  end if;
  select * into inv from public.invitations i
   where i.token_hash = public.hash_token(tok)
     and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
   for update;
  if inv.id is null or inv.email <> lower(new.email) then
    raise exception 'Convite inválido, vencido ou de outro e-mail' using errcode = '42501';
  end if;
  update public.invitations set accepted_at = now() where id = inv.id;
  -- O token não fica guardado nos dados do usuário
  new.raw_user_meta_data := (coalesce(new.raw_user_meta_data, '{}'::jsonb) - 'convite') || '{"via_convite": true}'::jsonb;
  return new;
end $$;

drop trigger if exists before_auth_user_created on auth.users;
create trigger before_auth_user_created
  before insert on auth.users
  for each row execute function public.tg_exigir_convite();

-- Quem entra por convite já escolheu nome e senha: não passa de novo por "Criar acesso"
create or replace function public.tg_novo_usuario()
returns trigger language plpgsql security definer
set search_path = ''
as $$
declare ws uuid;
begin
  insert into public.profiles (id, name, onboarded_at)
  values (new.id,
          nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
          case when (new.raw_user_meta_data ->> 'via_convite') = 'true' then now() end);

  insert into public.workspaces (name, kind, icon, color, created_by)
  values ('Pessoal', 'pessoal', 'person', 1, new.id)
  returning id into ws;
  insert into public.workspace_members (workspace_id, user_id, role) values (ws, new.id, 'dono');
  perform public.criar_categorias_iniciais(ws, 'pessoal');
  update public.profiles set default_workspace_id = ws where id = new.id;
  update public.invitations set accepted_by = new.id
   where email = lower(new.email) and accepted_at is not null and accepted_by is null;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Usuário desativado não vê nem altera dados (sem apagar nada dele)
-- ---------------------------------------------------------------------
create or replace function public.papel_no_ambiente(ws uuid)
returns text language sql stable security definer
set search_path = ''
as $$
  select m.role from public.workspace_members m
  join public.profiles p on p.id = m.user_id and p.disabled_at is null
  where m.workspace_id = ws and m.user_id = auth.uid()
$$;

-- O próprio usuário não pode mudar o campo de desativação
create or replace function public.tg_profiles_protege()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  if new.disabled_at is distinct from old.disabled_at and current_setting('financas.admin', true) is distinct from '1' then
    new.disabled_at := old.disabled_at;
  end if;
  new.id := old.id;
  return new;
end $$;
drop trigger if exists profiles_protege on public.profiles;
create trigger profiles_protege before update on public.profiles
  for each row execute function public.tg_profiles_protege();

create or replace function public.admin_usuarios()
returns table (id uuid, email text, name text, created_at timestamptz, last_sign_in_at timestamptz, disabled_at timestamptz, is_admin boolean)
language sql stable security definer
set search_path = ''
as $$
  select u.id, u.email::text, p.name, u.created_at, u.last_sign_in_at, p.disabled_at,
         exists (select 1 from public.platform_roles r where r.user_id = u.id and r.role = 'admin')
  from auth.users u
  left join public.profiles p on p.id = u.id
  where public.eh_admin()
  order by u.created_at
$$;
revoke execute on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;

create or replace function public.admin_desativar(p_user uuid, p_desativar boolean)
returns void language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.eh_admin() then raise exception 'Apenas administradores' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'Você não pode desativar o seu próprio acesso' using errcode = '42501'; end if;
  perform set_config('financas.admin', '1', true);
  update public.profiles set disabled_at = case when p_desativar then now() end where id = p_user;
end $$;
revoke execute on function public.admin_desativar(uuid, boolean) from public, anon;
grant execute on function public.admin_desativar(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- Categorias: mover lançamentos antes de excluir (inclui os da Lixeira)
-- ---------------------------------------------------------------------
create or replace function public.mover_lancamentos_categoria(p_de uuid, p_para uuid)
returns integer language plpgsql
set search_path = ''
as $$
declare n integer;
begin
  update public.transactions set category_id = p_para where category_id = p_de;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.mover_lancamentos_categoria(uuid, uuid) from public, anon;
grant execute on function public.mover_lancamentos_categoria(uuid, uuid) to authenticated;

create or replace function public.contar_uso_categoria(p_categoria uuid)
returns integer language sql stable
set search_path = ''
as $$ select count(*)::int from public.transactions where category_id = p_categoria $$;
revoke execute on function public.contar_uso_categoria(uuid) from public, anon;
grant execute on function public.contar_uso_categoria(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Primeiro administrador: o primeiro usuário cadastrado, se ainda não houver nenhum
-- ---------------------------------------------------------------------
insert into public.platform_roles (user_id, role)
select u.id, 'admin' from auth.users u
where not exists (select 1 from public.platform_roles)
order by u.created_at limit 1;
