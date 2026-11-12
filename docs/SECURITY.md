# Segurança e privacidade

## Ativos

- Identidade, nome, e-mail e naipe dos membros.
- Gravações de voz enviadas ao chat e metadados de presença.
- Stems, partituras e avisos do coral.
- Credenciais de provisionamento (fora do repositório).
- Integridade do papel de regente e do conteúdo do mural.

## Fronteiras de confiança

- O navegador é não confiável. Toda autorização é validada por RLS, privilégios de coluna e RPCs.
- O GitHub Pages serve arquivos públicos; apenas URL e chave publicável ficam no bundle.
- A Edge Function usa a service role e ignora RLS; cada entrada é validada explicitamente.
- URLs assinadas são portadoras temporárias; não devem ser registradas em logs nem compartilhadas.
- `public.app_secrets` não tem `select` para `anon`/`authenticated`; só funções `security definer`
  com `search_path` fixo leem os valores.

## Controles implementados

- Login por e-mail/senha; Google opcional com escopos mínimos.
- Regente concedido por `app_secrets.regent_emails` via `sync_regent_role`; o cliente não altera
  `role` (privilégio de coluna negado).
- `set_regent_role` é `security definer`, exige chamador regente, atualiza membro e
  `regent_emails` na mesma transação e impede remover o último regente.
- Entrada por `app_secrets.invite_code` validado em `join_choir`.
- RLS: leitura por membro; escrita de conteúdo e vídeos por regente; voto apenas no próprio
  `auth.uid()`.
- Storage privado: leitura por membro; upload de faixas/PDF/aquecimento só pelo regente; chat com
  prefixo do `uid`, `audio/*`, 2 MB e 60 s; stems até 25 MB; PDF até 10 MB.
- URLs de mídia assinadas por 15 minutos; verificação de sala para áudio de chat.
- Exclusão de conta remove áudios de chat, membro, votos, mensagens e `auth.users`.
- Overdub e afinador ficam no dispositivo.
- Chat com retenção documentada de 90 dias (`expires_at` filtrado na leitura; limpeza automática
  ainda não agendada).
- PIX estático com CRC16 conferido; sem confirmação automática de pagamento.
- `mailer_autoconfirm=true` no MVP reduz atrito, mas permite cadastro sem prova de posse do e-mail;
  o acesso ao coral continua exigindo o código de convite.

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
- **YouTube:** o player e as miniaturas são carregados de servidores do YouTube, que recebem IP e
  dados técnicos do navegador. Não há download offline nem controle sobre conteúdo de terceiros.
- **Plano free:** projeto pausado, cotas e egress podem indisponibilizar o coral; monitore o uso.
- **Sem garantia absoluta:** nenhum controle aqui elimina todos os riscos. Testes de RLS,
  revisão de código e monitoramento são necessários antes de produção.

## LGPD (visão prática)

- Base legal e finalidade devem ser definidas pelo controlador (o coral).
- Dados coletados: e-mail, nome, naipe, mensagens, áudios e presença.
- Retenção: chat 90 dias; presença 12 meses; conta até exclusão. A rotina automática de limpeza
  ainda precisa ser configurada no Postgres/Storage.
- Direitos: acesso, correção, exclusão e informação. Exclusão de conta está implementada;
  exportação ainda é manual.
- Áudio é dado pessoal; evite gravar terceiros sem consentimento.
- Não há Analytics de comportamento no MVP.
- Menores não são suportados sem fluxo específico de consentimento.

## Segredos e OAuth

- `regent_emails` e `invite_code` ficam em `public.app_secrets`, sem leitura pelo cliente.
- A service role e o token de administração nunca vão para o frontend, `.env.local` ou GitHub
  Actions.
- A chave publicável (`anon`) é pública; a segurança depende das policies.
- Escopos OAuth Google, se ativados: `openid`, `email`, `profile`.
- Revise acessos do GitHub Actions e use ambientes protegidos para `main`.
- Rotacione o token de administração Supabase se ele tiver sido exposto em chat/log.

## Resposta a incidentes

1. Revogar/rotacionar o `invite_code` e, se necessário, a lista de regentes.
2. Remover conteúdo e áudio; apagar URLs assinadas não é possível, então reduza a validade.
3. Revisar logs do Supabase (Auth, Postgres, Storage e Edge Functions).
4. Se houver exposição de dados pessoais, avaliar notificação conforme LGPD.
5. Corrigir policies, adicionar teste de regressão e republicar.

## O que ainda precisa ser verificado

- Testes automatizados de RLS/Storage no CI com usuários temporários.
- Rotina agendada de retenção (`pg_cron`) e exportação LGPD.
- Rate limiting e moderação de chat.
- Auditoria de acessibilidade e testes em dispositivos reais.
- Revisão de custos/cotas do plano free.
