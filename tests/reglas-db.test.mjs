/**
 * Pruebas de las reglas de la base de datos (permisos, planes, delivery, fotos).
 */
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
// Uso: SUPABASE_URL=... SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... PGURL=... node tests/reglas-db.test.mjs
// Ejecutar SOLO contra una base de pruebas: crea y modifica datos.
const URL = process.env.SUPABASE_URL || 'http://localhost:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!ANON || !SERVICE) { console.error('Faltan SUPABASE_ANON_KEY y SUPABASE_SERVICE_ROLE_KEY'); process.exit(1); }
const PG = process.env.PGURL || 'postgres://postgres@127.0.0.1:54322/postgres';
const sql = (q) => execSync(`psql "${PG}" -tAc "${q.replace(/"/g,'\\"')}"`).toString().trim();
const mk = () => createClient(URL, ANON, { auth: { persistSession: false } });
const svc = createClient(URL, SERVICE, { auth: { persistSession: false } });
let pass=0, fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓',m)} else {fail++;console.log('  ✗',m)} };
const rnd=Math.random().toString(36).slice(2,7);

async function signUp(email, meta){ const c=mk(); const {data,error}=await c.auth.signUp({email,password:'Clave12345',options:{data:meta}}); if(error) throw error; return {c, user:data.user}; }

console.log('Registro');
const M = await signUp(`com-${rnd}@t.com`, {signup_role:'merchant', full_name:'Ana', phone:'04141112233', business:{name:`Arepera Ñá ${rnd}`, category:'Comida', whatsapp_number:'04141112233', address:'Calle 1', opens_at:'07:00', closes_at:'21:00'}});
const D = await signUp(`rep-${rnd}@t.com`, {signup_role:'delivery', full_name:'Luis', phone:'04241234567', driver:{vehicle:'moto', plate:'AB123'}});
const D2 = await signUp(`rep2-${rnd}@t.com`, {signup_role:'delivery', full_name:'Pedro', phone:'04241234568', driver:{vehicle:'carro'}});
const A = await signUp(`adm-${rnd}@t.com`, {signup_role:'admin'});
const X = await signUp(`cli-${rnd}@t.com`, {});
ok(sql(`select role from profiles where user_id='${A.user.id}'`)==='client','pedir rol admin al registrarse no da admin');
sql(`update profiles set role='admin' where user_id='${A.user.id}'`);
let {data:mm}=await M.c.from('merchants').select('*').eq('user_id',M.user.id).single();
ok(mm && mm.status==='pending' && mm.plan==='gratis','comercio creado pendiente y gratis');
ok(mm.slug.startsWith('arepera-na-'),'slug limpio: '+mm.slug);
let {data:dd}=await D.c.from('drivers').select('*').single();
ok(dd && dd.status==='pending' && dd.vehicle==='moto','repartidor creado pendiente');

console.log('Visibilidad y permisos del comercio');
let {data:pub}=await mk().from('merchants').select('id').eq('id',mm.id);
ok(pub.length===0,'público no ve comercio pendiente');
await M.c.from('merchants').update({status:'approved', plan:'premium', is_featured:true, name:'Nuevo nombre'}).eq('id',mm.id);
({data:mm}=await M.c.from('merchants').select('*').eq('user_id',M.user.id).single())
ok(mm.status==='pending' && mm.plan==='gratis' && !mm.is_featured && mm.name==='Nuevo nombre','comercio no puede auto-aprobarse ni cambiar plan (sí su nombre)');
let r=await M.c.from('merchants').update({cover_url:'http://x/y.webp'}).eq('id',mm.id);
ok(r.error && r.error.message.includes('PLAN_PORTADA'),'portada bloqueada en plan gratis');
await A.c.from('merchants').update({status:'approved'}).eq('id',mm.id);
({data:pub}=await mk().from('merchants').select('id,approved_at').eq('id',mm.id));
ok(pub.length===1 && pub[0].approved_at,'admin aprueba → público lo ve');

console.log('Límites del plan');
const rows=Array.from({length:10},(_,i)=>({merchant_id:mm.id,title:'P'+i,price:5}));
for (const row of rows){ const e=(await M.c.from('products').insert(row)).error; if(e){console.log(e.message);} }
r=await M.c.from('products').insert({merchant_id:mm.id,title:'P11',price:5});
ok(r.error && r.error.message.includes('PLAN_PRODUCTOS'),'producto 11 bloqueado en Gratis');
const {data:prods}=await M.c.from('products').select('id,price').eq('merchant_id',mm.id);
const exp=new Date(Date.now()+3600e3).toISOString();
r=await M.c.from('flash_deals').insert({merchant_id:mm.id,product_id:prods[0].id,discount_price:3,expires_at:exp});
ok(r.error && r.error.message.includes('PLAN_OFERTAS'),'ofertas bloqueadas en Gratis');
await A.c.from('merchants').update({plan:'pro', plan_expires_at:new Date(Date.now()+30*864e5).toISOString()}).eq('id',mm.id);
r=await M.c.from('flash_deals').insert({merchant_id:mm.id,product_id:prods[0].id,discount_price:3,expires_at:exp});
ok(!r.error,'oferta permitida en Pro');
r=await M.c.from('flash_deals').insert({merchant_id:mm.id,product_id:prods[1].id,discount_price:9,expires_at:exp});
ok(r.error && r.error.message.includes('OFERTA_INVALIDA'),'oferta más cara que el precio bloqueada');
await M.c.from('flash_deals').insert({merchant_id:mm.id,product_id:prods[1].id,discount_price:2,expires_at:exp});
r=await M.c.from('flash_deals').insert({merchant_id:mm.id,product_id:prods[2].id,discount_price:2,expires_at:exp});
ok(r.error && r.error.message.includes('PLAN_OFERTAS'),'tercera oferta bloqueada en Pro (máx 2)');
r=await M.c.from('merchants').update({cover_url:'http://x/y.webp'}).eq('id',mm.id).select();
ok(!r.error,'portada permitida en Pro');
await A.c.from('merchants').update({plan_expires_at:new Date(Date.now()-864e5).toISOString()}).eq('id',mm.id);
r=await M.c.from('products').insert({merchant_id:mm.id,title:'P11',price:5});
ok(r.error && r.error.message.includes('PLAN_PRODUCTOS'),'plan vencido vuelve a límites de Gratis');
const X2=mk(); r=await X.c.from('products').insert({merchant_id:mm.id,title:'hack',price:1});
ok(r.error,'otro usuario no puede crear productos en un comercio ajeno');

