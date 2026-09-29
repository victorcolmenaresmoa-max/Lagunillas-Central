-- =====================================================================
--  LAGUNILLAS CENTRAL — Esquema de base de datos para Supabase
--  Cómo usarlo: Supabase → SQL Editor → New query → pega todo → Run
--  Es seguro ejecutarlo más de una vez.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. PERFILES (rol de cada usuario)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users (id) on delete cascade,
  role        text not null default 'client' check (role in ('admin', 'merchant', 'client')),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. COMERCIOS
-- ---------------------------------------------------------------------
create table if not exists public.merchants (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  name             text not null,
  slug             text not null unique,
  category         text not null default 'Comida'
                   check (category in ('Comida','Bodegones','Farmacias','Repuestos','Servicios','Barberías')),
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

create index if not exists merchants_category_idx on public.merchants (category);
create index if not exists merchants_user_idx on public.merchants (user_id);

-- ---------------------------------------------------------------------
-- 3. PRODUCTOS
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 4. OFERTAS FLASH
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- 5. FUNCIONES DE AYUDA
-- ---------------------------------------------------------------------

-- ¿El usuario actual es administrador?
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- ¿El usuario actual es dueño de este comercio?
create or replace function public.owns_merchant(m_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.merchants
    where id = m_id and user_id = auth.uid()
  );
$$;

-- Crea el perfil automáticamente cuando alguien se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, role)
  values (new.id, 'client')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 6. SEGURIDAD (Row Level Security)
--    Lectura pública · escritura solo para el dueño autenticado o admin
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.merchants   enable row level security;
alter table public.products    enable row level security;
alter table public.flash_deals enable row level security;

-- PROFILES: cada quien ve su perfil; el admin ve todos. El rol NO se cambia desde la app.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id or public.is_admin());

-- MERCHANTS
drop policy if exists "merchants_public_read" on public.merchants;
create policy "merchants_public_read" on public.merchants
  for select using (is_active or auth.uid() = user_id or public.is_admin());

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
  for select using (true);

drop policy if exists "products_owner_write" on public.products;
create policy "products_owner_write" on public.products
  for all to authenticated
  using (public.owns_merchant(merchant_id) or public.is_admin())
  with check (public.owns_merchant(merchant_id) or public.is_admin());

-- FLASH DEALS
drop policy if exists "flash_public_read" on public.flash_deals;
create policy "flash_public_read" on public.flash_deals
  for select using (true);

drop policy if exists "flash_owner_write" on public.flash_deals;
create policy "flash_owner_write" on public.flash_deals
  for all to authenticated
  using (public.owns_merchant(merchant_id) or public.is_admin())
  with check (public.owns_merchant(merchant_id) or public.is_admin());

-- =====================================================================
--  CÓMO DAR DE ALTA A UN COMERCIANTE (hazlo tú como administrador)
--  1) Crea su usuario en Authentication → Users → Add user (correo + clave).
--  2) Ejecuta, cambiando el correo y los datos del negocio:
--
--  update public.profiles set role = 'merchant'
--   where user_id = (select id from auth.users where email = 'dueno@correo.com');
--
--  insert into public.merchants (user_id, name, slug, category, whatsapp_number, address)
--  values ((select id from auth.users where email = 'dueno@correo.com'),
--          'Arepera El Páramo', 'arepera-el-paramo', 'Comida', '584141234567',
--          'Av. Principal, San Juan de Lagunillas');
--
--  Para hacerte administrador: igual que el paso 1, pero con role = 'admin'.
-- =====================================================================
