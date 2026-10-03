-- Apply AFTER both previous migrations, BEFORE deploying the new application.
begin;
alter table public.customer_addresses alter column point drop not null;
alter table public.app_orders alter column origin drop not null;
alter table public.app_orders add column if not exists payment_mode text not null default 'prepaid' check(payment_mode in ('prepaid','on_receipt'));
alter table public.app_orders add column if not exists merchant_address text;
alter table public.app_orders add column if not exists merchant_payment jsonb;
alter table public.app_orders add column if not exists driver_payment jsonb;
alter table public.order_messages add column if not exists audio_path text;
alter table public.order_messages drop constraint if exists order_messages_channel_check;
alter table public.order_messages add constraint order_messages_channel_check check(channel in ('merchant','driver','support'));
update storage.buckets set allowed_mime_types=array['image/jpeg','image/png','image/webp','audio/webm','audio/ogg','audio/mpeg','audio/mp4'] where id='pedidos';
alter table public.app_orders add column if not exists pickup_code text not null default lpad((floor(random()*10000)::int)::text,4,'0');
alter table public.app_orders add column if not exists pickup_failures int not null default 0;
alter table public.app_orders add column if not exists terms_version text;
alter table public.app_orders add column if not exists request_key uuid;
create unique index if not exists order_request_key on public.app_orders(customer_id,request_key) where request_key is not null;
alter table public.app_orders add column if not exists loss_recorded boolean not null default false;
alter table public.app_orders add column if not exists collected_at timestamptz;
alter table public.app_orders add column if not exists arrived_at timestamptz;
alter table public.app_orders add column if not exists commission_reserved numeric(12,2) not null default 0;
alter table public.app_orders add column if not exists returned_by_driver boolean not null default false;
alter table public.app_orders add column if not exists returned_to_merchant boolean not null default false;
alter table public.driver_wallets add column if not exists reserved numeric(12,2) not null default 0 check(reserved>=0 and reserved<=balance);
alter table public.wallet_ledger add column if not exists adjustment_order_id uuid unique references public.app_orders(id);
alter table public.app_orders drop constraint if exists app_orders_state_check;
alter table public.app_orders add constraint app_orders_state_check check(state in ('merchant_pending','products_payment','products_review','searching','delivery_payment','delivery_review','preparing','picked_up','pickup_ready','awaiting_handover','delivered','cancelled','disputed'));
drop trigger if exists order_driver_location on public.drivers;

-- Preserve pending historical orders and their original payment rules.
do $$ begin
 if to_regprocedure('public.order_action_prepaid(uuid,uuid,text,jsonb)') is null then
  alter function public.order_action(uuid,uuid,text,jsonb) rename to order_action_prepaid;
 end if;
 if to_regprocedure('public.order_create_prepaid(uuid,jsonb)') is null then
  alter function public.order_create(uuid,jsonb) rename to order_create_prepaid;
 end if;
end $$;
create or replace function public.order_action_prepaid(p_order uuid,p_actor uuid,p_action text,p_data jsonb default '{}')
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

