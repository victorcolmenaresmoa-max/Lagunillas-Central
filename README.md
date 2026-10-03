# Lagunillas Central

Plataforma hiperlocal para el Lagunillas, municipio Sucre, Mérida. Los clientes exploran sin cuenta y, con correo confirmado, hacen pedidos, pagan por separado al comercio y al repartidor y siguen la entrega dentro de la app. El retiro por WhatsApp sigue disponible. Los repartidores reciben el aviso en el teléfono y los comercios administran su catálogo. Tú apruebas y administras todo.

Se instala en el teléfono como una app (PWA), sin pasar por tiendas de aplicaciones.

**Tecnología:** Next.js 14 · TypeScript · Tailwind CSS · Supabase (base de datos, cuentas y fotos) · Notificaciones Web Push

---

## Las 4 vistas

| Vista | Dirección | Quién | Qué hace |
|---|---|---|---|
| **Cliente** | `/`, `/mis-pedidos`, `/mi-cuenta` | Explorar sin cuenta; pedir con cuenta confirmada | Direcciones con mapa, cotización por distancia, pagos separados, chat, código de entrega y calificación |
| **Comercio** | `/panel` | Dueños de negocio aprobados | Edita su perfil, logo y portada, maneja productos con foto, publica ofertas flash, ve sus pedidos con delivery y su membresía |
| **Repartidor** | `/repartidor` | Repartidores aprobados | Se pone disponible, recibe una notificación con sonido por cada pedido, lo acepta (el primero que acepta se lo queda), lo marca como recogido y entregado, y ve sus ganancias |
| **Administración** | `/admin` | Tú | Aprueba o suspende comercios y repartidores, asigna planes, destaca comercios, ve todos los pedidos y ajusta el precio del delivery y de los planes |

Además hay dos páginas públicas: **`/terminos`** (Términos y Condiciones) y **`/privacidad`** (Política de Privacidad). Están enlazadas en el registro, al hacer un pedido y al pie de la app.

Todos entran por **`/entrar`** (Iniciar sesión) y cada quien llega automáticamente a su panel. Si olvidan la contraseña, la recuperan en **`/entrar/recuperar`** con un código que llega al correo. Los comercios y repartidores se registran en **`/registro`** y quedan **en revisión** hasta que tú los apruebas.

---

## Datos legales y documentos

Para registrarse, comercios y repartidores dan datos legales en 3 pasos y aceptan los Términos y la Política de Privacidad:

| | Comercio | Repartidor |
|---|---|---|
| Identidad | Razón social, RIF, nombre, cédula, fecha de nacimiento y teléfono del responsable | Nombre, cédula, fecha de nacimiento, teléfono, dirección donde vive |
| Extra | — | Vehículo (marca, modelo, color, placa), licencia y RCV si es moto o carro; contacto de emergencia |
| Documentos (desde su panel) | Cédula del responsable, RIF, licencia de actividades (opcional) | Cédula, selfie con la cédula; licencia, certificado de circulación y RCV si es moto o carro |

- Solo pueden registrarse **mayores de 18 años**, y una cédula no puede tener dos cuentas del mismo tipo.
- Estos datos van a una tabla privada (`legal_profiles`) y los documentos a un almacén privado (`documentos`): **solo los ven el dueño de la cuenta y tú**. Ni el público ni los comercios ni otros repartidores.
- En **Administración → Comercios / Repartidores**, el botón 🛡 muestra si la verificación está completa, los datos y las fotos de los documentos, y te deja notas internas. Si apruebas una cuenta incompleta, la app te avisa antes.
- Quienes se registraron antes de este cambio ven en su panel **"Completa tu verificación"**.
- Si algún día cambias los términos, cambia la fecha `TERMS_VERSION` en `lib/legal.ts`: a todos se les pedirá aceptarlos de nuevo.

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

## Integración de pedidos de octubre de 2026

