# Arquitetura

## Divisão fundamental

```
Navegador
  ├─ PWA React/TS/Tailwind (GitHub Pages, estático)
  ├─ Web Audio/Tone.js + IndexedDB (áudio, cache offline)
  └─ SDK Firebase (Auth, Firestore offline, Storage)
        │
        ├─ Firebase Authentication (Google)
        ├─ Cloud Firestore (dados, offline-first, Security Rules)
        ├─ Cloud Storage (stems, PDFs, áudios de chat)
        └─ Cloud Functions 2ª geração (claims, convite, URL assinada, exclusão)
```

O GitHub Pages não executa backend. Toda confiança fica no Firebase/Google Cloud; o bundle
contém apenas identificadores públicos. Firebase Hosting não é usado em produção.

## Decisões

- **Híbrido enxuto:** BaaS para leitura/escrita em tempo real e offline; Functions apenas para
  operações que exigem Admin SDK ou segredo.
- **Autorização por documento de membro:** `choirs/{choirId}/members/{uid}` guarda `role` e
  `voicePart`. As regras leem esse documento; custom claims são um reforço, não a única fonte.
- **Regente por lista de e-mails:** `syncRegentRole` compara o e-mail autenticado com o segredo
  `REGENT_EMAILS` e grava o papel. O cliente não pode se promover.
- **Entrada por convite:** `joinChoir` valida `CHOIR_INVITE_CODE` e cria o membro.
- **Mídia privada:** leitura por URL assinada de 15 minutos emitida por `getMediaUrl`; o SDK do
  Storage é fallback apenas se a Function não estiver disponível.
- **Sem Analytics de comportamento:** logs e erros no servidor, sem perfil de uso.

## Modelo de dados

```
choirs/{choirId}
  members/{uid}            name, email, role, voicePart, createdAt, updatedAt
  notices/{id}             title, body, authorName, pinned
  tracks/{id}              title, composer, bpm, lyrics, parts{soprano..baixo}
  scores/{id}              title, pdfPath
  warmups/{id}             title, description, category, audioPath
  polls/{id}               title, eventDate, authorName
    votes/{uid}            value(sim|nao|talvez), name, updatedAt
  rooms/{room}/messages/{id}  room, text|audioPath, audioDuration, authorId, authorName
```

`room` é `geral` ou um dos quatro naipes. Coralista lê/escreve `geral` e o próprio naipe; regente
acessa todas.

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

## Offline e PWA

- Workbox pré-cacheia o shell; o Firestore usa cache persistente com múltiplas abas.
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

- **Sem rede:** leitura do cache do Firestore e faixas baixadas; escritas ficam em fila.
- **Storage indisponível:** mensagens de texto continuam; áudio falha com aviso.
- **Function indisponível:** login ainda funciona; onboarding e URLs assinadas podem falhar.
- **Regra mal configurada:** nega acesso em vez de expor dados, mas pode bloquear o coral.
- **PDF pesado:** abre em modal/aba separada; não é sincronizado com o áudio.

## Custos

O consumo cresce com horas de áudio armazenadas, downloads e invocações. Functions e Storage
exigem Blaze; Firestore tem cota gratuita. Defina orçamento e alertas, e monitore egress de áudio,
que tende a ser o maior custo em corais grandes.

## Evolução sugerida

1. Testes de regras no Emulator Suite e testes E2E no navegador.
2. Moderação/limite de mensagens e denúncia de áudio.
3. Variantes de BPM pré-geradas para qualidade.
4. Convites individuais com expiração e auditoria de ações do regente.
5. Exportação LGPD e retenção automatizada com TTL.
6. Empacotamento Tauri opcional, com assinatura de código, se houver requisito de `.exe`.
