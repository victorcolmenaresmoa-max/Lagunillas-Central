'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Bike, Building2, Calendar, Check, ChevronRight, Home, Loader2, Lock, Mail, MapPin, Phone, ShieldCheck, Store, User, UserRound } from 'lucide-react';
import {
  AuthShell,
  CheckRow,
  FormAlert,
  IdField,
  NoAccountNeeded,
  PasswordField,
  TermsText,
  TextField,
  YesNo,
  emailSuggestion,
  isEmail,
  passwordOk,
} from '@/components/auth';
import VerifyEmail from '@/components/VerifyEmail';
import { getBrowserClient } from '@/lib/supabase-browser';
import { friendlyError } from '@/lib/errors';
import { isValidPhone, normalizePhone } from '@/lib/validate';
import { CATEGORIES, type Category, type Vehicle } from '@/lib/types';
import { CATEGORY_STYLES } from '@/lib/categories';
import { VEHICLE_LABEL } from '@/lib/delivery';
import { TERMS_VERSION, birthError, cleanId, cleanRif, idError, maxBirthDate, rifError, type IdType } from '@/lib/legal';
import { cn } from '@/lib/utils';

type Tipo = 'comercio' | 'repartidor';
type Errors = Record<string, string | undefined>;
type Step = 1 | 2 | 3;

const TIPOS = {
  comercio: {
    icon: Store,
    title: 'Tengo un comercio',
    text: 'Muestra tus productos y recibe pedidos por WhatsApp.',
    perks: ['Gratis para empezar', 'Tu catálogo con fotos', 'Repartidores de la app'],
    tone: 'bg-teja-100 text-teja-600',
    steps: ['Negocio', 'Legal', 'Cuenta'],
  },
  repartidor: {
    icon: Bike,
    title: 'Quiero ser repartidor',
    text: 'Recibe avisos de pedidos y gana por cada entrega.',
    perks: ['Tú eliges cuándo trabajar', 'Avisos al instante', 'Cobras cada entrega'],
    tone: 'bg-laguna-100 text-laguna-600',
    steps: ['Tus datos', 'Vehículo', 'Cuenta'],
  },
} as const;

const SUBTITLES: Record<Tipo, Record<Step, string>> = {
  comercio: {
    1: 'Cuéntanos de tu negocio. Podrás cambiarlo después.',
    2: 'Los pedimos por seguridad de todos. Solo los ve la administración.',
    3: 'Con este correo y contraseña entrarás a tu panel.',
  },
  repartidor: {
    1: 'Tus datos como aparecen en tu cédula. Solo los ve la administración.',
    2: 'Así sabemos cómo haces las entregas y a quién llamar si pasa algo.',
    3: 'Con este correo y contraseña entrarás a tu panel.',
  },
};