Ver [pedidos y cobertura](docs/pedidos-y-cobertura.md) para activar la migración, configurar BCV, validar el perímetro de Lagunillas y programar vencimientos. `/cobertura` muestra el mapa público. Las tarifas iniciales son $1 hasta 1,5 km, $0,40/km adicional, redondeo a $0,25, tope $4 y comisión 10 %. Solo se admiten destinos internos. Los pedidos anteriores por WhatsApp conservan sus pantallas.

`npm run test:orders` ejecuta las pruebas locales de PostgreSQL embebido, sin tocar Supabase.

El acceso de compradores está en `/entrar` y `/registro/cliente`. Los registros de comercios y repartidores están en `/aliados`. Ver [acceso de compradores y categorías](docs/acceso-compradores.md); para actualizar una base existente, aplicar `migrations/20261003_buyer_access_categories.sql` después de la migración de pedidos. `npm run test:buyer` comprueba el retorno a la compra y el registro de las 22 categorías en PostgreSQL local.

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
   | `NEXT_PUBLIC_CONTACT_EMAIL` | (opcional) correo de contacto que aparece en Términos y Privacidad |

   Las dos claves de notificaciones se generan con `npm run vapid`. Si ya te las dieron, usa esas. Guárdalas: si las cambias, cada teléfono debe volver a activar las notificaciones.
3. Pulsa **Deploy**. Al terminar, copia tu dirección, por ejemplo `https://lagunillas-central.vercel.app`.

### Paso 3 · Conectar los correos de la app con tu dirección

En Supabase → **Authentication → URL Configuration**:
- **Site URL:** tu dirección de Vercel.
- **Redirect URLs** → **Add URL:** `https://TU-DIRECCION/auth/callback`

Sin esto, los enlaces de "confirmar cuenta" y "cambiar contraseña" no funcionan.

### Paso 4 · Correos (recuperar contraseña y confirmar cuenta)

El correo gratuito que trae Supabase **solo envía a los correos de tu equipo en Supabase y como máximo unos 2 por hora**. Por eso la recuperación de contraseña no le llega a la gente. Hay que conectar un correo propio. Gmail es gratis y alcanza para unos 500 correos al día:

1. Crea un Gmail para la app, por ejemplo `lagunillascentral@gmail.com`.
2. En esa cuenta, activa la **Verificación en 2 pasos**: myaccount.google.com → Seguridad.
3. Entra a **myaccount.google.com/apppasswords**, crea una contraseña de aplicación llamada `Supabase` y copia las 16 letras.
4. En Supabase → **Authentication → Emails → SMTP Settings**, activa **Enable Custom SMTP** y llena:
   - Sender email: tu Gmail · Sender name: `Lagunillas Central`
   - Host: `smtp.gmail.com` · Port: `587`
   - Username: tu Gmail · Password: las 16 letras
5. En **Authentication → Rate Limits**, sube **Rate limit for sending emails** a `100` por hora.
6. En **Authentication → Emails → Templates** pega las plantillas de la carpeta `emails/` (abre el archivo en GitHub, pulsa copiar y pégalo en **Message body**):
   - **Reset Password** → `emails/recuperar-clave.html` · Asunto: `Tu código para recuperar tu cuenta · Lagunillas Central`
   - **Confirm signup** → `emails/confirmar-cuenta.html` · Asunto: `Confirma tu cuenta · Lagunillas Central`

   Las plantillas traen un **código numérico** (la app espera 8 dígitos; si en Supabase cambias "Email OTP Length", pon el mismo número en la variable `NEXT_PUBLIC_OTP_LENGTH` de Vercel), que funciona aunque la persona abra el correo en otro teléfono o con la app instalada, y además un botón de respaldo.
7. En **Authentication → URL Configuration → Redirect URLs** agrega `https://TU-DIRECCION/**` (con los dos asteriscos al final).

**¿Confirmar el correo al registrarse?** En Authentication → Sign In / Providers → Email → **Confirm email**:
- **Activado** (recomendado cuando ya tengas el Gmail conectado): la persona escribe el código que le llega antes de entrar.
- **Desactivado**: la cuenta queda activa al instante. Igual nadie opera hasta que tú lo apruebes.

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
# Pruebas de privacidad de datos legales sin Supabase: ver tests/sql/LEEME.md
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
