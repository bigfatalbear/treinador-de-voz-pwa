# Arquitetura

## Divisão fundamental

```
Navegador
  ├─ PWA React/TS/Tailwind (GitHub Pages, estático)
  ├─ Web Audio/Tone.js + IndexedDB (áudio, cache offline)
  └─ SDK Supabase (Auth, Postgres, Storage, Realtime, Functions)
        │
        ├─ Supabase Auth (e-mail/senha; Google opcional)
        ├─ Postgres + RLS (membros, conteúdo, votos, chat)
        ├─ Storage privado (stems, PDFs, áudios de chat)
        └─ Edge Function (exclusão de conta)
```

O GitHub Pages não executa backend. Toda confiança fica no Supabase; o bundle contém apenas a URL
do projeto e a chave publicável (`anon`). Não há Firebase, Firestore ou Cloud Functions no fluxo
atual.

## Decisões

- **BaaS enxuto:** o Postgres/Realtime resolve dados e tempo real; a Edge Function existe apenas
  para operações que exigem a service role.
- **Autorização por linha de membro:** `public.members` guarda `role` e `voice_part`. As policies
  chamam `is_member`, `is_regent` e `can_use_room`; o cliente não pode inserir nem trocar o papel.
- **Regente por lista de e-mails:** `sync_regent_role` compara o e-mail do JWT com
  `app_secrets.regent_emails` e grava o papel. O cliente não se promove. A RPC `set_regent_role`
  permite que um regente promova/rebaixe outro membro, atualizando `members.role` e a lista de
  e-mails na mesma transação; o último regente não pode ser removido.
- **Entrada por convite:** `join_choir` valida `app_secrets.invite_code` e cria/atualiza o membro.
- **Mídia privada:** leitura por `createSignedUrl` de 15 minutos; o bucket `media` não é público.
- **Adaptador de dados:** `src/lib/store.ts` mantém a API antiga (`paths`, `watchCollection`,
  `addDocument`, etc.) e traduz caminhos para tabelas. Isso preservou as páginas durante a migração.
- **Demo local:** sem as variáveis Supabase, o mesmo adaptador usa `localStorage`; não é uma cópia
  das policies e não deve ser usado para validar segurança.
- **Sem Analytics de comportamento:** logs e erros ficam no Supabase; sem perfil de uso.

## Modelo de dados

```
auth.users
  └─ public.members          id, choir_id, name, email, role, voice_part
public.notices               title, body, author_name, pinned
public.tracks                title, composer, bpm, lyrics, demo, parts(jsonb)
public.scores                title, pdf_path
public.warmups               title, description, audio_path, category
public.videos                title, description, youtube_id, category, voice_part
public.polls                 title, event_date, author_name
public.poll_votes            poll_id, member_id, value, name, updated_at
public.messages              choir_id, room, text|audio_path, audio_duration,
                             author_id, author_name, expires_at
public.app_secrets           key, value (sem acesso pelo cliente)
```

`room` é `geral` ou um dos quatro naipes. Coralista lê/escreve `geral` e o próprio naipe; regente
acessa todas. `poll_votes` usa a chave composta `(poll_id, member_id)`.

## RLS e RPCs

- `members`: `select` do próprio membro ou de todos para o regente; `update` apenas de
  `name`, `voice_part` e `updated_at` via privilégios de coluna; sem `insert`/`delete` direto.
- `notices`, `tracks`, `scores`, `warmups`, `videos`, `polls`: leitura por membro, escrita pelo
  regente.
- `poll_votes`: voto/atualização apenas do próprio `auth.uid()`; regente pode remover.
- `messages`: leitura/escrita apenas nas salas permitidas; remoção pelo autor ou regente.
- `app_secrets`: `revoke all` para `anon`/`authenticated`; somente funções `security definer`.
- Storage: leitura por membro; faixas/PDF/aquecimento só pelo regente; chat com prefixo do `uid`,
  `audio/*` e limite de 2 MB.

## Áudio

