# Probar TomTom en Lagunillas Central

La app usa **Map Display API de TomTom Orbis v2** para dibujar calles y lugares en las direcciones, cobertura y seguimiento de pedidos. Leaflet es el visor: los mosaicos vienen de TomTom, no del servidor anterior de OpenStreetMap. Orbis combina distintas fuentes, incluida OpenStreetMap; cambiar de proveedor no garantiza que aparezcan todas las calles locales. El perímetro de delivery sigue siendo una configuración del negocio y necesita validación local.

## Activación

1. Crear una cuenta en [MyTomTom](https://my.tomtom.com/), con el plan para empezar gratis. No hace falta una tarjeta para el nivel gratuito; comprobar las cuotas vigentes en [Precios](https://docs.tomtom.com/pricing).
2. Abrir **API & SDK Keys**. TomTom normalmente crea una clave inicial llamada **My first API key**. Usarla o crear una dedicada a Lagunillas Central.
3. Verificar que la clave tenga asignado el producto **Map Display API**, con acceso a los mosaicos de Orbis. Editar la lista de dominios permitidos para incluir el dominio real de Vercel (por ejemplo, `lagunillas-central.vercel.app`) y el dominio propio si existe. Para pruebas locales, autorizar `localhost` según el formato que admite el panel.
4. En **Vercel → proyecto → Settings → Environment Variables**, añadir **`NEXT_PUBLIC_TOMTOM_API_KEY`**, con la clave como valor. Seleccionar **Production**; habilitar Preview/Development únicamente para los entornos y dominios que se vayan a probar. No enviar la clave por chat ni subir un `.env.local` al repositorio.
5. Después de aprobar y subir estos cambios a `main`, desplegar nuevamente en Vercel con esa variable. Las variables `NEXT_PUBLIC_` se incluyen en la compilación.
6. Abrir `/cobertura` en la app: comprobar calles conocidas de Lagunillas, acercar el mapa y tocar una casa. Luego guardar una dirección en **Mi cuenta**, probando **Usar mi ubicación** desde un teléfono en el lugar de entrega.

Para desarrollo local, poner la variable en `.env.local` y reiniciar el servidor. No hacen falta ID de mapa ni variables de Google.

## Funciones y límites

- Ubicación del teléfono al pulsar el botón, con permiso del navegador, HTTPS y alta precisión solicitada. Se muestra el margen de error; no se garantiza una posición exacta.
- Pin arrastrable y selección de un punto tocando el mapa. La dirección escrita y el punto deben corresponder a la misma casa.
- Círculo de precisión GPS, puntos de comercio/repartidor y recorrido cotizado cuando existe.
- La dirección no se sustituye por un punto genérico de un sector. Las direcciones ya guardadas conservan sus coordenadas hasta que el usuario las corrija.
- Si falta la clave, no hay solicitudes a TomTom; se informa que el mapa no está habilitado y el GPS sigue disponible.
- Si los mosaicos fallan, se muestra un aviso y un botón para reintentar. Revisar clave, dominios autorizados, acceso al producto, cuota y conexión.
- Se conserva la atribución de TomTom y sus fuentes. Las etiquetas provenientes de los comercios se muestran como texto, no como HTML.
- La cotización sigue usando OSRM o la estimación claramente indicada. Esta integración prueba el mapa; no habilita Routing API, búsqueda de direcciones ni satélite de TomTom.
- El plan gratuito tiene cuotas; consultar Analytics en TomTom para controlar uso. Una vista del mapa consume varios mosaicos, no una única solicitud.

## Validación pendiente con clave real

Comprobar en iPhone y Android el permiso aceptado/denegado, la precisión baja, el ajuste del pin, guardado y recuperación de la dirección, y el seguimiento del repartidor. Revisar visualmente la cartografía de Lagunillas antes de aceptar el proveedor como definitivo. Las pruebas locales no confirman la cobertura de todas sus calles.

Referencias oficiales: [obtener clave](https://docs.tomtom.com/platform/documentation/my-tomtom/how-to-get-a-tomtom-api-key), [restricciones de dominios y productos](https://docs.tomtom.com/platform/documentation/my-tomtom/api-key-management), [mosaicos Orbis](https://docs.tomtom.com/map-display-api/documentation/tomtom-orbis-maps/v2/raster/raster-tile), [atribución](https://docs.tomtom.com/map-display-api/documentation/tomtom-orbis-maps/v2/copyrights/copyrights).
