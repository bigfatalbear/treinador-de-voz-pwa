# CORAL PIBENS ACADEMY

PWA de treino de coral publicada no GitHub Pages, com autenticação, banco, arquivos e operações
confiáveis no **Supabase free**. O site é 100% estático; nenhum segredo fica no bundle.

- **UUID de marca:** `2dfce9de-de-4b-57ae-a291-a170c20195cd`
- **Repositório:** https://github.com/bigfatalbear/treinador-de-voz-pwa
- **URL pública:** https://bigfatalbear.github.io/treinador-de-voz-pwa/
- **Projeto Supabase:** `qlzmvtbhphybyklsttzq` (São Paulo, `sa-east-1`)
- **URL da API:** https://qlzmvtbhphybyklsttzq.supabase.co

## Modo demonstração

Sem `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, o app inicia em **modo demonstração**:

- login local como regente ou coralista;
- mixer com quatro naipes gerados no dispositivo + playback;
- BPM sem mudança de tom (Tone.js), loop A-B, letra LRC, afinador e overdub;
- faixas demo, mural, chat por naipe, enquetes de presença e área do regente;
- dados em `localStorage` e áudios em IndexedDB, somente neste navegador.

O modo demo não simula RLS. A autorização real só é aplicada com o Supabase configurado.

## Funcionalidades

- Mixer independente para soprano, contralto, tenor, baixo e playback.
- Andamento de 50–150 BPM com time-stretch no cliente.
- Looping A-B com marcação nos pontos atuais.
- Afinador visual por microfone (autocorrelação, sem envio de áudio).
- Overdub local com download da gravação.
- Letra sincronizada (LRC) e PDF de partitura para consulta.
- Áudios de aquecimento enviados pelo regente.
- Vídeos de treino do YouTube cadastrados pelo regente e reproduzidos sob demanda.
- Chat geral e por naipe, com texto e áudio de até 60 s.
- Mural de avisos fixos e enquete de presença.
- Área do regente: upload de stems/PDF/aquecimento, avisos, enquetes, vídeos e papéis.
- PWA offline, instalável no Windows via Edge/Chrome (atalho com janela própria).
- Botão “Ajude o desenvolvedor” com PIX estático e QR Code.

## Stack

React 18, TypeScript, Tailwind CSS, Vite, `vite-plugin-pwa`, Tone.js, Web Audio API,
`idb-keyval`, `@supabase/supabase-js` e Supabase (Auth, Postgres/RLS, Storage, Realtime e Edge
Functions). O frontend é publicado no GitHub Pages; não há servidor próprio.

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

## Configuração do Supabase

1. Copie `.env.example` para `.env.local` e preencha a URL e a chave publicável do projeto.
2. Aplique a migration e publique a função de exclusão:

```bash
supabase link --project-ref qlzmvtbhphybyklsttzq
supabase db push
supabase functions deploy delete-account --no-verify-jwt
```

3. Configure `site_url` e `uri_allow_list` do Auth para o Pages e para o desenvolvimento local.
4. Cadastre `regent_emails` e `invite_code` em `public.app_secrets`. Não versione esses valores.
5. Cadastre `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_BUCKET`,
   `VITE_SUPABASE_GOOGLE_ENABLED` e `VITE_CHOIR_ID` como secrets do GitHub Actions.

Detalhes em [docs/SETUP.md](docs/SETUP.md). Sem esses passos, o site publicado continua em modo
demonstração.

## Deploy

O workflow `.github/workflows/deploy.yml` roda typecheck, testes e build; publica `dist` no
GitHub Pages. Em **Settings → Pages**, selecione **GitHub Actions** como fonte.

O caminho base do Vite é `/treinador-de-voz-pwa/`; renomear o repositório exige atualizar `base`,
o `start_url`/`scope` do manifest, o workflow e as URLs autorizadas no Supabase Auth.

## Estrutura

```
src/
  components/     UI, layout, afinador, letra, gravador, PIX
  context/        autenticação e toasts
  lib/            Supabase, dados, áudio, mídia, cache, PIX, LRC, pitch
  pages/          Treino, Chat, Mural, Regente, Perfil, Login, Onboarding
supabase/
  migrations/     schema, RLS, RPCs, bucket e policies
  functions/      Edge Function de exclusão de conta
docs/             setup, arquitetura, segurança e aceite
```

## Segurança e privacidade

- Login por e-mail/senha; Google é opcional e depende de OAuth configurado.
- Papel de regente concedido no servidor por lista de e-mails (`app_secrets.regent_emails`); a área do regente atualiza membro e lista atomicamente pela RPC `set_regent_role`.
- Entrada no coral por código de convite validado pela RPC `join_choir`.
- RLS: leitura só para membros; escrita de conteúdo só para regente; voto só no próprio membro.
- Bucket privado; URLs assinadas por 15 minutos e sem service role no frontend.
- Chat com retenção documentada de 90 dias; presença por 12 meses; somente maiores de 18 anos.
- Overdub e afinador não saem do dispositivo.
- PIX é doação voluntária, sem verificação automática de pagamento.

Leia [docs/SECURITY.md](docs/SECURITY.md) para limites e riscos residuais.

## Limitações conhecidas

- O plano free do Supabase pode pausar projetos sem atividade; reative no painel.
- A limpeza automática de mensagens com mais de 90 dias ainda não está agendada (`expires_at` já
  existe e é filtrado na leitura).
- Google OAuth não está configurado por padrão; use `VITE_SUPABASE_GOOGLE_ENABLED=false`.
- O GitHub Pages não permite cabeçalhos HTTP personalizados; CSP é limitada.
- A qualidade do time-stretch no cliente varia por dispositivo e por tamanho da mudança de BPM.
- O atalho Windows é o da PWA; não há `.exe`, assinatura de código ou auto-update próprio.
- Testes de RLS/Storage são automatizados por script manual; Lighthouse/axe e dispositivos reais
  ainda precisam ser executados.

## Licença e conteúdo

Partituras, letras e gravações devem ter direitos autorais autorizados pelo coral. O regente é
responsável pelo conteúdo que envia.
