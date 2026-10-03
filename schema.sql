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
  lg jsonb := meta -> 'legal';
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

  -- Datos legales (cédula, RIF, contacto de emergencia…): tabla privada, ver sección 8
  if r in ('merchant', 'delivery') and lg is not null then
    begin
      insert into public.legal_profiles (
        user_id, kind, legal_name, id_type, id_number, birth_date, home_address,
        business_legal_name, rif, emergency_name, emergency_phone,
        vehicle_brand, vehicle_model, vehicle_color, has_license, has_rcv, terms_version
      ) values (
        new.id, r,
        left(nullif(trim(lg ->> 'legal_name'), ''), 120),
        case when lg ->> 'id_type' in ('V', 'E', 'P') then lg ->> 'id_type' end,
        left(nullif(regexp_replace(coalesce(lg ->> 'id_number', ''), '[^0-9A-Za-z]', '', 'g'), ''), 20),
        public.try_date(lg ->> 'birth_date'),
        left(nullif(trim(lg ->> 'home_address'), ''), 200),
        left(nullif(trim(lg ->> 'business_legal_name'), ''), 160),
        left(nullif(upper(regexp_replace(coalesce(lg ->> 'rif', ''), '[^0-9A-Za-z]', '', 'g')), ''), 12),
        left(nullif(trim(lg ->> 'emergency_name'), ''), 120),
        left(nullif(trim(lg ->> 'emergency_phone'), ''), 20),
        left(nullif(trim(lg ->> 'vehicle_brand'), ''), 40),
        left(nullif(trim(lg ->> 'vehicle_model'), ''), 40),
        left(nullif(trim(lg ->> 'vehicle_color'), ''), 30),
        case when lg ->> 'has_license' in ('true', 'false') then (lg ->> 'has_license')::boolean end,
        case when lg ->> 'has_rcv' in ('true', 'false') then (lg ->> 'has_rcv')::boolean end,
        left(nullif(lg ->> 'terms_version', ''), 20)
      )
      on conflict do nothing;
    exception when others then
      null; -- si algo falla, la cuenta igual se crea y los datos se completan en el panel
    end;
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

-- ---------------------------------------------------------------------
-- 8. DATOS LEGALES Y DOCUMENTOS (privados)
--    Cédula, RIF, fecha de nacimiento, contacto de emergencia, vehículo
--    y aceptación de los términos. SOLO los ve el dueño de la cuenta y el
--    administrador: ni el público, ni los comercios, ni otros repartidores.
-- ---------------------------------------------------------------------

-- Convierte texto a fecha sin fallar (si viene mal, queda vacío)
create or replace function public.try_date(p text)
returns date language plpgsql stable as $$
begin
  return nullif(p, '')::date;
exception when others then
  return null;
end;
$$;

