-- =====================================================================
--  LAGUNILLAS CENTRAL — Base de datos (versión 2: plataforma completa)
--
--  Cómo usarlo: Supabase → SQL Editor → New query → pega TODO → Run.
--  Es seguro ejecutarlo más de una vez (no borra datos).
--
--  Incluye:
--   · 4 tipos de usuario: cliente, comercio, repartidor y administrador
--   · Aprobación de comercios y repartidores por el administrador
--   · Membresías (Gratis / Pro / Premium) con límites aplicados en la base
--   · Solicitudes de delivery con seguimiento para el cliente
--   · Suscripciones a notificaciones push
--   · Almacenamiento de fotos en Supabase Storage (bucket "media")
--   · Seguridad por filas (RLS) en todas las tablas
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

-- Perfil de cada usuario (su rol)
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  role        text not null default 'client',
  created_at  timestamptz not null default now()
);
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin', 'merchant', 'delivery', 'client'));

-- Comercios
create table if not exists public.merchants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  name             text not null,
  slug             text not null unique,
  category         text not null default 'Comida',
  whatsapp_number  text not null,
  description      text,
  address          text,
  opens_at         time default '08:00',
  closes_at        time default '20:00',
  is_active        boolean not null default true,
  is_featured      boolean not null default false,
  logo_url         text,
  cover_url        text,
  created_at       timestamptz not null default now()
);
alter table public.merchants add column if not exists status text not null default 'pending';
alter table public.merchants add column if not exists plan text not null default 'gratis';
alter table public.merchants add column if not exists plan_expires_at timestamptz;
alter table public.merchants add column if not exists approved_at timestamptz;
alter table public.merchants drop constraint if exists merchants_status_check;
alter table public.merchants add constraint merchants_status_check check (status in ('pending', 'approved', 'suspended'));
alter table public.merchants drop constraint if exists merchants_plan_check;
alter table public.merchants add constraint merchants_plan_check check (plan in ('gratis', 'pro', 'premium'));
alter table public.merchants drop constraint if exists merchants_category_check;
alter table public.merchants add constraint merchants_category_check
  check (category in ('Comida','Bodegones','Farmacias','Repuestos','Servicios','Barberías'));
create index if not exists merchants_category_idx on public.merchants (category);
create index if not exists merchants_user_idx on public.merchants (user_id);
create index if not exists merchants_status_idx on public.merchants (status);

