import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
let checks = 0;
const ok = (v, label) => {
  assert.ok(v, label);
  checks++;
};
const deny = async (fn) => {
  await assert.rejects(fn);
  checks++;
};
try {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(fs.readFileSync("tests/sql/00-simular-supabase.sql", "utf8"));
  await db.exec(
    fs
      .readFileSync("schema.sql", "utf8")
      .replace('create extension if not exists "pgcrypto";', ""),
  );
  const migration = fs.readFileSync(
    "migrations/20261003_receipt_payment.sql",
    "utf8",
  );
  await db.exec(migration);
  await db.exec(migration);
  ok(true, "Fresh schema and repeatable migration");
  const [client, merchant, driver, other, admin, driver2] = Array.from(
    { length: 6 },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  );
  for (const id of [client, merchant, driver, other, admin, driver2])
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, id + "@example.com", {}],
    );
  for (const [id, role] of [
    [merchant, "merchant"],
    [driver, "delivery"],
    [driver2, "delivery"],
    [admin, "admin"],
  ])
    await db.query("update profiles set role=$2 where user_id=$1", [id, role]);
  const m = (
    await db.query(
      "insert into merchants(user_id,name,slug,whatsapp_number,status,address) values($1,'Tienda','tienda','584141234567','approved','Calle principal casa 1') returning id",
      [merchant],
    )
  ).rows[0];
  const account = {
    bank: "Banco",
    phone: "584141234567",
    document: "V12345678",
  };
  for (const uid of [merchant, driver, driver2])
    await db.query(
      "insert into order_accounts(user_id,account) values($1,$2)",
      [uid, account],
    );
  const drivers = [];
  for (const uid of [driver, driver2]) {
    const d = (
      await db.query(
        "insert into drivers(user_id,full_name,phone,vehicle,status,is_online) values($1,'Aliado','584141234567','moto','approved',true) returning id",
        [uid],
      )
    ).rows[0];
    drivers.push(d.id);
    await db.query(
      "insert into driver_wallets(driver_id,balance) values($1,1)",
      [d.id],
    );
  }
  await db.query("update app_settings set order_config=$1", [
    {
      minutes: {
        accept: 10,
        search: 15,
        products: 20,
        merchantConfirm: 15,
        delivery: 10,
        driverConfirm: 10,
      },
    },
  ]);
  const create = async (fulfillment = "delivery", request_key = null) =>
    (
      await db.query("select order_create($1,$2) as id", [
        client,
        {
          merchant_id: m.id,
          request_key,
          terms_version: "2026-10-03-pago-al-recibir",
          customer_name: "Cliente",
          customer_phone: "584141234567",
          fulfillment,
          address: "Calle segunda casa 2",
          sector: "Centro",
          destination: null,
          origin: null,
          items: [],
          subtotal: 10,
          delivery_fee: fulfillment === "delivery" ? 2 : 0,
          distance_km: 0,
          distance_method: "fixed",
          rate: 100,
          rate_date: "2026-10-03",
          commission_percent: 10,
          deadline_at: new Date(Date.now() + 600000).toISOString(),
          payment_mode: "on_receipt",
          merchant_address: "Calle principal casa 1",
          merchant_payment: account,
        },
      ])
    ).rows[0].id;
  const get = async (id) =>
    (await db.query("select * from app_orders where id=$1", [id])).rows[0];
  const act = async (id, who, action, data = {}) =>
    (
      await db.query("select * from order_action($1,$2,$3,$4)", [
        id,
        who,
        action,
        data,
      ])
    ).rows[0];
  const proof = (id, who, amount) => ({
    reference: "12345",
    bank: "Banco",
    amount,
    in_person: true,
    receipt: `${id}/${who}/00000000-0000-4000-8000-000000000010.jpg`,
  });
  const payment = async (id, who, amount) => {
    await act(id, who, "receipt", proof(id, who, amount));
    return (
      await db.query(
        "select id from order_payments where order_id=$1 and status='pending' and payer_id=$2 order by created_at desc limit 1",
        [id, who],
      )
    ).rows[0].id;
  };
  const wallet = async () =>
    (
      await db.query("select * from driver_wallets where driver_id=$1", [
        drivers[0],
      ])
    ).rows[0];
  const o = await create();
  await deny(async () => act(o, client, "receipt", proof(o, client, 1000)));
  await deny(async () => act(o, other, "accept"));
  ok(
    (await act(o, merchant, "accept")).state === "searching",
    "Accept without advance payment",
  );
  await deny(async () => act(o, client, "receipt", proof(o, client, 1000)));
  ok(
    (await act(o, driver, "claim")).state === "preparing",
    "Claim without GPS or payment",
  );
  ok(Number((await wallet()).reserved) === 0.2, "Commission reserved at claim");
  await deny(async () => act(o, driver2, "claim"));
  await deny(async () =>
    act(o, driver, "picked_up", { code: (await get(o)).pickup_code }),
  );
  await act(o, merchant, "ready");
  ok(
    (await act(o, driver, "picked_up", { code: "wrong" })).state ===
      "preparing",
    "Wrong pickup code cannot collect",
  );
  await act(o, driver, "picked_up", { code: (await get(o)).pickup_code });
  await deny(async () =>
    act(o, driver, "delivered", { code: (await get(o)).delivery_code }),
  );
  await deny(async () => act(o, other, "arrived"));
  ok(
    (await act(o, driver, "arrived")).state === "products_payment",
    "Payment starts at arrival",
  );
  await deny(async () => act(o, client, "receipt", proof(o, client, 1)));
  await deny(async () =>
    act(o, client, "receipt", { ...proof(o, client, 1000), in_person: false }),
  );
  const pp = await payment(o, client, 1000);
  await deny(async () => act(o, driver, "confirm", { payment_id: pp }));
  ok(
    (await act(o, merchant, "confirm", { payment_id: pp })).state ===
      "delivery_payment",
    "Merchant verifies product money",
  );
  await deny(async () =>
    act(o, driver, "delivered", { code: (await get(o)).delivery_code }),
  );
  const dp = await payment(o, client, 200);
  await act(o, driver, "confirm", { payment_id: dp });
  ok(
    (await get(o)).state === "awaiting_handover",
    "Both payments precede handover",
  );
  ok(
    (await act(o, driver, "delivered", { code: "wrong" })).state ===
      "awaiting_handover",
    "Wrong code does not debit",
  );
  ok(Number((await wallet()).balance) === 1, "No debit before handover");
  await act(o, driver, "delivered", { code: (await get(o)).delivery_code });
  ok(
    Number((await wallet()).balance) === 0.8 &&
      Number((await wallet()).reserved) === 0,
    "Debit and release atomically",
  );
  await deny(async () =>
    act(o, driver, "delivered", { code: (await get(o)).delivery_code }),
  );
  ok(
    (await db.query("select * from wallet_ledger where order_id=$1", [o])).rows
      .length === 1,
    "Exactly one commission",
  );
  await act(o, client, "dispute", { reason: "Paquete incompleto" });
  await act(o, admin, "resolve", {
    reason: "Se verificó contenido y recepción",
  });
  ok(
    (await get(o)).state === "delivered",
    "Resolved post-delivery claim stays delivered",
  );
  await act(o, client, "dispute", { reason: "Devolución acordada" });
  const rp = await payment(o, merchant, 1000);
  await act(o, client, "confirm", { payment_id: rp });
  ok((await get(o)).state === "disputed", "Both payees must refund");
  const rd = await payment(o, driver, 200);
  await act(o, client, "confirm", { payment_id: rd });
  ok(
    (await get(o)).state === "cancelled",
    "Full confirmed refunds close cancellation",
  );
  ok(
    Number((await wallet()).balance) === 1,
    "Commission reversed once after full cancellation",
  );
  await deny(async () => act(o, client, "confirm", { payment_id: rd }));

  const p = await create("pickup");
  await act(p, merchant, "accept");
  await act(p, merchant, "ready");
  await deny(async () => act(p, client, "receipt", proof(p, client, 1000)));
  await act(p, client, "begin_payment");
  const pay = await payment(p, client, 1000);
  await act(p, merchant, "confirm", { payment_id: pay });
  await act(p, merchant, "delivered", { code: (await get(p)).delivery_code });
  ok((await get(p)).state === "delivered", "Pickup payment at shop");

  const cancelled = await create();
  await act(cancelled, merchant, "accept");
  await act(cancelled, driver, "claim");
  await act(cancelled, client, "cancel", { reason: "Ya no lo necesito" });
  ok(
    Number((await wallet()).reserved) === 0,
    "Cancel before collection releases commission",
  );
  const returned = await create();
  await act(returned, merchant, "accept");
  await act(returned, driver, "claim");
  await act(returned, merchant, "ready");
  await act(returned, driver, "picked_up", {
    code: (await get(returned)).pickup_code,
  });
  await act(returned, driver, "dispute", { reason: "Cliente no responde" });
  await deny(async () =>
    act(returned, admin, "close_cancel", { reason: "Cerrar caso" }),
  );
  await deny(async () => act(returned, merchant, "return_received"));
  await act(returned, driver, "return_sent");
  await act(returned, merchant, "return_received");
  await act(returned, admin, "close_cancel", {
    reason: "Retorno confirmado sin pagos",
  });
  ok(
    Number((await wallet()).reserved) === 0,
    "Return requires both custody confirmations",
  );
  const timed = await create();
  await act(timed, merchant, "accept");
  await act(timed, driver, "claim");
  await db.query(
    "update app_orders set deadline_at=now()-interval '1 minute' where id=$1",
    [timed],
  );
  await db.query("select * from orders_tick()");
  ok(
    (await get(timed)).state === "disputed",
    "Preparation timeout opens incident",
  );
  await act(timed, admin, "reassign");
  ok(
    Number((await wallet()).reserved) === 0,
    "Reassignment releases old reservation",
  );
  await db.query(
    "update app_orders set deadline_at=now()-interval '1 minute' where id=$1",
    [timed],
  );
  await db.query("select * from orders_tick()");
  ok(
    (await get(timed)).state === "cancelled",
    "No driver closes without charging",
  );
  const insufficient = await create();
  await act(insufficient, merchant, "accept");
  await db.query("update driver_wallets set balance=0 where driver_id=$1", [
    drivers[0],
  ]);
  await deny(async () => act(insufficient, driver, "claim"));
  await act(insufficient, merchant, "reject").catch(() => {});
  await act(insufficient, client, "cancel", { reason: "Saldo insuficiente" });
  const key = "00000000-0000-4000-8000-000000000099";
  const original = await create("pickup", key);
  ok(
    (await create("pickup", key)) === original,
    "A lost response retry returns the same order",
  );
  ok(
    (await get(original)).terms_version === "2026-10-03-pago-al-recibir",
    "Order records accepted terms version",
  );
  await act(original, client, "cancel", { reason: "Prueba de reintento" });
  await db.query("update driver_wallets set balance=1 where driver_id=$1", [
    drivers[0],
  ]);
  const lost = await create();
  await act(lost, merchant, "accept");
  await act(lost, driver, "claim");
  await act(lost, merchant, "ready");
  await act(lost, driver, "picked_up", { code: (await get(lost)).pickup_code });
  await act(lost, client, "dispute", { reason: "No se recibió el paquete" });
  await deny(async () =>
    act(lost, driver, "record_loss", {
      reason: "Paquete perdido durante traslado",
    }),
  );
  await act(lost, admin, "record_loss", {
    reason: "Pérdida investigada y registrada sin pagos",
  });
  await act(lost, admin, "close_cancel", {
    reason: "Custodia resuelta por pérdida documentada",
  });
  ok(
    (await get(lost)).state === "cancelled" &&
      !(await get(lost)).returned_to_merchant,
    "Loss closure does not invent a physical return",
  );
  ok(
    Number((await wallet()).reserved) === 0,
    "Loss closure releases the reserved commission",
  );
  console.log(`Passed ${checks} receipt-payment checks`);
} finally {
  await db.close();
}
