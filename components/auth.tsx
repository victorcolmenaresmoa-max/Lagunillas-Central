'use client';

import { forwardRef, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Eye, EyeOff, Check, AlertCircle, ShoppingBag, ChevronRight } from 'lucide-react';
import Landscape from './Landscape';
import { LogoMark } from './Logo';
import { cn } from '@/lib/utils';

/* ================================================================
   Marco de las pantallas de acceso
   ================================================================ */
export function AuthShell({
  tab,
  title,
  subtitle,
  children,
  onBack,
  backHref = '/',
  showTabs = true,
  footer,
}: {
  tab?: 'entrar' | 'registro';
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  onBack?: () => void;
  backHref?: string;
  showTabs?: boolean;
  footer?: ReactNode;
}) {
  const backCls =
    'inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white ring-1 ring-white/40 backdrop-blur-md transition active:scale-90';
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <div className="relative h-[190px] overflow-hidden bg-[#5b9fd8]">
        <Landscape className="absolute inset-x-0 bottom-0 !h-[170px]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-cal-100" />
        <div className="pt-safe-top relative flex items-center justify-between px-5">
          {onBack ? (
            <button onClick={onBack} className={backCls} aria-label="Volver">
              <ArrowLeft size={20} />
            </button>
          ) : (
            <Link href={backHref} className={backCls} aria-label="Volver">
              <ArrowLeft size={20} />
            </Link>
          )}
          <Link href="/" className="flex items-center gap-2 rounded-2xl bg-white/25 py-1.5 pl-1.5 pr-3 ring-1 ring-white/40 backdrop-blur-md">
            <LogoMark className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-bold text-white">Lagunillas Central</span>
          </Link>
        </div>
      </div>

      <div className={cn('relative px-5', showTabs && tab ? '-mt-16' : '-mt-2')}>
        {showTabs && tab && (
          <nav className="mb-5 grid animate-fade-up grid-cols-2 gap-1 rounded-2xl bg-cal-50/90 p-1 shadow-soft ring-1 ring-cal-200 backdrop-blur" aria-label="Acceso">
            {(
              [
                ['entrar', 'Iniciar sesión', '/entrar'],
                ['registro', 'Crear cuenta', '/registro'],
              ] as const
            ).map(([key, label, href]) => (
              <Link
                key={key}
                href={href}
                replace
                aria-current={tab === key ? 'page' : undefined}
                className={cn(
                  'rounded-xl py-2.5 text-center text-sm font-bold transition',
                  tab === key ? 'bg-laguna-600 text-white shadow-jade' : 'text-tinta-500 hover:text-tinta-900'
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        )}

        <div className="animate-fade-up" style={{ animationDelay: '60ms' }}>
          <h1 className="heading text-[30px] leading-[1.1]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[15px] leading-relaxed text-tinta-500">{subtitle}</p>}
        </div>

        <div className="mt-5 animate-fade-up" style={{ animationDelay: '120ms' }}>
          {children}
        </div>

        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </main>
  );
}

/** Recordatorio: para pedir no hace falta cuenta */
export function NoAccountNeeded() {
  return (
    <Link href="/" className="flex items-center gap-3 rounded-2xl border border-dashed border-cal-300 p-3.5 text-sm transition active:scale-[0.98]">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ocre-100 text-ocre-600">
        <ShoppingBag size={18} />
      </span>
      <span className="flex-1 text-tinta-600">
        <b className="text-tinta-900">¿Solo quieres pedir?</b> No necesitas cuenta. Ve directo a los comercios.
      </span>
      <ChevronRight size={18} className="text-tinta-400" />
    </Link>
  );
}

/** Separador con texto: "¿No tienes cuenta?" */
export function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="my-6 flex items-center gap-3 text-sm font-semibold text-tinta-500">
      <span className="h-px flex-1 bg-cal-300" />
      {children}
      <span className="h-px flex-1 bg-cal-300" />
    </div>
  );
}

/* ================================================================
   Campos
   ================================================================ */
type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: any;
  error?: string | null;
  hint?: ReactNode;
  right?: ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, InputProps>(function TextField(
  { label, icon: Icon, error, hint, right, className, id, ...rest },
  ref
) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div>
      <div className="mb-1.5 flex items-end justify-between">
        <label htmlFor={fieldId} className="text-xs font-bold uppercase tracking-wider text-tinta-500">
          {label}
        </label>
        {right}
      </div>
      <div className="relative">
        {Icon && <Icon size={18} className={cn('pointer-events-none absolute left-4 top-1/2 -translate-y-1/2', error ? 'text-teja-500' : 'text-tinta-400')} />}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${fieldId}-err` : undefined}
          className={cn('input h-[52px]', Icon && 'pl-11', error && 'border-teja-400 focus:border-teja-400 focus:ring-teja-400/15', className)}
          {...rest}
        />
      </div>
      {error ? (
        <p id={`${fieldId}-err`} className="mt-1.5 flex items-start gap-1.5 text-[13px] font-medium text-teja-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-tinta-400">{hint}</div>
      ) : null}
    </div>
  );
});

export const PasswordField = forwardRef<HTMLInputElement, InputProps & { showRules?: boolean }>(function PasswordField(
  { showRules, value, className, ...rest },
  ref
) {
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const v = String(value ?? '');
  return (
    <div>
      <div className="relative">
        <TextField
          ref={ref}
          type={show ? 'text' : 'password'}
          value={value}
          className={cn('pr-12', className)}
          onKeyUp={(e) => setCaps(e.getModifierState?.('CapsLock') ?? false)}
          // Al tocar el ojito el campo pasa a texto normal: sin esto el teclado del
          // teléfono pone la primera letra en mayúscula o "corrige" la contraseña.
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-1.5 top-[28px] flex h-10 w-10 items-center justify-center rounded-xl text-tinta-400 hover:bg-cal-100 hover:text-tinta-700"
          aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          {show ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
      {caps && <p className="mt-1.5 text-xs font-semibold text-ocre-600">Mayúsculas activadas</p>}
      {showRules && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {[
            ['Mínimo 8 caracteres', v.length >= 8],
            ['Letras y números', /[a-zA-Z]/.test(v) && /\d/.test(v)],
            ...(v !== v.trim() ? ([['Sin espacios al inicio ni al final', false]] as const) : []),
          ].map(([label, ok]) => (
            <li key={label as string} className={cn('flex items-center gap-1 font-medium transition', ok ? 'text-laguna-600' : 'text-tinta-400')}>
              <span className={cn('flex h-4 w-4 items-center justify-center rounded-full', ok ? 'bg-laguna-500 text-white' : 'bg-cal-300')}>
                {ok && <Check size={11} strokeWidth={3} />}
              </span>
              {label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

export const passwordOk = (v: string) => v === v.trim() && v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v);

/* ================================================================
   Código de verificación (6–8 dígitos)
   ================================================================ */
export function CodeInput({
  value,
  onChange,
  onComplete,
  error,
  disabled,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: string | null;
  disabled?: boolean;
  length?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const boxes = Array.from({ length }, (_, i) => value[i] ?? '');
  return (
    <div>
      <label className="relative block cursor-text" onClick={() => ref.current?.focus()}>
        <span className="sr-only">Código de verificación</span>
        <input
          ref={ref}
          value={value}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 8);
            onChange(v);
            if (v.length >= length) onComplete?.(v);
          }}
          className="absolute inset-0 h-full w-full opacity-0"
          aria-invalid={Boolean(error)}
        />
        <div className="flex justify-between gap-2" aria-hidden>
          {boxes.map((d, i) => (
            <span
              key={i}
              className={cn(
                'flex h-14 flex-1 items-center justify-center rounded-2xl border-2 bg-white text-2xl font-extrabold tabular-nums text-tinta-900 transition',
                error ? 'border-teja-400' : i === value.length && !disabled ? 'border-laguna-500 ring-4 ring-laguna-400/15' : d ? 'border-laguna-300' : 'border-cal-300'
              )}
            >
              {d}
            </span>
          ))}
        </div>
      </label>
      {error && (
        <p className="mt-2 flex items-start gap-1.5 text-[13px] font-medium text-teja-600">
          <AlertCircle size={14} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

/** Botón "Reenviar" con cuenta regresiva */
export function ResendButton({ onResend, seconds = 60 }: { onResend: () => Promise<void>; seconds?: number }) {
  const [left, setLeft] = useState(seconds);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);
  return (
    <button
      type="button"
      disabled={left > 0 || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onResend();
          setLeft(seconds);
        } finally {
          setBusy(false);
        }
      }}
      className="text-sm font-bold text-laguna-600 disabled:font-medium disabled:text-tinta-400"
    >
      {busy ? 'Enviando…' : left > 0 ? `Reenviar código en ${left} s` : 'Reenviar código'}
    </button>
  );
}

/* ================================================================
   Aviso general del formulario
   ================================================================ */
export function FormAlert({ kind = 'error', children }: { kind?: 'error' | 'ok' | 'info'; children: ReactNode }) {
  const cls = {
    error: 'border-teja-400/40 bg-teja-100 text-teja-600',
    ok: 'border-laguna-400/40 bg-laguna-100 text-laguna-700',
    info: 'border-cielo-400/40 bg-cielo-100 text-cielo-600',
  }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-2xl border p-3 text-sm', cls)}>
      {kind === 'ok' ? <Check size={16} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} className="mt-0.5 shrink-0" />}
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ================================================================
   Sugerencia de correo mal escrito (gmial.com → gmail.com)
   ================================================================ */
const DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'yahoo.es', 'hotmail.es'];

function distance(a: string, b: string) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

export function emailSuggestion(email: string): string | null {
  const [user, domain] = email.trim().toLowerCase().split('@');
  if (!user || !domain || DOMAINS.includes(domain)) return null;
  const best = DOMAINS.map((d) => [d, distance(domain, d)] as const).sort((a, b) => a[1] - b[1])[0];
  return best && best[1] > 0 && best[1] <= 2 ? `${user}@${best[0]}` : null;
}

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
