\set ON_ERROR_STOP 1
create schema if not exists t; grant usage on schema t to public;
create or replace function t.ok(c boolean, m text) returns void language plpgsql as $$
begin if c then raise notice '  ✓ %', m; else raise warning '  ✗ %', m; end if; end $$;
-- helper para actuar como un usuario
create or replace function t.as_user(u uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false); end $$;

-- Registros
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-00000000000a','com@t.com','{"signup_role":"merchant","full_name":"Ana Pérez","phone":"04141112233","business":{"name":"Arepera","category":"Comida","whatsapp_number":"04141112233","address":"Calle 1"},"legal":{"legal_name":"Ana María Pérez","id_type":"V","id_number":"12.345.678","birth_date":"1990-05-10","business_legal_name":"Inversiones Ana C.A.","rif":"j-12345678-9","terms_version":"2026-09-30"}}'),
 ('00000000-0000-0000-0000-00000000000b','rep@t.com','{"signup_role":"delivery","full_name":"Luis Rangel","phone":"04241234567","driver":{"vehicle":"moto","plate":"AB123"},"legal":{"legal_name":"Luis Rangel","id_type":"V","id_number":"20111222","birth_date":"1998-01-02","home_address":"Sector El Llano","emergency_name":"Rosa Rangel","emergency_phone":"04161112222","vehicle_brand":"Bera","vehicle_model":"SBR","vehicle_color":"Negro","has_license":"true","has_rcv":"true","terms_version":"2026-09-30"}}'),
 ('00000000-0000-0000-0000-00000000000c','rep2@t.com','{"signup_role":"delivery","full_name":"Otro","phone":"04241234568","driver":{"vehicle":"moto"},"legal":{"legal_name":"Otro","id_type":"V","id_number":"20111222","birth_date":"no-es-fecha","terms_version":"2026-09-30"}}'),
 ('00000000-0000-0000-0000-00000000000d','adm@t.com','{}'),
 ('00000000-0000-0000-0000-00000000000e','rep3@t.com','{"signup_role":"delivery","full_name":"Pedro","phone":"04241234569","driver":{"vehicle":"carro"},"legal":{"legal_name":"Pedro Pérez","id_type":"V","id_number":"30999888","birth_date":"31/02/2000","terms_version":"2026-09-30"}}');
update public.profiles set role='admin' where user_id='00000000-0000-0000-0000-00000000000d';

select t.ok((select count(*) from auth.users)=5, 'las 5 cuentas se crean (ninguna falla por los datos legales)');
select t.ok((select rif='J123456789' and id_number='12345678' and terms_accepted_at is not null and kind='merchant' from legal_profiles where user_id='00000000-0000-0000-0000-00000000000a'), 'comercio: RIF y cédula limpios, aceptación de términos con fecha');
select t.ok((select emergency_name='Rosa Rangel' and has_rcv and has_license and birth_date='1998-01-02' from legal_profiles where user_id='00000000-0000-0000-0000-00000000000b'), 'repartidor: contacto de emergencia, licencia, RCV y fecha guardados');
select t.ok(not exists(select 1 from legal_profiles where user_id='00000000-0000-0000-0000-00000000000c'), 'cédula repetida: la cuenta se crea pero sin datos legales (los completa en el panel)');
select t.ok((select birth_date is null from legal_profiles where user_id='00000000-0000-0000-0000-00000000000e'), 'fecha inválida no rompe el registro (queda vacía)');

\c - authenticator
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from legal_profiles)=1, 'el comercio solo ve SUS datos legales');
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from legal_profiles)=1 and (select user_id from legal_profiles)='00000000-0000-0000-0000-00000000000b', 'el repartidor solo ve SUS datos legales');
select t.as_user('00000000-0000-0000-0000-00000000000d');
select t.ok((select count(*) from legal_profiles)=3, 'el administrador ve todos (3 con datos)');
\c - postgres
\c - authenticator
set role anon; select set_config('request.jwt.claims','{"role":"anon"}',false);
select t.ok((select count(*) from legal_profiles)=0, 'el público no ve nada');
\c - postgres

-- Cambios del repartidor mientras está pendiente
\c - authenticator
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000b');
update legal_profiles set id_number='20111223', admin_notes='hack', terms_accepted_at='2000-01-01', kind='merchant' where user_id='00000000-0000-0000-0000-00000000000b';
\c - postgres
select t.ok((select id_number='20111223' and admin_notes is null and terms_accepted_at > now() - interval '1 hour' and kind='delivery' from legal_profiles where user_id='00000000-0000-0000-0000-00000000000b'), 'pendiente: puede corregir su cédula, pero no notas del admin, ni la fecha de aceptación, ni el tipo');

-- Aprobado: identidad bloqueada, documentos sí
update drivers set status='approved' where user_id='00000000-0000-0000-0000-00000000000b';
\c - authenticator
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000b');
update legal_profiles set id_number='99999999', legal_name='Otro Nombre', docs='{"cedula":"00000000-0000-0000-0000-00000000000b/cedula.webp"}', emergency_phone='04160000000' where user_id='00000000-0000-0000-0000-00000000000b';
\c - postgres
select t.ok((select id_number='20111223' and legal_name='Luis Rangel' and docs->>'cedula' is not null and emergency_phone='04160000000' from legal_profiles where user_id='00000000-0000-0000-0000-00000000000b'), 'aprobado: no puede cambiar nombre ni cédula; sí documentos y contacto');

-- El que quedó sin datos (cédula repetida) los completa y choca con la regla
\c - authenticator
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000c');
do $$ begin
  insert into legal_profiles (user_id, kind, legal_name, id_type, id_number) values ('00000000-0000-0000-0000-00000000000c','delivery','Otro','V','20111223');
  raise warning '  ✗ debió rechazar la cédula repetida';
exception when unique_violation then raise notice '  ✓ cédula repetida rechazada al completar en el panel';
end $$;
do $$ begin
  insert into legal_profiles (user_id, kind, legal_name) values ('00000000-0000-0000-0000-00000000000a','merchant','intruso');
  raise warning '  ✗ pudo crear datos para otra persona';
exception when others then raise notice '  ✓ no puede crear datos legales a nombre de otro';
end $$;
insert into legal_profiles (user_id, kind, legal_name, id_type, id_number, terms_version) values ('00000000-0000-0000-0000-00000000000c','delivery','Otro','V','25555666','2026-09-30');
\c - postgres
select t.ok((select terms_accepted_at is not null from legal_profiles where user_id='00000000-0000-0000-0000-00000000000c'), 'completar en el panel registra la aceptación');

-- Documentos privados
\c - authenticator
set role authenticated;
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into storage.objects (bucket_id, name) values ('documentos','00000000-0000-0000-0000-00000000000b/cedula.webp');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('documentos','00000000-0000-0000-0000-00000000000a/falso.webp');
  raise warning '  ✗ subió en carpeta ajena';
exception when others then raise notice '  ✓ no puede subir documentos en la carpeta de otro';
end $$;
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from storage.objects where bucket_id='documentos')=0, 'el comercio NO puede ver la cédula del repartidor');
select t.as_user('00000000-0000-0000-0000-00000000000d');
select t.ok((select count(*) from storage.objects where bucket_id='documentos')=1, 'el administrador sí puede verla');
\c - postgres
select t.ok((select not public from storage.buckets where id='documentos'), 'el bucket de documentos es privado');
