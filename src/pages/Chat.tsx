import { useEffect, useMemo, useRef, useState } from 'react';
import { Lock, MessageCircle, Send, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { addDocument, paths, watchCollection, type WithId } from '../lib/store';
import { CHOIR_ID, LIMITS, RETENTION_DAYS } from '../lib/branding';
import { uploadFile } from '../lib/media';
import type { Message, Room } from '../types';
import { ROOMS, ROOM_LABEL } from '../types';
import { cn, formatDateTime, newId } from '../lib/utils';
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, TextArea } from '../components/ui';
import { AudioRecorder } from '../components/AudioRecorder';
import { MessageAudio } from '../components/MessageAudio';

export function Chat() {
  const { member } = useAuth();
  const { notify } = useToast();
  const [room, setRoom] = useState<Room>('geral');
  const [messages, setMessages] = useState<WithId<Message>[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [audio, setAudio] = useState<{ blob: Blob; seconds: number } | null>(null);
  const [recorderKey, setRecorderKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const allowedRooms = useMemo(() => {
    if (member?.role === 'regente') return ROOMS;
    return ROOMS.filter((item) => item === 'geral' || item === member?.voicePart);
  }, [member?.role, member?.voicePart]);

  useEffect(() => {
    if (!allowedRooms.includes(room)) setRoom('geral');
  }, [allowedRooms, room]);

  useEffect(() => {
    return watchCollection<Message>(paths.room(room), setMessages);
  }, [room]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  if (!member) return null;

  const sendText = async () => {
    const clean = text.trim();
    if (!clean) return;
    setSending(true);
    try {
      await addDocument<Omit<Message, 'id'>>(paths.room(room), {
        room,
        text: clean.slice(0, LIMITS.messageChars),
        authorId: member.id,
        authorName: member.name
      });
      setText('');
    } catch {
      notify('Não foi possível enviar a mensagem.', 'error');
    } finally {
      setSending(false);
    }
  };

  const sendAudio = async () => {
    if (!audio) return;
    setSending(true);
    try {
      const extension = audio.blob.type.includes('mp4') ? 'm4a' : 'webm';
      const storagePath = `choirs/${CHOIR_ID}/chat/${room}/${member.id}-${newId()}.${extension}`;
      const uploadedPath = await uploadFile(storagePath, audio.blob);
      await addDocument<Omit<Message, 'id'>>(paths.room(room), {
        room,
        audioPath: uploadedPath,
        audioDuration: audio.seconds,
        authorId: member.id,
        authorName: member.name
      });
      setAudio(null);
      setRecorderKey((key) => key + 1);
      notify('Áudio enviado.', 'success');
    } catch {
      notify('Não foi possível enviar o áudio.', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-brand-300">Comunicação</p>
        <h1 className="mt-1 text-2xl font-bold text-white">Chat por naipe</h1>
        <p className="mt-1 text-xs text-slate-500">
          Salas separadas para o coral. Áudios expiram em {RETENTION_DAYS.chat} dias e o acesso é
          validado no servidor.
        </p>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Salas do chat">
        {ROOMS.map((item) => {
          const allowed = allowedRooms.includes(item);
          return (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={room === item}
              disabled={!allowed}
              onClick={() => {
                if (allowed) setRoom(item);
              }}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-medium transition',
                room === item
                  ? 'border-brand-400/50 bg-brand-500/15 text-brand-100'
                  : allowed
                    ? 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20'
                    : 'cursor-not-allowed border-white/5 bg-white/[0.01] text-slate-700'
              )}
            >
              {!allowed ? <Lock className="h-3 w-3" aria-hidden /> : <Users className="h-3 w-3" aria-hidden />}
              {ROOM_LABEL[item]}
            </button>
          );
        })}
      </div>

      <Card className="flex min-h-[55vh] flex-col p-0">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-white">Sala {ROOM_LABEL[room]}</p>
            <p className="text-[11px] text-slate-500">
              {member.role === 'regente'
                ? 'Regente: acesso a todas as salas'
                : `Acesso liberado para ${ROOM_LABEL[room]}`}
            </p>
          </div>
          <Badge tone="brand">{messages.length} mensagens</Badge>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
          {messages.length === 0 ? (
            <EmptyState
              title="Nenhuma mensagem nesta sala"
              description="Comece com uma dúvida curta ou envie um áudio de até 60 segundos."
            />
          ) : (
            messages.map((message) => {
              const own = message.authorId === member.id;
              return (
                <div
                  key={message.id}
                  className={cn('flex', own ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] space-y-1.5 rounded-2xl border px-3 py-2 sm:max-w-[70%]',
                      own
                        ? 'border-brand-400/30 bg-brand-500/15'
                        : 'border-white/10 bg-white/[0.04]'
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold text-slate-300">
                        {own ? 'Você' : message.authorName}
                      </p>
                      <p className="text-[10px] text-slate-500">{formatDateTime(message.createdAt)}</p>
                    </div>
                    {message.text ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">
                        {message.text}
                      </p>
                    ) : null}
                    {message.audioPath ? (
                      <div className="pt-1">
                        <MessageAudio path={message.audioPath} />
                        {message.audioDuration ? (
                          <p className="mt-0.5 text-[10px] text-slate-500">
                            Áudio de {Math.round(message.audioDuration)}s
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-end gap-2">
            <TextArea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void sendText();
                }
              }}
              placeholder={`Mensagem para ${ROOM_LABEL[room]}…`}
              maxLength={LIMITS.messageChars}
              className="min-h-12 flex-1"
              aria-label="Mensagem de texto"
            />
            <Button
              onClick={() => void sendText()}
              loading={sending && !audio}
              disabled={!text.trim() || sending}
              aria-label="Enviar mensagem"
              className="h-12 w-12 shrink-0 px-0"
            >
              <Send className="h-4 w-4" aria-hidden />
            </Button>
          </div>

          <div className="mt-2">
            <AudioRecorder
              key={recorderKey}
              maxSeconds={LIMITS.chatAudioSeconds}
              onRecorded={(blob, seconds) => setAudio({ blob, seconds })}
              onClear={() => setAudio(null)}
              label="Gravar dúvida em áudio"
            />
            {audio ? (
              <Button
                className="mt-2 w-full"
                onClick={() => void sendAudio()}
                loading={sending}
              >
                <Send className="h-4 w-4" aria-hidden />
                Enviar áudio de {Math.round(audio.seconds)}s
              </Button>
            ) : null}
          </div>

          <p className="mt-2 flex items-center gap-1 text-[10px] text-slate-600">
            <MessageCircle className="h-3 w-3" aria-hidden />
            Se estiver offline, a mensagem não é enviada. Conecte-se e tente novamente.
          </p>
        </div>
      </Card>

      {sending ? <Spinner label="Enviando" /> : null}
    </div>
  );
}
