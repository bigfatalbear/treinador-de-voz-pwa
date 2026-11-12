# TREINADOR DE VOZ

PWA de treino de coral publicada no GitHub Pages, com dados e mídia no Firebase/Google Cloud.
O site é 100% estático; autenticação, banco, arquivos e operações confiáveis rodam fora do
GitHub Pages.

- **UUID de marca:** `2dfce9de-de4b-57ae-a291-a170c20195cd`
- **Repositório:** https://github.com/bigfatalbear/treinador-de-voz-pwa
- **URL pública (GitHub Pages ativa):** https://bigfatalbear.github.io/treinador-de-voz-pwa/
- **Projeto Google Cloud/Firebase:** `treinador-de-voz-ccb070` (confirmado pelo responsável; provisionamento pendente)
- **Região:** `southamerica-east1` (São Paulo)

## O que já funciona sem Firebase

Sem as variáveis `VITE_FIREBASE_*`, o app inicia em **modo demonstração**:

- login local como regente ou coralista;
- mixer com quatro naipes gerados no dispositivo + playback;
- BPM sem mudança de tom (Tone.js), loop A-B, letra LRC, afinador e overdub;
- faixas demo, mural, chat por naipe, enquetes de presença e área do regente;
- dados em `localStorage` e áudios em IndexedDB, somente neste navegador.

O modo demo não simula as Security Rules. A autorização real só é aplicada com o Firebase
provisionado.

## Funcionalidades

- Mixer independente para soprano, contralto, tenor, baixo e playback.
- Andamento de 50–150 BPM com time-stretch no cliente.
- Looping A-B com marcação nos pontos atuais.
- Afinador visual por microfone (autocorrelação, sem envio de áudio).
- Overdub local com download da gravação.
- Letra sincronizada (LRC) e PDF de partitura para consulta.
- Áudios de aquecimento enviados pelo regente.
- Chat geral e por naipe, com texto e áudio de até 60 s.
- Mural de avisos fixos e enquete de presença.
- Área do regente: upload de stems/PDF/aquecimento, avisos, enquetes e exclusão.
- PWA offline, instalável no Windows via Edge/Chrome (atalho com janela própria).
- Botão “Ajude o desenvolvedor” com PIX estático e QR Code.

## Stack

React 18, TypeScript, Tailwind CSS, Vite, `vite-plugin-pwa`, Tone.js, Web Audio API,
`idb-keyval`, Firebase Auth/Firestore/Storage/Functions, Cloud Functions 2ª geração.
O frontend é publicado no GitHub Pages; o Firebase Hosting não é usado em produção.

## Desenvolvimento

```bash
npm install
npm run dev
```

Verificações:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

## Configuração do Firebase

1. Provisione o projeto e os serviços seguindo [docs/SETUP.md](docs/SETUP.md).
2. Copie `.env.example` para `.env.local` e preencha os valores públicos do app Web.
3. Rode as regras e as Functions:

```bash
npm --prefix functions install
firebase deploy --only firestore:rules,firestore:indexes,storage,functions
```

4. Cadastre os mesmos valores como secrets do GitHub Actions para o build de produção.
5. Autorize o domínio `bigfatalbear.github.io` no Firebase Authentication.

Sem esses passos, o site publicado continua em modo demonstração. Nenhum segredo deve ir para
`.env.local` versionado, para o repositório ou para o bundle.

## Deploy

O workflow `.github/workflows/deploy.yml` roda typecheck, testes e build; publica `dist` no
GitHub Pages. Em **Settings → Pages**, selecione **GitHub Actions** como fonte.

A URL só existe depois do primeiro deploy bem-sucedido. O caminho base do Vite é
`/treinador-de-voz-pwa/`; renomear o repositório exige atualizar `base`, o `start_url`/`scope`
do manifest, o workflow e os domínios autorizados.

## Estrutura

```
src/
  components/     UI, layout, afinador, letra, gravador, PIX
  context/        autenticação e toasts
  lib/            Firebase, dados, áudio, mídia, cache, PIX, LRC, pitch
  pages/          Treino, Chat, Mural, Regente, Perfil, Login, Onboarding
functions/        Cloud Functions (claims, convite, URL assinada, exclusão)
firestore.rules   autorização por membro/papel/sala
storage.rules     leitura privada, escrita do regente, chat limitado
docs/             setup, arquitetura, segurança e aceite
```

## Segurança e privacidade

- Login Google com escopos básicos (`openid`, `email`, `profile`); sem Drive.
- Papel de regente concedido apenas no servidor por lista de e-mails (`REGENT_EMAILS`).
- Entrada no coral por código de convite validado em Cloud Function.
- Firestore/Storage: leitura só para membros; escrita de conteúdo só para regente.
- URLs de mídia assinadas por 15 minutos; sem tokens de service account no frontend.
- App Check opcional com reCAPTCHA Enterprise (`VITE_RECAPTCHA_SITE_KEY`).
- Chat com retenção de 90 dias; presença por 12 meses; somente maiores de 18 anos no MVP.
- Overdub e afinador não saem do dispositivo.
- PIX é doação voluntária, sem verificação automática de pagamento.

Leia [docs/SECURITY.md](docs/SECURITY.md) para limites e riscos residuais.

## Limitações conhecidas

- Firebase/GCP **não provisionados** neste repositório.
- O GitHub Pages não permite cabeçalhos HTTP personalizados; CSP é limitada.
- A qualidade do time-stretch no cliente varia por dispositivo e por tamanho da mudança de BPM.
- O atalho Windows é o da PWA; não há `.exe`, assinatura de código ou auto-update próprio.
- Testes de regras com Emulator Suite, Lighthouse/axe e testes em dispositivos reais ainda
  precisam ser executados no ambiente provisionado.

## Licença e conteúdo

Partituras, letras e gravações devem ter direitos autorais autorizados pelo coral. O regente é
responsável pelo conteúdo que envia.
