# Finanças

Controle financeiro pessoal e da empresa — app web instalável (PWA) para Android, iPhone, iPad e computador.
Projeto de Cleber Urias. Regra do produto: **completo nos dados, simples na utilização**.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `app/` | App em React + TypeScript + Vite (PWA) |
| `app/src/data/` | Acesso aos dados: Supabase (real) e modo demonstração (dados fictícios) |
| `supabase/migrations/` | Estrutura do banco, regras de segurança (RLS) e categorias iniciais |
| `app/scripts/test-schema.mjs` | Testes automáticos das regras do banco (isolamento entre usuários e ambientes) |
| `.github/workflows/publicar.yml` | Publica a versão web no GitHub Pages a cada alteração |

## Configuração do Supabase (uma vez)

1. **SQL Editor** → colar e rodar, em ordem, cada arquivo de `supabase/migrations/` (0001, 0002…), uma única vez cada.
2. **Authentication → Sign In / Providers**: **ligar "Allow new users to sign up"** e **desligar "Confirm email"**. O cadastro continua fechado: o banco só aceita quem tem um convite válido criado pelo administrador (Mais → Usuários e convites).
3. **Authentication → URL Configuration**: *Site URL* = endereço do app publicado (ex.: `https://SEU-USUARIO.github.io/financas/`) e o mesmo em *Redirect URLs*.
4. **Criar acessos** em **Authentication → Users → Add user**:
   - *Create new user* com e-mail e uma senha provisória (marcar *Auto Confirm*). No primeiro acesso o app pede nome e nova senha.
   - ou *Send invitation* (exige o Gmail do app configurado como SMTP — Decisão 24).
5. Tornar-se administrador (SQL Editor):
   `insert into platform_roles (user_id, role) select id, 'admin' from auth.users where email = 'SEU@EMAIL';`

## Desenvolvimento

```bash
cd app
npm install
npm run dev              # sem variáveis do Supabase, abre em modo demonstração
npx vite build --mode demo   # página única de demonstração
node scripts/test-schema.mjs # testes do banco
```

Variáveis (arquivo `app/.env.local`, nunca enviado ao GitHub):

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=chave-publica-anon
```

## Segurança

- O app usa só a chave pública; a chave `service_role` nunca entra no código nem no GitHub.
- Todo dado financeiro pertence a um ambiente; o banco só mostra linhas de ambientes dos quais o usuário é membro (RLS).
- Fotos em bucket privado, caminho `{ambiente}/{lançamento}/{arquivo}`, acesso por link temporário.
- Nenhum dado financeiro fica guardado no aparelho (só a sessão e preferências como último ambiente).
