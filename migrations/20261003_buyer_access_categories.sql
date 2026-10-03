-- Ejecutar después de 20261003_orders.sql. Conserva las categorías existentes.
begin;
alter table public.merchants drop constraint if exists merchants_category_check;
alter table public.merchants add constraint merchants_category_check check (category in ('Comida','Bodegones','Supermercados','Abastos','Panaderías','Pastelerías','Cafeterías','Fruterías y verduras','Carnicerías','Licorerías','Farmacias','Ferreterías','Repuestos','Tecnología','Ropa y calzado','Belleza y cosméticos','Barberías','Papelerías','Hogar y muebles','Mascotas','Servicios','Otros comercios'));
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
    if cat is null or cat not in ('Comida','Bodegones','Supermercados','Abastos','Panaderías','Pastelerías','Cafeterías','Fruterías y verduras','Carnicerías','Licorerías','Farmacias','Ferreterías','Repuestos','Tecnología','Ropa y calzado','Belleza y cosméticos','Barberías','Papelerías','Hogar y muebles','Mascotas','Servicios','Otros comercios') then cat := 'Servicios'; end if;
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
commit;
