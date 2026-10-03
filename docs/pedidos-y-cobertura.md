# Pedidos, pagos y cobertura de Lagunillas

Implementación basada en el PDF «Flujo de pedidos, pagos y delivery», con la decisión de operar **solo dentro de Lagunillas**. No incluye tarifas ni pedidos hacia otras parroquias.

## Activar una instalación existente

1. Aplicar `migrations/20261003_orders.sql` en Supabase. Para instalaciones nuevas, `schema.sql` ya incluye esta migración. Es repetible y conserva los pedidos anteriores.
2. Administración → Ajustes → Pedidos: guardar tasa BCV y fecha, revisar tarifas, tiempos y contorno de cobertura en el mapa. No se permiten pedidos con tasa cero.
3. Cada comercio guarda sus datos de pago móvil y el punto del local en Perfil. Cada repartidor guarda su pago móvil y solicita una recarga que la administración confirma.
4. Configurar un programador externo para llamar **cada minuto** a `GET /api/orders/tick` con `Authorization: Bearer <CRON_SECRET>`. Definir `CRON_SECRET` en el servidor. Las consultas del panel también procesan vencimientos; sin programador, cuando nadie abre la app los avisos se retrasan. No usar una tarea diaria para límites de 10 minutos.
5. Opcional: configurar `OSRM_URL` con una instancia compatible para producción. El valor predeterminado es el servidor público de demostración de OSRM, que no ofrece garantías de disponibilidad. Si no responde, la cotización muestra explícitamente la estimación de línea recta × 1,4. No presenta esa estimación como distancia real por carretera.
6. Confirmación de correo de Supabase y Web Push usan la configuración existente. Verificar un pedido completo con cuentas de prueba de cliente, comercio y repartidor antes de operar con dinero real.

## Flujo

Cliente con correo confirmado → comercio acepta → cliente sube pago de productos → comercio verifica su banco → repartidores cercanos reciben el aviso → uno acepta → cliente sube pago de delivery → repartidor verifica su banco → comercio marca listo → repartidor recoge → código de cuatro dígitos → entrega y calificación.

El retiro dentro de la app salta búsqueda y pago de repartidor; mantiene pago de productos y código de entrega. WhatsApp sin cuenta queda como alternativa para retirar en el local. Los pedidos anteriores continúan en secciones identificadas como anteriores.

Productos y delivery se pagan directamente a sus respectivos receptores. La app guarda comprobantes privados y la identidad de quien confirmó, nunca confirma dinero por leer una captura. La tasa y su fecha quedan guardadas en cada pedido. Una referencia de cinco dígitos repetida se marca como advertencia, no como prueba definitiva de fraude.

Solo el primer repartidor puede aceptar; la transacción bloquea su fila y la del pedido. Un repartidor solo puede tener un pedido sin cerrar. La comisión se descuenta al entregar, en una transacción, y el libro de saldo impide repetir el descuento. Se trunca la comisión al centavo para conservar el ejemplo del PDF: $1,75 × 10 % = $0,17 de comisión y $1,58 netos.

## Mapa: datos comprobados y límites

- Centro: [OSM node 722277188](https://www.openstreetmap.org/node/722277188), 8.4978615, -71.3896149.
- El Molino: [OSM node 9068787411](https://www.openstreetmap.org/node/9068787411), 8.5074744, -71.4080858.
- Laguna de Urao: [OSM way 57800085](https://www.openstreetmap.org/way/57800085), geometría consultada el 3 de octubre de 2026. El archivo `lib/laguna-urao.json` conserva fuente, fecha y licencia ODbL. Se excluyen destinos dentro del agua.
- [OSRM Route API](https://project-osrm.org/docs/v5.24.0/api/#route-service): coordenadas origen → destino, distancia por carretera y límite de aproximación de 150 m a la red vial. El tramo repartidor → comercio no incrementa la tarifa.

El contorno inicial **es un perímetro operativo aproximado**, no un límite catastral ni una delimitación oficial de barrios. El PDF es un esquema medido sobre una captura; tampoco permite demostrar cobertura de todas las casas. Por eso no se inventan sectores ni se importan poblados de otras parroquias como barrios de Lagunillas. Administración puede dibujar el contorno y agregar referencias con nombre y punto. `/cobertura` permite comprobar cualquier punto sin cuenta; los mismos controles se ejecutan en el servidor al guardar direcciones, ubicar comercios, poner repartidores disponibles y cotizar pedidos.

Para identificar todos los barrios locales faltan sus nombres usados por residentes y la validación del borde operativo, especialmente en extremos norte/sur. El sistema acepta direcciones escritas y puntos exactos dentro del contorno aunque no exista un barrio en el catálogo de referencias.

## Privacidad y operación

Las tablas nuevas no admiten lectura o escritura directa de usuarios por REST: se acceden a través del servidor después de autenticar y verificar participantes. El código de entrega solo se devuelve al cliente. Los comprobantes se leen con enlaces temporales de 2 minutos, exclusivamente por pagador, receptor y administración. Los datos bancarios solo se muestran al cliente en el paso correspondiente. El chat de administración solo se devuelve cuando hay reclamo.

Chat cliente-comercio desde aceptación hasta salida; chat cliente-repartidor desde confirmación del pago hasta dos horas después de entregar, con mensajes rápidos y fotos privadas. Las pantallas se actualizan aproximadamente cada 10 segundos y usan Web Push cuando está configurado.

GPS requiere la app abierta. Se guarda solo la última posición; 15 segundos con pedido activo y 2 minutos disponible. No se guarda un recorrido histórico. El panel del cliente muestra si la última posición está desactualizada. Los datos públicos de OSM no garantizan todas las calles; los puntos de casa/local deben verificarse en campo.

La migración, configuración BCV, validación local del contorno, programador y pruebas con Supabase todavía deben aplicarse al entorno desplegado. Subir código a GitHub no realiza estas operaciones por sí mismo.

## Pruebas locales

`npm run test:orders` utiliza PostgreSQL embebido (PGlite), sin conectarse a Supabase ni tocar datos de producción. Comprueba migración repetible, transiciones, permisos de confirmación, referencias repetidas, plazos, código de entrega, recargas, descuento único y cobertura. PGlite usa `gen_random_uuid` nativo y omite la declaración de extensión `pgcrypto` durante esa simulación.

`npm run build` comprueba compilación y tipos. Las pruebas locales no sustituyen una prueba completa de correo, almacenamiento privado, notificaciones y GPS en teléfonos conectados al Supabase real.
