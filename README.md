# Lagunillas Central

Plataforma hiperlocal para el municipio Lagunillas, Mérida. Los clientes piden a los comercios del pueblo por WhatsApp y pueden pedir un repartidor. Los repartidores reciben el aviso en el teléfono y los comercios administran su catálogo. Tú apruebas y administras todo.

Se instala en el teléfono como una app (PWA), sin pasar por tiendas de aplicaciones.

**Tecnología:** Next.js 14 · TypeScript · Tailwind CSS · Supabase (base de datos, cuentas y fotos) · Notificaciones Web Push

---

## Las 4 vistas

| Vista | Dirección | Quién | Qué hace |
|---|---|---|---|
| **Cliente** | `/` | Cualquier persona, sin cuenta | Busca comercios y ofertas, arma su pedido y lo envía por WhatsApp. Si toca **"Quiero que venga un delivery"**, avisa a los repartidores y puede seguir su pedido en `/pedido/…` |
| **Comercio** | `/panel` | Dueños de negocio aprobados | Edita su perfil, logo y portada, maneja productos con foto, publica ofertas flash, ve sus pedidos con delivery y su membresía |
| **Repartidor** | `/repartidor` | Repartidores aprobados | Se pone disponible, recibe una notificación con sonido por cada pedido, lo acepta (el primero que acepta se lo queda), lo marca como recogido y entregado, y ve sus ganancias |
| **Administración** | `/admin` | Tú | Aprueba o suspende comercios y repartidores, asigna planes, destaca comercios, ve todos los pedidos y ajusta el precio del delivery y de los planes |

Todos entran por **`/entrar`**, y cada quien llega automáticamente a su panel. Los comercios y repartidores se registran en **`/registro`** y quedan **en revisión** hasta que tú los apruebas.

---

## Membresías de los comercios

| | Gratis | Pro | Premium |
|---|---|---|---|
| Productos con foto | 10 | 60 | Ilimitados |
| Ofertas flash activas a la vez | — | 2 | 6 |
| Foto de portada | — | ✓ | ✓ |
| Aparece primero y destacado ⭐ | — | — | ✓ |
| Pedidos por WhatsApp y repartidores | ✓ | ✓ | ✓ |

- El comercio ve los planes en su panel y te escribe por WhatsApp para pagar (pago móvil, transferencia o Zelle).
- Tú activas el plan en **Administración → Comercios → Plan**, eligiendo 1, 3, 6 o 12 meses.
- Cuando vence, el comercio vuelve solo a Gratis.
- Los límites los hace cumplir la base de datos, no solo la pantalla, así que nadie puede saltárselos.
- Los precios se cambian en **Administración → Ajustes**.

---

## Puesta en marcha (paso a paso)

### Paso 1 · Crear la base de datos en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**. Nómbralo `lagunillas-central`, elige la región **East US** (la más cercana) y guarda la contraseña.
2. Cuando esté listo, abre **SQL Editor** → **New query**. Copia **todo** el archivo `schema.sql`, pégalo y pulsa **Run**. Debe decir *Success*.
3. Ve a **Project Settings → API** y copia tres datos:
   - **Project URL**
   - **anon public**
   - **service_role**: es secreta, nunca la compartas.

### Paso 2 · Publicar en Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New… → Project** e importa `Lagunillas-Central` desde GitHub.
2. Antes de **Deploy**, abre **Environment Variables** y agrega una por una:

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | clave pública de notificaciones |
   | `VAPID_PRIVATE_KEY` | clave privada de notificaciones |
   | `VAPID_SUBJECT` | `mailto:` + tu correo, por ejemplo `mailto:tucorreo@gmail.com` |

   Las dos claves de notificaciones se generan con `npm run vapid`. Si ya te las dieron, usa esas. Guárdalas: si las cambias, cada teléfono debe volver a activar las notificaciones.
3. Pulsa **Deploy**. Al terminar, copia tu dirección, por ejemplo `https://lagunillas-central.vercel.app`.

