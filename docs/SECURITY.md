# Segurança e privacidade

## Ativos

- Identidade Google, nome, e-mail e naipe dos membros.
- Gravações de voz enviadas ao chat e metadados de presença.
- Stems, partituras e avisos do coral.
- Credenciais de provisionamento (fora do repositório).
- Integridade do papel de regente e do conteúdo do mural.

## Fronteiras de confiança

- O navegador é não confiável. Toda autorização é validada por Security Rules e/ou Functions.
- O GitHub Pages serve arquivos públicos; não há segredo no bundle.
- Functions usam Admin SDK e ignoram regras: cada entrada é validada explicitamente.
- URLs assinadas são portadoras temporárias; não devem ser registradas em logs nem compartilhadas.

## Controles implementados

- Login Google com escopos mínimos; sem Drive/appDataFolder.
- Regente concedido por `REGENT_EMAILS` no servidor; cliente não altera `role`.
- Entrada por `CHOIR_INVITE_CODE` validado em Function.
- Firestore: leitura por membro; escrita de conteúdo por regente; voto apenas no próprio `uid`.
- Storage: leitura por membro; uploads do regente com limite; chat com 2 MB e `audio/*`.
- URLs de mídia assinadas por 15 minutos; verificação de sala para áudio de chat.
- App Check opcional com reCAPTCHA Enterprise.
- Firebase Web API key restrita por referrer (passo de console).
- Exclusão de conta remove membro, votos, mensagens e áudios do usuário.
- Overdub e afinador ficam no dispositivo.
- Chat com retenção de 90 dias (documentada; TTL automático ainda pendente de provisionamento).
- PIX estático com CRC16 conferido; sem confirmação automática de pagamento.

## Riscos residuais

- **Moderação:** não há análise automática de texto/áudio. Um membro pode enviar conteúdo
  impróprio; o regente precisa apagar e a política de convivência deve ser explícita.
- **Abuso de áudio:** limites de tamanho/duração reduzem, mas não impedem spam dentro do limite.
- **URL assinada:** quem obtiver o link dentro da validade consegue baixar o arquivo. Evite
  compartilhar e mantenha validade curta.
- **PDF:** arquivos podem conter conteúdo malicioso ou scripts no visualizador do navegador.
  Abra com cuidado e prefira o visualizador nativo. Uma CSP forte é limitada no GitHub Pages.
- **Dispositivo compartilhado:** o cache offline e a sessão podem ficar acessíveis a outra pessoa.
  Oriente logout e limpeza do cache em aparelhos compartilhados.
- **Menores:** o MVP é somente para maiores de 18 anos. Se isso mudar, consentimento de
  responsável, retenção e revisão jurídica são obrigatórios.
- **Direitos autorais:** o app não detecta violação; o regente declara ter autorização.
- **Sem garantia absoluta:** nenhum controle aqui elimina todos os riscos. Testes de regras,
  revisão de código e monitoramento são necessários antes de produção.

## LGPD (visão prática)

- Base legal e finalidade devem ser definidas pelo controlador (o coral).
- Dados coletados: identidade Google, e-mail, nome, naipe, mensagens, áudios e presença.
- Retenção: chat 90 dias; presença 12 meses; conta até exclusão. A rotina automática de TTL
  ainda precisa ser configurada no Firestore/Storage.
- Direitos: acesso, correção, exclusão e informação. Exclusão de conta está implementada;
  exportação ainda é manual.
- Áudio é dado pessoal; evite gravar terceiros sem consentimento.
- Não há Analytics de comportamento no MVP.
- Menores não são suportados sem fluxo específico de consentimento.

## Segredos e OAuth

- `REGENT_EMAILS` e `CHOIR_INVITE_CODE` ficam no Secret Manager via Firebase Functions.
- Service accounts nunca vão para o repositório; prefira Workload Identity Federation.
- Escopos OAuth: `openid`, `email`, `profile`.
- A API key Web é pública; restrinja por referrer e ative App Check.
- Revise acessos do GitHub Actions e use ambientes protegidos para `main`.

## Resposta a incidentes

1. Revogar/rotacionar `CHOIR_INVITE_CODE` e, se necessário, a lista de regentes.
2. Remover conteúdo e áudio; apagar URLs assinadas não é possível, então reduza a validade.
3. Revisar logs do Cloud Logging e acessos do Firebase.
4. Se houver exposição de dados pessoais, avaliar notificação conforme LGPD.
5. Corrigir regras, adicionar teste de regressão no Emulator Suite e republicar.

## O que ainda precisa ser verificado

- Testes automatizados das Security Rules no Emulator Suite.
- App Check em modo enforce e monitoramento de rejeições.
- CORS real do bucket e expiração de URLs.
- Orçamento e alertas de cobrança.
- Auditoria de acessibilidade e testes em dispositivos reais.
