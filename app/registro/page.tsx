'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Bike, Check, ChevronRight, Loader2, Lock, Mail, MapPin, Phone, Store, User } from 'lucide-react';
import { AuthShell, FormAlert, NoAccountNeeded, PasswordField, TextField, emailSuggestion, isEmail, passwordOk } from '@/components/auth';
import VerifyEmail from '@/components/VerifyEmail';
import { getBrowserClient } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';
import { isValidPhone, normalizePhone } from '@/lib/validate';
import { CATEGORIES, type Category, type Vehicle } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/categories';
import { VEHICLE_LABEL } from '@/lib/delivery';
import { cn } from '@/lib/utils';

type Tipo = 'comercio' | 'repartidor';
type Errors = Record<string, string | undefined>;

const TIPOS = {
  comercio: {
    icon: Store,
    title: 'Tengo un comercio',
    text: 'Muestra tus productos y recibe pedidos por WhatsApp.',
    perks: ['Gratis para empezar', 'Tu catálogo con fotos', 'Repartidores de la app'],
    tone: 'bg-teja-100 text-teja-600',
  },
  repartidor: {
    icon: Bike,
    title: 'Quiero ser repartidor',
    text: 'Recibe avisos de pedidos y gana por cada entrega.',
    perks: ['Tú eliges cuándo trabajar', 'Avisos al instante', 'Cobras cada entrega'],
    tone: 'bg-laguna-100 text-laguna-600',
  },
} as const;

