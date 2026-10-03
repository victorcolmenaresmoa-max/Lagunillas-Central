"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthShell,
  TextField,
  PasswordField,
  CheckRow,
  passwordOk,
  isEmail,
} from "@/components/auth";
import { buyerReturnPath } from "@/lib/buyer-navigation";
import VerifyEmail from "@/components/VerifyEmail";
import { getBrowserClient } from "@/lib/supabase-browser";
import { isValidPhone, normalizePhone } from "@/lib/validate";
import { TERMS_VERSION } from "@/lib/legal";
function ClientSignup() {
  const router = useRouter();
  const params = useSearchParams();
  const returnTo = buyerReturnPath(params.get("next"));
  const [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [terms, setTerms] = useState(false),
    [busy, setBusy] = useState(false),
    [verify, setVerify] = useState(false),
    [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (
      name.trim().length < 2 ||
      !isValidPhone(phone) ||
      !isEmail(email) ||
      !passwordOk(password) ||
      !terms
    )
      return setError(
        "Revisa nombre, teléfono, correo, contraseña y términos.",
      );
    const sb = getBrowserClient();
    if (!sb) return setError("App sin conexión a la base de datos.");
    setBusy(true);
    const { data, error } = await sb.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(returnTo)}`,
        data: {
          signup_role: "client",
          full_name: name.trim(),
          phone: normalizePhone(phone),
          terms_version: TERMS_VERSION,
        },
      },
    });
    setBusy(false);
    if (error) return setError(error.message);
    if (data.session) router.replace(returnTo);
    else setVerify(true);
  };
  return (
    <AuthShell
      tab="registro"
      title={verify ? "Confirma tu correo" : "Empieza a comprar con confianza"}
      loginHref={`/entrar?next=${encodeURIComponent(returnTo)}`}
      registerHref={`/registro/cliente?next=${encodeURIComponent(returnTo)}`}
      showTabs={!verify}
      subtitle="Crea tu cuenta para guardar direcciones, confirmar pagos y seguir tus compras en Lagunillas."
    >
      {verify ? (
        <VerifyEmail
          next={returnTo}
          email={email.trim().toLowerCase()}
          onVerified={() => router.replace(returnTo)}
        />
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <TextField
            label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
          <TextField
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
            autoComplete="tel"
          />
          <TextField
            label="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
          <PasswordField
            label="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            showRules
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            <span>
              Acepto los{" "}
              <a href="/terminos" className="underline">
                Términos
              </a>{" "}
              y la{" "}
              <a href="/privacidad" className="underline">
                Privacidad
              </a>
              .
            </span>
          </label>
          {error && <p role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Creando…" : "Crear mi cuenta para comprar"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ClientSignupPage() { return <Suspense><ClientSignup /></Suspense>; }
