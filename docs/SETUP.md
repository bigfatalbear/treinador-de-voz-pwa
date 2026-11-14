# Provisionamento e publicação

Este documento descreve o backend Supabase já provisionado e como recriá-lo. Não exige cartão de
crédito nem faturamento Google.

## 1. Projeto atual

- **Projeto:** `qlzmvtbhphybyklsttzq`
- **API:** `https://qlzmvtbhphybyklsttzq.supabase.co`
- **Região:** `sa-east-1` (São Paulo)
- **Banco:** Postgres com RLS, RPCs e Realtime
- **Arquivos:** bucket privado `media`
- **Função:** `delete-account`
- **Auth:** e-mail/senha com confirmação automática no MVP; Google opcional

O provisionamento foi feito pela CLI/Management API. Senhas, códigos de convite e tokens de
administração **não** ficam neste repositório.

## 2. Pré-requisitos

- Node.js 20 ou superior.
- Conta no Supabase e um token de acesso pessoal (`SUPABASE_ACCESS_TOKEN`).
- Repositório `bigfatalbear/treinador-de-voz-pwa` com permissão de administrador.
- `gh` autenticado para configurar secrets do GitHub Actions.

```powershell
$env:SUPABASE_ACCESS_TOKEN = '<token-pessoal>'
npx supabase --version
gh auth status
```

Não cole o token em arquivos versionados. Rotacione-o se houver exposição.

## 3. Criar ou linkar o projeto

Para usar o projeto existente:

```powershell
npx supabase link --project-ref qlzmvtbhphybyklsttzq
```

Para recriar do zero, crie o projeto na região `sa-east-1` e ajuste a URL/chave em `.env.local`.
A senha do banco deve ser guardada em gerenciador de segredos, nunca no repositório.

## 4. Aplicar schema, RLS e bucket

```powershell
npx supabase db push
```

A migration `supabase/migrations/20261112010000_init.sql` cria:

- `members`, `notices`, `tracks`, `scores`, `warmups`, `polls`, `poll_votes`, `messages`;
- `app_secrets` sem acesso para `anon`/`authenticated`;
- funções `is_member`, `is_regent`, `can_use_room`, `is_regent_email`, `sync_regent_role` e
  `join_choir`;
- policies de leitura por membro, escrita por regente, voto próprio e salas por naipe;
- bucket privado `media` (25 MiB por arquivo) e policies de Storage;
- publicação Realtime das tabelas do coral.

A migration `20261112020000_roles_and_videos.sql` adiciona:

- `videos` (título, descrição, ID do YouTube, categoria e naipe opcional) com leitura por membro
  e escrita pelo regente;
- RPC `set_regent_role`, que promove/rebaixa um membro e atualiza `regent_emails` na mesma
  transação, protegendo o último regente.

## 5. Publicar a Edge Function

```powershell
npx supabase functions deploy delete-account --no-verify-jwt
```

`--no-verify-jwt` é necessário porque a função valida o token manualmente com a service role e
retorna erros JSON. A função apaga os áudios de chat do usuário e a conta em `auth.users`; o
`on delete cascade` remove membro, votos e mensagens.

## 6. Configurar Auth

No painel **Authentication → URL Configuration**:

- **Site URL:** `https://bigfatalbear.github.io/treinador-de-voz-pwa/`
- **Redirect URLs:**
  - `https://bigfatalbear.github.io/treinador-de-voz-pwa/`
  - `http://localhost:5173/`
  - `http://localhost:4173/`

O MVP usa `mailer_autoconfirm=true` para evitar dependência de e-mail no onboarding por convite.
Se a confirmação por e-mail for reativada, ajuste o template e teste o fluxo.

O link **Esqueci minha senha** usa `resetPasswordForEmail` e retorna para a URL base do Pages.
Mantenha o Site URL e as Redirect URLs acima; o link precisa ser aberto no mesmo navegador em que
foi solicitado. Para produção com mais volume, configure um SMTP próprio no Supabase.

### Google opcional

1. Crie um OAuth Client Web no Google Cloud.
2. Autorize o redirect `https://qlzmvtbhphybyklsttzq.supabase.co/auth/v1/callback`.
3. Ative o provedor Google em **Authentication → Providers**.
4. Defina `VITE_SUPABASE_GOOGLE_ENABLED=true` no build.
5. Autorize a origem `https://bigfatalbear.github.io` no OAuth.

Sem esses passos, mantenha `VITE_SUPABASE_GOOGLE_ENABLED=false`; o botão Google fica oculto.

## 7. Segredos do coral

Execute no **SQL Editor** do Supabase, substituindo os valores:

```sql
insert into public.app_secrets (key, value)
values
  ('regent_emails', 'regente@exemplo.com,outro-regente@exemplo.com'),
  ('invite_code', 'TROQUE-ESTE-CODIGO')
on conflict (key) do update
  set value = excluded.value,
      updated_at = now();
```

- `regent_emails`: e-mails separados por vírgula; o primeiro login promove a regente.
- `invite_code`: código compartilhado para entrada de coralistas. Troque quando necessário.

Esses valores são lidos apenas por funções `security definer`; `anon` e `authenticated` não têm
`select` em `app_secrets`.

## 8. Configuração do app Web

Crie `.env.local` (ignorado pelo Git) a partir de `.env.example`:

```env
VITE_SUPABASE_URL=https://qlzmvtbhphybyklsttzq.supabase.co
VITE_SUPABASE_ANON_KEY=<chave-publicavel>
VITE_SUPABASE_BUCKET=media
VITE_SUPABASE_GOOGLE_ENABLED=false
VITE_CHOIR_ID=principal
```

A chave publicável (`anon`) é um identificador público; a segurança vem das policies. Nunca use a
`service_role` no frontend, no `.env.local` do app ou em secrets de build.

No GitHub: **Settings → Secrets and variables → Actions → New repository secret**, cadastre os
mesmos nomes `VITE_*`. O workflow injeta os valores no build; sem eles, o Pages publica o modo
demonstração.

## 9. Deploy no GitHub Pages

O workflow está em `.github/workflows/deploy.yml`. No GitHub:

1. **Settings → Pages → Source: GitHub Actions**.
2. Rode o workflow (push em `main` ou **Actions → Deploy PWA → Run workflow**).
3. Confirme a URL `https://bigfatalbear.github.io/treinador-de-voz-pwa/`.

Se o repositório for renomeado, atualize `base` em `vite.config.ts`, `start_url`/`scope` do
manifest, o workflow e as URLs autorizadas no Supabase Auth.

## 10. Verificação pós-provisionamento

- Cadastro e login por e-mail/senha funcionam no domínio do Pages.
- `sync_regent_role` promove o e-mail da lista e rebaixa quem sair dela.
- `join_choir` aceita o código correto e rejeita o incorreto.
- Coralista lê o próprio membro e não consegue alterar `role`.
- Coralista acessa o chat geral e o próprio naipe; salas alheias são negadas pela RLS.
- Upload de faixa/PDF só funciona como regente; chat só no próprio naipe.
- Áudio de chat é limitado a 2 MB e 60 s; stems/PDF a 25 MB/10 MB.
- `createSignedUrl` gera URL temporária e a leitura é restrita a membros.
- `delete-account` remove conta, membro, votos, mensagens e áudios.
- `npm run typecheck`, `npm test` e `npm run build` passam.

## 11. Limites do plano free

O plano free não cobra cartão, mas tem cotas de banco, Storage, egress e invocações de Functions.
Projetos sem atividade podem ser pausados; reative no painel. Consulte os limites atuais antes de
divulgar o coral e monitore o uso de áudio, que tende a ser o maior consumidor.