create table if not exists public.legal_profiles (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  kind                 text not null check (kind in ('merchant', 'delivery')),
  legal_name           text,          -- nombre completo como aparece en la cédula
  id_type              text check (id_type in ('V', 'E', 'P')),
  id_number            text,
  birth_date           date,
  home_address         text,
  business_legal_name  text,          -- comercio: razón social o nombre del titular
  rif                  text,          -- comercio: RIF sin guiones, ej. J123456789
  emergency_name       text,          -- repartidor
  emergency_phone      text,
  vehicle_brand        text,
  vehicle_model        text,
  vehicle_color        text,
  has_license          boolean,
  has_rcv              boolean,       -- seguro de Responsabilidad Civil Vehicular vigente
  docs                 jsonb not null default '{}'::jsonb, -- { "cedula": "ruta", "rif": "ruta", ... } en el bucket "documentos"
  terms_version        text,
  terms_accepted_at    timestamptz,
  admin_notes          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
-- Una misma cédula no puede tener dos cuentas del mismo tipo (evita que alguien suspendido vuelva con otra cuenta)
create unique index if not exists legal_id_unique on public.legal_profiles (kind, id_type, id_number) where id_number is not null;

-- Reglas: la fecha de aceptación la pone la base; los datos de identidad
-- no se pueden cambiar después de aprobada la cuenta (solo el administrador)
create or replace function public.guard_legal()
returns trigger language plpgsql security definer set search_path = public as $$
declare approved boolean;
begin
  new.updated_at := now();
  if public.is_system() or public.is_admin() then
    if tg_op = 'INSERT' and new.terms_version is not null and new.terms_accepted_at is null then
      new.terms_accepted_at := now();
    end if;
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.admin_notes := null;
    new.created_at := now();
    new.terms_accepted_at := case when new.terms_version is not null then now() end;
    return new;
  end if;
  new.user_id := old.user_id;
  new.kind := old.kind;
  new.created_at := old.created_at;
  new.admin_notes := old.admin_notes;
  if new.terms_version is distinct from old.terms_version and new.terms_version is not null then
    new.terms_accepted_at := now();
  else
    new.terms_version := old.terms_version;
    new.terms_accepted_at := old.terms_accepted_at;
  end if;
  approved := exists (select 1 from public.merchants where user_id = old.user_id and status = 'approved')
           or exists (select 1 from public.drivers where user_id = old.user_id and status = 'approved');
  if approved then
    new.legal_name := old.legal_name;
    new.id_type := old.id_type;
    new.id_number := old.id_number;
    new.birth_date := old.birth_date;
    new.business_legal_name := old.business_legal_name;
    new.rif := old.rif;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_legal on public.legal_profiles;
create trigger guard_legal before insert or update on public.legal_profiles
  for each row execute function public.guard_legal();

alter table public.legal_profiles enable row level security;
drop policy if exists "legal_select_own" on public.legal_profiles;
create policy "legal_select_own" on public.legal_profiles
  for select to authenticated using (auth.uid() = user_id or public.is_admin());
drop policy if exists "legal_insert_own" on public.legal_profiles;
create policy "legal_insert_own" on public.legal_profiles
  for insert to authenticated with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "legal_update_own" on public.legal_profiles;
create policy "legal_update_own" on public.legal_profiles
  for update to authenticated
  using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id or public.is_admin());
drop policy if exists "legal_admin_delete" on public.legal_profiles;
create policy "legal_admin_delete" on public.legal_profiles
  for delete to authenticated using (public.is_admin());

-- Bucket PRIVADO "documentos": fotos de cédula, RIF, licencia, etc.
-- No tiene enlace público: solo el dueño y el administrador pueden abrirlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 8388608,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

drop policy if exists "docs_owner_read" on storage.objects;
create policy "docs_owner_read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "docs_owner_insert" on storage.objects;
create policy "docs_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "docs_owner_update" on storage.objects;
create policy "docs_owner_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "docs_owner_delete" on storage.objects;
create policy "docs_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- =====================================================================
--  HACERTE ADMINISTRADOR (solo una vez)
--  1) Regístrate en la app (como cliente, comercio o repartidor da igual)
--     o crea tu usuario en Authentication → Users → Add user.
--  2) Ejecuta esto cambiando el correo por el tuyo:
--
--  update public.profiles set role = 'admin'
--   where user_id = (select id from auth.users where email = 'TU-CORREO@gmail.com');
-- =====================================================================


