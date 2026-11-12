import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Heart, ShieldCheck, TriangleAlert } from 'lucide-react';
import { PIX_CITY, PIX_PAYLOAD, PIX_RECEIVER } from '../lib/branding';
import { isValidPixPayload } from '../lib/pix';
import { Button, Modal } from './ui';
import { useToast } from '../context/ToastContext';

export function PixButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const { notify } = useToast();
  const valid = isValidPixPayload(PIX_PAYLOAD);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void QRCode.toDataURL(PIX_PAYLOAD, {
      width: 520,
      margin: 1,
      color: { dark: '#0b1020', light: '#ffffff' }
    })
      .then((url) => {
        if (active) setQr(url);
      })
      .catch(() => {
        if (active) setQr('');
      });
    return () => {
      active = false;
    };
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PIX_PAYLOAD);
      setCopied(true);
      notify('Código PIX copiado.', 'success');
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      notify('Não foi possível copiar. Selecione o código manualmente.', 'error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          compact
            ? 'flex items-center gap-2 rounded-full border border-rose-300/20 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-500/20'
            : 'flex w-full items-center justify-center gap-2 border-t border-white/5 bg-ink-950/90 px-4 py-2 text-xs font-medium text-rose-200/90 backdrop-blur transition hover:bg-ink-900 hover:text-rose-100'
        }
      >
        <Heart className="h-4 w-4" aria-hidden />
        Ajude o desenvolvedor
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Ajude o desenvolvedor">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-300">
            Este app é gratuito e feito para o seu coral. Se ele ajudou nos ensaios, você pode
            apoiar o desenvolvimento com um PIX voluntário. Não é cobrança do coral e não há
            verificação automática de pagamento.
          </p>

          <div className="rounded-2xl border border-white/10 bg-white p-3">
            {qr ? (
              <img
                src={qr}
                alt={`QR Code PIX para ${PIX_RECEIVER}`}
                className="mx-auto h-auto w-full max-w-[260px] rounded-xl"
              />
            ) : (
              <div className="flex h-52 items-center justify-center text-sm text-slate-500">
                Gerando QR Code…
              </div>
            )}
          </div>

          <div className="space-y-1 text-sm">
            <p className="font-medium text-white">{PIX_RECEIVER}</p>
            <p className="text-slate-400">{PIX_CITY}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-ink-900 p-3">
            <p className="break-all font-mono text-[11px] leading-relaxed text-slate-400">
              {PIX_PAYLOAD}
            </p>
          </div>

          <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
            {valid ? (
              <>
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-400" aria-hidden />
                <span>
                  Estrutura e CRC16 do código PIX conferidos. A confirmação final do pagamento deve
                  ser feita no aplicativo do seu banco.
                </span>
              </>
            ) : (
              <>
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
                <span>
                  O código PIX precisa ser conferido no aplicativo do banco antes de qualquer
                  doação.
                </span>
              </>
            )}
          </div>

          <Button onClick={copy} className="w-full">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? 'Copiado' : 'Copiar código PIX'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
