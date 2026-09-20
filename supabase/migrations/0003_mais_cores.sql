-- 0003: paleta ampliada — categorias e ambientes aceitam cores de 1 a 24 (0 = Outros)
alter table public.categories drop constraint if exists categories_color_check;
alter table public.categories add constraint categories_color_check check (color between 0 and 24);
alter table public.workspaces drop constraint if exists workspaces_color_check;
alter table public.workspaces add constraint workspaces_color_check check (color between 1 and 24);
