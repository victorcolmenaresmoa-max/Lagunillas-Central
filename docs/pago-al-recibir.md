# Pago al recibir y direcciones en Google Maps

## Desplegar una instalación existente

1. Pausar pedidos nuevos durante la actualización. Guardar respaldo de Supabase.
2. Aplicar `migrations/20261003_receipt_payment.sql` DESPUÉS de `20261003_orders.sql` y `20261003_buyer_access_categories.sql`. La migración es repetible y no borra pedidos, direcciones ni saldos. No volver a aplicar las migraciones anteriores después de esta, porque sustituyen las funciones nuevas.
3. Subir el commit y desplegar. Ya no se usan la clave de TomTom ni OSRM. Google Maps se abre externamente, sin una clave API de Google.
4. Administración → Ajustes → Pedidos: revisar tarifa fija, comisión, tasa BCV, fecha y tiempos. La tarifa fija utiliza el valor `base` existente; ya no calcula kilómetros. Cambiarla solo afecta a pedidos posteriores.
5. Comercios y repartidores completan su verificación y aceptan la nueva versión de términos antes de aceptar pedidos nuevos. No se permite aprobar aliados incompletos desde el panel. Comercios guardan dirección escrita y datos de pago móvil. Clientes guardan dirección, sector y referencia. Probar los enlaces de Google Maps; una búsqueda por texto no garantiza un pin exacto.
6. Mantener el programador cada minuto para `/api/orders/tick` con `CRON_SECRET`. Los detalles también procesan vencimientos. No depender de que alguien abra una pantalla.
7. Probar con cuentas de cliente, comercio, repartidor y administrador: correo, almacenamiento privado, notas de voz, notificaciones y un pedido completo. Las pruebas locales no verifican el Supabase desplegado ni bancos reales.

Para instalaciones nuevas `schema.sql` incluye la migración. Hacer push por sí solo NO aplica SQL en un Supabase existente.

## Pedidos nuevos

Comercio acepta → búsqueda de repartidor → repartidor acepta y reserva comisión → comercio marca listo → repartidor introduce código de recogida del comercio → traslado → repartidor indica que está con el cliente → comprador paga productos al comercio → comercio verifica su banco → comprador paga delivery al repartidor → repartidor verifica su banco → comprador recibe el paquete y comunica el código de entrega → se completa el pedido y descuenta comisión una sola vez.

Retiro: comercio acepta → prepara → listo → cliente indica que está en el local → paga productos → comercio verifica → entrega con código del cliente. El retiro no paga delivery.

El cliente no paga antes del traslado. Se paga con el paquete presente, antes de cerrar el intercambio; el repartidor y comprador deben hacer entrega y pago en presencia mutua. Un botón de llegada no acredita presencia física y el sistema no puede impedir un impago o robo por sí solo. Los códigos son controles de registro, no seguro ni garantía bancaria. Los reintentos de creación usan una clave única para evitar duplicar pedidos si se pierde la respuesta del servidor.

Las cuentas de cobro se guardan en el pedido y en la asignación: cambiar el perfil no cambia el destinatario de una operación ya aceptada. Las capturas del chat no confirman pagos. Los comprobantes estructurados requieren el monto exacto mostrado en Bs; diferencias, duplicados y pagos inesperados se llevan a soporte. En esta versión las devoluciones automáticas registradas son completas por concepto; una devolución parcial exige atención humana y no se marca falsamente como completa.

El código de recogida solo lo ve el comercio; el código de entrega solo lo ve el cliente y, para pedidos nuevos, únicamente después de los pagos. Cinco intentos incorrectos abren incidencia. El código de entrega no elimina reclamos por contenido o calidad.

## Incidencias y custodia

- Los plazos de aceptación y búsqueda cancelan sin cobrar. Preparación (30 min), traslado (45 min), pago y entrega (15 min tras pagos) vencidos abren incidencia, sin confirmar automáticamente dinero.
- Cliente, comercio y repartidor pueden abrir incidencia; soporte puede responder en el canal compartido. Chats normales continúan disponibles.
- Cancelar después de recoger o reportar pago abre incidencia. Una reserva de comisión queda retenida hasta resolverla.
- Para devolver un paquete: el repartidor registra devolución y el comercio confirma recepción. Administración puede documentar una pérdida de paquete sin simular una devolución física; esa anotación no confirma ni devuelve dinero. Solo cierra cancelación cuando la custodia y las devoluciones de pagos están resueltas, y no hay comprobantes pendientes.
- Una cancelación completa posterior a una entrega revierte la comisión una sola vez. El saldo no se utiliza como indemnización automática.
- Los mensajes se mantienen disponibles durante 48 h tras entregar. Esto no modifica los plazos legales de reclamación; el contacto alternativo de soporte sigue disponible.

Pedidos existentes con modo `prepaid` conservan su secuencia financiera anterior; la pantalla los identifica. Ya no requieren GPS para aceptar nuevas asignaciones históricas. No forzar pedidos ya pagados al nuevo modo.

## Antes del piloto real

Definir aliados verificados, horarios de soporte, valor máximo de pedido, qué hacer ante impago, retorno, daño o pérdida, y quién financia compensaciones. Los contratos y obligaciones fiscales necesitan revisión local. El código no sustituye esas decisiones. La comisión por venta comercial no forma parte de este cambio: los comercios mantienen sus membresías actuales.

## Dependencias

Next.js se actualizó de 14.2.35 a 15.5.24 por avisos de seguridad del framework; las rutas usan parámetros asíncronos. PostCSS se actualiza también para sus avisos. Node.js debe cumplir los requisitos de Next 15 (18.18 o posterior; preferir una versión LTS compatible).

La auditoría de dependencias de producción no reportó vulnerabilidades conocidas en esta revisión. La auditoría completa mantiene cinco avisos altos en la cadena de herramientas de Tailwind 3 (braces, chokidar, micromatch y fast-glob): el registro no ofrece una versión corregida de braces. No se aplicó una migración automática a Tailwind 4 porque requiere revisar estilos y configuración. Estos avisos siguen pendientes; las pruebas de compilación no los eliminan.

## Validación

`npm run test:receipt`: flujo de delivery y retiro, bloqueo de anticipos, códigos, permisos, comisión reservada, cargo y reversión únicos, retorno, cancelaciones y vencimientos en PostgreSQL embebido.

`npm run test:maps`: enlaces codificados de Google y ausencia de mapas/GPS en las pantallas nuevas.

`npm run test:orders`, `npm run test:buyer`, `npm run test:db`, `npm run build`: regresiones y compilación. El despliegue requiere además pruebas con Supabase real.

Referencia de navegación externa: https://developers.google.com/maps/documentation/urls/get-started
