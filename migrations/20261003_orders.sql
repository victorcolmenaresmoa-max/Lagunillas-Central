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