### Paso 3 · Conectar los correos de la app con tu dirección

En Supabase → **Authentication → URL Configuration**:
- **Site URL:** tu dirección de Vercel.
- **Redirect URLs** → **Add URL:** `https://TU-DIRECCION/auth/callback`

Sin esto, los enlaces de "confirmar cuenta" y "cambiar contraseña" no funcionan.

### Paso 4 · Correos de confirmación

El correo gratuito de Supabase solo envía **unos pocos correos por hora**. Elige una opción:
- **Para arrancar:** Authentication → Sign In / Providers → Email → desactiva **Confirm email**. Las cuentas quedan activas al instante. Igual nadie puede operar hasta que tú lo apruebes.
- **Para crecer:** conecta un servicio de correo (Resend, Brevo…) en Authentication → Emails → SMTP Settings y deja **Confirm email** activado.

### Paso 5 · Hacerte administrador

1. Abre tu app y regístrate en `/registro` (como comercio o repartidor; da igual).
2. En Supabase → SQL Editor, ejecuta (con tu correo):
   ```sql
   update public.profiles set role = 'admin'
    where user_id = (select id from auth.users where email = 'TU-CORREO@gmail.com');
   ```
3. Entra por `/entrar`: llegarás a **Administración**. En **Ajustes** pon tu WhatsApp (para cobrar membresías), el precio del delivery y el de los planes.

---

## Notificaciones a repartidores

- **Android (Chrome):** funcionan aunque la app esté cerrada. El repartidor toca **Activar notificaciones** una vez.
- **iPhone:** requieren iOS 16.4 o superior y que la app esté **instalada** (Compartir → Agregar a inicio). El panel lo explica.
- Con la app abierta, además **suena una alerta** cuando llega un pedido, y la lista se actualiza sola cada 10 segundos.
- También reciben avisos el comercio (pedido nuevo, repartidor en camino, entregado) y el administrador (registro nuevo por aprobar).

## Fotos

Las fotos (logos, portadas, productos y repartidores) se suben desde el teléfono a **Supabase Storage**, en el bucket `media`. Antes de subir, la app las reduce y convierte a WEBP para que carguen rápido. Cada usuario solo puede subir y borrar fotos en su propia carpeta. Las fotos que se reemplazan se borran solas.

## Seguridad

- Todas las tablas tienen seguridad por filas (RLS). Cada rol solo ve y cambia lo suyo.
- Los precios del pedido con delivery los calcula el servidor con los datos de la base, no el teléfono del cliente.
- Un repartidor solo ve el teléfono del cliente después de aceptar el pedido.
- La clave `service_role` solo se usa en el servidor (`/api`).
- Hay límites contra pedidos falsos o repetidos: por teléfono, por conexión y una trampa anti-robots.

---

## Para desarrolladores

```bash
npm install
cp .env.example .env.local   # rellena las claves
npm run dev                  # http://localhost:3000
npm run test:db              # 36 pruebas de reglas de la base (usar SOLO con una base de pruebas)
```

```
schema.sql                     Tablas, reglas, funciones, RLS y bucket de fotos
app/page.tsx                   Inicio del cliente
app/comercio/[slug]/           Página del comercio + pedido
app/pedido/[token]/            Seguimiento del pedido (cliente)
app/entrar/ · app/registro/    Acceso y registro
app/panel/                     Panel del comercio
app/repartidor/                Panel del repartidor
app/admin/                     Panel de administración
app/api/deliveries/            Crear, seguir, cancelar y avanzar pedidos (+ notificaciones)
lib/push-server.ts             Envío de notificaciones
lib/upload.ts                  Compresión y subida de fotos
lib/plans.ts                   Membresías (espejo de plan_limits en schema.sql)
public/sw.js                   Service worker: instalación, modo sin señal y notificaciones
tests/reglas-db.test.mjs       Pruebas de permisos, planes, fotos y delivery
```