create or replace function public.order_create(p_actor uuid,p_data jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 perform 1 from public.profiles where user_id=p_actor and role='client' and not suspended for update;
 if not found then raise exception 'Cuenta de cliente no disponible'; end if;
 if p_data->>'request_key' is not null then
  select id into result from public.app_orders where customer_id=p_actor and request_key=(p_data->>'request_key')::uuid;
  if found then return result; end if;
 end if;
 result:=public.order_create_prepaid(p_actor,p_data);
 update public.app_orders set payment_mode=coalesce(p_data->>'payment_mode','prepaid'), merchant_address=p_data->>'merchant_address', merchant_payment=p_data->'merchant_payment',request_key=(p_data->>'request_key')::uuid,terms_version=p_data->>'terms_version' where id=result;
 return result;
end $$;

create or replace function public.order_action(p_order uuid,p_actor uuid,p_action text,p_data jsonb default '{}')
returns public.app_orders language plpgsql security definer set search_path=public as $$
declare o public.app_orders; mu uuid; du uuid; d public.drivers; administrator boolean; c jsonb; mins jsonb;
 target text; deadline timestamptz; pay public.order_payments; charge numeric; expected numeric;
begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 select * into o from public.app_orders where id=p_order for update;
 if not found then raise exception 'Pedido no encontrado'; end if;
 if o.payment_mode='prepaid' then return public.order_action_prepaid(p_order,p_actor,p_action,p_data); end if;
 if not exists(select 1 from public.profiles where user_id=p_actor and not suspended) then raise exception 'Cuenta no disponible'; end if;
 select user_id into mu from public.merchants where id=o.merchant_id;
 select user_id into du from public.drivers where id=o.driver_id;
 select exists(select 1 from public.profiles where user_id=p_actor and role='admin') into administrator;
 select order_config into c from public.app_settings where id=1;
 mins:=coalesce(c->'minutes','{"accept":10,"search":15,"products":20,"merchantConfirm":15,"delivery":10,"driverConfirm":10}');
 target:=o.state; deadline:=o.deadline_at;
 if o.deadline_at<=now() and o.state='merchant_pending' then raise exception 'El pedido venció'; end if;

 if p_action='accept' and p_actor=mu and o.state='merchant_pending' then
  if o.fulfillment='pickup' then target:='preparing'; deadline:=now()+interval '30 minutes';
  else target:='searching'; deadline:=now()+make_interval(mins=>(mins->>'search')::int); end if;
 elsif p_action='reject' and p_actor=mu and o.state='merchant_pending' then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Indica el motivo'; end if;
  target:='cancelled'; o.reason:=left(p_data->>'reason',300); deadline:=null;
 elsif p_action='claim' and o.state='searching' and o.fulfillment='delivery' then
  if o.deadline_at<=now() then raise exception 'La búsqueda venció'; end if;
  select * into d from public.drivers where user_id=p_actor for update;
  if d.id is null or d.status<>'approved' or not d.is_online then raise exception 'Debes estar aprobado y disponible'; end if;
  if exists(select 1 from public.app_orders where driver_id=d.id and state not in ('delivered','cancelled')) then raise exception 'Ya tienes un pedido activo'; end if;
  if not exists(select 1 from public.order_accounts where user_id=p_actor and account->>'bank'<>'' and account->>'phone'<>'' and account->>'document'<>'') then raise exception 'Completa tus datos de pago'; end if;
  charge:=trunc(o.delivery_fee*o.commission_percent)/100;
  update public.driver_wallets set reserved=reserved+charge where driver_id=d.id and balance-reserved>=charge;
  if not found then raise exception 'Recarga tu saldo disponible para cubrir la comisión'; end if;
  o.driver_id:=d.id; select account into o.driver_payment from public.order_accounts where user_id=p_actor; o.commission_reserved:=charge; target:='preparing'; deadline:=now()+interval '30 minutes';
 elsif p_action='ready' and p_actor=mu and not o.ready and o.state in ('searching','preparing') then
  o.ready:=true;
  if o.fulfillment='pickup' then target:='pickup_ready'; deadline:=now()+interval '30 minutes'; end if;
 elsif p_action='picked_up' and p_actor=du and o.state='preparing' and o.ready then
  if p_data->>'code' is distinct from o.pickup_code then
   o.pickup_failures:=o.pickup_failures+1;
   if o.pickup_failures>=5 then target:='disputed'; o.reason:='Demasiados intentos de código de recogida'; deadline:=null; end if;
  else target:='picked_up'; o.collected_at:=now(); deadline:=now()+interval '45 minutes'; end if;
 elsif p_action='arrived' and p_actor=du and o.state='picked_up' then
  o.arrived_at:=now(); target:='products_payment'; deadline:=now()+make_interval(mins=>(mins->>'products')::int);
 elsif p_action='begin_payment' and p_actor=o.customer_id and o.state='pickup_ready' then
  o.arrived_at:=now(); target:='products_payment'; deadline:=now()+make_interval(mins=>(mins->>'products')::int);
 elsif p_action='receipt' and ((p_actor=o.customer_id and o.state in ('products_payment','delivery_payment')) or
  (o.state='disputed' and ((p_actor=mu and o.products_paid and not o.products_refunded) or (p_actor=du and o.delivery_paid and not o.delivery_refunded)))) then
  if coalesce(p_data->>'reference','') !~ '^[0-9]{5}$' or coalesce(p_data->>'bank','')='' or coalesce(p_data->>'receipt','') not like o.id::text||'/'||p_actor::text||'/%' then raise exception 'Comprobante inválido'; end if;
  if p_actor=o.customer_id and coalesce(p_data->>'in_person','false')<>'true' then raise exception 'Confirma que el pedido está presente antes de pagar'; end if;
  expected:=round((case when p_actor=du or o.state='delivery_payment' then o.delivery_fee else o.subtotal end)*o.rate,2);
  if (p_data->>'amount')::numeric is distinct from expected or expected<=0 then raise exception 'El monto debe coincidir con los bolívares indicados; si pagaste distinto, abre una incidencia'; end if;
  if exists(select 1 from public.order_payments where order_id=o.id and status='pending' and payer_id=p_actor) then raise exception 'Ya hay un comprobante pendiente'; end if;
  insert into public.order_payments(order_id,kind,payer_id,payee_id,reference,bank,amount,receipt,duplicate)
  values(o.id,case when p_actor<>o.customer_id then 'refund' when o.state='products_payment' then 'products' else 'delivery' end,p_actor,
   case when p_actor<>o.customer_id then o.customer_id when o.state='products_payment' then mu else du end,
   p_data->>'reference',left(p_data->>'bank',80),expected,p_data->>'receipt',
   exists(select 1 from public.order_payments where payee_id=case when p_actor<>o.customer_id then o.customer_id when o.state='products_payment' then mu else du end and reference=p_data->>'reference' and order_id<>o.id));
  if p_actor=o.customer_id then
   target:=case when o.state='products_payment' then 'products_review' else 'delivery_review' end;
   deadline:=now()+make_interval(mins=>(mins->>case when target='products_review' then 'merchantConfirm' else 'driverConfirm' end)::int);
  end if;
 elsif p_action in ('confirm','not_received') and ((p_actor=mu and o.state='products_review') or (p_actor=du and o.state='delivery_review') or (p_actor=o.customer_id and o.state='disputed')) then
  select * into pay from public.order_payments where order_id=o.id and payee_id=p_actor and status='pending' and id=(p_data->>'payment_id')::uuid for update;
  if not found then raise exception 'No hay comprobante para revisar'; end if;
  update public.order_payments set status=case when p_action='confirm' then 'confirmed' else 'rejected' end,confirmed_by=p_actor,confirmed_at=now() where id=pay.id;
  if p_action='not_received' then
   target:='disputed'; o.reason:='Pago reportado no recibido; requiere revisión'; deadline:=null;
  elsif pay.kind='refund' then
   if pay.payer_id=mu then o.products_refunded:=true; else o.delivery_refunded:=true; end if;
   if (not o.products_paid or o.products_refunded) and (not o.delivery_paid or o.delivery_refunded) and (o.collected_at is null or o.delivered_at is not null or o.returned_to_merchant or o.loss_recorded) then target:='cancelled'; deadline:=null; end if;
  elsif pay.kind='products' then
   o.products_paid:=true;
   target:=case when o.fulfillment='pickup' or o.delivery_fee=0 then 'awaiting_handover' else 'delivery_payment' end;
   deadline:=now()+make_interval(mins=>(mins->>'delivery')::int);
  else o.delivery_paid:=true; target:='awaiting_handover'; deadline:=now()+interval '15 minutes'; end if;
 elsif p_action='delivered' and o.state='awaiting_handover' and o.products_paid and (o.fulfillment='pickup' or o.delivery_paid or o.delivery_fee=0) and ((p_actor=du and o.fulfillment='delivery') or (p_actor=mu and o.fulfillment='pickup')) then
  if p_data->>'code' is distinct from o.delivery_code then
   o.code_failures:=o.code_failures+1;
   if o.code_failures>=5 then target:='disputed'; o.reason:='Demasiados intentos de código de entrega'; deadline:=null; end if;
  else
   if o.driver_id is not null then
    perform 1 from public.drivers where id=o.driver_id for update;
    update public.driver_wallets set balance=balance-o.commission_reserved,reserved=reserved-o.commission_reserved where driver_id=o.driver_id and reserved>=o.commission_reserved;
    if not found then raise exception 'No se encontró la reserva de comisión'; end if;
    insert into public.wallet_ledger(driver_id,order_id,amount) values(o.driver_id,o.id,-o.commission_reserved);
    o.commission_reserved:=0;
   end if;
   target:='delivered'; o.delivered_at:=now(); deadline:=null;
  end if;
 elsif p_action='pickup' and p_actor=o.customer_id and o.state='searching' then
  o.fulfillment:='pickup'; o.delivery_fee:=0; target:=case when o.ready then 'pickup_ready' else 'preparing' end; deadline:=now()+interval '30 minutes';
 elsif p_action='dispute' and (p_actor in (o.customer_id,mu,du) or administrator) and o.state not in ('cancelled','disputed') then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Explica el motivo'; end if;
  target:='disputed'; o.reason:=left(p_data->>'reason',300); deadline:=null;
 elsif p_action='cancel' and (p_actor in (o.customer_id,mu,du) or administrator) and o.state not in ('delivered','cancelled') then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Indica el motivo'; end if;
  target:=case when o.products_paid or o.delivery_paid or o.collected_at is not null or exists(select 1 from public.order_payments where order_id=o.id and status='pending') then 'disputed' else 'cancelled' end;
  o.reason:=left(p_data->>'reason',300); deadline:=null;
 elsif p_action='return_sent' and p_actor=du and o.state='disputed' and o.collected_at is not null and o.delivered_at is null then o.returned_by_driver:=true;
 elsif p_action='return_received' and p_actor=mu and o.state='disputed' and o.returned_by_driver then o.returned_to_merchant:=true;
 elsif p_action='record_loss' and administrator and o.state='disputed' and o.collected_at is not null and o.delivered_at is null then
  if length(trim(coalesce(p_data->>'reason','')))<10 then raise exception 'Documenta la pérdida y la resolución de custodia'; end if;
  o.loss_recorded:=true; o.reason:=left(p_data->>'reason',300);
 elsif p_action='close_cancel' and administrator and o.state='disputed' and (not o.products_paid or o.products_refunded) and (not o.delivery_paid or o.delivery_refunded) and (o.collected_at is null or o.returned_to_merchant or o.delivered_at is not null or o.loss_recorded) and not exists(select 1 from public.order_payments where order_id=o.id and status='pending') then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Documenta el cierre'; end if;
  target:='cancelled'; o.reason:=left(p_data->>'reason',300); deadline:=null;
 elsif p_action='resolve' and administrator and o.state='disputed' and not o.products_refunded and not o.delivery_refunded and not o.returned_by_driver then
  if length(trim(coalesce(p_data->>'reason','')))<3 then raise exception 'Documenta la resolución'; end if;
  target:=coalesce(o.previous_state,'merchant_pending');
  if target in ('products_review','delivery_review') and not exists(select 1 from public.order_payments where order_id=o.id and status='pending') then target:=case when target='products_review' then 'products_payment' else 'delivery_payment' end; end if;
  if target in ('cancelled','disputed') then raise exception 'No se puede reabrir este pedido'; end if;
  deadline:=case when target='delivered' then null else now()+interval '15 minutes' end; o.reason:=left(p_data->>'reason',300);
 elsif p_action='reassign' and administrator and o.state in ('preparing','searching','disputed') and o.collected_at is null and not o.products_paid and not o.delivery_paid and not exists(select 1 from public.order_payments where order_id=o.id and status='pending') then
  if o.driver_id is not null then update public.driver_wallets set reserved=reserved-o.commission_reserved where driver_id=o.driver_id; end if;
  o.commission_reserved:=0; o.driver_id:=null; target:='searching'; deadline:=now()+make_interval(mins=>(mins->>'search')::int);
 elsif p_action='rating' and p_actor=o.customer_id and o.state='delivered' and o.rating is null then o.rating:=(p_data->>'rating')::int;
 else raise exception 'Acción no permitida en este paso'; end if;

 if target='cancelled' and o.driver_id is not null then
  update public.driver_wallets set reserved=reserved-o.commission_reserved where driver_id=o.driver_id; o.commission_reserved:=0;
  if exists(select 1 from public.wallet_ledger where order_id=o.id) and not exists(select 1 from public.wallet_ledger where adjustment_order_id=o.id) then
   select -amount into charge from public.wallet_ledger where order_id=o.id;
   update public.driver_wallets set balance=balance+charge where driver_id=o.driver_id;
   insert into public.wallet_ledger(driver_id,adjustment_order_id,amount) values(o.driver_id,o.id,charge);
  end if;
 end if;
 update public.app_orders set state=target,driver_id=o.driver_id,driver_payment=o.driver_payment,fulfillment=o.fulfillment,delivery_fee=o.delivery_fee,ready=o.ready,
 products_paid=o.products_paid,delivery_paid=o.delivery_paid,reason=o.reason,rating=o.rating,delivered_at=o.delivered_at,
 products_refunded=o.products_refunded,delivery_refunded=o.delivery_refunded,pickup_failures=o.pickup_failures,code_failures=o.code_failures,
 collected_at=o.collected_at,arrived_at=o.arrived_at,commission_reserved=o.commission_reserved,
 returned_by_driver=o.returned_by_driver,returned_to_merchant=o.returned_to_merchant,loss_recorded=o.loss_recorded,
 previous_state=case when target='disputed' and o.state<>'disputed' then o.state else previous_state end,
 stalled=false,deadline_at=deadline,updated_at=now() where id=o.id returning * into o;
 insert into public.order_events(order_id,actor_id,action) values(o.id,p_actor,p_action);
 return o;
end $$;

create or replace function public.orders_tick() returns setof public.app_orders language plpgsql security definer set search_path=public as $$
declare o public.app_orders; old_state text; begin
 if auth.role() is distinct from 'service_role' and session_user not in ('postgres','supabase_admin') then raise exception 'No autorizado'; end if;
 for o in select * from public.app_orders where deadline_at<=now() and state not in ('delivered','cancelled','disputed') for update skip locked loop
  old_state:=o.state;
  if o.payment_mode='on_receipt' then
   if o.state in ('merchant_pending','searching') then o.state:='cancelled'; o.reason:='Se venció la aceptación o no se consiguió repartidor';
   else o.state:='disputed'; o.reason:='Tiempo vencido: revisar preparación, entrega o pago; no se confirmó dinero automáticamente'; end if;
  else
   if o.state in ('merchant_pending','products_payment') then o.state:='cancelled'; o.reason:='Se venció el tiempo para aceptar o pagar';
   elsif o.state='delivery_payment' then o.state:='searching'; o.driver_id:=null; o.expanded_at:=now();
   elsif o.state='searching' then o.pickup_offered:=true; o.expanded_at:=now(); end if;
  end if;
  update public.app_orders set state=o.state,driver_id=o.driver_id,reason=o.reason,pickup_offered=o.pickup_offered,expanded_at=o.expanded_at,
  previous_state=case when o.state='disputed' then old_state else previous_state end,deadline_at=null,stalled=true,updated_at=now() where id=o.id returning * into o;
  insert into public.order_events(order_id,action) values(o.id,'timeout'); return next o;
 end loop;
end $$;
revoke all on function public.order_action(uuid,uuid,text,jsonb),public.order_create(uuid,jsonb),public.orders_tick() from public,anon,authenticated;
grant execute on function public.order_action(uuid,uuid,text,jsonb),public.order_create(uuid,jsonb),public.orders_tick() to service_role;
commit;
