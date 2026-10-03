import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}
const geoSource = ts.transpileModule(fs.readFileSync("lib/geo.ts", "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    esModuleInterop: true,
  },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(geoSource, {
  exports: module.exports,
  module,
  require: () => JSON.parse(fs.readFileSync("lib/laguna-urao.json", "utf8")),
});
const {
  DEFAULT_CONFIG: c,
  CENTER,
  covered,
  inside,
  isPoint,
  kmBetween,
  deliveryPrice,
  validConfig,
} = module.exports;
check(covered(CENTER, c.coverage), "Town center inside coverage");
check(
  covered({ lat: 8.5074744, lng: -71.4080858 }, c.coverage),
  "OSM El Molino landmark included",
);
check(
  !covered({ lat: 8.504, lng: -71.3995 }, c.coverage),
  "Lagoon is excluded",
);
check(
  !covered({ lat: 8.51, lng: -71.353 }, c.coverage),
  "San Juan is outside coverage",
);
check(
  !covered({ lat: 8.55, lng: -71.39 }, c.coverage),
  "Outside town is blocked",
);
check(
  !isPoint({ lat: NaN, lng: 1 }) && !isPoint({ lat: "8", lng: -71 }),
  "Reject invalid coordinates",
);
check(kmBetween(CENTER, CENTER) === 0, "Zero distance");
check(deliveryPrice(1.5, c) === 1, "Base includes 1.5 km");
check(deliveryPrice(1.51, c) === 1.25, "Round up to a quarter");
check(
  deliveryPrice(3.375, c) === 1.75,
  "Exact quarter without float over-rounding",
);
check(deliveryPrice(4.4, c) === 2.25, "Opposite ends cost more than $2");
check(deliveryPrice(100, c) === 4, "Cap applied");
check(!validConfig({ ...c, bcv: 0 }), "No orders without BCV");
check(
  validConfig({ ...c, bcv: 100, bcvDate: "2026-10-03" }),
  "Valid configurable rates",
);
check(
  !validConfig({ ...c, bcv: 100, bcvDate: "2026-02-30" }),
  "Reject impossible BCV date",
);
check(
  !validConfig({
    ...c,
    bcv: 100,
    bcvDate: "2026-10-03",
    coverage: [CENTER, CENTER, CENTER],
  }),
  "Reject degenerate contour",
);
const db = new PGlite();
try {
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  await db.exec(fs.readFileSync("tests/sql/00-simular-supabase.sql", "utf8"));
  // PGlite has built-in gen_random_uuid but no pgcrypto bundle. Production retains the extension.
  const schema = fs
    .readFileSync("schema.sql", "utf8")
    .replace('create extension if not exists "pgcrypto";', "");
  await db.exec(schema);
  await db.exec(fs.readFileSync("migrations/20261003_orders.sql", "utf8"));
  check(true, "Fresh schema and repeatable migration execute");
  const ids = Array.from(
    { length: 7 },
    (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`,
  );
  const [client, merchant, driver, other, admin, driver2] = ids;
  for (const id of ids)
    await db.query(
      "insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)",
      [id, id + "@example.com", {}],
    );
  await db.query("update profiles set role='admin' where user_id=$1", [admin]);
  await db.query("update profiles set role='merchant' where user_id=$1", [
    merchant,
  ]);
  for (const d of [driver, driver2])
    await db.query("update profiles set role='delivery' where user_id=$1", [d]);
  const {
    rows: [m],
  } = await db.query(
    "insert into merchants(user_id,name,slug,whatsapp_number,status) values($1,'Tienda','tienda','584141234567','approved') returning id",
    [merchant],
  );
  const drivers = [];
  for (const uid of [driver, driver2]) {
    const {
      rows: [d],
    } = await db.query(
      "insert into drivers(user_id,full_name,phone,vehicle,status) values($1,'Repartidor','584141234567','moto','approved') returning id",
      [uid],
    );
    drivers.push(d.id);
    await db.query(
      "insert into driver_positions(driver_id,point) values($1,$2)",
      [d.id, CENTER],
    );
    await db.query("update drivers set is_online=true where id=$1", [d.id]);
    await db.query(
      "insert into driver_wallets(driver_id,balance) values($1,10)",
      [d.id],
    );
    await db.query(
      "insert into order_accounts(user_id,account) values($1,$2)",
      [uid, { bank: "Banco", phone: "584141234567", document: "V12345678" }],
    );
  }
  await db.query("update app_settings set order_config=$1", [
    { ...c, bcv: 100, bcvDate: "2026-10-03" },
  ]);
  const newOrder = async (fulfillment = "delivery") => {
    const {
      rows: [o],
    } = await db.query(
      "insert into app_orders(customer_id,merchant_id,fulfillment,customer_name,customer_phone,address,origin,destination,items,subtotal,delivery_fee,distance_km,distance_method,rate,rate_date,commission_percent,deadline_at) values($1,$2,$3,'Cliente','584141234567','Calle centro',$4,$4,'[]',10,1.75,3,'estimate',100,'2026-10-03',10,now()+interval '10 minutes') returning *",
      [client, m.id, fulfillment, CENTER],
    );
    return o;
  };
  const act = async (id, who, action, data = {}) =>
    (
      await db.query("select * from order_action($1,$2,$3,$4)", [
        id,
        who,
        action,
        data,
      ])
    ).rows[0];
  const deny = async (fn, label) => {
    await assert.rejects(fn);
    checks++;
  };
  const receipt = (o, who, reference = "12345") => ({
    reference,
    bank: "Banco",
    amount: 1000,
    receipt: `${o.id}/${who}/proof.jpg`,
  });
  const o = await newOrder();
  await deny(
    () => act(o.id, driver, "claim"),
    "Driver cannot claim before products payment",
  );
  await deny(
    () => act(o.id, other, "accept"),
    "Unrelated merchant cannot accept",
  );
  check(
    (await act(o.id, merchant, "accept")).state === "products_payment",
    "Merchant accepts before payment",
  );
  await deny(
    () => act(o.id, client, "confirm"),
    "Customer cannot confirm own payment",
  );
  check(
    (await act(o.id, client, "receipt", receipt(o, client))).state ===
      "products_review",
    "Proof triggers review",
  );
  await deny(
    () => act(o.id, driver, "claim"),
    "Proof alone cannot dispatch driver",
  );
  check(
    (await act(o.id, merchant, "confirm")).state === "searching",
    "Bank confirmation triggers dispatch",
  );
  check(
    (await act(o.id, driver, "claim")).driver_id === drivers[0],
    "First driver wins",
  );
  await deny(
    () => act(o.id, driver2, "claim"),
    "Second driver cannot claim same order",
  );
  await deny(
    () => act(o.id, driver, "picked_up"),
    "No pickup before delivery payment",
  );
  await act(o.id, client, "receipt", receipt(o, client, "54321"));
  await deny(
    () => act(o.id, merchant, "confirm"),
    "Merchant cannot confirm driver payment",
  );
  check(
    (await act(o.id, driver, "confirm")).state === "preparing",
    "Driver confirms delivery money",
  );
  await deny(() => act(o.id, driver, "picked_up"), "Merchant must mark ready");
  await act(o.id, merchant, "ready");
  await act(o.id, driver, "picked_up");
  check(
    (await act(o.id, driver, "delivered", { code: "wrong" })).state ===
      "picked_up",
    "Wrong delivery code cannot complete order",
  );
  check(
    (await act(o.id, driver, "delivered", { code: o.delivery_code })).state ===
      "delivered",
    "Correct code completes order",
  );
  const {
    rows: [wallet],
  } = await db.query("select balance from driver_wallets where driver_id=$1", [
    drivers[0],
  ]);
  check(
    Number(wallet.balance) === 9.83,
    "Commission $0.17 matches PDF rounding",
  );
  await deny(
    () => act(o.id, driver, "delivered", { code: o.delivery_code }),
    "Double delivery cannot double debit",
  );
  check(
    (await db.query("select * from wallet_ledger where order_id=$1", [o.id]))
      .rows.length === 1,
    "One debit per delivery",
  );
  await act(o.id, client, "rating", { rating: 5 });
  await deny(
    () => act(o.id, other, "rating", { rating: 1 }),
    "Only client can rate",
  );
  const p = await newOrder("pickup");
  await act(p.id, merchant, "accept");
  await act(p.id, client, "receipt", receipt(p, client));
  await act(p.id, merchant, "confirm");
  check(
    (await act(p.id, merchant, "ready")).state === "pickup_ready",
    "Pickup skips driver/payment step",
  );
  check(
    (await act(p.id, merchant, "delivered", { code: p.delivery_code }))
      .state === "delivered",
    "Pickup delivery code works",
  );
  const duplicate = (
    await db.query("select duplicate from order_payments where order_id=$1", [
      p.id,
    ])
  ).rows[0];
  check(duplicate.duplicate, "Repeated reference flagged");
  const rejected = await newOrder();
  await act(rejected.id, merchant, "accept");
  await act(rejected.id, client, "receipt", receipt(rejected, client));
  await act(rejected.id, merchant, "not_received");
  await act(rejected.id, client, "receipt", receipt(rejected, client));
  check(
    (await act(rejected.id, merchant, "not_received")).state === "disputed",
    "Second rejection escalates",
  );
  const refund = await newOrder();
  await act(refund.id, merchant, "accept");
  await act(refund.id, client, "receipt", receipt(refund, client));
  await act(refund.id, merchant, "confirm");
  check(
    (await act(refund.id, merchant, "cancel", { reason: "No hay productos" }))
      .state === "disputed",
    "Cancellation after payment requires refund",
  );
  await act(refund.id, merchant, "receipt", receipt(refund, merchant, "99999"));
  check(
    (await act(refund.id, client, "confirm")).state === "cancelled",
    "Client confirms refund before closure",
  );
  const exp = await newOrder();
  await db.query(
    "update app_orders set deadline_at=now()-interval '1 minute' where id=$1",
    [exp.id],
  );
  await db.query("select * from orders_tick()");
  check(
    (await db.query("select state from app_orders where id=$1", [exp.id]))
      .rows[0].state === "cancelled",
    "Expired merchant acceptance auto-cancels",
  );
  const review = await newOrder();
  await act(review.id, merchant, "accept");
  await act(review.id, client, "receipt", receipt(review, client));
  await db.query(
    "update app_orders set deadline_at=now()-interval '1 minute' where id=$1",
    [review.id],
  );
  await db.query("select * from orders_tick()");
  const stalled = (
    await db.query("select * from app_orders where id=$1", [review.id])
  ).rows[0];
  check(
    stalled.state === "products_review" && stalled.stalled,
    "Payment timeout alerts but never auto-confirms",
  );
  const brute = await newOrder("pickup");
  await act(brute.id, merchant, "accept");
  await act(brute.id, client, "receipt", receipt(brute, client));
  await act(brute.id, merchant, "confirm");
  await act(brute.id, merchant, "ready");
  for (let i = 0; i < 5; i++)
    await act(brute.id, merchant, "delivered", { code: "bad" });
  check(
    (await db.query("select state from app_orders where id=$1", [brute.id]))
      .rows[0].state === "disputed",
    "Five wrong codes escalate",
  );
  const resolve = await newOrder();
  await act(resolve.id, merchant, "accept");
  await act(resolve.id, client, "receipt", receipt(resolve, client));
  await act(resolve.id, client, "dispute", { reason: "Necesito ayuda" });
  await deny(
    () => act(resolve.id, client, "resolve", { reason: "Revisado" }),
    "Only administration resolves disputes",
  );
  check(
    (
      await act(resolve.id, admin, "resolve", {
        reason: "Comprobante pendiente; consultar banco",
      })
    ).state === "products_review",
    "Resolve preserves pending bank review",
  );
  const both = await newOrder();
  await act(both.id, merchant, "accept");
  await act(both.id, client, "receipt", receipt(both, client));
  await act(both.id, merchant, "confirm");
  await act(both.id, driver2, "claim");
  await act(both.id, client, "receipt", receipt(both, client, "44444"));
  await act(both.id, driver2, "confirm");
  await act(both.id, merchant, "cancel", { reason: "No podemos entregar" });
  await act(both.id, merchant, "receipt", receipt(both, merchant, "77777"));
  await act(both.id, driver2, "receipt", receipt(both, driver2, "88888"));
  const refunds = (
    await db.query(
      "select * from order_payments where order_id=$1 and kind='refund'",
      [both.id],
    )
  ).rows;
  check(
    (
      await act(both.id, client, "confirm", {
        payment_id: refunds.find((p) => p.payer_id === merchant).id,
      })
    ).state === "disputed",
    "Products refund alone cannot close when delivery was paid",
  );
  check(
    (
      await act(both.id, client, "confirm", {
        payment_id: refunds.find((p) => p.payer_id === driver2).id,
      })
    ).state === "cancelled",
    "Both recipients refund before closure",
  );
  const release = await newOrder();
  await act(release.id, merchant, "accept");
  await act(release.id, client, "receipt", receipt(release, client));
  await act(release.id, merchant, "confirm");
  await act(release.id, driver2, "claim");
  await db.query(
    "update app_orders set deadline_at=now()-interval '1 minute' where id=$1",
    [release.id],
  );
  await db.query("select * from orders_tick()");
  const released = (
    await db.query("select * from app_orders where id=$1", [release.id])
  ).rows[0];
  check(
    released.state === "searching" && released.driver_id === null,
    "Unpaid delivery timeout releases driver",
  );
  await db.query(
    "update app_orders set deadline_at=now()-interval '1 minute' where id=$1",
    [release.id],
  );
  await db.query("select * from orders_tick()");
  check(
    (await db.query("select * from app_orders where id=$1", [release.id]))
      .rows[0].pickup_offered,
    "Search timeout offers pickup",
  );
  check(
    (await act(release.id, client, "pickup")).fulfillment === "pickup",
    "Customer can switch to pickup",
  );
  const {
    rows: [topup],
  } = await db.query(
    "insert into wallet_topups(driver_id,amount,reference,receipt) values($1,2,'22222','test.jpg') returning id",
    [drivers[0]],
  );
  await deny(
    () => db.query("select approve_topup($1,$2)", [topup.id, client]),
    "Only admin approves topups",
  );
  await db.query("select approve_topup($1,$2)", [topup.id, admin]);
  await deny(
    () => db.query("select approve_topup($1,$2)", [topup.id, admin]),
    "Topup cannot be credited twice",
  );
  await db.exec("set role authenticated;");
  await deny(
    () => db.query("select * from app_orders"),
    "Direct reads unavailable to unrelated authenticated users",
  );
  await deny(
    () => db.query("select * from order_payments"),
    "Private proofs inaccessible through direct REST tables",
  );
  await deny(
    () =>
      db.query("select order_action($1,$2,$3,$4)", [o.id, admin, "cancel", {}]),
    "Users cannot impersonate actor through RPC",
  );
  await db.exec("reset role;");
  const creationPayload = {merchant_id:m.id, customer_name:'Nuevo cliente', customer_phone:'584141234567', fulfillment:'delivery', address:'Calle centro', sector:'Centro', destination:CENTER, origin:CENTER, items:[], subtotal:10, delivery_fee:1.75, distance_km:3, distance_method:'estimate', rate:100, rate_date:'2026-10-03', commission_percent:10, deadline_at:new Date(Date.now()+600000).toISOString()};
  for(let i=0;i<3;i++) await db.query('select order_create($1,$2)',[ids[6],creationPayload]);
  await deny(()=>db.query('select order_create($1,$2)',[ids[6],creationPayload]),'Atomic creation caps concurrent active requests');
  await deny(()=>db.query('select order_create($1,$2)',[merchant,creationPayload]),'Only client profiles can create purchases');
  await db.query("update profiles set suspended=true where user_id=$1", [
    client,
  ]);
  await db.exec("set session authorization authenticated;");
  await db.query("select set_config('request.jwt.claims',$1,false)", [
    JSON.stringify({ sub: client, role: "authenticated" }),
  ]);
  await db.query("update profiles set suspended=false where user_id=$1", [
    client,
  ]);
  check(
    (
      await db.query("select suspended from profiles where user_id=$1", [
        client,
      ])
    ).rows[0].suspended,
    "Client cannot unsuspend self",
  );
  await db.exec("reset session authorization;");
  console.log(
    `${checks} checks passed: geography, flow, receipts, deadlines, delivery code, wallets and privacy.`,
  );
} finally {
  await db.close();
}
