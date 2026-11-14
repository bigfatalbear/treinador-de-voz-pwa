# Critérios de aceite

Status após a migração para Supabase. “Pendente” depende de teste em ambiente real ou de uma
decisão futura; não deve ser lido como concluído.

| Área | Critério | Status |
|---|---|---|
| Build | `npm run typecheck`, `npm test` e `npm run build` passam | Verificado localmente |
| Backend | Migration, bucket, policies e Edge Function aplicados | Verificado no projeto Supabase |
| Auth | Cadastro, login e recuperação de senha por e-mail; Google opcional | Fluxo de recuperação verificado na UI local; entrega do link a validar no e-mail real |
| Convite | Código correto entra; código errado é rejeitado | Verificado por smoke test e UI |
| Papéis | Regente por lista de e-mails; cliente não se promove | Verificado por smoke test |
| Papéis | Regente promove/rebaixa membro; lista e papel mudam juntos; último regente protegido | Verificado por smoke SQL transacional e UI |
| Vídeos | Regente publica link do YouTube; membro lê e player abre sob demanda | Verificado na UI e no deploy (run 43130276336) |
| RLS | Coralista lê conteúdo, não cria aviso e não altera `role` | Verificado por smoke test |
| Chat | Salas geral + 4 naipes; coralista restrito ao próprio naipe | Verificado por smoke test |
| Presença | Voto único por membro, alterável | RLS verificada; fluxo de UI a validar |
| Storage | Regente envia faixa; coralista não envia faixa; chat do próprio naipe | Verificado por smoke test |
| Mídia | URL assinada para membro e expiração curta | Verificado por smoke test |
| Exclusão | Edge Function remove conta, membro e áudios | Verificado por smoke test |
| PWA | Manifest, service worker e instalação no Edge/Chrome | Implementado; instalação a validar |
| Offline | Shell abre sem rede e faixas baixadas tocam | Implementado; teste em dispositivo pendente |
| Mixer | Volume independente de 4 naipes + playback | Implementado no modo demo |
| BPM | Slider 50–150 sem mudança de tom | Implementado com Tone.js; qualidade a validar |
| Loop A-B | Marcar A/B, ativar e repetir | Implementado |
| Letra | LRC sincronizado, clique para buscar | Implementado e testado unitariamente |
| Partitura | PDF privado para consulta | Implementado; fluxo de upload a validar |
| Afinador | Microfone, nota e cents em tempo real | Implementado; requer HTTPS e permissão |
| Overdub | Gravar junto, ouvir e baixar | Implementado; latência a validar |
| Mural | Avisos fixos, criação/exclusão pelo regente | RLS verificada; UI a validar |
| Regente | Upload de stems, PDF, aquecimento, avisos e enquetes | Fluxo implementado; teste completo pendente |
| Privacidade | Sem Analytics; retenção documentada; exclusão de conta | Implementado; limpeza automática pendente |
| PIX | Botão visível, QR, copia-e-cola e CRC16 | Implementado; teste no app do banco pendente |
| Acessibilidade | Teclado, rótulos, contraste, alvos de toque | Revisão manual; axe/Lighthouse pendentes |
| GitHub Pages | Deploy por Actions com backend Supabase | Publicado e verificado (run 43130276336) |

## Critérios que exigem decisão futura

- `.exe` real com assinatura e auto-update: não faz parte deste MVP.
- Variantes de BPM pré-geradas no servidor: não fazem parte deste MVP.
- Moderação automática de chat: não implementada.
- Exportação LGPD: manual.
- Múltiplos corais: modelo preparado por `choir_id`, interface de um coral.
- Google OAuth: opcional; requer client OAuth e ativação do provedor.
- Limpeza automática de mensagens após 90 dias: `expires_at` existe, job não agendado.
