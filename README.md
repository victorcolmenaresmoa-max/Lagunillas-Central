# Lagunillas Central

App móvil hiperlocal para el municipio Lagunillas, Mérida: directorio de comercios, ofertas flash con cuenta regresiva y pedidos armados automáticamente por WhatsApp. Se instala en el teléfono como una app (PWA).

**Tecnología:** Next.js 14 · TypeScript · Tailwind CSS · Supabase · Lucide Icons

---

## Qué incluye

| Pantalla | Ruta | Para quién |
|---|---|---|
| Inicio: buscador, categorías, Flash Deals y directorio | `/` | Clientes |
| Página del comercio: catálogo, cantidades, total y pedido por WhatsApp | `/comercio/[slug]` | Clientes |
| Inicio de sesión | `/admin/login` | Dueños de negocio |
| Panel: perfil, productos y ofertas flash | `/admin/dashboard` | Dueños de negocio |

**Modo demostración:** mientras Supabase no esté conectado, la app muestra 8 comercios de ejemplo y el panel funciona sin guardar cambios.

---

## Puesta en marcha (paso a paso)

### 1. Crear la base de datos en Supabase
1. Entra a [supabase.com](https://supabase.com) → **New project**. Ponle `lagunillas-central` y guarda la contraseña que te pida.
2. Cuando termine de crearse, abre **SQL Editor** (menú izquierdo) → **New query**.
3. Copia todo el contenido del archivo `schema.sql` de este proyecto, pégalo y pulsa **Run**.
4. Ve a **Authentication → Sign In / Providers → Email** y **desactiva "Allow new users to sign up"**. Así solo tú creas las cuentas de los comercios.
5. Ve a **Project Settings → API** y copia dos datos: **Project URL** y **anon public key**.

### 2. Publicar en Vercel
1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project** → importa `Lagunillas-Central` desde GitHub.
2. Antes de pulsar **Deploy**, abre **Environment Variables** y agrega:
   - `NEXT_PUBLIC_SUPABASE_URL` → el Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → la anon public key
3. Pulsa **Deploy**.

### 3. Dar de alta a un comercio
1. En Supabase: **Authentication → Users → Add user → Create new user** (correo y clave del dueño, marca *Auto Confirm User*).
2. En **SQL Editor** ejecuta (cambiando el correo):
   ```sql
   update public.profiles set role = 'merchant'
    where user_id = (select id from auth.users where email = 'dueno@correo.com');
   ```
3. Envíale al dueño el enlace `tu-dominio/admin/login` con su correo y clave. Al entrar por primera vez, el panel le pedirá crear su comercio.

Para hacerte **administrador**, repite el paso 2 con tu correo y `role = 'admin'`.

---

## Para desarrolladores

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                  # http://localhost:3000
```

Estructura principal:

```
schema.sql                 Tablas, funciones y seguridad (RLS)
app/page.tsx               Inicio
app/comercio/[slug]/       Detalle del comercio
app/admin/login/           Acceso de comercios
app/admin/dashboard/       Panel del comercio
components/                Piezas de interfaz
lib/data.ts                Lectura pública (Supabase o demo)
lib/admin-store.ts         Escritura del panel (Supabase o demo)
middleware.ts              Protege /admin
public/manifest.json       Configuración PWA
public/sw.js               Service worker (instalación y modo sin señal)
```
