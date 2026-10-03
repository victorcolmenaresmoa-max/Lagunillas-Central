# Acceso de compradores y categorías

- `/entrar` y `/registro/cliente` son el acceso de compradores, sin selección de roles de trabajo.
- `/aliados` reúne el registro de comercios y repartidores y el enlace a su panel.
- `/entrar?acceso=negocio` conserva el acceso a los paneles existentes.
- Los enlaces antiguos de registro con `tipo` redirigen al apartado de trabajo; `/registro` sin tipo abre el registro de comprador.
- Al iniciar sesión desde una compra, se recupera el carrito en ese mismo navegador y se regresa al comercio. Los precios se recalculan al volver.
- Una cuenta de trabajo no cambia de rol al entrar por el acceso de compradores.
- Las 22 categorías se comparten entre registro, edición de comercio y filtros públicos.

Aplicar `migrations/20261003_buyer_access_categories.sql` después de la migración de pedidos para habilitar las nuevas categorías en Supabase. El `schema.sql` ya incluye la lista actualizada para instalaciones nuevas.