-- Run after schema.sql on existing installations. No existing orders are deleted.
begin;
alter table public.profiles add column if not exists suspended boolean not null default false;
alter table public.app_settings add column if not exists order_config jsonb;
create table if not exists public.customer_addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
 label text not null, address text not null, sector text not null, point jsonb not null,
 created_at timestamptz not null default now()
);
create table if not exists public.order_accounts (
 user_id uuid primary key references auth.users(id), account jsonb not null default '{}',
 point jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.driver_positions (
 driver_id uuid primary key references public.drivers(id), point jsonb not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.driver_wallets (
 driver_id uuid primary key references public.drivers(id), balance numeric(12,2) not null default 0 check(balance >= 0)
);
create table if not exists public.app_orders (
 id uuid primary key default gen_random_uuid(), code text not null default ('LC-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
 customer_id uuid not null references auth.users(id), merchant_id uuid not null references public.merchants(id), driver_id uuid references public.drivers(id),
 fulfillment text not null check(fulfillment in ('delivery','pickup')),
 state text not null default 'merchant_pending' check(state in ('merchant_pending','products_payment','products_review','searching','delivery_payment','delivery_review','preparing','picked_up','pickup_ready','delivered','cancelled','disputed')),
 customer_name text not null, customer_phone text not null, address text not null, sector text not null default '', destination jsonb, origin jsonb not null,
 items jsonb not null, subtotal numeric(12,2) not null check(subtotal>0), delivery_fee numeric(12,2) not null check(delivery_fee>=0),
 distance_km numeric not null, distance_method text not null, rate numeric not null check(rate>0), rate_date date not null,
 commission_percent numeric not null check(commission_percent between 0 and 100),
 ready boolean not null default false, products_paid boolean not null default false, delivery_paid boolean not null default false,
 delivery_code text not null default lpad(((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,8))::bit(32)::bigint%10000))::text,4,'0'), code_failures int not null default 0,
 reason text, rating int check(rating between 1 and 5), pickup_offered boolean not null default false,
 expanded_at timestamptz, deadline_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), delivered_at timestamptz
);
create index if not exists app_orders_customer on public.app_orders(customer_id,created_at desc);
create index if not exists app_orders_state on public.app_orders(state,deadline_at);
create index if not exists app_orders_driver on public.app_orders(driver_id,state);
alter table public.app_orders add column if not exists stalled boolean not null default false;
alter table public.app_orders add column if not exists previous_state text;
alter table public.app_orders add column if not exists products_refunded boolean not null default false;
alter table public.app_orders add column if not exists delivery_refunded boolean not null default false;
alter table public.app_orders add column if not exists route_geometry jsonb;
create table if not exists public.order_payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.app_orders(id),
 kind text not null check(kind in ('products','delivery','refund')), payer_id uuid not null references auth.users(id), payee_id uuid not null references auth.users(id),
 reference text not null check(reference ~ '^[0-9]{5}$'), bank text not null, amount numeric(12,2) not null check(amount>0),
 receipt text not null, status text not null default 'pending' check(status in ('pending','confirmed','rejected')), duplicate boolean not null default false,
 confirmed_by uuid references auth.users(id), confirmed_at timestamptz, created_at timestamptz not null default now()
);
create index if not exists payment_reference on public.order_payments(payee_id,reference);
create table if not exists public.order_messages (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.app_orders(id), sender_id uuid not null references auth.users(id),
 channel text not null check(channel in ('merchant','driver')), text text not null default '', image_path text, created_at timestamptz not null default now()
);
create table if not exists public.order_events (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.app_orders(id), actor_id uuid references auth.users(id), action text not null, created_at timestamptz not null default now()
);
create table if not exists public.wallet_topups (
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.drivers(id), amount numeric(12,2) not null check(amount>0),
 reference text not null check(reference ~ '^[0-9]{5}$'), receipt text not null, status text not null default 'pending', approved_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.wallet_ledger (
 id uuid primary key default gen_random_uuid(), driver_id uuid not null references public.drivers(id), order_id uuid unique references public.app_orders(id),
 topup_id uuid unique references public.wallet_topups(id), amount numeric(12,2) not null, created_at timestamptz not null default now()
);
-- All new order data is accessed through authenticated server endpoints. No public token access.
do $$ declare t text; begin
 foreach t in array array['customer_addresses','order_accounts','driver_positions','driver_wallets','app_orders','order_payments','order_messages','order_events','wallet_topups','wallet_ledger'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
end $$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('pedidos','pedidos',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false;
create or replace function public.guard_profile()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if public.is_system() or public.is_admin() then return new; end if;
 new.role:=old.role; new.user_id:=old.user_id; new.suspended:=old.suspended;
 return new;
end $$;
create or replace function public.require_driver_location()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if new.is_online and (tg_op='INSERT' or not old.is_online) and not exists(select 1 from public.driver_positions where driver_id=new.id and updated_at>now()-interval '3 minutes') then
  raise exception 'Permite ubicación dentro de Lagunillas para estar disponible';
 end if;
 return new;
end $$;
drop trigger if exists order_driver_location on public.drivers;
create trigger order_driver_location before insert or update on public.drivers for each row execute function public.require_driver_location();

-- The service validates authentication and authorization before passing the verified actor.
-- Row locks serialize competing driver claims, confirmations, retries and wallet debits.
create or replace function public.order_create(p_actor uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 perform 1 from public.profiles where user_id=p_actor and role='client' and not suspended for update;
 if not found then raise exception 'Cuenta de cliente no disponible'; end if;
 if (select count(*) from public.app_orders where customer_id=p_actor and state not in ('delivered','cancelled') and created_at>now()-interval '30 minutes')>=3 then raise exception 'Ya tienes varios pedidos activos'; end if;
 insert into public.app_orders(customer_id,merchant_id,customer_name,customer_phone,fulfillment,address,sector,destination,origin,items,subtotal,delivery_fee,distance_km,distance_method,rate,rate_date,commission_percent,deadline_at)
 values(p_actor,(p_data->>'merchant_id')::uuid,p_data->>'customer_name',p_data->>'customer_phone',p_data->>'fulfillment',p_data->>'address',p_data->>'sector',nullif(p_data->'destination','null'::jsonb),p_data->'origin',p_data->'items',(p_data->>'subtotal')::numeric,(p_data->>'delivery_fee')::numeric,(p_data->>'distance_km')::numeric,p_data->>'distance_method',(p_data->>'rate')::numeric,(p_data->>'rate_date')::date,(p_data->>'commission_percent')::numeric,(p_data->>'deadline_at')::timestamptz)
 returning id into result;
 update public.app_orders set route_geometry=p_data->'route_geometry' where id=result;
 return result;
end $$;
revoke all on function public.order_create(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.order_create(uuid,jsonb) to service_role;

create or replace function public.order_action(p_order uuid,p_actor uuid,p_action text,p_data jsonb default '{}')
returns public.app_orders language plpgsql security definer set search_path=public as $$
declare o public.app_orders; merchant_user uuid; driver_user uuid; me public.drivers; admin_actor boolean;
 c jsonb; mins jsonb; target text; next_minutes int; pay public.order_payments; charge numeric; failures int;
begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 select * into o from public.app_orders where id=p_order for update;
 if not found then raise exception 'Pedido no encontrado'; end if;
 if exists(select 1 from public.profiles where user_id=p_actor and suspended) then raise exception 'Cuenta suspendida'; end if;
 select user_id into merchant_user from public.merchants where id=o.merchant_id;
 select user_id into driver_user from public.drivers where id=o.driver_id;
 select exists(select 1 from public.profiles where user_id=p_actor and role='admin') into admin_actor;
 select coalesce(order_config,'{}') into c from public.app_settings where id=1;
 mins := coalesce(c->'minutes','{"accept":10,"products":20,"merchantConfirm":15,"search":15,"delivery":10,"driverConfirm":10}');
 target := o.state;
 if o.deadline_at<=now() and o.state in ('merchant_pending','products_payment','delivery_payment') then raise exception 'El paso del pedido venció; actualiza la pantalla'; end if;
 if p_action='accept' and p_actor=merchant_user and o.state='merchant_pending' then
  if o.deadline_at<=now() then raise exception 'El pedido venció'; end if;
  target:='products_payment'; next_minutes:=(mins->>'products')::int;
 elsif p_action='reject' and p_actor=merchant_user and o.state='merchant_pending' then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Indica el motivo'; end if;
  target:='cancelled'; o.reason:=left(p_data->>'reason',300);
 elsif p_action='claim' and o.state='searching' and o.fulfillment='delivery' then
  select * into me from public.drivers where user_id=p_actor for update;
  if me.id is null or me.status<>'approved' or not me.is_online then raise exception 'Debes estar aprobado y disponible'; end if;
  if not exists(select 1 from public.driver_positions where driver_id=me.id and updated_at>now()-interval '3 minutes') then raise exception 'Actualiza tu ubicación'; end if;
  if o.expanded_at>now() and not exists(select 1 from public.driver_positions where driver_id=me.id and
    6371*2*asin(sqrt(least(1,power(sin(radians((point->>'lat')::numeric-(o.origin->>'lat')::numeric)/2),2)+cos(radians((point->>'lat')::numeric))*cos(radians((o.origin->>'lat')::numeric))*power(sin(radians((point->>'lng')::numeric-(o.origin->>'lng')::numeric)/2),2))))<=2) then raise exception 'Este aviso todavía es para repartidores cercanos'; end if;
  if exists(select 1 from public.app_orders where driver_id=me.id and state not in ('delivered','cancelled')) then raise exception 'Ya tienes un pedido activo'; end if;
  charge:=trunc(o.delivery_fee*o.commission_percent)/100;
  if coalesce((select balance from public.driver_wallets where driver_id=me.id),0)<charge then raise exception 'Recarga tu saldo para cubrir la comisión'; end if;
  if not exists(select 1 from public.order_accounts where user_id=p_actor and account->>'bank'<>'' and account->>'phone'<>'' and account->>'document'<>'') then raise exception 'Completa tus datos de pago'; end if;
  o.driver_id:=me.id; target:='delivery_payment'; next_minutes:=(mins->>'delivery')::int;
 elsif p_action='receipt' and ((p_actor=o.customer_id and o.state in ('products_payment','delivery_payment')) or (p_actor=merchant_user and o.state='disputed' and o.products_paid and not o.products_refunded) or (p_actor=driver_user and o.state='disputed' and o.delivery_paid and not o.delivery_refunded)) then
  if coalesce(p_data->>'reference','') !~ '^[0-9]{5}$' or coalesce(p_data->>'bank','')='' or coalesce(p_data->>'receipt','') not like o.id::text||'/'||p_actor::text||'/%' then raise exception 'Comprobante inválido'; end if;
  if (p_data->>'amount')::numeric<=0 then raise exception 'Monto inválido'; end if;
  select * into pay from public.order_payments where order_id=o.id and status='pending' and payer_id=p_actor and kind=(case when p_actor in (merchant_user,driver_user) then 'refund' when o.state='products_payment' then 'products' else 'delivery' end);
  if found then raise exception 'Ya hay un comprobante pendiente'; end if;
  insert into public.order_payments(order_id,kind,payer_id,payee_id,reference,bank,amount,receipt,duplicate)
  values(o.id,case when p_actor in (merchant_user,driver_user) then 'refund' when o.state='products_payment' then 'products' else 'delivery' end,p_actor,
    case when p_actor in (merchant_user,driver_user) then o.customer_id when o.state='products_payment' then merchant_user else driver_user end,
    p_data->>'reference',left(p_data->>'bank',80),(p_data->>'amount')::numeric,p_data->>'receipt',
    exists(select 1 from public.order_payments where reference=p_data->>'reference' and payee_id=(case when p_actor in (merchant_user,driver_user) then o.customer_id when o.state='products_payment' then merchant_user else driver_user end) and order_id<>o.id));
  if p_actor=o.customer_id then target:=case when o.state='products_payment' then 'products_review' else 'delivery_review' end; next_minutes:=(mins->>case when target='products_review' then 'merchantConfirm' else 'driverConfirm' end)::int; end if;
 elsif p_action in ('confirm','not_received') and ((p_actor=merchant_user and o.state='products_review') or (p_actor=driver_user and o.state='delivery_review') or (p_actor=o.customer_id and o.state='disputed')) then
  select * into pay from public.order_payments where order_id=o.id and payee_id=p_actor and status='pending' and (p_data->>'payment_id' is null or id=(p_data->>'payment_id')::uuid) order by created_at desc limit 1 for update;
  if not found then raise exception 'No hay comprobante para revisar'; end if;
  update public.order_payments set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,confirmed_by=p_actor,confirmed_at=now() where id=pay.id;
  if p_action='not_received' then
   select count(*) into failures from public.order_payments where order_id=o.id and kind=pay.kind and status='rejected';
   if failures>=2 or pay.kind='refund' then target:='disputed'; o.reason:='Pago no recibido; requiere revisión';
   else target:=case when pay.kind='products' then 'products_payment' else 'delivery_payment' end; next_minutes:=(mins->>case when pay.kind='products' then 'products' else 'delivery' end)::int; end if;
  elsif pay.kind='refund' then
   if pay.payer_id=merchant_user then o.products_refunded:=true; else o.delivery_refunded:=true; end if;
   target:=case when (not o.products_paid or o.products_refunded) and (not o.delivery_paid or o.delivery_refunded) then 'cancelled' else 'disputed' end;
  elsif pay.kind='products' then
   o.products_paid:=true;
   if o.fulfillment='pickup' then target:='preparing'; else target:='searching'; next_minutes:=(mins->>'search')::int; o.expanded_at:=now()+interval '3 minutes'; end if;
  else o.delivery_paid:=true; target:='preparing'; end if;
 elsif p_action='ready' and p_actor=merchant_user and o.products_paid and o.state in ('searching','delivery_payment','delivery_review','preparing') then
  o.ready:=true; if o.fulfillment='pickup' then target:='pickup_ready'; end if;
 elsif p_action='picked_up' and p_actor=driver_user and o.state='preparing' and o.ready and o.delivery_paid then target:='picked_up';
 elsif p_action='delivered' and ((p_actor=driver_user and o.state='picked_up') or (p_actor=merchant_user and o.state='pickup_ready')) then
  if p_data->>'code' is distinct from o.delivery_code then
   o.code_failures:=o.code_failures+1;
   if o.code_failures>=5 then target:='disputed'; o.reason:='Demasiados intentos de código de entrega'; end if;
   update public.app_orders set code_failures=o.code_failures,state=target,reason=o.reason,previous_state=case when target='disputed' then o.state else previous_state end where id=o.id returning * into o;
   return o;
  end if;
  if o.driver_id is not null then
   perform 1 from public.drivers where id=o.driver_id for update;
   charge:=trunc(o.delivery_fee*o.commission_percent)/100;
   update public.driver_wallets set balance=balance-charge where driver_id=o.driver_id and balance>=charge;
   if not found and charge>0 then raise exception 'Saldo insuficiente; solicita recarga'; end if;
   insert into public.wallet_ledger(driver_id,order_id,amount) values(o.driver_id,o.id,-charge);
  end if;
  target:='delivered'; o.delivered_at:=now();
 elsif p_action='pickup' and p_actor=o.customer_id and o.state='searching' and o.pickup_offered then o.fulfillment:='pickup'; o.delivery_fee:=0; target:=case when o.ready then 'pickup_ready' else 'preparing' end;
 elsif p_action='rating' and p_actor=o.customer_id and o.state='delivered' and o.rating is null then o.rating:=(p_data->>'rating')::int;
 elsif p_action='resolve' and admin_actor and o.state='disputed' and not o.products_refunded and not o.delivery_refunded then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Documenta la resolución'; end if;
  target:=case when o.delivered_at is not null then 'delivered' when not o.products_paid then 'products_payment' when o.fulfillment='pickup' then case when o.ready then 'pickup_ready' else 'preparing' end when o.driver_id is null then 'searching' when not o.delivery_paid then 'delivery_payment' when o.previous_state='picked_up' then 'picked_up' else 'preparing' end;
  if target='products_payment' and exists(select 1 from public.order_payments where order_id=o.id and kind='products' and status='pending') then target:='products_review'; end if;
  if target='delivery_payment' and exists(select 1 from public.order_payments where order_id=o.id and kind='delivery' and status='pending') then target:='delivery_review'; end if;
  next_minutes:=case target when 'products_payment' then (mins->>'products')::int when 'products_review' then (mins->>'merchantConfirm')::int when 'delivery_payment' then (mins->>'delivery')::int when 'delivery_review' then (mins->>'driverConfirm')::int when 'searching' then (mins->>'search')::int end;
  o.reason:=left(p_data->>'reason',300);
  if target='searching' then o.expanded_at:=now(); end if;
 elsif p_action='dispute' and p_actor=o.customer_id and o.state not in ('cancelled','disputed') then target:='disputed'; o.reason:=left(p_data->>'reason',300);
 elsif p_action='cancel' and (admin_actor or p_actor=merchant_user or (p_actor=o.customer_id and not o.products_paid)) and o.state not in ('delivered','cancelled') then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Indica el motivo'; end if;
  target:=case when o.products_paid or exists(select 1 from public.order_payments where order_id=o.id and status='pending') then 'disputed' else 'cancelled' end; o.reason:=left(p_data->>'reason',300);
 elsif p_action='reassign' and admin_actor and o.fulfillment='delivery' and o.products_paid and not o.delivery_paid and o.state in ('searching','delivery_payment','disputed') and not exists(select 1 from public.order_payments where order_id=o.id and kind='delivery' and status='pending') then
  o.driver_id:=null; target:='searching'; o.expanded_at:=now(); next_minutes:=(mins->>'search')::int;
 else raise exception 'Acción no permitida en este paso'; end if;
 update public.app_orders set state=target, driver_id=o.driver_id, fulfillment=o.fulfillment, delivery_fee=o.delivery_fee, ready=o.ready, products_paid=o.products_paid,delivery_paid=o.delivery_paid,
 reason=o.reason,rating=o.rating,delivered_at=o.delivered_at,expanded_at=o.expanded_at,updated_at=now(),products_refunded=o.products_refunded,delivery_refunded=o.delivery_refunded,
 previous_state=case when target='disputed' and o.state<>'disputed' then o.state else previous_state end,
 stalled=case when target<>o.state then false else stalled end,
 deadline_at=case when next_minutes is not null then now()+make_interval(mins=>next_minutes) when target<>o.state then null else o.deadline_at end
 where id=o.id returning * into o;
 insert into public.order_events(order_id,actor_id,action) values(o.id,p_actor,p_action);
 return o;
end $$;
revoke all on function public.order_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.order_action(uuid,uuid,text,jsonb) to service_role;

create or replace function public.orders_tick() returns setof public.app_orders language plpgsql security definer set search_path=public as $$
declare o public.app_orders; minutes_search int;
begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 select coalesce((order_config->'minutes'->>'search')::int,15) into minutes_search from public.app_settings where id=1;
 for o in select * from public.app_orders where deadline_at<=now() and state not in ('delivered','cancelled','disputed') for update skip locked loop
  if o.state in ('merchant_pending','products_payment') then o.state:='cancelled'; o.reason:='Se venció el tiempo para aceptar o pagar';
  elsif o.state='delivery_payment' then o.state:='searching'; o.driver_id:=null; o.expanded_at:=now();
  elsif o.state='searching' then o.pickup_offered:=true; o.expanded_at:=now();
  end if;
  update public.app_orders set state=o.state,driver_id=o.driver_id,expanded_at=o.expanded_at,pickup_offered=o.pickup_offered,reason=o.reason,updated_at=now(),stalled=true,
   deadline_at=case when o.state='searching' and not o.pickup_offered then now()+make_interval(mins=>minutes_search) else null end
  where id=o.id returning * into o;
  return next o;
 end loop;
end $$;
revoke all on function public.orders_tick() from public,anon,authenticated;
grant execute on function public.orders_tick() to service_role;

create or replace function public.approve_topup(p_id uuid,p_actor uuid) returns void language plpgsql security definer set search_path=public as $$
declare t public.wallet_topups; begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.profiles where user_id=p_actor and role='admin' and not suspended) then raise exception 'No autorizado'; end if;
 select * into t from public.wallet_topups where id=p_id and status='pending' for update;
 if not found then raise exception 'Recarga ya revisada'; end if;
 update public.wallet_topups set status='approved',approved_by=p_actor where id=t.id;
 insert into public.driver_wallets(driver_id,balance) values(t.driver_id,t.amount) on conflict(driver_id) do update set balance=public.driver_wallets.balance+excluded.balance;
 insert into public.wallet_ledger(driver_id,topup_id,amount) values(t.driver_id,t.id,t.amount);
end $$;
revoke all on function public.approve_topup(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_topup(uuid,uuid) to service_role;
commit;