function Registro() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('tipo');
  const [tipo, setTipo] = useState<Tipo | null>(initial === 'comercio' || initial === 'repartidor' ? initial : null);
  const [step, setStep] = useState<1 | 2>(1);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Negocio
  const [biz, setBiz] = useState({ name: '', category: 'Comida' as Category, whatsapp: '', address: '', opens: '08:00', closes: '20:00', description: '' });
  // Repartidor
  const [vehicle, setVehicle] = useState<Vehicle>('moto');
  const [plate, setPlate] = useState('');
  // Cuenta
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accept, setAccept] = useState(false);

  // Si ya tiene sesión, no tiene sentido registrarse de nuevo
  useEffect(() => {
    getBrowserClient()
      ?.auth.getSession()
      .then(({ data }) => data.session && router.replace('/entrar'));
  }, [router]);

  const clear = (k: string) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));
  const home = tipo === 'comercio' ? '/panel' : '/repartidor';

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Errors = {};
    if (tipo === 'comercio') {
      if (biz.name.trim().length < 2) errs.name = 'Escribe el nombre de tu negocio.';
      if (!isValidPhone(biz.whatsapp)) errs.whatsapp = 'Escribe un WhatsApp válido, por ejemplo 0414-1234567.';
      if (biz.address.trim().length < 5) errs.address = 'Escribe la dirección con un punto de referencia.';
    } else {
      if (fullName.trim().split(/\s+/).length < 2) errs.fullName = 'Escribe tu nombre y apellido.';
      if (!isValidPhone(phone)) errs.phone = 'Escribe un teléfono válido, por ejemplo 0414-1234567.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;
    if (tipo === 'comercio' && !phone) setPhone(biz.whatsapp);
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs: Errors = {};
    if (tipo === 'comercio') {
      if (fullName.trim().length < 3) errs.fullName = 'Escribe tu nombre.';
      if (!isValidPhone(phone)) errs.phone = 'Escribe un teléfono válido.';
    }
    if (!isEmail(email)) errs.email = 'Escribe un correo válido. Lo usarás para entrar.';
    if (!passwordOk(password)) errs.password = 'Usa al menos 8 caracteres, con letras y números, sin espacios al inicio ni al final.';
    if (!accept) errs.accept = 'Marca la casilla para continuar.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    const sb = getBrowserClient();
    if (!sb) return setFormError('La app aún no está conectada a la base de datos.');
    setLoading(true);
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${home}`,
        data: {
          signup_role: tipo === 'comercio' ? 'merchant' : 'delivery',
          full_name: fullName.trim(),
          phone: normalizePhone(phone),
          ...(tipo === 'comercio'
            ? {
                business: {
                  name: biz.name.trim(),
                  category: biz.category,
                  whatsapp_number: normalizePhone(biz.whatsapp),
                  address: biz.address.trim(),
                  opens_at: biz.opens,
                  closes_at: biz.closes,
                  description: biz.description.trim(),
                },
              }
            : { driver: { vehicle, plate: plate.trim().toUpperCase() } }),
        },
      },
    });
    setLoading(false);
    const exists = /already registered/i.test(error?.message ?? '') || (data?.user && data.user.identities?.length === 0);
    if (exists) return setErrors({ email: 'Ese correo ya tiene una cuenta.' });
    if (error) return setFormError(friendlyError(error));
    try {
      localStorage.setItem('lc-ultimo-correo', email.trim().toLowerCase());
    } catch {}
    if (data.session) {
      router.replace(home);
      return;
    }
    setVerifying(true);
  };

  /* ---------- Confirmar correo con código ---------- */
  if (verifying) {
    return (
      <AuthShell showTabs={false} title="Confirma tu correo" subtitle="Último paso para activar tu cuenta." onBack={() => setVerifying(false)}>
        <VerifyEmail email={email.trim().toLowerCase()} onVerified={() => router.replace(home)} onChangeEmail={() => setVerifying(false)} />
      </AuthShell>
    );
  }

  const loginLink = (
    <p className="mt-5 text-center text-sm text-tinta-500">
      ¿Ya tienes una cuenta?{' '}
      <Link href="/entrar" className="font-bold text-laguna-600">
        Inicia sesión
      </Link>
    </p>
  );

  /* ---------- Elegir tipo de cuenta ---------- */
  if (!tipo) {
    return (
      <AuthShell tab="registro" title="Crea tu cuenta" subtitle="¿Cómo quieres ser parte de Lagunillas Central?" footer={<NoAccountNeeded />}>
        <div className="space-y-3">
          {(Object.keys(TIPOS) as Tipo[]).map((key) => {
            const t = TIPOS[key];
            return (
              <button
                key={key}
                onClick={() => {
                  setTipo(key);
                  setStep(1);
                  setErrors({});
                }}
                className="card flex w-full items-start gap-4 p-4 text-left transition active:scale-[0.98]"
              >
                <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', t.tone)}>
                  <t.icon size={26} />
                </span>
                <span className="flex-1">
                  <span className="block font-bold text-tinta-900">{t.title}</span>
                  <span className="block text-sm text-tinta-500">{t.text}</span>
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {t.perks.map((p) => (
                      <span key={p} className="inline-flex items-center gap-1 rounded-full bg-cal-100 px-2 py-0.5 text-[11px] font-semibold text-tinta-600">
                        <Check size={11} className="text-laguna-600" /> {p}
                      </span>
                    ))}
                  </span>
                </span>
                <ChevronRight size={20} className="mt-4 text-tinta-400" />
              </button>
            );
          })}
        </div>
        {loginLink}
      </AuthShell>
    );
  }

  const t = TIPOS[tipo];
  const stepLabels = tipo === 'comercio' ? ['Tu negocio', 'Tu cuenta'] : ['Tus datos', 'Tu cuenta'];
  const suggestion = emailSuggestion(email);

  return (
    <AuthShell
      tab="registro"
      title={tipo === 'comercio' ? 'Registra tu comercio' : 'Sé repartidor'}
      subtitle={step === 1 ? (tipo === 'comercio' ? 'Cuéntanos de tu negocio. Podrás cambiarlo después.' : 'Así te conocerán los comercios y clientes.') : 'Con este correo y contraseña entrarás a tu panel.'}
      onBack={() => (step === 2 ? setStep(1) : (setTipo(null), setErrors({})))}
    >
      {/* Pasos */}
      <ol className="mb-4 grid grid-cols-2 gap-2">
        {stepLabels.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                  done ? 'bg-laguna-500 text-white' : current ? 'bg-laguna-600 text-white ring-4 ring-laguna-400/20' : 'bg-cal-300 text-tinta-500'
                )}
              >
                {done ? <Check size={14} strokeWidth={3} /> : n}
              </span>
              <span className={cn('text-sm font-semibold', current ? 'text-tinta-900' : 'text-tinta-400')}>{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 ? (
        <form onSubmit={nextStep} noValidate className="card space-y-4 rounded-[28px] p-5">
          <div className="flex items-center gap-3 rounded-2xl bg-cal-100 p-3">
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', t.tone)}>
              <t.icon size={19} />
            </span>
            <p className="flex-1 text-sm font-semibold text-tinta-700">{t.title}</p>
            <button type="button" onClick={() => setTipo(null)} className="text-xs font-bold text-laguna-600">
              Cambiar
            </button>
          </div>

          {tipo === 'comercio' ? (
            <>
              <TextField label="Nombre del negocio" icon={Store} value={biz.name} onChange={(e) => (setBiz({ ...biz, name: e.target.value }), clear('name'))} placeholder="Ej: Arepera El Páramo" maxLength={80} error={errors.name} />
              <div>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tinta-500">Categoría</span>
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = CATEGORY_STYLES[c].icon;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setBiz({ ...biz, category: c })}
                        aria-pressed={biz.category === c}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-semibold transition active:scale-95',
                          biz.category === c ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-500'
                        )}
                      >
                        <Icon size={17} />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <TextField label="WhatsApp del negocio" icon={Phone} inputMode="tel" autoComplete="tel" value={biz.whatsapp} onChange={(e) => (setBiz({ ...biz, whatsapp: e.target.value }), clear('whatsapp'))} placeholder="0414-1234567" error={errors.whatsapp} hint="Aquí te llegarán los pedidos de los clientes." />
              <TextField label="Dirección" icon={MapPin} value={biz.address} onChange={(e) => (setBiz({ ...biz, address: e.target.value }), clear('address'))} placeholder="Calle, sector y punto de referencia" maxLength={160} error={errors.address} />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Abre" type="time" value={biz.opens} onChange={(e) => setBiz({ ...biz, opens: e.target.value })} />
                <TextField label="Cierra" type="time" value={biz.closes} onChange={(e) => setBiz({ ...biz, closes: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tinta-500" htmlFor="desc">
                  Descripción <span className="font-medium normal-case tracking-normal text-tinta-400">(opcional)</span>
                </label>
                <textarea id="desc" className="input min-h-[80px] resize-none" value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} placeholder="¿Qué vendes? ¿Qué te hace especial?" maxLength={280} />
              </div>
            </>
          ) : (
            <>
              <TextField label="Nombre y apellido" icon={User} autoComplete="name" value={fullName} onChange={(e) => (setFullName(e.target.value), clear('fullName'))} placeholder="Ej: Luis Rangel" error={errors.fullName} />
              <TextField label="Teléfono (WhatsApp)" icon={Phone} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => (setPhone(e.target.value), clear('phone'))} placeholder="0414-1234567" error={errors.phone} hint="Los clientes y comercios te contactarán aquí." />
              <div>
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tinta-500">¿En qué haces las entregas?</span>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(VEHICLE_LABEL) as Vehicle[]).map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setVehicle(v)}
                      aria-pressed={vehicle === v}
                      className={cn(
                        'rounded-2xl border py-2.5 text-xs font-semibold transition active:scale-95',
                        vehicle === v ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-500'
                      )}
                    >
                      {VEHICLE_LABEL[v]}
                    </button>
                  ))}
                </div>
              </div>
              {(vehicle === 'moto' || vehicle === 'carro') && (
                <TextField label="Placa (opcional)" className="uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="AB1C23D" maxLength={12} />
              )}
            </>
          )}

          <button type="submit" className="btn-primary w-full py-3.5 text-base">
            Continuar <ArrowRight size={18} />
          </button>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="card space-y-4 rounded-[28px] p-5">
          {tipo === 'comercio' && (
            <>
              <TextField label="Tu nombre (dueño o encargado)" icon={User} autoComplete="name" value={fullName} onChange={(e) => (setFullName(e.target.value), clear('fullName'))} placeholder="Ej: María Rangel" error={errors.fullName} />
              <TextField label="Tu teléfono" icon={Phone} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => (setPhone(e.target.value), clear('phone'))} placeholder="0414-1234567" error={errors.phone} />
            </>
          )}
          <TextField
            label="Correo"
            icon={Mail}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            value={email}
            onChange={(e) => (setEmail(e.target.value), clear('email'))}
            placeholder="tu@correo.com"
            error={errors.email}
            hint={
              suggestion ? (
                <button type="button" onClick={() => setEmail(suggestion)} className="font-semibold text-laguna-600">
                  ¿Quisiste decir {suggestion}?
                </button>
              ) : (
                'Lo usarás para entrar y recuperar tu contraseña.'
              )
            }
          />
          {errors.email === 'Ese correo ya tiene una cuenta.' && (
            <div className="-mt-2 flex gap-3 text-sm">
              <Link href="/entrar" className="font-bold text-laguna-600">
                Iniciar sesión
              </Link>
              <Link href={`/entrar/recuperar?correo=${encodeURIComponent(email.trim())}`} className="font-semibold text-tinta-500">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          )}
          <PasswordField label="Crea una contraseña" icon={Lock} autoComplete="new-password" value={password} onChange={(e) => (setPassword(e.target.value), clear('password'))} placeholder="Mínimo 8 caracteres" error={errors.password} showRules />

          <label className={cn('flex items-start gap-3 rounded-2xl p-3 text-sm text-tinta-600', errors.accept ? 'bg-teja-100 ring-1 ring-teja-400/50' : 'bg-cal-100')}>
            <input type="checkbox" checked={accept} onChange={(e) => (setAccept(e.target.checked), clear('accept'))} className="mt-0.5 h-5 w-5 shrink-0 accent-laguna-600" />
            <span>
              {tipo === 'comercio'
                ? 'Confirmo que los datos de mi negocio son reales. Mi comercio aparecerá en la app cuando la administración lo apruebe.'
                : 'Confirmo que mis datos son reales. Podré recibir pedidos cuando la administración apruebe mi cuenta.'}
            </span>
          </label>
          {errors.accept && <p className="-mt-2 text-[13px] font-medium text-teja-600">{errors.accept}</p>}

          {formError && <FormAlert>{formError}</FormAlert>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
            {loading ? <Loader2 size={20} className="animate-spin" /> : 'Crear mi cuenta'}
          </button>
        </form>
      )}
      {loginLink}
    </AuthShell>
  );
}

export default function RegistroPage() {
  return (
    <Suspense>
      <Registro />
    </Suspense>
  );
}
