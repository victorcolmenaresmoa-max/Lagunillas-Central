import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, context = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports: module.exports, module, URLSearchParams, ...context });
  return module.exports;
}
const { tomtomTileUrl } = load('lib/tomtom-maps.ts');
assert.throws(() => tomtomTileUrl('   '), /GPS/);
const url = new URL(tomtomTileUrl(' key&injected=true '));
assert.equal(url.origin, 'https://api.tomtom.com');
assert.equal(url.searchParams.get('key'), 'key&injected=true');
assert.equal(url.searchParams.has('injected'), false, 'API key cannot inject query parameters');
assert.equal(url.searchParams.get('apiVersion'), '2');
assert.ok(url.pathname.startsWith('/maps/orbis/display/raster/tile/'));
let requested = 0;
function locator(handler, secure = true, supported = true) {
  return load('lib/device-location.ts', { window: { isSecureContext: secure }, navigator: { geolocation: supported ? { getCurrentPosition: (ok, fail, options) => { requested++; assert.equal(options.enableHighAccuracy, true); assert.equal(options.maximumAge, 0); assert.equal(options.timeout, 20000); handler(ok, fail); } } : undefined } }).deviceLocation;
}
await assert.rejects(locator(() => assert.fail('Must not request on HTTP'), false)(), /HTTPS/);
await assert.rejects(locator(() => assert.fail('Unavailable GPS'), true, false)(), /dispositivo/);
assert.equal(requested, 0);
const position = await locator(ok => ok({ coords: { latitude: 8.4978615, longitude: -71.3896149, accuracy: 12 } }))();
assert.equal(position.point.lat, 8.4978615); assert.equal(position.point.lng, -71.3896149); assert.equal(position.accuracy, 12);
for (const [code, text] of [[1, /Permite/], [2, /señal/], [3, /demasiado/]]) await assert.rejects(locator((ok, fail) => fail({ code }))(), text);
for (const coords of [{ latitude: NaN, longitude: 0, accuracy: 2 }, { latitude: 8, longitude: 190, accuracy: 2 }, { latitude: 8, longitude: -71, accuracy: -1 }]) await assert.rejects(locator(ok => ok({ coords }))(), /inválida/);
console.log('TomTom y GPS: configuración, clave codificada, HTTPS, permiso, plazo, precisión y coordenadas inválidas aprobados.');
