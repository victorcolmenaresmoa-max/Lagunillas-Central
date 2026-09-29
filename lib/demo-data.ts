/**
 * Datos de demostración.
 * Se usan automáticamente mientras Supabase no esté configurado,
 * para que la app se vea completa desde el primer día.
 */
import type { FlashDealFull, Merchant, Product } from './types';

const created = '2026-09-01T12:00:00Z';

function m(p: Partial<Merchant> & Pick<Merchant, 'id' | 'name' | 'slug' | 'category'>): Merchant {
  return {
    user_id: null,
    whatsapp_number: '584141234567',
    description: null,
    address: null,
    opens_at: '08:00:00',
    closes_at: '20:00:00',
    is_active: true,
    is_featured: false,
    logo_url: null,
    cover_url: null,
    created_at: created,
    ...p,
  };
}

export const DEMO_MERCHANTS: Merchant[] = [
  m({
    id: 'm1',
    name: 'Arepera El Páramo',
    slug: 'arepera-el-paramo',
    category: 'Comida',
    description: 'Arepas andinas de trigo y maíz, pisca y chocolate caliente. Recetas de la abuela desde 1998.',
    address: 'Calle Bolívar, San Juan de Lagunillas',
    opens_at: '06:30:00',
    closes_at: '22:00:00',
    is_featured: true,
  }),
  m({
    id: 'm2',
    name: 'Burger Laguna',
    slug: 'burger-laguna',
    category: 'Comida',
    description: 'Hamburguesas artesanales a la parrilla, papas rústicas y malteadas.',
    address: 'Av. Principal, frente a la plaza',
    opens_at: '12:00:00',
    closes_at: '23:59:00',
    is_featured: true,
  }),
  m({
    id: 'm3',
    name: 'Bodegón La Trinidad',
    slug: 'bodegon-la-trinidad',
    category: 'Bodegones',
    description: 'Víveres, charcutería, bebidas y productos importados. Delivery en todo el municipio.',
    address: 'Sector La Trinidad, local 4',
    opens_at: '07:00:00',
    closes_at: '21:00:00',
  }),
  m({
    id: 'm4',
    name: 'Farmacia Urao',
    slug: 'farmacia-urao',
    category: 'Farmacias',
    description: 'Medicamentos, cuidado personal y atención farmacéutica. Guardia los fines de semana.',
    address: 'Calle Sucre, cerca de la Laguna de Urao',
    opens_at: '00:00:00',
    closes_at: '23:59:00',
    is_featured: true,
  }),
  m({
    id: 'm5',
    name: 'Repuestos Los Andes',
    slug: 'repuestos-los-andes',
    category: 'Repuestos',
    description: 'Repuestos para carros y motos, lubricantes y baterías.',
    address: 'Carretera Panamericana, km 2',
    opens_at: '08:00:00',
    closes_at: '17:00:00',
  }),
  m({
    id: 'm6',
    name: 'Barbería Tío Rafa',
    slug: 'barberia-tio-rafa',
    category: 'Barberías',
    description: 'Cortes clásicos y modernos, perfilado de barba y tratamientos. Con cita o por orden de llegada.',
    address: 'Centro Comercial Lagunillas, PB',
    opens_at: '09:00:00',
    closes_at: '19:00:00',
  }),
  m({
    id: 'm7',
    name: 'Técnico Express',
    slug: 'tecnico-express',
    category: 'Servicios',
    description: 'Reparación de teléfonos, neveras y lavadoras. Servicio a domicilio.',
    address: 'San Juan de Lagunillas',
    opens_at: '08:00:00',
    closes_at: '18:00:00',
  }),
  m({
    id: 'm8',
    name: 'Dulcería Doña Carmen',
    slug: 'dulceria-dona-carmen',
    category: 'Comida',
    description: 'Dulces abrillantados, alfondoque, conservas y tortas por encargo.',
    address: 'Calle Miranda, casa 12',
    opens_at: '08:00:00',
    closes_at: '18:00:00',
  }),
];

let pid = 0;
function p(merchant_id: string, title: string, price: number, description?: string, is_available = true): Product {
  pid += 1;
  return {
    id: `p${pid}`,
    merchant_id,
    title,
    description: description ?? null,
    price,
    image_url: null,
    is_available,
    created_at: created,
  };
}

export const DEMO_PRODUCTS: Product[] = [
  p('m1', 'Arepa de trigo rellena', 3.5, 'Queso ahumado, jamón y aguacate'),
  p('m1', 'Pisca andina', 4, 'Caldo de papa, huevo, cilantro y queso'),
  p('m1', 'Arepa reina pepiada', 4.5, 'Pollo desmechado con aguacate'),
  p('m1', 'Chocolate caliente', 1.5, 'Con queso ahumado'),
  p('m1', 'Jugo natural', 1.75, 'Mora, fresa o guanábana', false),
  p('m2', 'Hamburguesa Clásica', 5, 'Carne 150 g, queso, tomate, lechuga'),
  p('m2', 'Doble Laguna', 8.5, 'Doble carne, tocineta, cebolla caramelizada'),
  p('m2', 'Papas rústicas', 2.5, 'Con salsa de ajo de la casa'),
  p('m2', 'Malteada de fresa', 3),
  p('m3', 'Harina PAN 1 kg', 1.2),
  p('m3', 'Queso andino 1 kg', 6.5, 'Fresco del páramo'),
  p('m3', 'Café molido 500 g', 4.8),
  p('m3', 'Cartón de huevos', 4.5, '30 unidades'),
  p('m4', 'Acetaminofén 500 mg', 1.8, 'Caja de 10 tabletas'),
  p('m4', 'Vitamina C 1 g', 5.5, '30 tabletas efervescentes'),
  p('m4', 'Protector solar FPS 50', 9.9),
  p('m5', 'Aceite 20W-50 (1 L)', 6),
  p('m5', 'Bujía NGK', 3.5),
  p('m5', 'Pastillas de freno', 18),
  p('m6', 'Corte clásico', 5),
  p('m6', 'Corte + barba', 8),
  p('m6', 'Perfilado de cejas', 2),
  p('m7', 'Cambio de pantalla (diagnóstico)', 10),
  p('m7', 'Mantenimiento de nevera', 25),
  p('m8', 'Dulces abrillantados (docena)', 6),
  p('m8', 'Alfondoque', 1.5),
  p('m8', 'Torta de zanahoria', 15, 'Por encargo, 24 h de anticipación'),
];

/** Genera ofertas relativas al momento actual para que el contador siempre corra */
export function demoFlashDeals(): FlashDealFull[] {
  const now = Date.now();
  const mk = (id: string, merchantId: string, productTitle: string, discount: number, minutes: number): FlashDealFull => {
    const merchant = DEMO_MERCHANTS.find((x) => x.id === merchantId)!;
    const product = DEMO_PRODUCTS.find((x) => x.merchant_id === merchantId && x.title === productTitle)!;
    return {
      id,
      merchant_id: merchant.id,
      product_id: product.id,
      discount_price: discount,
      expires_at: new Date(now + minutes * 60_000).toISOString(),
      is_active: true,
      created_at: created,
      product: { id: product.id, title: product.title, price: product.price, image_url: null },
      merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug, category: merchant.category },
    };
  };
  return [
    mk('f1', 'm2', 'Doble Laguna', 5.99, 97),
    mk('f2', 'm1', 'Pisca andina', 2.5, 42),
    mk('f3', 'm4', 'Protector solar FPS 50', 6.9, 240),
  ];
}
