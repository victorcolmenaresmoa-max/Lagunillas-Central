'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AlertTriangle, Calendar, Check, ChevronDown, Eye, FileText, Home, Loader2, Lock, Phone, ShieldCheck, Upload, User } from 'lucide-react';
import { CheckRow, IdField, TermsText, TextField, YesNo } from './auth';
import { friendlyError } from '@/lib/errors';
import {
  DOCS,
  TERMS_VERSION,
  birthError,
  cleanId,
  cleanRif,
  formatId,
  formatRif,
  idError,
  isRequired,
  maxBirthDate,
  missingItems,
  rifError,
  type DocKey,
  type IdType,
  type LegalProfile,
} from '@/lib/legal';
import { documentUrl, removeDocument, uploadDocument } from '@/lib/upload';
import { displayPhone, isValidPhone, normalizePhone } from '@/lib/validate';
import { cn } from '@/lib/utils';

type Kind = 'merchant' | 'delivery';

/**
 * Tarjeta "Verificación de identidad" para los paneles de comercio y repartidor.
 * Muestra qué falta, permite completar los datos legales y subir los documentos.
 * Todo queda en la tabla privada legal_profiles y el bucket privado "documentos".
 */
export function VerificationCard({
  sb,
  userId,
  kind,
  approved,
  vehicle,
  prefill,
  notify,
  hideWhenComplete = false,
}: {
  sb: SupabaseClient;
  userId: string;
  kind: Kind;
  approved: boolean;
  vehicle?: string | null;
  prefill?: { legal_name?: string | null };
  notify: (m: string, k?: 'ok' | 'err') => void;
  /** en la pestaña principal solo aparece si falta algo */
  hideWhenComplete?: boolean;
}) {
  const [row, setRow] = useState<LegalProfile | null | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await sb.from('legal_profiles').select('*').eq('user_id', userId).maybeSingle();
    setRow((data as LegalProfile) ?? null);
  }, [sb, userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (row === undefined) return null;
  const missing = missingItems(kind, row, vehicle);
  const complete = missing.length === 0;
  if (complete && hideWhenComplete) return null;

  return (
    <section className={cn('overflow-hidden rounded-[28px] ring-1', complete ? 'bg-cal-50 ring-cal-200' : 'bg-ocre-100/60 ring-ocre-400/40')}>
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={open}>
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', complete ? 'bg-laguna-100 text-laguna-600' : 'bg-ocre-100 text-ocre-600')}>
          {complete ? <ShieldCheck size={22} /> : <AlertTriangle size={22} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-tinta-900">{complete ? 'Verificación completa' : 'Completa tu verificación'}</span>
          <span className="block text-xs text-tinta-500">
            {complete
              ? 'Tus datos legales y documentos están listos.'
              : `Falta: ${missing.slice(0, 3).join(', ')}${missing.length > 3 ? ` y ${missing.length - 3} más` : ''}.`}
          </span>
        </span>
        <ChevronDown size={20} className={cn('shrink-0 text-tinta-400 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-cal-200 bg-cal-50 p-4">
          <p className="flex gap-2 rounded-2xl bg-laguna-50 p-3 text-xs text-laguna-700 ring-1 ring-laguna-200">
            <Lock size={15} className="mt-0.5 shrink-0" />
            Solo tú y la administración pueden ver estos datos y documentos.
            {approved && ' Como tu cuenta ya está aprobada, tu nombre y cédula solo los puede corregir la administración.'}
          </p>
          <LegalForm sb={sb} userId={userId} kind={kind} row={row} approved={approved} vehicle={vehicle} prefill={prefill} notify={notify} onSaved={load} />
          <DocsList sb={sb} userId={userId} kind={kind} row={row} vehicle={vehicle} notify={notify} onSaved={load} />
        </div>
      )}
    </section>
  );
}

/* ---------------- Datos legales ---------------- */
function LegalForm({
  sb,
  userId,
  kind,
  row,
  approved,
  vehicle,
  prefill,
  notify,
  onSaved,
}: {
  sb: SupabaseClient;
  userId: string;
  kind: Kind;
  row: LegalProfile | null;
  approved: boolean;
  vehicle?: string | null;
  prefill?: { legal_name?: string | null };
  notify: (m: string, k?: 'ok' | 'err') => void;
  onSaved: () => void;
}) {
  const identityLocked = approved && Boolean(row?.id_number);
  const motorized = vehicle === 'moto' || vehicle === 'carro';
  const [f, setF] = useState({
    legal_name: row?.legal_name ?? prefill?.legal_name ?? '',
    id_type: (row?.id_type ?? 'V') as IdType,
    id_number: row?.id_number ?? '',
    birth_date: row?.birth_date ?? '',
    home_address: row?.home_address ?? '',
    business_legal_name: row?.business_legal_name ?? '',
    rif: row?.rif ? formatRif(row.rif) : '',
    emergency_name: row?.emergency_name ?? '',
    emergency_phone: displayPhone(row?.emergency_phone),
    vehicle_brand: row?.vehicle_brand ?? '',
    vehicle_model: row?.vehicle_model ?? '',
    vehicle_color: row?.vehicle_color ?? '',
    has_license: row?.has_license ?? null,
    has_rcv: row?.has_rcv ?? null,
  });
  const [accept, setAccept] = useState(row?.terms_version === TERMS_VERSION);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: any) => (setF((x) => ({ ...x, [k]: v })), setErrors((e) => ({ ...e, [k]: undefined })));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string | undefined> = {};
    if (!identityLocked) {
      if (f.legal_name.trim().split(/\s+/).filter(Boolean).length < 2) errs.legal_name = 'Escribe nombre y apellido, como en la cédula.';
      errs.id_number = idError(f.id_type, f.id_number) ?? undefined;
      errs.birth_date = birthError(f.birth_date) ?? undefined;
      if (kind === 'merchant') {
        if (f.business_legal_name.trim().length < 3) errs.business_legal_name = 'Escribe la razón social o tu nombre completo.';
        errs.rif = rifError(f.rif) ?? undefined;
      }
    }
    if (kind === 'delivery') {
      if (f.home_address.trim().length < 8) errs.home_address = 'Escribe tu sector, calle y un punto de referencia.';
      if (f.emergency_name.trim().split(/\s+/).filter(Boolean).length < 2) errs.emergency_name = 'Escribe nombre y apellido.';
      if (!isValidPhone(f.emergency_phone)) errs.emergency_phone = 'Escribe un teléfono válido.';
      if (motorized) {
        if (f.has_license !== true) errs.has_license = 'Para repartir en moto o carro necesitas licencia vigente.';
        if (f.has_rcv !== true) errs.has_rcv = 'El seguro RCV es obligatorio para circular.';
      }
    }
    if (!accept) errs.accept = 'Debes aceptar los términos vigentes.';
    Object.keys(errs).forEach((k) => errs[k] === undefined && delete errs[k]);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    const payload: Partial<LegalProfile> & { user_id: string; kind: Kind } = {
      user_id: userId,
      kind,
      terms_version: TERMS_VERSION,
      ...(identityLocked
        ? {}
        : {
            legal_name: f.legal_name.trim(),
            id_type: f.id_type,
            id_number: cleanId(f.id_number),
            birth_date: f.birth_date,
            ...(kind === 'merchant' ? { business_legal_name: f.business_legal_name.trim(), rif: cleanRif(f.rif) } : {}),
          }),
      ...(kind === 'delivery'
        ? {
            home_address: f.home_address.trim(),
            emergency_name: f.emergency_name.trim(),
            emergency_phone: normalizePhone(f.emergency_phone),
            vehicle_brand: motorized ? f.vehicle_brand.trim() || null : null,
            vehicle_model: motorized ? f.vehicle_model.trim() || null : null,
            vehicle_color: motorized ? f.vehicle_color.trim() || null : null,
            has_license: motorized ? f.has_license : null,
            has_rcv: motorized ? f.has_rcv : null,
          }
        : {}),
    };
    const { error } = row
      ? await sb.from('legal_profiles').update(payload).eq('user_id', userId)
      : await sb.from('legal_profiles').insert(payload);
    setSaving(false);
    if (error) return notify(friendlyError(error), 'err');
    notify('Datos guardados');
    onSaved();
  };

  return (
    <form onSubmit={save} noValidate className="space-y-4">
      <p className="text-sm font-extrabold text-tinta-900">Tus datos</p>
      {identityLocked ? (
        <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-cal-100 p-3 text-sm">
          <Info label="Nombre" value={row?.legal_name} />
          <Info label="Cédula" value={formatId(row?.id_type ?? null, row?.id_number ?? null)} />
          <Info label="Nacimiento" value={row?.birth_date ? new Date(row.birth_date + 'T12:00:00').toLocaleDateString('es-VE') : '—'} />
          {kind === 'merchant' && <Info label="RIF" value={formatRif(row?.rif)} />}
          {kind === 'merchant' && <Info label="Razón social" value={row?.business_legal_name} wide />}
        </dl>
      ) : (
        <>
          {kind === 'merchant' && (
            <>
              <TextField label="Razón social" value={f.business_legal_name} onChange={(e) => set('business_legal_name', e.target.value)} placeholder="Ej: Inversiones El Páramo, C.A." maxLength={160} error={errors.business_legal_name} hint="Si eres persona natural, escribe tu nombre completo." />
              <TextField label="RIF" value={f.rif} onChange={(e) => set('rif', e.target.value.toUpperCase())} placeholder="J-12345678-9" maxLength={14} error={errors.rif} />
            </>
          )}
          <TextField label={kind === 'merchant' ? 'Nombre del responsable' : 'Nombre y apellido'} icon={User} value={f.legal_name} onChange={(e) => set('legal_name', e.target.value)} placeholder="Como aparece en la cédula" error={errors.legal_name} />
          <IdField type={f.id_type} number={f.id_number} onType={(t) => set('id_type', t)} onNumber={(n) => set('id_number', n)} error={errors.id_number} />
          <TextField label="Fecha de nacimiento" icon={Calendar} type="date" max={maxBirthDate()} value={f.birth_date} onChange={(e) => set('birth_date', e.target.value)} error={errors.birth_date} />
        </>
      )}

      {kind === 'delivery' && (
        <>
          <TextField label="Dirección donde vives" icon={Home} value={f.home_address} onChange={(e) => set('home_address', e.target.value)} placeholder="Sector, calle y punto de referencia" maxLength={200} error={errors.home_address} />
          {motorized && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <TextField label="Marca" value={f.vehicle_brand} onChange={(e) => set('vehicle_brand', e.target.value)} maxLength={40} />
                <TextField label="Modelo" value={f.vehicle_model} onChange={(e) => set('vehicle_model', e.target.value)} maxLength={40} />
                <TextField label="Color" value={f.vehicle_color} onChange={(e) => set('vehicle_color', e.target.value)} maxLength={30} />
              </div>
              <YesNo label="¿Licencia de conducir vigente?" value={f.has_license} onChange={(v) => set('has_license', v)} error={errors.has_license} />
              <YesNo label="¿Seguro RCV vigente?" value={f.has_rcv} onChange={(v) => set('has_rcv', v)} error={errors.has_rcv} />
            </>
          )}
          <p className="pt-1 text-sm font-extrabold text-tinta-900">Contacto de emergencia</p>
          <TextField label="Nombre y apellido" icon={User} value={f.emergency_name} onChange={(e) => set('emergency_name', e.target.value)} maxLength={120} error={errors.emergency_name} />
          <TextField label="Teléfono" icon={Phone} inputMode="tel" value={f.emergency_phone} onChange={(e) => set('emergency_phone', e.target.value)} placeholder="0414-1234567" error={errors.emergency_phone} />
        </>
      )}

      <CheckRow checked={accept} onChange={(v) => (setAccept(v), setErrors((e) => ({ ...e, accept: undefined })))} error={errors.accept}>
        <TermsText />
      </CheckRow>

      <button type="submit" disabled={saving} className="btn-primary w-full">
        {saving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar datos'}
      </button>
    </form>
  );
}

