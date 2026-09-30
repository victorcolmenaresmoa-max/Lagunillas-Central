'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, Loader2, MailCheck, Store, Bike, ChevronLeft } from 'lucide-react';
import AuthHero from '@/components/AuthHero';
import { Field } from '@/components/ui';
import { getBrowserClient } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';
import { isValidPhone, normalizePhone } from '@/lib/validate';
import { CATEGORIES, type Category, type Vehicle } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/categories';
import { VEHICLE_LABEL } from '@/lib/delivery';
import { cn } from '@/lib/utils';

type Tipo = 'comercio' | 'repartidor';

function Registro() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('tipo');
  const [tipo, setTipo] = useState<Tipo | null>(initial === 'comercio' || initial === 'repartidor' ? initial : null);
  const [step, setStep] = useState<1 | 2>(1);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  const nextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tipo === 'comercio') {
      if (biz.name.trim().length < 2) return setError('Escribe el nombre de tu negocio.');
      if (!isValidPhone(biz.whatsapp)) return setError('Escribe un número de WhatsApp válido, por ejemplo 0414-1234567.');
      if (biz.address.trim().length < 5) return setError('Escribe la dirección de tu negocio.');
      if (!phone) setPhone(biz.whatsapp);
    } else {
      if (fullName.trim().length < 3) return setError('Escribe tu nombre completo.');
      if (!isValidPhone(phone)) return setError('Escribe un número válido, por ejemplo 0414-1234567.');
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (fullName.trim().length < 3) return setError('Escribe tu nombre completo.');
    if (!isValidPhone(phone)) return setError('Escribe un teléfono válido.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (!accept) return setError('Debes aceptar las condiciones para continuar.');
    const sb = getBrowserClient();
    if (!sb) return setError('La app aún no está conectada a la base de datos.');

    setLoading(true);
    const home = tipo === 'comercio' ? '/panel' : '/repartidor';
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
    if (error) return setError(friendlyError(error));
    // Supabase devuelve un usuario "vacío" si el correo ya existía
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return setError('Ese correo ya tiene una cuenta. Inicia sesión.');
    }
    if (data.session) {
      router.replace(home);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col pb-10">
        <AuthHero title="¡Revisa tu correo!" back="/" />
        <div className="card mx-5 mt-7 p-6 text-center">
          <MailCheck size={40} className="mx-auto text-laguna-500" />
          <p className="mt-3 text-tinta-700">
            Te enviamos un enlace a <b>{email}</b>. Tócalo para activar tu cuenta.
          </p>
          <p className="mt-2 text-sm text-tinta-500">Si no lo ves, revisa la carpeta de spam o promociones.</p>
          <Link href="/entrar" className="btn-primary mt-5 w-full">Ir a Entrar</Link>
        </div>
      </main>
    );
  }

  if (!tipo) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col pb-10">
        <AuthHero title="Únete" subtitle="¿Cómo quieres ser parte de Lagunillas Central?" />
        <div className="mx-5 mt-7 space-y-3">
          {(
            [
              ['comercio', Store, 'Tengo un comercio', 'Muestra tus productos y recibe pedidos por WhatsApp.'],
              ['repartidor', Bike, 'Quiero ser repartidor', 'Recibe avisos de pedidos y gana por cada entrega.'],
            ] as const
          ).map(([key, Icon, title, text]) => (
            <button key={key} onClick={() => setTipo(key)} className="card flex w-full items-center gap-4 p-4 text-left transition active:scale-[0.98]">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-laguna-100 text-laguna-600">
                <Icon size={26} />
              </span>
              <span className="flex-1">
                <span className="block font-bold text-tinta-900">{title}</span>
                <span className="block text-sm text-tinta-500">{text}</span>
              </span>
              <ArrowRight size={20} className="text-tinta-400" />
            </button>
          ))}
          <p className="pt-2 text-center text-sm text-tinta-500">
            ¿Ya tienes cuenta? <Link href="/entrar" className="font-semibold text-laguna-600">Entra aquí</Link>
          </p>
        </div>
      </main>
    );
  }

  const title = tipo === 'comercio' ? 'Registra tu comercio' : 'Sé repartidor';

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col pb-10">
      <AuthHero title={title} subtitle={`Paso ${step} de 2 · ${step === 1 ? (tipo === 'comercio' ? 'Tu negocio' : 'Tus datos') : 'Tu cuenta'}`}
        onBack={() => (step === 2 ? setStep(1) : (setTipo(null), setError(null)))}
      />

      <div className="mx-5 mt-5 flex gap-2">
        {[1, 2].map((n) => (
          <span key={n} className={cn('h-1.5 flex-1 rounded-full transition', n <= step ? 'bg-laguna-500' : 'bg-cal-300')} />
        ))}
      </div>

      {step === 1 ? (
        <form onSubmit={nextStep} className="card mx-5 mt-4 space-y-4 rounded-[28px] p-5">
          {tipo === 'comercio' ? (
            <>
              <Field label="Nombre del negocio">
                <input className="input" value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} placeholder="Ej: Arepera El Páramo" maxLength={80} />
              </Field>
              <Field label="Categoría">
                <div className="grid grid-cols-3 gap-2">
                  {CATEGORIES.map((c) => {
                    const Icon = CATEGORY_STYLES[c].icon;
                    return (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setBiz({ ...biz, category: c })}
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
              </Field>
              <Field label="WhatsApp del negocio" hint="Aquí te llegarán los pedidos.">
                <input className="input" inputMode="tel" value={biz.whatsapp} onChange={(e) => setBiz({ ...biz, whatsapp: e.target.value })} placeholder="0414-1234567" />
              </Field>
              <Field label="Dirección">
                <input className="input" value={biz.address} onChange={(e) => setBiz({ ...biz, address: e.target.value })} placeholder="Calle, sector y punto de referencia" maxLength={160} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Abre">
                  <input className="input" type="time" value={biz.opens} onChange={(e) => setBiz({ ...biz, opens: e.target.value })} />
                </Field>
                <Field label="Cierra">
                  <input className="input" type="time" value={biz.closes} onChange={(e) => setBiz({ ...biz, closes: e.target.value })} />
                </Field>
              </div>
              <Field label="Descripción (opcional)">
                <textarea className="input min-h-[80px] resize-none" value={biz.description} onChange={(e) => setBiz({ ...biz, description: e.target.value })} placeholder="¿Qué vendes? ¿Qué te hace especial?" maxLength={280} />
              </Field>
            </>
          ) : (
            <>
              <Field label="Nombre completo">
                <input className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: Luis Rangel" />
              </Field>
              <Field label="Teléfono (WhatsApp)" hint="Los clientes y comercios te contactarán aquí.">
                <input className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0414-1234567" />
              </Field>
              <Field label="¿En qué haces las entregas?">
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(VEHICLE_LABEL) as Vehicle[]).map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setVehicle(v)}
                      className={cn(
                        'rounded-2xl border py-2.5 text-xs font-semibold transition active:scale-95',
                        vehicle === v ? 'border-laguna-400 bg-laguna-100 text-laguna-700' : 'border-cal-300 bg-white text-tinta-500'
                      )}
                    >
                      {VEHICLE_LABEL[v]}
                    </button>
                  ))}
                </div>
              </Field>
              {(vehicle === 'moto' || vehicle === 'carro') && (
                <Field label="Placa (opcional)">
                  <input className="input uppercase" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="AB1C23D" maxLength={12} />
                </Field>
              )}
            </>
          )}

          {error && <p className="rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}
          <button type="submit" className="btn-primary w-full py-3.5">
            Continuar <ArrowRight size={18} />
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="card mx-5 mt-4 space-y-4 rounded-[28px] p-5">
          {tipo === 'comercio' && (
            <>
              <Field label="Tu nombre (dueño o encargado)">
                <input className="input" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: María Rangel" />
              </Field>
              <Field label="Tu teléfono">
                <input className="input" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0414-1234567" />
              </Field>
            </>
          )}
          <Field label="Correo">
            <input className="input" type="email" inputMode="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres.">
            <input className="input" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>

          <label className="flex items-start gap-3 rounded-2xl bg-cal-100 p-3 text-sm text-tinta-600">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-5 w-5 accent-laguna-600" />
            <span>
              {tipo === 'comercio'
                ? 'Confirmo que los datos de mi negocio son reales. Entiendo que mi comercio aparecerá en la app cuando sea aprobado.'
                : 'Confirmo que mis datos son reales. Entiendo que podré recibir pedidos cuando mi cuenta sea aprobada.'}
            </span>
          </label>

          {error && <p className="rounded-2xl bg-teja-100 p-3 text-sm text-teja-600">{error}</p>}
          <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Crear mi cuenta
          </button>
          <button type="button" onClick={() => setStep(1)} className="flex w-full items-center justify-center gap-1 text-sm font-medium text-tinta-500">
            <ChevronLeft size={16} /> Volver
          </button>
        </form>
      )}
    </main>
  );
}

export default function RegistroPage() {
  return (
    <Suspense>
      <Registro />
    </Suspense>
  );
}
