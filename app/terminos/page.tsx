import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { type LegalSection } from '@/components/LegalPage';
import { getSettings } from '@/lib/data';
import { CONTACT_EMAIL, TERMS_VERSION } from '@/lib/legal';
import { waLink } from '@/lib/delivery';

export const metadata: Metadata = {
  title: 'Términos y Condiciones · Lagunillas Central',
  description: 'Reglas de uso de Lagunillas Central para clientes, comercios y repartidores.',
};
export const revalidate = 3600;

const fecha = (v: string) => new Date(v.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' });

export default async function TerminosPage() {
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
      id: 'que-es',
      title: 'Qué es Lagunillas Central',
      body: (
        <>
          <p>
            Lagunillas Central (<b>“la app”</b> o <b>“nosotros”</b>) es una plataforma digital que conecta a personas del Lagunillas, municipio Sucre, estado
            Mérida, Venezuela, con comercios de la zona y con repartidores independientes.
          </p>
          <p>A través de la app puedes:</p>
          <ul>
            <li>
              <b>Como cliente:</b> explorar sin cuenta; con cuenta y correo confirmado, pedir dentro de la app, registrar pagos y seguir la entrega. El retiro por WhatsApp continúa disponible sin cuenta.
            </li>
            <li>
              <b>Como comercio:</b> mostrar tu negocio y tu catálogo, publicar ofertas y recibir pedidos.
            </li>
            <li>
              <b>Como repartidor:</b> recibir avisos de pedidos que necesitan entrega y aceptarlos.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: 'aceptacion',
      title: 'Aceptación de estos términos',
      body: (
        <>
          <p>
            Al usar la app aceptas estos Términos y Condiciones y la <Link href="/privacidad">Política de Privacidad</Link>. Si no estás de acuerdo, no uses
            la app.
          </p>
          <p>
            Los comercios y repartidores los aceptan de forma expresa al crear su cuenta, marcando la casilla correspondiente. Guardamos la fecha y la versión
            aceptada. Conservamos ese registro como evidencia de aceptación, conforme a los requisitos legales aplicables.
          </p>
        </>
      ),
    },
    {
      id: 'quien',
      title: 'Quién puede usar la app',
      body: (
        <ul>
          <li>Para tener cuenta de <b>comercio</b> o de <b>repartidor</b> debes ser mayor de 18 años y tener capacidad legal para contratar.</li>
          <li>Los clientes necesitan cuenta confirmada para pedir dentro de la app. Si eres menor de edad, pide con autorización de tu representante.</li>
          <li>Cada persona puede tener una sola cuenta de cada tipo. Una misma cédula no puede registrarse dos veces como repartidor ni como comercio.</li>
        </ul>
      ),
    },
    {
      id: 'intermediario',
      title: 'Nuestro papel: somos un intermediario',
      body: (
        <>
          <p>Esto es lo más importante de estos términos:</p>
          <ul>
            <li>
              <b>No vendemos los productos.</b> La compra es un acuerdo directo entre el cliente y el comercio. El comercio es el único responsable de sus
              productos, precios, calidad, existencia, garantía y facturación.
            </li>
            <li>
              <b>No prestamos el servicio de entrega.</b> Los repartidores son personas independientes que deciden libremente cuándo trabajar y qué pedidos
              aceptar. La calificación jurídica de la relación depende de los acuerdos y de la actividad real, conforme a la legislación aplicable.
            </li>
            <li>
              <b>No cobramos ni recibimos el pago de los pedidos.</b> Por ahora el cliente paga directamente al comercio y al repartidor (ver sección
              “Precios y pagos”).
            </li>
          </ul>
          <p>Nuestro trabajo es ofrecer la herramienta, verificar a comercios y repartidores antes de aprobarlos y ayudar a resolver problemas cuando podamos.</p>
        </>
      ),
    },
    {
      id: 'cuentas',
      title: 'Cuentas y verificación',
      body: (
        <ul>
          <li>Debes dar datos reales, completos y actualizados. Dar datos falsos o de otra persona es causa de suspensión inmediata y puede ser un delito.</li>
          <li>
            Pedimos datos legales y fotos de documentos (cédula, RIF, licencia, certificado de circulación, póliza de RCV, según el caso) para verificar tu
            identidad y proteger a todos los usuarios.
          </li>
          <li>Las cuentas nuevas quedan “en revisión”. La administración decide si aprueba una cuenta y puede pedir documentos adicionales.</li>
          <li>Eres responsable de cuidar tu contraseña y de todo lo que se haga con tu cuenta. Si crees que alguien entró a tu cuenta, cambia tu contraseña y avísanos.</li>
          <li>Debes mantener vigentes tus documentos (por ejemplo, licencia y RCV) y actualizarlos en tu panel cuando cambien.</li>
        </ul>
      ),
    },
    {
      id: 'comercios',
      title: 'Obligaciones de los comercios',
      body: (
        <ul>
          <li>Publicar información veraz: nombre, dirección, horario, productos, fotos y precios.</li>
          <li>Respetar los precios y ofertas que publica mientras estén vigentes, y avisar al cliente si algo no está disponible.</li>
          <li>Contar con los permisos que exige la ley para su actividad (RIF, licencia de actividades económicas y, si vende alimentos, los permisos sanitarios).</li>
          <li>Emitir factura o comprobante cuando corresponda y cumplir sus obligaciones fiscales.</li>
          <li>Entregar al repartidor el pedido bien empacado y cerrado, y avisar si contiene algo frágil.</li>
          <li>Atender los reclamos de sus clientes sobre los productos.</li>
          <li>
            No vender a través de la app: armas, explosivos, drogas, medicamentos que requieran récipe sin cumplir los requisitos legales, bebidas alcohólicas o
            tabaco a menores, productos robados, falsificados o cualquier cosa prohibida por la ley.
          </li>
        </ul>
      ),
    },
    {
      id: 'repartidores',
      title: 'Obligaciones de los repartidores',
      body: (
        <ul>
          <li>Si usas moto o carro: tener licencia de conducir vigente, certificado de circulación del vehículo y seguro de Responsabilidad Civil Vehicular (RCV) vigente.</li>
          <li>Respetar las leyes de tránsito, usar casco en moto y manejar con prudencia. Eres el único responsable de tu conducción y de tu vehículo.</li>
          <li>Aceptar solo los pedidos que puedas cumplir, recogerlos en el comercio y entregarlos en buen estado y en un tiempo razonable.</li>
          <li>Marcar en la app cada paso del pedido (aceptado, recogido, entregado) de forma honesta.</li>
          <li>Cobrar solo el monto del pedido y la tarifa de delivery mostrados en la app.</li>
          <li>
            Usar el nombre, teléfono y dirección del cliente <b>solo para hacer esa entrega</b>. Está prohibido guardarlos, compartirlos o usarlos para
            cualquier otra cosa.
          </li>
          <li>Tratar con respeto a clientes y comercios.</li>
        </ul>
      ),
    },
    {
      id: 'clientes',
      title: 'Obligaciones de los clientes',
      body: (
        <ul>
          <li>Dar un nombre, teléfono y dirección correctos, con un punto de referencia claro.</li>
          <li>Estar disponible para recibir el pedido y pagar lo acordado.</li>
          <li>No hacer pedidos falsos o de broma. La app tiene límites automáticos contra pedidos repetidos y puede bloquear teléfonos o conexiones que abusen.</li>
          <li>Tratar con respeto a repartidores y comercios.</li>
        </ul>
      ),
    },
    {
      id: 'pagos',
      title: 'Precios y pagos',
      body: (
        <>
          <ul>
            <li>Los precios de los productos los fija cada comercio. Los montos se muestran como referencia en la moneda indicada en la app.</li>
            <li>Los pedidos nuevos usan una tarifa fija de delivery para Lagunillas, mostrada antes de enviar. Cliente y comercio indican direcciones escritas; Google Maps se abre como servicio externo. El comercio y el repartidor deben comprobar acceso y cobertura antes de aceptar. Los pedidos anteriores conservan sus condiciones originales.</li>
            <li>La tasa BCV y su fecha se guardan en el pedido. Los pedidos nuevos se pagan al recibir: el repartidor habilita el pago al llegar, o el cliente al estar en el local para retirar. No se pide anticipar dinero antes del traslado. Una captura de pago nunca sustituye la verificación del banco.</li>
            <li>Al aceptar se reserva en el saldo prepagado del repartidor la comisión configurada y guardada en el pedido; al completar se descuenta una sola vez. No se puede aceptar sin saldo disponible suficiente. Las cancelaciones anteriores a recogida liberan la reserva; después de recoger requieren resolver la custodia del paquete y los pagos. Las recargas necesitan confirmación de la administración.</li>
            <li>
              <b>El cliente paga directamente</b> los productos al comercio y el delivery al repartidor. Los pedidos dentro de la app usan pago móvil con comprobante, últimos cinco dígitos de referencia, banco y monto. Solo quien cobra confirma que vio el dinero en su banco. La app no recibe ese dinero. Efectivo, punto de venta y Zelle se acuerdan directamente para retiro o WhatsApp.
            </li>
            <li>Nunca te pediremos claves bancarias ni códigos de confirmación. Si alguien te los pide en nombre de la app, es un fraude.</li>
          </ul>
          <p>
            <b>Membresías de comercios.</b> Los planes Pro y Premium se pagan a la administración por el período elegido. El plan se activa cuando se confirma
            el pago y, al vencer, el comercio vuelve al plan Gratis. No hay reembolsos por períodos no usados, salvo que el servicio no se haya podido prestar
            por causa nuestra. Podemos cambiar los precios de los planes avisando con anticipación; el cambio no afecta períodos ya pagados.
          </p>
        </>
      ),
    },
    {
      id: 'reclamos',
      title: 'Cancelaciones y reclamos',
      body: (
        <ul>
          <li>Cancelar después de cobrar abre un reclamo; quien recibió el pago debe registrar la devolución y el cliente confirma que llegó. Los plazos de aceptación y pago pueden cancelar o liberar una asignación; los plazos de confirmación bancaria avisan a la administración y nunca confirman un pago automáticamente.</li>
          <li>Los pedidos nuevos requieren un código de recogida del comercio y otro de entrega del cliente. La entrega solo se registra tras confirmar los pagos correspondientes y el código del cliente. Ese código acredita recepción dentro del procedimiento, pero no elimina reclamos sobre calidad o contenido. El chat admite texto, fotos y audio; en reclamos se habilita soporte. Tras entregar, se admite comunicación durante 48 horas; esto no limita otros plazos legales de reclamación.</li>
          <li>Los reclamos sobre el producto (calidad, cantidad, precio, estado) se hacen al comercio.</li>
          <li>Los reclamos sobre la entrega (demora, trato, daños en el traslado) se hacen al repartidor.</li>
          <li>
            Puedes avisarnos {contacto}. Revisaremos el caso, podremos mediar y, si hubo una falta grave, suspender la cuenta responsable. Un pago directo al comercio o repartidor no puede ser revertido unilateralmente por la app. Un código, saldo o ubicación no constituye un seguro contra pérdida o robo. Esto no limita los
            derechos que te da la ley como consumidor.
          </li>
        </ul>
      ),
    },
    {
      id: 'prohibido',
      title: 'Usos prohibidos',
      body: (
        <ul>
          <li>Hacerse pasar por otra persona o comercio, o usar documentos ajenos o alterados.</li>
          <li>Publicar contenido falso, ofensivo, discriminatorio, violento o ilegal.</li>
          <li>Acosar, amenazar o estafar a otros usuarios.</li>
          <li>Intentar entrar a cuentas ajenas, copiar datos de la app de forma masiva o dañar su funcionamiento.</li>
          <li>Usar la app para actividades ilegales.</li>
        </ul>
      ),
    },
    {
      id: 'contenido',
      title: 'Contenido y propiedad intelectual',
      body: (
        <>
          <p>El nombre, el logo, el diseño y el código de Lagunillas Central nos pertenecen y no se pueden copiar sin permiso.</p>
          <p>
            Los comercios y repartidores conservan los derechos de las fotos, logos y textos que suben. Al subirlos, nos permiten mostrarlos gratuitamente dentro
            de la app y en su promoción mientras la cuenta exista, y garantizan que tienen derecho a usarlos.
          </p>
        </>
      ),
    },
    {
      id: 'responsabilidad',
      title: 'Limitación de responsabilidad',
      body: (
        <>
          <p>Hacemos nuestro mejor esfuerzo para que la app funcione bien, pero se ofrece “tal como está” y puede tener fallas o interrupciones (por ejemplo, por falta de internet o de electricidad).</p>
          <p>En la medida en que la ley lo permita, Lagunillas Central no responde por:</p>
          <ul>
            <li>La calidad, seguridad, legalidad o existencia de los productos que venden los comercios.</li>
            <li>Los actos de comercios, repartidores o clientes, incluidos retrasos, pérdidas, daños o accidentes durante una entrega.</li>
            <li>Los pagos y acuerdos hechos directamente entre usuarios.</li>
            <li>Daños causados por datos falsos que haya dado otro usuario.</li>
          </ul>
          <p>Esto no aplica cuando el daño sea causado por dolo o culpa grave de nuestra parte.</p>
        </>
      ),
    },
    {
      id: 'suspension',
      title: 'Suspensión y cierre de cuentas',
      body: (
        <>
          <p>
            Podemos suspender o cerrar una cuenta, sin aviso previo cuando la gravedad lo justifique, si se incumplen estos términos, si hay datos o documentos
            falsos, quejas graves repetidas, o por orden de una autoridad.
          </p>
          <p>
            Puedes pedir el cierre de tu cuenta en cualquier momento {contacto}. Conservaremos solo los datos que la ley nos obligue a guardar, como explica la{' '}
            <Link href="/privacidad">Política de Privacidad</Link>.
          </p>
        </>
      ),
    },
    {
      id: 'cambios',
      title: 'Cambios a estos términos',
      body: (
        <p>
          Podemos actualizar estos términos. La fecha de vigencia siempre aparece al inicio. Si el cambio es importante, lo avisaremos en la app y los comercios
          y repartidores deberán aceptarlo de nuevo desde su panel para seguir usándola.
        </p>
      ),
    },
    {
      id: 'ley',
      title: 'Ley aplicable',
      body: (
        <p>
          Estos términos se rigen por las leyes de la República Bolivariana de Venezuela. Antes de acudir a los tribunales, las partes intentarán resolver
          cualquier diferencia de forma amistosa. Si no es posible, serán competentes los tribunales del estado Mérida.
        </p>
      ),
    },
    {
      id: 'contacto',
      title: 'Contacto',
      body: <p>Si tienes preguntas sobre estos términos, escríbenos {contacto}.</p>,
    },
  ];

  return (
    <LegalPage
      title="Términos y Condiciones"
      updated={fecha(TERMS_VERSION)}
      intro={
        <p>
          Estas son las reglas para usar Lagunillas Central. Las escribimos en lenguaje sencillo para que cualquiera las entienda. Aplican a clientes, comercios
          y repartidores.
        </p>
      }
      sections={sections}
      other={{ href: '/privacidad', label: 'la Política de Privacidad' }}
    />
  );
}
