# Critérios de aceite

Status após a implementação local. “Pendente” depende de provisionamento Google ou de teste em
ambiente real; não deve ser lido como concluído.

| Área | Critério | Status |
|---|---|---|
| Build | `npm run typecheck`, `npm test` e `npm run build` passam | Verificado localmente |
| PWA | Manifest, service worker e instalação no Edge/Chrome | Implementado; teste de instalação pendente |
| Offline | Shell abre sem rede e faixas baixadas tocam | Implementado; teste em dispositivo pendente |
| Mixer | Volume independente de 4 naipes + playback | Implementado no modo demo |
| BPM | Slider 50–150 sem mudança de tom | Implementado com Tone.js; qualidade a validar |
| Loop A-B | Marcar A/B, ativar e repetir | Implementado |
| Letra | LRC sincronizado, clique para buscar | Implementado e testado unitariamente |
| Partitura | PDF privado para consulta | Implementado; CORS/Storage pendentes |
| Afinador | Microfone, nota e cents em tempo real | Implementado; requer HTTPS e permissão |
| Overdub | Gravar junto, ouvir e baixar | Implementado; latência a validar |
| Auth | Google + onboarding por convite | Implementado; Firebase pendente |
| Papéis | Regente por lista de e-mails; cliente não se promove | Implementado nas Functions/regras; testar no emulador |
| Chat | Salas geral + 4 naipes, texto e áudio ≤60 s | Implementado; regras a testar |
| Mural | Avisos fixos, criação/exclusão pelo regente | Implementado |
| Presença | Voto único por membro, alterável | Implementado; regras a testar |
| Regente | Upload de stems, PDF, aquecimento, avisos e enquetes | Implementado |
| Offline cache | Download explícito e limpeza | Implementado |
| Privacidade | Sem Analytics; retenção documentada; exclusão de conta | Implementado; TTL/rotina pendente |
| PIX | Botão visível, QR, copia-e-cola e CRC16 | Implementado; teste no app do banco pendente |
| Segurança | Sem segredos no bundle/repo; URLs assinadas; App Check opcional | Implementado; App Check pendente |
| Acessibilidade | Teclado, rótulos, contraste, alvos de toque | Revisão manual; axe/Lighthouse pendentes |
| Windows | Atalho instalado da PWA | Depende do navegador do usuário |
| GitHub Pages | Deploy por Actions e URL pública | Ativar Pages e confirmar URL |

## Critérios que exigem decisão futura

- `.exe` real com assinatura e auto-update: não faz parte deste MVP.
- Variantes de BPM pré-geradas no servidor: não fazem parte deste MVP.
- Moderação automática de chat: não implementada.
- Exportação LGPD: manual.
- Múltiplos corais: modelo preparado por `choirId`, interface de um coral.
