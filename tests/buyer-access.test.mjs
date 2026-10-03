import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

function load(source) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
  return module.exports;
}
const { buyerReturnPath } = load(fs.readFileSync('lib/buyer-navigation.ts', 'utf8'));
for (const path of ['/comercio/pan-del-pueblo', '/mis-pedidos?pedido=123', '/mi-cuenta']) assert.equal(buyerReturnPath(path), path);
for (const path of [null, '//example.com', 'https://example.com', '/panel', '/admin', '/repartidor', '/comercio/../panel', '/comercio/tienda\\admin']) assert.equal(buyerReturnPath(path), '/mis-pedidos');
const { CATEGORIES } = load(fs.readFileSync('lib/types.ts', 'utf8'));
const oldCategories = "'Comida','Bodegones','Farmacias','Repuestos','Servicios','Barberías'";
const newCategories = CATEGORIES.map(c => `'${c}'`).join(',');
const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
  await db.exec(fs.readFileSync('tests/sql/00-simular-supabase.sql', 'utf8'));
  // Start with the old catalog and signup trigger, as on an existing installation.
  await db.exec(fs.readFileSync('schema.sql', 'utf8').replace('create extension if not exists "pgcrypto";', '').replaceAll(newCategories, oldCategories));
  await db.exec("insert into merchants(name,slug,category,whatsapp_number) values('Local existente','local-existente','Comida','584141234567')");
  const migration = fs.readFileSync('migrations/20261003_buyer_access_categories.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration);
  assert.equal((await db.query("select category from merchants where slug='local-existente'")).rows[0].category, 'Comida');
  for (const category of CATEGORIES) {
    const { rows: [user] } = await db.query('insert into auth.users(raw_user_meta_data) values($1) returning id', [{ signup_role: 'merchant', full_name: 'Persona de prueba', business: { name: `Local ${category}`, category } }]);
    assert.equal((await db.query('select category from merchants where user_id=$1', [user.id])).rows[0].category, category);
    await db.query('update merchants set category=$1 where user_id=$2', [category, user.id]);
  }
  const { rows: [buyer] } = await db.query('insert into auth.users(raw_user_meta_data) values($1) returning id', [{ signup_role: 'client', full_name: 'Comprador de prueba' }]);
  assert.equal((await db.query('select role from profiles where user_id=$1', [buyer.id])).rows[0].role, 'client');
  assert.equal((await db.query('select id from merchants where user_id=$1', [buyer.id])).rows.length, 0);
  assert.equal((await db.query('select id from drivers where user_id=$1', [buyer.id])).rows.length, 0);
  await assert.rejects(db.query("update merchants set category='Categoría inventada' where slug='local-existente'"));
  console.log('Acceso de comprador, retorno seguro y registro de las 22 categorías: aprobados.');
} finally { await db.close(); }
