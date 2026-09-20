-- 0004: paleta com 50 cores (0 = Outros)
alter table public.categories drop constraint if exists categories_color_check;
alter table public.categories add constraint categories_color_check check (color between 0 and 50);
alter table public.workspaces drop constraint if exists workspaces_color_check;
alter table public.workspaces add constraint workspaces_color_check check (color between 1 and 50);