console.log('Fotos (Storage)');
const img=new Blob([new Uint8Array([137,80,78,71])],{type:'image/png'});
r=await M.c.storage.from('media').upload(`${M.user.id}/logo.png`, img); 
ok(!r.error,'comercio sube foto en su carpeta');
r=await M.c.storage.from('media').upload(`${D.user.id}/hack.png`, img);
ok(r.error,'no puede subir en carpeta ajena');
r=await mk().storage.from('media').upload(`anon/x.png`, img);
ok(r.error,'visitante sin cuenta no puede subir');

console.log('Delivery');
const {data:req, error:reqErr}=await svc.from('delivery_requests').insert({merchant_id:mm.id,customer_name:'Cliente',customer_phone:'04140000000',address:'Sector La Trinidad casa 8',items:[{title:'P0',qty:2,price:5}],subtotal:10,delivery_fee:1.5}).select().single();
ok(!reqErr && req.code.startsWith('LC-'),'servidor crea solicitud con código '+(req&&req.code));
({data:pub}=await mk().from('delivery_requests').select('*'));
ok(!pub || pub.length===0,'público no puede leer pedidos');
let av=await D.c.rpc('available_deliveries');
ok(!av.error && av.data.length===0,'repartidor pendiente no ve pedidos');
r=await D.c.rpc('accept_delivery',{p_id:req.id});
ok(r.error && r.error.message.includes('NO_AUTORIZADO'),'repartidor pendiente no puede aceptar');
await A.c.from('drivers').update({status:'approved'}).eq('user_id',D.user.id);
await A.c.from('drivers').update({status:'approved'}).eq('user_id',D2.user.id);
r=await D.c.rpc('set_driver_online',{p_online:true});
ok(!r.error && r.data.is_online,'repartidor aprobado se pone disponible');
await D.c.from('drivers').update({status:'approved'}).eq('user_id',D.user.id);
av=await D.c.rpc('available_deliveries');
ok(av.data.length===1 && av.data[0].items_count===2 && !('customer_phone' in av.data[0]),'ve el pedido disponible sin teléfono del cliente');
const [a1,a2]=await Promise.all([D.c.rpc('accept_delivery',{p_id:req.id}), D2.c.rpc('accept_delivery',{p_id:req.id})]);
ok((!a1.error)!==(!a2.error),'dos repartidores a la vez: solo uno se lo queda');
const winner = !a1.error ? D : D2, loser = !a1.error ? D2 : D;
let {data:mine}=await winner.c.from('delivery_requests').select('customer_phone,status').eq('id',req.id).single();
ok(mine && mine.customer_phone==='04140000000' && mine.status==='accepted','el ganador ve teléfono del cliente');
({data:pub}=await loser.c.from('delivery_requests').select('*').eq('id',req.id));
ok(pub.length===0,'el otro repartidor no ve el pedido');
r=await loser.c.rpc('update_delivery_status',{p_id:req.id,p_status:'picked_up'});
ok(r.error,'otro repartidor no puede cambiar el estado');
r=await winner.c.rpc('update_delivery_status',{p_id:req.id,p_status:'delivered'});
ok(r.error && r.error.message.includes('ESTADO_INVALIDO'),'no puede saltar a entregado sin recoger');
r=await winner.c.rpc('update_delivery_status',{p_id:req.id,p_status:'picked_up'});
ok(!r.error && r.data.status==='picked_up','marca recogido');
r=await winner.c.rpc('update_delivery_status',{p_id:req.id,p_status:'delivered'});
ok(!r.error && r.data.status==='delivered','marca entregado');
({data:pub}=await M.c.from('delivery_requests').select('status').eq('id',req.id));
ok(pub[0].status==='delivered','el comercio ve su pedido');
r=await M.c.rpc('cancel_delivery',{p_id:req.id});
ok(r.error,'no se cancela un pedido entregado');
await A.c.from('drivers').update({status:'suspended'}).eq('user_id',D.user.id);
({data:dd}=await A.c.from('drivers').select('is_online').eq('user_id',D.user.id).single());
ok(dd.is_online===false,'al suspender repartidor queda desconectado');
r=await X.c.from('profiles').update({role:'admin'}).eq('user_id',X.user.id);
ok(sql(`select role from profiles where user_id='${X.user.id}'`)==='client','cliente no puede hacerse admin');
console.log(`\n${pass} correctas, ${fail} fallidas`);
process.exit(fail?1:0);
