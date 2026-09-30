import { cn } from '@/lib/utils';

/**
 * Fotos de Lagunillas (Laguna de Urao, cerros, arco de bienvenida) para
 * portadas y fondos. Están en public/paisajes en 3 tamaños WEBP y el
 * teléfono descarga solo el que necesita.
 *
 *  - "dia":      arco de bienvenida con la laguna a pleno día (inicio)
 *  - "laguna":   la laguna con el reflejo de los cerros (acceso, pedidos)
 *  - "ocaso":    atardecer dorado (ofertas, pie de página, pedido entregado)
 *  - "amanecer": salida del sol sobre el pueblo (portadas de comercios)
 */
export type Paisaje = 'dia' | 'laguna' | 'ocaso' | 'amanecer';

/** Color promedio de cada foto: se ve mientras la foto carga */
const COLOR: Record<Paisaje, string> = {
  dia: '#6f9fd0',
  laguna: '#79a9c6',
  ocaso: '#d98a3c',
  amanecer: '#c9a45a',
};

const COMERCIOS: Paisaje[] = ['dia', 'laguna', 'amanecer', 'ocaso'];

/** Elige siempre la misma foto para un mismo texto (p. ej. el nombre del comercio) */
export function paisajePara(texto: string): Paisaje {
  let h = 0;
  for (const ch of texto) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COMERCIOS[h % COMERCIOS.length];
}

export default function Landscape({
  variant = 'dia',
  className,
  position = 'center',
  priority = false,
  sizes = '(max-width: 448px) 100vw, 448px',
}: {
  variant?: Paisaje;
  className?: string;
  /** qué parte de la foto se ve cuando se recorta, p. ej. "center 40%" */
  position?: string;
  /** true para la foto de arriba de la pantalla: carga primero */
  priority?: boolean;
  sizes?: string;
}) {
  const src = (w: number) => `/paisajes/${variant}-${w}.webp`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src(960)}
      srcSet={`${src(640)} 640w, ${src(960)} 960w, ${src(1280)} 1280w`}
      sizes={sizes}
      alt=""
      aria-hidden
      draggable={false}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      {...({ fetchpriority: priority ? 'high' : 'auto' } as any)}
      className={cn('h-full w-full select-none object-cover', className)}
      style={{ objectPosition: position, backgroundColor: COLOR[variant] }}
    />
  );
}