- **Mixer:** cada stem vira um `Tone.GrainPlayer` ligado a um `Gain`; o playback geral é um Gain
  mestre.
- **BPM sem tom:** `GrainPlayer.playbackRate` faz time-stretch granular. O slider é relativo ao
  BPM de referência da faixa. A qualidade cai em mudanças grandes e depende da CPU do aparelho.
- **Loop A-B:** o player reinicia todos os stems no ponto A quando a posição cruza B. O reinício
  pode gerar um pequeno artefato; é o trade-off de uma implementação simples e previsível.
- **Demo:** quatro stems de acordes são sintetizados localmente, permitindo testar tudo sem upload.
- **Afinador:** `getUserMedia` + autocorrelação; o áudio não sai do dispositivo.
- **Overdub:** `MediaRecorder` grava a voz junto com a base; o blob fica local e pode ser baixado.
- **Offline:** stems baixados viram blobs no IndexedDB. O player prefere o cache antes da rede.

## Vídeos do YouTube

- O banco guarda apenas o ID de 11 caracteres, título, categoria, naipe opcional e orientações.
- A UI aceita `watch`, `youtu.be`, `shorts`, `embed`, `live` e IDs diretos.
- O player usa `youtube-nocookie.com` e só é criado quando o vídeo é aberto; a miniatura é
  carregada de `i.ytimg.com`.
- Vídeos não entram no cache offline. O restante do treino continua disponível sem rede.
- O YouTube é um terceiro: ao abrir o player/miniatura, o navegador faz requisições aos servidores
  dele. O coral deve usar links autorizados e adequados à política de privacidade.

## Offline e PWA

- Workbox pré-cacheia o shell; o app abre sem rede.
- Leitura de dados exige rede, exceto o membro em cache no `AuthContext` e faixas já baixadas.
- Escritas no Supabase não têm fila offline; a interface mostra erro e permite tentar novamente.
- O download explícito de faixas evita armazenar todo o acervo sem consentimento.
- Em iOS/Safari, o sistema pode remover caches sob pressão de armazenamento.
- O app usa `HashRouter` para não depender de fallback de servidor no GitHub Pages.
- O service worker tem escopo no subdiretório do repositório.

## Limitações do GitHub Pages

- Sem backend, sem redirects de servidor e sem cabeçalhos HTTP personalizados.
- CSP precisa ser via `<meta>` ou proxy externo; HSTS e headers de segurança ficam limitados.
- Repositório público no plano gratuito; Pages em repositório privado exige plano pago.
- Cache/CDN público para os arquivos estáticos: nunca colocar segredo no bundle.
- HTTPS é fornecido pelo Pages, requisito para microfone e PWA.

## Falhas e resiliência

- **Sem rede:** shell e faixas baixadas funcionam; dados novos não carregam.
- **Storage indisponível:** mensagens de texto continuam; áudio falha com aviso.
- **Edge Function indisponível:** login e dados continuam; exclusão de conta falha com aviso.
- **Policy mal configurada:** nega acesso em vez de expor dados, mas pode bloquear o coral.
- **PDF pesado:** abre em modal/aba separada; não é sincronizado com o áudio.
- **Projeto free pausado:** o app não autentica até o projeto ser reativado no painel.

## Custos

O plano free do Supabase cobre o MVP, mas tem cotas de banco, Storage, egress e invocações. O
consumo cresce com horas de áudio armazenadas e downloads. Monitore o uso de áudio, que tende a ser
o maior consumidor, e consulte os limites atuais antes de ampliar o coral.

## Evolução sugerida

1. Testes automatizados de RLS/Storage no CI com usuários temporários.
2. Moderação/limite de mensagens e denúncia de áudio.
3. Variantes de BPM pré-geradas para qualidade.
4. Convites individuais com expiração e auditoria de ações do regente.
5. Exportação LGPD e rotina agendada de retenção com `pg_cron`.
6. Empacotamento Tauri opcional, com assinatura de código, se houver requisito de `.exe`.
