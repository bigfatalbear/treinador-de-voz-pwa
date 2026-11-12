# Provisionamento e publicação

Este documento descreve o caminho para sair do modo demonstração e ativar o backend Google.
Nada aqui foi provisionado automaticamente pelo agente.

## 1. Pré-requisitos

- Conta Google com acesso ao projeto `treinador-de-voz-ccb070`.
- Faturamento ativo e plano **Blaze** (necessário para Cloud Functions e Storage em projetos novos).
- `gcloud`, `firebase-tools` e `gsutil` instalados e autenticados.
- Repositório GitHub `bigfatalbear/treinador-de-voz-pwa` com permissão de administrador.

```bash
gcloud auth login
gcloud config set project treinador-de-voz-ccb070
firebase login
firebase use treinador-de-voz-ccb070
```

Se o ID `treinador-de-voz-ccb070` não estiver disponível, crie outro e atualize este documento,
o workflow e todos os comandos. Não presuma que o ID está livre.

## 2. APIs

```bash
gcloud services enable \
  firebase.googleapis.com \
  identitytoolkit.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com \
  cloudfunctions.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  appcheck.googleapis.com \
  recaptchaenterprise.googleapis.com
```

## 3. Firebase e Firestore

1. No console do Firebase, confirme o app Web e copie a configuração pública.
2. Crie o Firestore em **Native mode**, região `southamerica-east1`. A região é imutável.

```bash
gcloud firestore databases create \
  --project=treinador-de-voz-ccb070 \
  --location=southamerica-east1 \
  --type=firestore-native
```

3. Crie o bucket padrão do Storage em `southamerica-east1` pelo console do Firebase
   (**Storage → Começar**). Copie o nome exato do bucket exibido; ele varia entre projetos.

## 4. Autenticação

No console do Firebase:

1. **Authentication → Sign-in method → Google**: ativar.
2. **Authentication → Settings → Authorized domains**: adicionar
   - `localhost`
   - `bigfatalbear.github.io`
   - `treinador-de-voz-ccb070.firebaseapp.com`
   - `treinador-de-voz-ccb070.web.app`
3. Configure a tela de consentimento OAuth com escopos `openid`, `email` e `profile`.
   Não solicite Drive (`drive.appdata`) neste produto.

O fluxo usa popup e cai para redirect quando o popup é bloqueado.

## 5. Configuração do app Web

Crie `.env.local` (ignorado pelo Git) a partir de `.env.example`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=treinador-de-voz-ccb070.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=treinador-de-voz-ccb070
VITE_FIREBASE_STORAGE_BUCKET=<bucket exibido no console>
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_REGION=southamerica-east1
VITE_RECAPTCHA_SITE_KEY=<site key do App Check>
VITE_CHOIR_ID=principal
```

A API key do Firebase Web é um identificador público, não um segredo. Restrinja-a por HTTP
referrer no Google Cloud Console e ative App Check.

No GitHub: **Settings → Secrets and variables → Actions → New repository secret**, cadastre os
mesmos nomes (`VITE_*`). O workflow de deploy injeta esses valores no build. Sem eles, o Pages
publica o modo demonstração.

## 6. Regras e Functions

```bash
npm --prefix functions install
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

### Segredos das Functions

```bash
firebase functions:secrets:set REGENT_EMAILS
firebase functions:secrets:set CHOIR_INVITE_CODE
```

- `REGENT_EMAILS`: e-mails separados por vírgula. O primeiro login de cada e-mail autorizado cria
  o membro com papel `regente`.
- `CHOIR_INVITE_CODE`: código compartilhado pelo regente para entrada de coralistas. Sem ele,
  `joinChoir` nega a entrada. Troque o código quando necessário.

O código usa `CHOIR_ID=principal` por padrão. Se alterar, ajuste também `VITE_CHOIR_ID` e as
regras/documentação.

### URL assinada e IAM

`getMediaUrl` usa `getSignedUrl`. Se o deploy falhar com erro de `signBlob`, conceda ao service
account das Functions permissão para assinar blobs. Verifique o service account usado pelo
projeto antes de executar:

```bash
PROJECT_NUMBER=$(gcloud projects describe treinador-de-voz-ccb070 --format="value(projectNumber)")
SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --member="serviceAccount:${SA}" \
  --role="roles/iam.serviceAccountTokenCreator"
```

Confirme no console se o runtime usa esse service account; não aplique o comando às cegas.

### CORS do Storage

Áudio é decodificado e cacheado via `fetch` no navegador. Aplique CORS ao bucket real:

```bash
gsutil cors set cors.json gs://<BUCKET>
```

O arquivo `cors.json` autoriza `https://bigfatalbear.github.io` e o dev server local.

## 7. App Check

1. No console, registre o app Web no App Check com **reCAPTCHA Enterprise**.
2. Copie a site key para `VITE_RECAPTCHA_SITE_KEY` (local e GitHub Secrets).
3. Ative a aplicação gradual para Firestore, Storage e Functions.
4. Para desenvolvimento local, use o modo de depuração do App Check e cadastre o token de debug;
   nunca versione esse token.

Sem App Check, as APIs continuam protegidas por autenticação e regras, mas ficam mais expostas a
abuso automatizado.

## 8. Orçamento

Em **Billing → Budgets & alerts**, crie um orçamento para o projeto com alertas em 50%, 90% e
100%. Defina o valor conforme sua tolerância; orçamento é alerta, não limite rígido. Functions,
Storage e egress podem gerar cobrança.

## 9. Deploy no GitHub Pages

O workflow já está em `.github/workflows/deploy.yml`. No GitHub:

1. **Settings → Pages → Source: GitHub Actions**.
2. Rode o workflow (push em `main` ou **Actions → Deploy PWA → Run workflow**).
3. Confirme a URL publicada. A URL esperada é
   `https://bigfatalbear.github.io/treinador-de-voz-pwa/`.

A URL só deve ser tratada como publicada após o deploy concluir. Se o repositório for renomeado,
atualize `base` em `vite.config.ts`, `start_url`/`scope` do manifest, o workflow e os domínios
autorizados no Firebase.

## 10. Verificação pós-provisionamento

- Login Google funciona no domínio do Pages.
- `syncRegentRole` cria o membro regente para um e-mail da lista.
- `joinChoir` aceita o código correto e rejeita o incorreto.
- Coralista lê o próprio membro e não consegue alterar `role`.
- Coralista acessa o chat geral e o próprio naipe; salas alheias retornam `permission-denied`.
- Upload de faixa/PDF só funciona como regente.
- Áudio de chat é limitado a 2 MB e 60 s.
- `getMediaUrl` gera URL assinada e expira em 15 minutos.
- `deleteMyData` remove membro, votos, mensagens e a conta.
- Regras testadas no Emulator Suite antes de produção.