-- Productos
create table if not exists public.products (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null references public.merchants (id) on delete cascade,
  title         text not null,
  description   text,
  price         numeric(10, 2) not null check (price >= 0),
  image_url     text,
  is_available  boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists products_merchant_idx on public.products (merchant_id);

-- Ofertas flash
create table if not exists public.flash_deals (
  id              uuid primary key default gen_random_uuid(),
  merchant_id     uuid not null references public.merchants (id) on delete cascade,
  product_id      uuid not null references public.products (id) on delete cascade,
  discount_price  numeric(10, 2) not null check (discount_price >= 0),
  expires_at      timestamptz not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index if not exists flash_deals_active_idx on public.flash_deals (is_active, expires_at);

-- Repartidores
create table if not exists public.drivers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  full_name     text not null,
  phone         text not null,
  vehicle       text not null default 'moto' check (vehicle in ('moto', 'carro', 'bicicleta', 'a_pie')),
  plate         text,
  photo_url     text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  is_online     boolean not null default false,
  last_seen_at  timestamptz,
  approved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists drivers_online_idx on public.drivers (status, is_online);

-- Solicitudes de delivery
create table if not exists public.delivery_requests (
  id              uuid primary key default gen_random_uuid(),
  code            text not null unique default ('LC-' || upper(substring(md5(random()::text) for 5))),
  tracking_token  uuid not null unique default gen_random_uuid(),
  merchant_id     uuid not null references public.merchants (id) on delete cascade,
  customer_name   text not null,
  customer_phone  text not null,
  address         text not null,
  notes           text,
  items           jsonb not null default '[]'::jsonb,
  subtotal        numeric(10, 2) not null default 0,
  delivery_fee    numeric(10, 2) not null default 0,
  status          text not null default 'searching'
                  check (status in ('searching', 'accepted', 'picked_up', 'delivered', 'cancelled')),
  driver_id       uuid references public.drivers (id) on delete set null,
  accepted_at     timestamptz,
  picked_up_at    timestamptz,
  delivered_at    timestamptz,
  cancelled_at    timestamptz,
  cancel_reason   text,
  created_at      timestamptz not null default now()
);
create index if not exists delivery_status_idx on public.delivery_requests (status, created_at desc);
create index if not exists delivery_driver_idx on public.delivery_requests (driver_id);
create index if not exists delivery_merchant_idx on public.delivery_requests (merchant_id, created_at desc);
create index if not exists delivery_phone_idx on public.delivery_requests (customer_phone, created_at desc);

-- Suscripciones a notificaciones push (una por teléfono/navegador)
create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists push_user_idx on public.push_subscriptions (user_id);

-- Ajustes generales (una sola fila)
create table if not exists public.app_settings (
  id              int primary key default 1 check (id = 1),
  delivery_fee    numeric(10, 2) not null default 1.50,
  admin_whatsapp  text,
  price_pro       numeric(10, 2) not null default 10,
  price_premium   numeric(10, 2) not null default 25,
  updated_at      timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE AYUDA
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and role = 'admin');
$$;

-- ¿Quien ejecuta es el sistema? (el servidor con la clave secreta, o tú desde el SQL Editor)
create or replace function public.is_system()
returns boolean language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role' or session_user in ('postgres', 'supabase_admin');
$$;

create or replace function public.owns_merchant(m_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.merchants where id = m_id and user_id = auth.uid());
$$;

create or replace function public.merchant_is_public(m_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.merchants where id = m_id and status = 'approved' and is_active);
$$;

create or replace function public.my_driver_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.drivers where user_id = auth.uid();
$$;

-- Plan vigente (si venció, vuelve a Gratis)
create or replace function public.effective_plan(p_plan text, p_expires timestamptz)
returns text language sql immutable as $$
  select case when p_plan <> 'gratis' and (p_expires is null or p_expires > now()) then p_plan else 'gratis' end;
$$;

-- Qué permite cada plan
create or replace function public.plan_limits(p_plan text)
returns table (max_products int, max_deals int, can_cover boolean, featured boolean)
language sql immutable as $$
  select t.a, t.b, t.c, t.d
  from (values
    ('gratis',  10,   0, false, false),
    ('pro',     60,   2, true,  false),
    ('premium', 1000, 6, true,  true)
  ) as t(plan, a, b, c, d)
  where t.plan = p_plan;
$$;

-- Genera un slug único a partir del nombre
create or replace function public.unique_slug(p_name text)
returns text language plpgsql as $$
declare
  base text := trim(both '-' from regexp_replace(lower(translate(p_name,
    'áéíóúàèìòùäëïöüñÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÑ', 'aeiouaeiouaeiounAEIOUAEIOUAEIOUN')), '[^a-z0-9]+', '-', 'g'));
  candidate text;
  n int := 1;
begin
  if base = '' then base := 'comercio'; end if;
  candidate := base;
  while exists (select 1 from public.merchants where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. REGISTRO: crea perfil, comercio o repartidor al registrarse
--    (lee los datos que la app envía al crear la cuenta)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := meta ->> 'signup_role';
  r text := case when wanted in ('merchant', 'delivery') then wanted else 'client' end;
  biz jsonb := meta -> 'business';
  drv jsonb := meta -> 'driver';
  cat text;
begin
  insert into public.profiles (user_id, role, full_name, phone)
  values (new.id, r, nullif(meta ->> 'full_name', ''), nullif(meta ->> 'phone', ''))
  on conflict (user_id) do nothing;

  if r = 'merchant' and biz is not null and coalesce(biz ->> 'name', '') <> '' then
    cat := biz ->> 'category';
    if cat not in ('Comida','Bodegones','Farmacias','Repuestos','Servicios','Barberías') then cat := 'Servicios'; end if;
    insert into public.merchants (user_id, name, slug, category, whatsapp_number, description, address, opens_at, closes_at, status, plan)
    values (
      new.id,
      left(biz ->> 'name', 80),
      public.unique_slug(biz ->> 'name'),
      cat,
      coalesce(nullif(biz ->> 'whatsapp_number', ''), meta ->> 'phone', ''),
      nullif(left(biz ->> 'description', 280), ''),
      nullif(left(biz ->> 'address', 160), ''),
      coalesce(nullif(biz ->> 'opens_at', '')::time, '08:00'),
      coalesce(nullif(biz ->> 'closes_at', '')::time, '20:00'),
      'pending', 'gratis'
    );
  elsif r = 'delivery' then
    insert into public.drivers (user_id, full_name, phone, vehicle, plate, status)
    values (
      new.id,
      coalesce(nullif(meta ->> 'full_name', ''), 'Repartidor'),
      coalesce(nullif(meta ->> 'phone', ''), ''),
      case when drv ->> 'vehicle' in ('moto','carro','bicicleta','a_pie') then drv ->> 'vehicle' else 'moto' end,
      nullif(left(drv ->> 'plate', 12), ''),
      'pending'
    )
    on conflict (user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. REGLAS DE NEGOCIO (se aplican en la base, no se pueden saltar)
-- ---------------------------------------------------------------------

-- Perfiles: nadie puede cambiarse el rol a sí mismo
create or replace function public.guard_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_system() or public.is_admin() then return new; end if;
  new.role := old.role;
  new.user_id := old.user_id;
  return new;
end;
$$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles
  for each row execute function public.guard_profile();

-- Comercios: estado, plan y destacado solo los cambia el administrador
create or replace function public.guard_merchant()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim record;
begin
  if public.is_system() or public.is_admin() then
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status <> 'approved' then
      new.approved_at := now();
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.plan := 'gratis';
    new.plan_expires_at := null;
    new.is_featured := false;
    new.approved_at := null;
    if auth.uid() is not null then new.user_id := auth.uid(); end if;
    new.slug := public.unique_slug(new.name);
    new.cover_url := null;
    return new;
  end if;

  new.status := old.status;
  new.plan := old.plan;
  new.plan_expires_at := old.plan_expires_at;
  new.is_featured := old.is_featured;
  new.user_id := old.user_id;
  new.slug := old.slug;
  new.approved_at := old.approved_at;

  select * into lim from public.plan_limits(public.effective_plan(old.plan, old.plan_expires_at));
  if new.cover_url is distinct from old.cover_url and new.cover_url is not null and not lim.can_cover then
    raise exception 'PLAN_PORTADA: La foto de portada está disponible desde el plan Pro.';
  end if;
  return new;
end;
$$;
drop trigger if exists guard_merchant on public.merchants;
create trigger guard_merchant before insert or update on public.merchants
  for each row execute function public.guard_merchant();

-- Productos: límite según el plan
create or replace function public.guard_product()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim record; m record; total int;
begin
  if public.is_system() or public.is_admin() then return new; end if;
  select * into m from public.merchants where id = new.merchant_id;
  select * into lim from public.plan_limits(public.effective_plan(m.plan, m.plan_expires_at));
  select count(*) into total from public.products where merchant_id = new.merchant_id;
  if total >= lim.max_products then
    raise exception 'PLAN_PRODUCTOS: Tu plan permite hasta % productos.', lim.max_products;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_product on public.products;
create trigger guard_product before insert on public.products
  for each row execute function public.guard_product();

-- Ofertas flash: límite según el plan y precio válido
create or replace function public.guard_flash_deal()
returns trigger language plpgsql security definer set search_path = public as $$
declare lim record; m record; p record; active_count int;
begin
  select * into p from public.products where id = new.product_id;
  if p is null or p.merchant_id <> new.merchant_id then
    raise exception 'OFERTA_INVALIDA: El producto no pertenece a este comercio.';
  end if;
  if new.is_active and new.discount_price >= p.price then
    raise exception 'OFERTA_INVALIDA: El precio de oferta debe ser menor al precio normal.';
  end if;
  if public.is_system() or public.is_admin() then return new; end if;
  if new.is_active and (tg_op = 'INSERT' or not old.is_active) then
    select * into m from public.merchants where id = new.merchant_id;
    select * into lim from public.plan_limits(public.effective_plan(m.plan, m.plan_expires_at));
    select count(*) into active_count from public.flash_deals
      where merchant_id = new.merchant_id and is_active and expires_at > now() and id <> new.id;
    if active_count >= lim.max_deals then
      if lim.max_deals = 0 then
        raise exception 'PLAN_OFERTAS: Las ofertas flash están disponibles desde el plan Pro.';
      end if;
      raise exception 'PLAN_OFERTAS: Tu plan permite % ofertas activas a la vez.', lim.max_deals;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_flash_deal on public.flash_deals;
create trigger guard_flash_deal before insert or update on public.flash_deals
  for each row execute function public.guard_flash_deal();

-- Repartidores: el estado solo lo cambia el administrador
create or replace function public.guard_driver()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_system() or public.is_admin() then
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status <> 'approved' then new.approved_at := now(); end if;
    if new.status <> 'approved' then new.is_online := false; end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_online := false;
    if auth.uid() is not null then new.user_id := auth.uid(); end if;
    return new;
  end if;
  new.status := old.status;
  new.user_id := old.user_id;
  new.approved_at := old.approved_at;
  if new.status <> 'approved' then new.is_online := false; end if;
  return new;
end;
$$;
drop trigger if exists guard_driver on public.drivers;
create trigger guard_driver before insert or update on public.drivers
  for each row execute function public.guard_driver();

-- ---------------------------------------------------------------------
-- 5. ACCIONES DEL DELIVERY (funciones seguras que usa la app)
-- ---------------------------------------------------------------------

-- Pedidos disponibles para el repartidor (sin datos privados del cliente)
create or replace function public.available_deliveries()
returns table (
  id uuid, code text, merchant_name text, merchant_address text, merchant_category text,
  destination text, items_count int, subtotal numeric, delivery_fee numeric, created_at timestamptz
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.drivers d where d.user_id = auth.uid() and d.status = 'approved') then
    return;
  end if;
  return query
    select r.id, r.code, m.name, m.address, m.category,
           r.address, coalesce((select sum((i ->> 'qty')::int) from jsonb_array_elements(r.items) i), 0)::int,
           r.subtotal, r.delivery_fee, r.created_at
    from public.delivery_requests r
    join public.merchants m on m.id = r.merchant_id
    where r.status = 'searching' and r.created_at > now() - interval '3 hours'
    order by r.created_at;
end;
$$;

-- Tomar un pedido (el primero que lo acepta se lo queda)
create or replace function public.accept_delivery(p_id uuid)
returns public.delivery_requests
language plpgsql security definer set search_path = public as $$
declare d record; active_count int; result public.delivery_requests;
begin
  select * into d from public.drivers where user_id = auth.uid();
  if d is null or d.status <> 'approved' then
    raise exception 'NO_AUTORIZADO: Tu cuenta de repartidor aún no está aprobada.';
  end if;
  select count(*) into active_count from public.delivery_requests
    where driver_id = d.id and status in ('accepted', 'picked_up');
  if active_count >= 2 then
    raise exception 'LIMITE: Termina tus entregas en curso antes de tomar otra.';
  end if;
  update public.delivery_requests
     set status = 'accepted', driver_id = d.id, accepted_at = now()
   where id = p_id and status = 'searching'
   returning * into result;
  if result.id is null then
    raise exception 'YA_TOMADO: Otro repartidor ya tomó este pedido.';
  end if;
  update public.drivers set last_seen_at = now() where id = d.id;
  return result;
end;
$$;

-- Avanzar o soltar un pedido (solo el repartidor asignado)
create or replace function public.update_delivery_status(p_id uuid, p_status text)
returns public.delivery_requests
language plpgsql security definer set search_path = public as $$
declare my_id uuid := public.my_driver_id(); r public.delivery_requests;
begin
  select * into r from public.delivery_requests where id = p_id for update;
  if r.id is null or r.driver_id is distinct from my_id or my_id is null then
    raise exception 'NO_AUTORIZADO: Este pedido no está asignado a ti.';
  end if;
  if p_status = 'picked_up' and r.status = 'accepted' then
    update public.delivery_requests set status = 'picked_up', picked_up_at = now() where id = p_id returning * into r;
  elsif p_status = 'delivered' and r.status = 'picked_up' then
    update public.delivery_requests set status = 'delivered', delivered_at = now() where id = p_id returning * into r;
  elsif p_status = 'searching' and r.status = 'accepted' then
    update public.delivery_requests set status = 'searching', driver_id = null, accepted_at = null where id = p_id returning * into r;
  else
    raise exception 'ESTADO_INVALIDO: No se puede pasar de % a %.', r.status, p_status;
  end if;
  return r;
end;
$$;

-- Cancelar (comercio dueño o administrador)
create or replace function public.cancel_delivery(p_id uuid, p_reason text default null)
returns public.delivery_requests
language plpgsql security definer set search_path = public as $$
declare r public.delivery_requests;
begin
  select * into r from public.delivery_requests where id = p_id for update;
  if r.id is null or not (public.is_admin() or public.owns_merchant(r.merchant_id)) then
    raise exception 'NO_AUTORIZADO: No puedes cancelar este pedido.';
  end if;
  if r.status not in ('searching', 'accepted') then
    raise exception 'ESTADO_INVALIDO: Este pedido ya no se puede cancelar.';
  end if;
  update public.delivery_requests
     set status = 'cancelled', cancelled_at = now(), cancel_reason = left(p_reason, 200)
   where id = p_id returning * into r;
  return r;
end;
$$;

-- Ponerse disponible / no disponible
create or replace function public.set_driver_online(p_online boolean)
returns public.drivers
language plpgsql security definer set search_path = public as $$
declare d public.drivers;
begin
  update public.drivers
     set is_online = p_online and status = 'approved', last_seen_at = now()
   where user_id = auth.uid()
   returning * into d;
  if d.id is null then raise exception 'NO_AUTORIZADO: No tienes cuenta de repartidor.'; end if;
  return d;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. SEGURIDAD POR FILAS (RLS)
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.merchants          enable row level security;
alter table public.products           enable row level security;
alter table public.flash_deals        enable row level security;
alter table public.drivers            enable row level security;
alter table public.delivery_requests  enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_settings       enable row level security;

-- PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());

-- MERCHANTS: el público ve solo los aprobados y activos
drop policy if exists "merchants_public_read" on public.merchants;
create policy "merchants_public_read" on public.merchants
  for select using ((status = 'approved' and is_active) or auth.uid() = user_id or public.is_admin());
drop policy if exists "merchants_owner_insert" on public.merchants;
create policy "merchants_owner_insert" on public.merchants
  for insert to authenticated with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "merchants_owner_update" on public.merchants;
create policy "merchants_owner_update" on public.merchants
  for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "merchants_admin_delete" on public.merchants;
create policy "merchants_admin_delete" on public.merchants
  for delete to authenticated using (public.is_admin());

-- PRODUCTS
drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products
  for select using (public.merchant_is_public(merchant_id) or public.owns_merchant(merchant_id) or public.is_admin());
drop policy if exists "products_owner_write" on public.products;
create policy "products_owner_write" on public.products
  for all to authenticated
  using (public.owns_merchant(merchant_id) or public.is_admin())
  with check (public.owns_merchant(merchant_id) or public.is_admin());

-- FLASH DEALS
drop policy if exists "flash_public_read" on public.flash_deals;
create policy "flash_public_read" on public.flash_deals
  for select using (public.merchant_is_public(merchant_id) or public.owns_merchant(merchant_id) or public.is_admin());
drop policy if exists "flash_owner_write" on public.flash_deals;
create policy "flash_owner_write" on public.flash_deals
  for all to authenticated
  using (public.owns_merchant(merchant_id) or public.is_admin())
  with check (public.owns_merchant(merchant_id) or public.is_admin());

-- DRIVERS
drop policy if exists "drivers_select_own" on public.drivers;
create policy "drivers_select_own" on public.drivers
  for select using (auth.uid() = user_id or public.is_admin());
-- El comercio ve al repartidor que lleva sus pedidos (nombre, teléfono, vehículo)
create or replace function public.driver_serves_my_merchant(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.delivery_requests r
    join public.merchants m on m.id = r.merchant_id
    where r.driver_id = d_id and m.user_id = auth.uid()
  );
$$;
drop policy if exists "drivers_read_by_merchant" on public.drivers;
create policy "drivers_read_by_merchant" on public.drivers
  for select to authenticated using (public.driver_serves_my_merchant(id));
drop policy if exists "drivers_insert_own" on public.drivers;
create policy "drivers_insert_own" on public.drivers
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "drivers_update_own" on public.drivers;
create policy "drivers_update_own" on public.drivers
  for update to authenticated using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "drivers_admin_delete" on public.drivers;
create policy "drivers_admin_delete" on public.drivers
  for delete to authenticated using (public.is_admin());

-- DELIVERY REQUESTS: se crean desde el servidor; aquí solo lectura
drop policy if exists "delivery_read" on public.delivery_requests;
create policy "delivery_read" on public.delivery_requests
  for select to authenticated using (
    public.is_admin()
    or public.owns_merchant(merchant_id)
    or (driver_id is not null and driver_id = public.my_driver_id())
  );

-- PUSH SUBSCRIPTIONS
drop policy if exists "push_own" on public.push_subscriptions;
create policy "push_own" on public.push_subscriptions
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- APP SETTINGS
drop policy if exists "settings_read" on public.app_settings;
create policy "settings_read" on public.app_settings for select using (true);
drop policy if exists "settings_admin" on public.app_settings;
create policy "settings_admin" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Permisos de ejecución de las funciones públicas
grant execute on function public.available_deliveries() to authenticated;
grant execute on function public.accept_delivery(uuid) to authenticated;
grant execute on function public.update_delivery_status(uuid, text) to authenticated;
grant execute on function public.cancel_delivery(uuid, text) to authenticated;
grant execute on function public.set_driver_online(boolean) to authenticated;
revoke execute on function public.available_deliveries() from anon;
revoke execute on function public.accept_delivery(uuid) from anon;
revoke execute on function public.update_delivery_status(uuid, text) from anon;
revoke execute on function public.cancel_delivery(uuid, text) from anon;
revoke execute on function public.set_driver_online(boolean) from anon;

-- ---------------------------------------------------------------------
-- 7. FOTOS (Supabase Storage)
--    Bucket público "media". Cada usuario sube solo dentro de su carpeta.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "media_public_read" on storage.objects;
create policy "media_public_read" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media_owner_insert" on storage.objects;
create policy "media_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "media_owner_update" on storage.objects;
create policy "media_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists "media_owner_delete" on storage.objects;
create policy "media_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'media' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =====================================================================
--  HACERTE ADMINISTRADOR (solo una vez)
--  1) Regístrate en la app (como cliente, comercio o repartidor da igual)
--     o crea tu usuario en Authentication → Users → Add user.
--  2) Ejecuta esto cambiando el correo por el tuyo:
--
--  update public.profiles set role = 'admin'
--   where user_id = (select id from auth.users where email = 'TU-CORREO@gmail.com');
-- =====================================================================