function Registro() {
  const params = useSearchParams();
  const router = useRouter();
  const initial = params.get('tipo');
  const [tipo, setTipo] = useState<Tipo | null>(initial === 'comercio' || initial === 'repartidor' ? initial : null);
  const [step, setStep] = useState<Step>(1);
  const [verifying, setVerifying] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Negocio
  const [biz, setBiz] = useState({ name: '', category: 'Comida' as Category, whatsapp: '', address: '', opens: '08:00', closes: '20:00', description: '' });
  const [legalBiz, setLegalBiz] = useState({ razon: '', rif: '' });
  // Persona (dueño o repartidor)
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [idType, setIdType] = useState<IdType>('V');
  const [idNumber, setIdNumber] = useState('');
  const [birth, setBirth] = useState('');
  const [home, setHome] = useState('');
  // Repartidor
  const [vehicle, setVehicle] = useState<Vehicle>('moto');
  const [plate, setPlate] = useState('');
  const [veh, setVeh] = useState({ brand: '', model: '', color: '' });
  const [hasLicense, setHasLicense] = useState<boolean | null>(null);
  const [hasRcv, setHasRcv] = useState<boolean | null>(null);
  const [emergency, setEmergency] = useState({ name: '', phone: '' });
  // Cuenta
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [declare, setDeclare] = useState(false);
  const [terms, setTerms] = useState(false);

  // Si ya tiene sesión, no tiene sentido registrarse de nuevo
  useEffect(() => {
    getBrowserClient()
      ?.auth.getSession()
      .then(({ data }) => data.session && router.replace('/entrar?acceso=negocio'));
  }, [router]);

  const clear = (k: string) => errors[k] && setErrors((e) => ({ ...e, [k]: undefined }));
  const panelHome = tipo === 'comercio' ? '/panel' : '/repartidor';
  const motorized = vehicle === 'moto' || vehicle === 'carro';

  const goTo = (s: Step) => {
    setErrors({});
    setStep(s);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------- Validación de cada paso ---------- */
  const validate = (s: Step): Errors => {
    const errs: Errors = {};
    const name2 = (v: string) => v.trim().split(/\s+/).filter(Boolean).length >= 2;
    if (tipo === 'comercio' && s === 1) {
      if (biz.name.trim().length < 2) errs.name = 'Escribe el nombre de tu negocio.';
      if (!isValidPhone(biz.whatsapp)) errs.whatsapp = 'Escribe un WhatsApp válido, por ejemplo 0414-1234567.';
      if (biz.address.trim().length < 5) errs.address = 'Escribe la dirección con un punto de referencia.';
    }
    if (tipo === 'comercio' && s === 2) {
      if (legalBiz.razon.trim().length < 3) errs.razon = 'Escribe la razón social, o tu nombre completo si eres persona natural.';
      errs.rif = rifError(legalBiz.rif) ?? undefined;
      if (!name2(fullName)) errs.fullName = 'Escribe nombre y apellido, como en la cédula.';
      errs.idNumber = idError(idType, idNumber) ?? undefined;
      errs.birth = birthError(birth) ?? undefined;
      if (!isValidPhone(phone)) errs.phone = 'Escribe un teléfono válido, por ejemplo 0414-1234567.';
    }
    if (tipo === 'repartidor' && s === 1) {
      if (!name2(fullName)) errs.fullName = 'Escribe nombre y apellido, como en la cédula.';
      errs.idNumber = idError(idType, idNumber) ?? undefined;
      errs.birth = birthError(birth) ?? undefined;
      if (!isValidPhone(phone)) errs.phone = 'Escribe un teléfono válido, por ejemplo 0414-1234567.';
      if (home.trim().length < 8) errs.home = 'Escribe tu sector, calle y un punto de referencia.';
    }
    if (tipo === 'repartidor' && s === 2) {
      if (motorized) {
        if (veh.brand.trim().length < 2) errs.brand = 'Escribe la marca.';
        if (veh.model.trim().length < 1) errs.model = 'Escribe el modelo.';
        if (veh.color.trim().length < 3) errs.color = 'Escribe el color.';
        if (cleanId(plate).length < 5) errs.plate = 'Escribe la placa completa.';
        if (hasLicense === null) errs.license = 'Elige una opción.';
        else if (!hasLicense) errs.license = 'Para repartir en moto o carro necesitas licencia de conducir vigente.';
        if (hasRcv === null) errs.rcv = 'Elige una opción.';
        else if (!hasRcv) errs.rcv = 'El seguro RCV es obligatorio para circular. Sácalo antes de registrarte.';
      }
      if (!name2(emergency.name)) errs.eName = 'Escribe nombre y apellido.';
      if (!isValidPhone(emergency.phone)) errs.ePhone = 'Escribe un teléfono válido.';
      else if (normalizePhone(emergency.phone) === normalizePhone(phone)) errs.ePhone = 'Debe ser el teléfono de otra persona.';
    }
    if (s === 3) {
      if (!isEmail(email)) errs.email = 'Escribe un correo válido. Lo usarás para entrar.';
      if (!passwordOk(password)) errs.password = 'Usa al menos 8 caracteres, con letras y números, sin espacios al inicio ni al final.';
      if (!declare) errs.declare = 'Marca la casilla para continuar.';
      if (!terms) errs.terms = 'Debes aceptar los términos y la política de privacidad.';
    }
    Object.keys(errs).forEach((k) => errs[k] === undefined && delete errs[k]);
    return errs;
  };

  const next = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();
    if (tipo === 'comercio' && step === 1 && !phone) setPhone(biz.whatsapp);
    goTo((step + 1) as Step);
  };

  const focusFirstError = () =>
    requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], [role="radiogroup"] button.border-teja-400')?.focus());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const errs = validate(3);
    setErrors(errs);
    if (Object.keys(errs).length) return focusFirstError();

    const sb = getBrowserClient();
    if (!sb) return setFormError('La app aún no está conectada a la base de datos.');
    setLoading(true);
    const legal = {
      legal_name: fullName.trim(),
      id_type: idType,
      id_number: cleanId(idNumber),
      birth_date: birth,
      terms_version: TERMS_VERSION,
      ...(tipo === 'comercio'
        ? { business_legal_name: legalBiz.razon.trim(), rif: cleanRif(legalBiz.rif) }
        : {
            home_address: home.trim(),
            emergency_name: emergency.name.trim(),
            emergency_phone: normalizePhone(emergency.phone),
            vehicle_brand: motorized ? veh.brand.trim() : null,
            vehicle_model: motorized ? veh.model.trim() : null,
            vehicle_color: motorized ? veh.color.trim() : null,
            has_license: motorized ? hasLicense : null,
            has_rcv: motorized ? hasRcv : null,
          }),
    };
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${panelHome}`,
        data: {
          signup_role: tipo === 'comercio' ? 'merchant' : 'delivery',
          full_name: fullName.trim(),
          phone: normalizePhone(phone),
          legal,
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
            : { driver: { vehicle, plate: motorized ? cleanId(plate) : '' } }),
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
      router.replace(panelHome);
      return;
    }
    setVerifying(true);
  };

  /* ---------- Confirmar correo con código ---------- */
  if (verifying) {
    return (
      <AuthShell showTabs={false} title="Confirma tu correo" subtitle="Último paso para activar tu cuenta." onBack={() => setVerifying(false)}>
        <VerifyEmail email={email.trim().toLowerCase()} onVerified={() => router.replace(panelHome)} onChangeEmail={() => setVerifying(false)} />
      </AuthShell>
    );
  }

  const loginLink = (
    <p className="mt-5 text-center text-sm text-tinta-500">
      ¿Ya tienes una cuenta?{' '}
      <Link href="/entrar?acceso=negocio" className="font-bold text-laguna-600">
        Inicia sesión
      </Link>
    </p>
  );

  /* ---------- Elegir tipo de cuenta ---------- */
  if (!tipo) {
    return (
      <AuthShell tab="registro" loginHref="/entrar?acceso=negocio" registerHref="/aliados/registro" title="Trabaja con Lagunillas Central" subtitle="Registro exclusivo para comercios y repartidores.">
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
  const suggestion = emailSuggestion(email);

  const idFields = (
    <>
      <IdField
        type={idType}
        number={idNumber}
        onType={setIdType}
        onNumber={(v) => (setIdNumber(v), clear('idNumber'))}
        error={errors.idNumber}
        hint="Solo la ve la administración. Luego te pediremos una foto."
      />
      <TextField
        label="Fecha de nacimiento"
        icon={Calendar}
        type="date"
        max={maxBirthDate()}
        value={birth}
        onChange={(e) => (setBirth(e.target.value), clear('birth'))}
        error={errors.birth}
        hint="Debes ser mayor de 18 años."
      />
    </>
  );

  return (
    <AuthShell loginHref="/entrar?acceso=negocio" registerHref="/aliados/registro"
      tab="registro"
      title={tipo === 'comercio' ? 'Registra tu comercio' : 'Sé repartidor'}
      subtitle={SUBTITLES[tipo][step]}
      onBack={() => (step > 1 ? goTo((step - 1) as Step) : (setTipo(null), setErrors({})))}
    >
      {/* Pasos */}
      <ol className="mb-4 grid grid-cols-3 gap-2">
        {t.steps.map((label, i) => {
          const n = i + 1;
          const done = step > n;
          const current = step === n;
          return (
            <li key={label} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                  done ? 'bg-laguna-500 text-white' : current ? 'bg-laguna-600 text-white ring-4 ring-laguna-400/20' : 'bg-cal-300 text-tinta-500'
                )}
              >
                {done ? <Check size={14} strokeWidth={3} /> : n}
              </span>
              <span className={cn('truncate text-[13px] font-semibold', current ? 'text-tinta-900' : 'text-tinta-400')}>{label}</span>
            </li>
          );
        })}
      </ol>

      <form onSubmit={step === 3 ? submit : next} noValidate className="card space-y-4 rounded-[28px] p-5">
        {step === 1 && (
          <div className="flex items-center gap-3 rounded-2xl bg-cal-100 p-3">
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', t.tone)}>
              <t.icon size={19} />
            </span>
            <p className="flex-1 text-sm font-semibold text-tinta-700">{t.title}</p>
            <button type="button" onClick={() => setTipo(null)} className="text-xs font-bold text-laguna-600">
              Cambiar
            </button>
          </div>
        )}

        {/* ---------------- COMERCIO ---------------- */}
        {tipo === 'comercio' && step === 1 && (
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
        )}

        {tipo === 'comercio' && step === 2 && (
          <>
            <PrivacyNote />
            <SectionTitle icon={Building2}>El comercio</SectionTitle>
            <TextField label="Razón social" icon={Building2} value={legalBiz.razon} onChange={(e) => (setLegalBiz({ ...legalBiz, razon: e.target.value }), clear('razon'))} placeholder="Ej: Inversiones El Páramo, C.A." maxLength={160} error={errors.razon} hint="Si eres persona natural, escribe tu nombre completo." />
            <TextField label="RIF" value={legalBiz.rif} onChange={(e) => (setLegalBiz({ ...legalBiz, rif: e.target.value.toUpperCase() }), clear('rif'))} placeholder="J-12345678-9" autoCapitalize="characters" maxLength={14} error={errors.rif} />
            <SectionTitle icon={UserRound}>Responsable del comercio</SectionTitle>
            <TextField label="Nombre y apellido" icon={User} autoComplete="name" value={fullName} onChange={(e) => (setFullName(e.target.value), clear('fullName'))} placeholder="Como aparece en la cédula" error={errors.fullName} />
            {idFields}
            <TextField label="Teléfono del responsable" icon={Phone} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => (setPhone(e.target.value), clear('phone'))} placeholder="0414-1234567" error={errors.phone} />
          </>
        )}

        {/* ---------------- REPARTIDOR ---------------- */}
        {tipo === 'repartidor' && step === 1 && (
          <>
            <PrivacyNote />
            <TextField label="Nombre y apellido" icon={User} autoComplete="name" value={fullName} onChange={(e) => (setFullName(e.target.value), clear('fullName'))} placeholder="Como aparece en la cédula" error={errors.fullName} />
            {idFields}
            <TextField label="Teléfono (WhatsApp)" icon={Phone} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => (setPhone(e.target.value), clear('phone'))} placeholder="0414-1234567" error={errors.phone} hint="Los clientes y comercios te contactarán aquí." />
            <TextField label="Dirección donde vives" icon={Home} autoComplete="street-address" value={home} onChange={(e) => (setHome(e.target.value), clear('home'))} placeholder="Sector, calle y punto de referencia" maxLength={200} error={errors.home} />
          </>
        )}

        {tipo === 'repartidor' && step === 2 && (
          <>
            <div>
              <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-tinta-500">¿En qué haces las entregas?</span>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(VEHICLE_LABEL) as Vehicle[]).map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => (setVehicle(v), setErrors({}))}
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
            {motorized && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Marca" value={veh.brand} onChange={(e) => (setVeh({ ...veh, brand: e.target.value }), clear('brand'))} placeholder={vehicle === 'moto' ? 'Ej: Bera' : 'Ej: Toyota'} maxLength={40} error={errors.brand} />
                  <TextField label="Modelo" value={veh.model} onChange={(e) => (setVeh({ ...veh, model: e.target.value }), clear('model'))} placeholder={vehicle === 'moto' ? 'Ej: SBR' : 'Ej: Corolla'} maxLength={40} error={errors.model} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Color" value={veh.color} onChange={(e) => (setVeh({ ...veh, color: e.target.value }), clear('color'))} placeholder="Ej: Negro" maxLength={30} error={errors.color} />
                  <TextField label="Placa" className="uppercase" value={plate} onChange={(e) => (setPlate(e.target.value), clear('plate'))} placeholder="AB1C23D" autoCapitalize="characters" maxLength={12} error={errors.plate} />
                </div>
                <YesNo label="¿Tienes licencia de conducir vigente?" value={hasLicense} onChange={(v) => (setHasLicense(v), clear('license'))} error={errors.license} />
                <YesNo label="¿Tienes seguro RCV vigente?" value={hasRcv} onChange={(v) => (setHasRcv(v), clear('rcv'))} error={errors.rcv} hint="Responsabilidad Civil Vehicular: es obligatorio para circular." />
              </>
            )}
            <SectionTitle icon={ShieldCheck}>Contacto de emergencia</SectionTitle>
            <p className="-mt-2 text-xs text-tinta-400">Una persona de confianza a quien llamar si te pasa algo durante una entrega.</p>
            <TextField label="Nombre y apellido" icon={User} value={emergency.name} onChange={(e) => (setEmergency({ ...emergency, name: e.target.value }), clear('eName'))} placeholder="Ej: Rosa Rangel" maxLength={120} error={errors.eName} />
            <TextField label="Teléfono" icon={Phone} inputMode="tel" value={emergency.phone} onChange={(e) => (setEmergency({ ...emergency, phone: e.target.value }), clear('ePhone'))} placeholder="0414-1234567" error={errors.ePhone} />
          </>
        )}

        {/* ---------------- CUENTA ---------------- */}
        {step === 3 && (
          <>
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
                <Link href="/entrar?acceso=negocio" className="font-bold text-laguna-600">
                  Iniciar sesión
                </Link>
                <Link href={`/entrar/recuperar?correo=${encodeURIComponent(email.trim())}`} className="font-semibold text-tinta-500">
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}
            <PasswordField label="Crea una contraseña" icon={Lock} autoComplete="new-password" value={password} onChange={(e) => (setPassword(e.target.value), clear('password'))} placeholder="Mínimo 8 caracteres" error={errors.password} showRules />

            <CheckRow checked={declare} onChange={(v) => (setDeclare(v), clear('declare'))} error={errors.declare}>
              {tipo === 'comercio'
                ? 'Declaro que los datos de mi negocio y míos son reales y que puedo demostrarlos con documentos. Mi comercio aparecerá en la app cuando la administración lo apruebe.'
                : 'Declaro que mis datos son reales y que puedo demostrarlos con documentos. Podré recibir pedidos cuando la administración apruebe mi cuenta.'}
            </CheckRow>
            <CheckRow checked={terms} onChange={(v) => (setTerms(v), clear('terms'))} error={errors.terms}>
              <TermsText />
            </CheckRow>
            <p className="text-xs text-tinta-400">Después de crear tu cuenta te pediremos fotos de tus documentos desde tu panel.</p>
          </>
        )}

        {formError && <FormAlert>{formError}</FormAlert>}
        <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 text-base">
          {loading ? (
            <Loader2 size={20} className="animate-spin" />
          ) : step === 3 ? (
            'Crear mi cuenta'
          ) : (
            <>
              Continuar <ArrowRight size={18} />
            </>
          )}
        </button>
      </form>
      {loginLink}
    </AuthShell>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: any; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 border-t border-cal-200 pt-4 text-sm font-extrabold text-tinta-900 first:border-t-0 first:pt-0">
      <Icon size={16} className="text-laguna-600" /> {children}
    </p>
  );
}

function PrivacyNote() {
  return (
    <div className="flex gap-3 rounded-2xl bg-laguna-50 p-3 text-xs text-laguna-700 ring-1 ring-laguna-200">
      <ShieldCheck size={18} className="mt-0.5 shrink-0" />
      <p>
        Estos datos son <b>privados</b>: no los ven los clientes ni otros usuarios, solo la administración.{' '}
        <Link href="/privacidad" target="_blank" className="font-bold underline underline-offset-2">
          Cómo los cuidamos
        </Link>
      </p>
    </div>
  );
}

export default function RegistroPage() {
  return (
    <Suspense>
      <Registro />
    </Suspense>
  );
}
