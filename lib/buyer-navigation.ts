/** Return paths allowed for the buyer flow; never a panel or external URL. */
export function buyerReturnPath(value: string | null | undefined): string {
  if (value && /^\/(?:comercio\/[^/?#]+|mi-cuenta|mis-pedidos)(?:[?#].*)?$/.test(value) && !/[\\\r\n]/.test(value)) return value;
  return '/mis-pedidos';
}
