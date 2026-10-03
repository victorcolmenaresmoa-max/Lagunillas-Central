import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const module = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync("lib/maps-address.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  { exports: module.exports, URLSearchParams, URL },
);
const { googleMapsSearch, googleMapsDirections, localAddress } = module.exports;
const address = "Calle 2, casa #3 & frente a “La Plaza”";
for (const fn of [googleMapsSearch, googleMapsDirections]) {
  const u = new URL(fn(address, "Centro"));
  assert.equal(u.origin, "https://www.google.com");
  assert.equal(u.searchParams.get("api"), "1");
  assert.equal(
    u.searchParams.get(fn === googleMapsSearch ? "query" : "destination"),
    localAddress(address, "Centro"),
  );
  assert.equal(u.searchParams.has("key"), false);
}
for (const path of [
  "components/OrdersBoard.tsx",
  "components/OrderProfile.tsx",
  "components/CoverageClient.tsx",
  "app/repartidor/page.tsx",
]) {
  const source = fs.readFileSync(path, "utf8");
  assert.doesNotMatch(source, /DeliveryMap|PointPicker|navigator\.geolocation/);
}
assert.doesNotMatch(
  fs.readFileSync("app/api/orders/route.ts", "utf8"),
  /roadDistance|deliveryPrice/,
);
console.log("Passed external Google Maps encoding and no-embedded-map checks");
