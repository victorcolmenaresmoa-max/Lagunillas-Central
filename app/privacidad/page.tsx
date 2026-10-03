import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { type LegalSection } from '@/components/LegalPage';
import { getSettings } from '@/lib/data';
import { CONTACT_EMAIL, TERMS_VERSION } from '@/lib/legal';
import { waLink } from '@/lib/delivery';

export const metadata: Metadata = {
  title: 'Política de Privacidad · Lagunillas Central',
  description: 'Qué datos recoge Lagunillas Central, para qué los usa, quién los ve y cómo ejercer tus derechos.',
};
export const revalidate = 3600;

const fecha = (v: string) => new Date(v + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function PrivacidadPage() {
  const settings = await getSettings();
  const contacto = (
    <>
      {settings.admin_whatsapp && (
        <>
          por WhatsApp a la administración (
          <a href={waLink(settings.admin_whatsapp)} target="_blank" rel="noopener noreferrer">
            escribir aquí
          </a>
          )
        </>
      )}
      {settings.admin_whatsapp && CONTACT_EMAIL && ' o '}
      {CONTACT_EMAIL && (
        <>
          al correo <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </>
      )}
      {!settings.admin_whatsapp && !CONTACT_EMAIL && 'a través de los canales de contacto de la administración que se muestran en la app'}
    </>
  );

  const sections: LegalSection[] = [
    {
      id: 'responsable',
      title: 'Quién cuida tus datos',
      body: (
        <p>
          El responsable de tus datos es la administración de Lagunillas Central, la plataforma que conecta clientes, comercios y repartidores del municipio
          Lagunillas, estado Mérida. Puedes escribirnos {contacto}.
        </p>
      ),
    },
    {
      id: 'que-datos',
      title: 'Qué datos recogemos',
      body: (
        <>
          <p>
            <b>Si eres cliente</b> (cuenta necesaria para pedidos dentro de la app):
          </p>
          <ul>
            <li>Cuando pides un repartidor: tu nombre, teléfono, dirección de entrega, nota y los productos del pedido.</li>
            <li>Cuando envías el pedido por WhatsApp, ese mensaje va directo al comercio a través de WhatsApp; nosotros no lo guardamos.</li>
            <li>Guardamos tu nombre, teléfono, correo confirmado y direcciones con punto en el mapa en tu cuenta. No solicitamos cédula a clientes.</li>
            <li>Guardamos los pedidos, comprobantes, referencias de pago, tasa BCV, reclamos, calificaciones y mensajes del chat para gestionar la entrega y atender incidencias.</li>
          </ul>
          <p>
            <b>Si eres comercio:</b>
          </p>
          <ul>
            <li>Datos públicos del negocio: nombre, categoría, dirección, horario, WhatsApp, descripción, logo, fotos, productos y ofertas.</li>
            <li>Datos privados: correo, razón social, RIF, y nombre, cédula, fecha de nacimiento y teléfono del responsable.</li>
            <li>Documentos: foto de la cédula del responsable, RIF y, si la subes, la licencia de actividades económicas.</li>
          </ul>
          <p>
            <b>Si eres repartidor:</b>
          </p>
          <ul>
            <li>Nombre, teléfono, correo, foto de perfil y tipo de vehículo (con marca, modelo, color y placa si es moto o carro).</li>
            <li>Datos privados: cédula, fecha de nacimiento, dirección donde vives y un contacto de emergencia.</li>
            <li>Documentos: cédula, una foto tuya con la cédula y, si usas moto o carro, licencia, certificado de circulación y póliza de RCV.</li>
            <li>Tu actividad en la app: si estás disponible, los pedidos que aceptas y entregas, y lo que ganaste por ellos.</li>
          </ul>
          <p>
            <b>Datos técnicos:</b> para enviarte notificaciones guardamos un identificador de tu teléfono; para mantener tu sesión usamos cookies necesarias; y
            para frenar pedidos falsos revisamos por unos minutos la conexión desde la que llegan, sin guardarla. Usamos ubicación GPS solo cuando la autorizas para guardar una dirección o ubicar el comercio, y mientras el repartidor está disponible o lleva un pedido con la app abierta. No usamos cookies de publicidad.
          </p>
        </>
      ),
    },
    {
      id: 'para-que',
      title: 'Para qué los usamos',
      body: (
        <ul>
          <li>Hacer funcionar los pedidos: mostrar comercios, avisar a repartidores y permitir el seguimiento.</li>
          <li>Verificar la identidad de comercios y repartidores antes de aprobarlos, y que sus documentos estén vigentes.</li>
          <li>La seguridad de todos: prevenir fraudes, pedidos falsos y cuentas duplicadas o de personas suspendidas.</li>
          <li>Contactar a tu persona de emergencia si te pasa algo durante una entrega (solo repartidores).</li>
          <li>Enviarte avisos sobre tus pedidos, tu cuenta y tu membresía.</li>
          <li>Atender reclamos y cumplir obligaciones legales o requerimientos de autoridades competentes.</li>
        </ul>
      ),
    },
    {
      id: 'base',
      title: 'Por qué podemos usarlos',
      body: (
        <p>
          Usamos tus datos porque tú los das y aceptas esta política al usar la app o crear tu cuenta, porque son necesarios para prestarte el servicio que
          pides, y para cumplir la ley. Respetamos el derecho a la protección del honor, la vida privada y los datos personales que reconoce la Constitución de
          la República Bolivariana de Venezuela (artículos 28 y 60).
        </p>
      ),
    },
    {
      id: 'quien-ve',
      title: 'Quién ve cada dato',
      body: (
        <>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Dato</th>
                  <th>Quién lo ve</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Datos públicos del comercio</td>
                  <td>Cualquier persona, una vez aprobado</td>
                </tr>
                <tr>
                  <td>Tu pedido con delivery (nombre, teléfono, dirección)</td>
                  <td>El comercio del pedido y la administración</td>
                </tr>
                <tr>
                  <td>Dirección de entrega</td>
                  <td>Los repartidores disponibles ven el sector y el punto de destino para evaluar la ruta; solo el asignado ve tus datos de contacto y dirección escrita.</td>
                </tr>
                <tr>
                  <td>Tu nombre y teléfono como cliente</td>
                  <td>Solo el repartidor que aceptó tu pedido</td>
                </tr>
                <tr>
                  <td>Nombre, foto, vehículo, placa y teléfono del repartidor</td>
                  <td>El cliente de ese pedido y el comercio correspondiente, como parte del historial de la entrega.</td>
                </tr>
                <tr>
                  <td>Cédula, RIF, fecha de nacimiento, dirección, contacto de emergencia y documentos</td>
                  <td>
                    <b>Solo la persona dueña de la cuenta y la administración</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Los comprobantes están en almacenamiento privado; solo los ve quien pagó, quien cobró y la administración. Los datos de pago móvil solo aparecen al cliente en el paso de pago. La administración solo puede leer los chats de pedidos en reclamo. Guardamos únicamente la última ubicación del repartidor, no su recorrido; se actualiza aproximadamente cada 15 segundos con pedido activo y cada 2 minutos disponible. El cliente ve esa ubicación durante la entrega, junto con su hora de actualización.
          </p><p>
            <b>No vendemos ni alquilamos tus datos</b>, ni los usamos para publicidad de terceros.
          </p>
        </>
      ),
    },
    {
      id: 'proveedores',
      title: 'Servicios que usamos',
      body: (
        <>
          <p>Para funcionar, la app se apoya en proveedores que guardan o procesan datos solo por encargo nuestro:</p>
          <ul>
            <li>
              <b>Supabase</b>: base de datos, cuentas y almacenamiento de fotos y documentos. Sus servidores están en los Estados Unidos, por lo que tus datos se
              guardan fuera de Venezuela.
            </li>
            <li>
              <b>Vercel</b>: aloja la app.
            </li><li><b>OpenStreetMap y el servicio de rutas OSRM</b>: muestran el mapa y calculan recorridos. El mapa solicita mosaicos de la zona visible y el servicio de rutas recibe los puntos de origen y destino, sin nombres ni teléfonos. Las rutas pueden estimarse cuando el servicio no está disponible.
            </li>
            <li>
              <b>Google (Gmail)</b>: envía los correos con códigos para confirmar tu cuenta o recuperar tu contraseña.
            </li>
            <li>
              <b>WhatsApp</b>: cuando envías tu pedido o contactas a alguien por WhatsApp, esa conversación se rige por las políticas de WhatsApp.
            </li>
          </ul>
          <p>
            También podemos entregar datos a una autoridad venezolana competente cuando lo exija una orden judicial o la ley, o para proteger la vida o la
            seguridad de una persona.
          </p>
        </>
      ),
    },
    {
      id: 'seguridad',
      title: 'Cómo protegemos tus datos',
      body: (
        <ul>
          <li>Toda la comunicación con la app va cifrada (HTTPS).</li>
          <li>Las contraseñas se guardan cifradas; nadie, ni siquiera la administración, puede verlas.</li>
          <li>La base de datos tiene reglas que impiden que un usuario vea o cambie datos que no son suyos.</li>
          <li>Los documentos están en un almacén privado, sin enlaces públicos: solo se abren con enlaces temporales que vencen en minutos.</li>
          <li>Después de aprobada una cuenta, el nombre legal y la cédula solo los puede corregir la administración.</li>
        </ul>
      ),
    },
    {
      id: 'conservacion',
      title: 'Cuánto tiempo los guardamos',
      body: (
        <ul>
          <li>Mientras tu cuenta esté activa.</li>
          <li>
            Si pides cerrar tu cuenta, borraremos tus documentos y datos personales, salvo lo que debamos conservar para atender reclamos pendientes, prevenir
            fraudes (por ejemplo, que una cuenta suspendida vuelva con otro correo) o cumplir la ley. Eso lo guardamos por el tiempo mínimo necesario.
          </li>
          <li>Los datos de los pedidos se conservan como historial del comercio y del repartidor mientras sus cuentas existan.</li>
        </ul>
      ),
    },
    {
      id: 'derechos',
      title: 'Tus derechos',
      body: (
        <>
          <p>En cualquier momento puedes pedirnos:</p>
          <ul>
            <li>
              <b>Acceso:</b> saber qué datos tuyos tenemos.
            </li>
            <li>
              <b>Rectificación:</b> corregir datos equivocados o desactualizados. Muchos los puedes cambiar tú mismo desde tu panel.
            </li>
            <li>
              <b>Eliminación:</b> que borremos tu cuenta y tus datos, con las excepciones de la sección anterior.
            </li>
            <li>
              <b>Oposición:</b> que dejemos de usar tus datos para algo que no sea necesario para el servicio.
            </li>
          </ul>
          <p>
            Escríbenos {contacto}. Para proteger tu cuenta te pediremos confirmar tu identidad. Responderemos en un plazo razonable, normalmente dentro de 15 días
            hábiles.
          </p>
        </>
      ),
    },
    {
      id: 'menores',
      title: 'Menores de edad',
      body: (
        <p>
          No aceptamos cuentas de comercio ni de repartidor de menores de 18 años. Si eres representante de un menor y crees que nos dio sus datos, escríbenos y
          los borraremos.
        </p>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios a esta política',
      body: (
        <p>
          Si cambiamos esta política, actualizaremos la fecha de vigencia y, si el cambio es importante, lo avisaremos en la app. Lee también los{' '}
          <Link href="/terminos">Términos y Condiciones</Link>.
        </p>
      ),
    },
  ];

  return (
    <LegalPage
      title="Política de Privacidad"
      updated={fecha(TERMS_VERSION)}
      intro={
        <p>
          Aquí te explicamos, sin letra pequeña, qué datos recoge Lagunillas Central, para qué los usa, quién los ve y cómo puedes pedir que los corrijamos o
          borremos.
        </p>
      }
      sections={sections}
      other={{ href: '/terminos', label: 'los Términos y Condiciones' }}
    />
  );
}
