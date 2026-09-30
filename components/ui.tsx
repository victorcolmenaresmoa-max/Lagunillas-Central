'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Camera, Check, AlertTriangle, Loader2, X, ImagePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------------- Campo de formulario ---------------- */
export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-tinta-400">{hint}</p>}
    </div>
  );
}

/* ---------------- Interruptor ---------------- */
export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-laguna-500' : 'bg-cal-300')}
    >
      <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-6' : 'left-1')} />
    </button>
  );
}

/* ---------------- Hoja inferior (modal móvil) ---------------- */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-tinta-900/40 backdrop-blur-sm" />
      <div className="pb-safe relative max-h-[92dvh] w-full max-w-md animate-slide-up overflow-y-auto rounded-t-[32px] bg-cal-50 px-5 pt-3 shadow-lift">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-cal-300" />
        <div className="mb-4 flex items-center justify-between">
          <h3 className="heading text-2xl">{title}</h3>
          <button onClick={onClose} className="rounded-full p-2 text-tinta-500 hover:bg-cal-200" aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- Avisos flotantes ---------------- */
export function useToast() {
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const notify = useCallback((msg: string, kind: 'ok' | 'err' = 'ok') => {
    clearTimeout(timer.current);
    setToast({ msg, kind });
    timer.current = setTimeout(() => setToast(null), kind === 'err' ? 4200 : 2600);
  }, []);
  const node = toast ? (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] mx-auto flex max-w-md justify-center px-4" role="status">
      <div
        className={cn(
          'flex animate-fade-up items-start gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lift',
          toast.kind === 'ok' ? 'bg-laguna-600 text-white' : 'bg-teja-500 text-white'
        )}
      >
        {toast.kind === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0" />}
        {toast.msg}
      </div>
    </div>
  ) : null;
  return { notify, toastNode: node };
}

/* ---------------- Pantalla de carga ---------------- */
export function FullLoader() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <Loader2 className="animate-spin text-laguna-500" size={32} />
    </main>
  );
}

/* ---------------- Estado vacío ---------------- */
export function Empty({ icon: Icon, title, text, children }: { icon: any; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-10 text-center">
      <Icon size={34} className="text-tinta-400" />
      <p className="mt-3 font-semibold text-tinta-900">{title}</p>
      {text && <p className="mt-1 text-sm text-tinta-500">{text}</p>}
      {children}
    </div>
  );
}

/* ---------------- Selector de foto (sube a Supabase) ---------------- */
export function PhotoPicker({
  value,
  onPick,
  onRemove,
  shape = 'square',
  label = 'Subir foto',
  disabled,
  locked,
}: {
  value: string | null;
  onPick: (file: File) => Promise<void>;
  onRemove?: () => Promise<void> | void;
  shape?: 'square' | 'wide' | 'round';
  label?: string;
  disabled?: boolean;
  /** muestra un candado con este texto en lugar de permitir subir */
  locked?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const box =
    shape === 'wide' ? 'aspect-[16/7] w-full rounded-3xl' : shape === 'round' ? 'h-24 w-24 rounded-full' : 'h-24 w-24 rounded-3xl';

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    try {
      await onPick(f);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className={cn('flex items-center gap-3', shape === 'wide' && 'flex-col items-stretch')}>
      <button
        type="button"
        disabled={disabled || busy || Boolean(locked)}
        onClick={() => input.current?.click()}
        className={cn(
          box,
          'relative flex shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-cal-300 bg-cal-100 text-tinta-400 transition active:scale-[0.98] disabled:active:scale-100',
          value && 'border-solid border-transparent'
        )}
        aria-label={label}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-xs font-semibold">
            <ImagePlus size={22} />
            {shape === 'wide' ? label : null}
          </span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-cal-50/70">
            <Loader2 className="animate-spin text-laguna-600" />
          </span>
        )}
        {value && !busy && !locked && (
          <span className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-tinta-900/60 text-white">
            <Camera size={15} />
          </span>
        )}
        {locked && (
          <span className="absolute inset-0 flex items-center justify-center bg-cal-100/85 px-3 text-center text-xs font-semibold text-tinta-500">
            🔒 {locked}
          </span>
        )}
      </button>
      {shape !== 'wide' && (
        <div className="flex flex-col gap-1.5">
          <button type="button" disabled={disabled || busy || Boolean(locked)} onClick={() => input.current?.click()} className="btn-ghost py-2 text-xs">
            <Camera size={14} /> {value ? 'Cambiar' : label}
          </button>
          {value && onRemove && (
            <button type="button" disabled={busy} onClick={() => onRemove()} className="text-left text-xs font-semibold text-teja-500">
              <Trash2 size={12} className="mr-1 inline" /> Quitar
            </button>
          )}
        </div>
      )}
      {shape === 'wide' && value && onRemove && !locked && (
        <button type="button" disabled={busy} onClick={() => onRemove()} className="self-start text-xs font-semibold text-teja-500">
          <Trash2 size={12} className="mr-1 inline" /> Quitar portada
        </button>
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

/* ---------------- Barra de navegación inferior ---------------- */
export function BottomNav<T extends string>({
  items,
  active,
  onChange,
  badges,
}: {
  items: readonly (readonly [T, string, any])[];
  active: T;
  onChange: (t: T) => void;
  badges?: Partial<Record<T, number>>;
}) {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3">
      <div className="glass grid gap-1 rounded-3xl p-1.5 shadow-lift" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(([key, label, Icon]) => {
          const on = active === key;
          const badge = badges?.[key];
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={cn(
                'relative flex flex-col items-center gap-1 rounded-2xl py-2 text-[10.5px] font-semibold transition active:scale-95',
                on ? 'bg-laguna-600 text-white shadow-jade' : 'text-tinta-500'
              )}
            >
              <Icon size={19} strokeWidth={2.3} />
              {label}
              {badge ? (
                <span className="absolute right-2 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-teja-500 px-1 text-[10px] font-black text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* ---------------- Etiqueta de estado de aprobación ---------------- */
export function ApprovalPill({ status }: { status: 'pending' | 'approved' | 'suspended' }) {
  const map = {
    pending: ['En revisión', 'bg-ocre-100 text-ocre-600'],
    approved: ['Aprobado', 'bg-laguna-100 text-laguna-700'],
    suspended: ['Suspendido', 'bg-teja-100 text-teja-600'],
  } as const;
  const [label, cls] = map[status];
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', cls)}>{label}</span>;
}