function Info({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={cn(wide && 'col-span-2')}>
      <dt className="text-[11px] font-bold uppercase tracking-wider text-tinta-400">{label}</dt>
      <dd className="break-words font-semibold text-tinta-900">{value || '—'}</dd>
    </div>
  );
}

/* ---------------- Documentos ---------------- */
function DocsList({
  sb,
  userId,
  kind,
  row,
  vehicle,
  notify,
  onSaved,
}: {
  sb: SupabaseClient;
  userId: string;
  kind: Kind;
  row: LegalProfile | null;
  vehicle?: string | null;
  notify: (m: string, k?: 'ok' | 'err') => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState<DocKey | null>(null);
  const inputs = useRef<Partial<Record<DocKey, HTMLInputElement | null>>>({});
  const docs = row?.docs ?? {};
  const specs = DOCS[kind].filter((d) => isRequired(d, row ?? {}, vehicle) || d.required === false);

  const upload = async (key: DocKey, file: File) => {
    if (!row) return notify('Primero guarda tus datos (arriba) y luego sube los documentos.', 'err');
    setBusy(key);
    try {
      const path = await uploadDocument(sb, userId, file, key);
      const { error } = await sb.from('legal_profiles').update({ docs: { ...docs, [key]: path } }).eq('user_id', userId);
      if (error) {
        await removeDocument(sb, path);
        throw error;
      }
      await removeDocument(sb, docs[key]);
      notify('Documento subido');
      onSaved();
    } catch (err) {
      notify(friendlyError(err), 'err');
    } finally {
      setBusy(null);
    }
  };

  const view = async (path: string) => {
    try {
      window.open(await documentUrl(sb, path), '_blank', 'noopener');
    } catch (err) {
      notify(friendlyError(err), 'err');
    }
  };

  return (
    <div className="space-y-2">
      <p className="pt-1 text-sm font-extrabold text-tinta-900">Documentos</p>
      <p className="text-xs text-tinta-400">Fotos claras, con buena luz y sin reflejos. También puedes subir PDF.</p>
      {!row && <p className="rounded-2xl bg-cal-100 p-3 text-xs text-tinta-500">Guarda tus datos primero para poder subir los documentos.</p>}
      <ul className="space-y-2">
        {specs.map((d) => {
          const has = Boolean(docs[d.key]);
          const required = isRequired(d, row ?? {}, vehicle);
          return (
            <li key={d.key} className="rounded-2xl border border-cal-200 bg-white p-3">
              <div className="flex items-start gap-3">
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', has ? 'bg-laguna-100 text-laguna-600' : 'bg-cal-100 text-tinta-400')}>
                  {has ? <Check size={18} strokeWidth={3} /> : <FileText size={18} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-tinta-900">
                    {d.title} {!required && <span className="font-medium text-tinta-400">(opcional)</span>}
                  </span>
                  <span className="block text-xs text-tinta-500">{has ? 'Subido. Puedes reemplazarlo si hace falta.' : d.hint}</span>
                </span>
              </div>
              <div className="mt-2.5 flex justify-end gap-2">
                {has && (
                  <button type="button" onClick={() => view(docs[d.key]!)} className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-tinta-600 hover:bg-cal-100">
                    <Eye size={15} /> Ver
                  </button>
                )}
                <button
                  type="button"
                  disabled={!row || busy !== null}
                  onClick={() => inputs.current[d.key]?.click()}
                  className={cn('flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition active:scale-95 disabled:opacity-50', has ? 'bg-cal-100 text-tinta-600' : 'bg-laguna-600 text-white')}
                >
                  {busy === d.key ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  {has ? 'Cambiar' : 'Subir foto o PDF'}
                </button>
              </div>
              <input
                ref={(el) => {
                  inputs.current[d.key] = el;
                }}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload(d.key, file);
                }}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ================================================================
   Administración: revisar datos y documentos de una cuenta
   ================================================================ */
export function LegalReview({
  sb,
  userId,
  kind,
  vehicle,
  row,
  notify,
  onChanged,
}: {
  sb: SupabaseClient;
  userId: string;
  kind: Kind;
  vehicle?: string | null;
  row: LegalProfile | null;
  notify: (m: string, k?: 'ok' | 'err') => void;
  onChanged: (r: LegalProfile) => void;
}) {
  const [thumbs, setThumbs] = useState<Partial<Record<DocKey, string>>>({});
  const [notes, setNotes] = useState(row?.admin_notes ?? '');
  const [saving, setSaving] = useState(false);
  const missing = missingItems(kind, row, vehicle);

  useEffect(() => {
    let alive = true;
    (async () => {
      const out: Partial<Record<DocKey, string>> = {};
      for (const [k, path] of Object.entries(row?.docs ?? {})) {
        if (path) out[k as DocKey] = await documentUrl(sb, path).catch(() => '');
      }
      if (alive) setThumbs(out);
    })();
    return () => {
      alive = false;
    };
  }, [sb, row]);

  if (!row) {
    return (
      <p className="rounded-2xl bg-ocre-100 p-4 text-sm text-ocre-600">
        Esta cuenta todavía no tiene datos legales. Se registró antes de que se pidieran o aún no los completa en su panel.
      </p>
    );
  }

  const age = row.birth_date ? Math.floor((Date.now() - new Date(row.birth_date + 'T12:00:00').getTime()) / (365.25 * 864e5)) : null;

  return (
    <div className="space-y-4">
      {missing.length > 0 ? (
        <p className="flex gap-2 rounded-2xl bg-ocre-100 p-3 text-sm text-ocre-600">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" /> Falta: {missing.join(', ')}.
        </p>
      ) : (
        <p className="flex items-center gap-2 rounded-2xl bg-laguna-100 p-3 text-sm font-semibold text-laguna-700">
          <ShieldCheck size={17} /> Datos y documentos completos.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 rounded-2xl bg-cal-100 p-3 text-sm">
        <Info label="Nombre legal" value={row.legal_name} wide />
        <Info label="Cédula" value={formatId(row.id_type, row.id_number)} />
        <Info label="Edad" value={age !== null ? `${age} años` : '—'} />
        {kind === 'merchant' ? (
          <>
            <Info label="RIF" value={formatRif(row.rif)} />
            <Info label="Razón social" value={row.business_legal_name} />
          </>
        ) : (
          <>
            <Info label="Vive en" value={row.home_address} wide />
            <Info label="Emergencia" value={row.emergency_name} />
            <Info label="Tel. emergencia" value={displayPhone(row.emergency_phone)} />
            {row.vehicle_brand && <Info label="Vehículo" value={[row.vehicle_brand, row.vehicle_model, row.vehicle_color].filter(Boolean).join(' · ')} wide />}
            {row.has_license !== null && <Info label="Licencia" value={row.has_license ? 'Sí' : 'No'} />}
            {row.has_rcv !== null && <Info label="RCV" value={row.has_rcv ? 'Sí' : 'No'} />}
          </>
        )}
        <Info
          label="Aceptó términos"
          value={row.terms_accepted_at ? `${new Date(row.terms_accepted_at).toLocaleString('es-VE')} (v. ${row.terms_version})` : 'No'}
          wide
        />
      </dl>

      <div className="grid grid-cols-2 gap-2">
        {DOCS[kind].map((d) => {
          const url = thumbs[d.key];
          const path = row.docs?.[d.key];
          const isPdf = path?.endsWith('.pdf');
          return (
            <a
              key={d.key}
              href={url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className={cn('overflow-hidden rounded-2xl border bg-white', path ? 'border-cal-200' : 'pointer-events-none border-dashed border-cal-300')}
            >
              <div className="flex aspect-[4/3] items-center justify-center bg-cal-100">
                {url && !isPdf ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={d.title} className="h-full w-full object-cover" />
                ) : path ? (
                  <FileText size={28} className="text-tinta-400" />
                ) : (
                  <span className="text-xs text-tinta-400">Sin subir</span>
                )}
              </div>
              <p className="px-2 py-1.5 text-[11px] font-bold leading-tight text-tinta-700">{d.title}</p>
            </a>
          );
        })}
      </div>

      <div>
        <label className="label" htmlFor="admin-notes">
          Notas internas (solo administración)
        </label>
        <textarea id="admin-notes" className="input min-h-[70px] resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: cédula verificada en persona el 30/09" maxLength={500} />
        <button
          type="button"
          disabled={saving || notes === (row.admin_notes ?? '')}
          onClick={async () => {
            setSaving(true);
            const { data, error } = await sb.from('legal_profiles').update({ admin_notes: notes.trim() || null }).eq('user_id', userId).select().single();
            setSaving(false);
            if (error) return notify(friendlyError(error), 'err');
            onChanged(data as LegalProfile);
            notify('Nota guardada');
          }}
          className="btn-ghost mt-2 w-full py-2.5 text-sm"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Guardar nota'}
        </button>
      </div>
    </div>
  );
}
