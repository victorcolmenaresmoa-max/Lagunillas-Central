'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Paisaje ilustrado de Lagunillas: cerros verdes que se reflejan en la laguna.
 *  - "dia":   cielo azul, nubes sobre la cumbre, agua jade.
 *  - "ocaso": sol dorado bajando tras las montañas y su reflejo en el agua.
 * Es un dibujo vectorial (no una foto) para que cargue instantáneo y se vea nítido.
 */
export default function Landscape({
  variant = 'dia',
  className,
  tint,
}: {
  variant?: 'dia' | 'ocaso';
  className?: string;
  /** color opcional para teñir el cielo (portadas de comercios) */
  tint?: string;
}) {
  const id = useId().replace(/:/g, '');
  const ocaso = variant === 'ocaso';

  const sky = ocaso ? ['#f9d27a', '#f09a4a', '#c45a30'] : [tint ?? '#5b9fd8', '#9cc6ea', '#dcebf7'];
  const farHill = ocaso ? '#a1503a' : '#9fb8a9';
  const hill = ocaso ? ['#7a3a28', '#5c2a1f'] : ['#7fa152', '#4f7a3c'];
  const trees = ocaso ? '#3f1d16' : '#35613a';
  const water = ocaso ? ['#c86a35', '#7a3420'] : ['#4f9c80', '#23705a'];

  return (
    <svg viewBox="0 0 400 240" preserveAspectRatio="xMidYMax slice" className={cn('h-full w-full', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[0]} />
          <stop offset="0.6" stopColor={sky[1]} />
          <stop offset="1" stopColor={sky[2]} />
        </linearGradient>
        <linearGradient id={`${id}hill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hill[0]} />
          <stop offset="1" stopColor={hill[1]} />
        </linearGradient>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={water[0]} />
          <stop offset="1" stopColor={water[1]} />
        </linearGradient>
        <linearGradient id={`${id}sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6d6" />
          <stop offset="1" stopColor="#ffd36b" />
        </linearGradient>
        <filter id={`${id}blur`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <clipPath id={`${id}clipWater`}>
          <rect x="0" y="168" width="400" height="72" />
        </clipPath>
      </defs>

      {/* Cielo */}
      <rect width="400" height="240" fill={`url(#${id}sky)`} />

      {/* Sol */}
      {ocaso ? (
        <g className="origin-[292px_120px] animate-glow">
          <circle cx="292" cy="122" r="46" fill="#ffe29a" opacity="0.35" filter={`url(#${id}blur)`} />
          <circle cx="292" cy="122" r="20" fill={`url(#${id}sun)`} />
        </g>
      ) : (
        <g><circle cx="318" cy="44" r="30" fill="#fff8e1" opacity="0.35" filter={`url(#${id}blur)`} /><circle cx="318" cy="44" r="13" fill="#fff6d6" /></g>
      )}

      {/* Nubes que se deslizan (dos copias para que el movimiento sea continuo) */}
      {!ocaso && (
        <g className="animate-drift" opacity="0.95">
          {[0, 400].map((dx) => (
            <g key={dx} transform={`translate(${dx} 0)`} filter={`url(#${id}blur)`} fill="#ffffff">
              <ellipse cx="250" cy="92" rx="70" ry="18" opacity="0.9" />
              <ellipse cx="300" cy="80" rx="48" ry="20" opacity="0.85" />
              <ellipse cx="120" cy="70" rx="40" ry="10" opacity="0.6" />
              <ellipse cx="360" cy="100" rx="55" ry="14" opacity="0.8" />
            </g>
          ))}
        </g>
      )}

      {/* Cerros lejanos */}
      <path d="M0 150 L40 128 L78 140 L120 112 L160 132 L200 118 L236 136 L270 120 L300 134 L340 110 L400 138 L400 172 L0 172 Z" fill={farHill} opacity="0.75" />

      {/* Cerro principal */}
      <path
        d="M0 172 L0 150 C30 142 52 130 80 124 C104 118 118 104 142 92 C158 84 168 88 182 98 C196 108 206 112 222 104 C236 97 246 86 262 84 C282 82 292 96 312 108 C332 120 356 132 400 140 L400 172 Z"
        fill={`url(#${id}hill)`}
      />
      {/* Pliegues del cerro */}
      <path d="M142 92 C150 118 146 140 132 170 M222 104 C228 128 238 148 250 170 M262 84 C258 110 270 136 286 170" stroke={ocaso ? '#4a2319' : '#3f6a33'} strokeWidth="1" fill="none" opacity="0.18" />

      {/* Arboleda en la orilla */}
      <path
        d="M0 172 C6 162 12 164 16 168 C20 160 28 160 32 166 C38 158 46 160 50 167 C56 161 62 162 66 168 C72 159 82 160 86 167 C92 162 100 163 104 168 C110 160 120 161 124 167 C132 162 140 164 144 169 C150 163 158 163 162 168 C170 160 178 162 182 167 C190 162 198 164 202 169 C208 161 218 162 222 168 C230 163 238 164 242 169 C248 162 258 162 262 168 C270 160 280 161 284 167 C292 162 300 164 304 169 C312 161 322 162 326 168 C332 163 340 164 344 169 C352 162 360 162 364 168 C372 160 384 162 388 168 C394 164 398 165 400 168 L400 174 L0 174 Z"
        fill={trees}
      />

      {/* Laguna */}
      <rect x="0" y="172" width="400" height="68" fill={`url(#${id}water)`} />

      {/* Reflejo del cerro en el agua */}
      <g clipPath={`url(#${id}clipWater)`} opacity={ocaso ? 0.25 : 0.35}>
        <path
          transform="translate(0 344) scale(1 -1)"
          d="M0 172 L0 150 C30 142 52 130 80 124 C104 118 118 104 142 92 C158 84 168 88 182 98 C196 108 206 112 222 104 C236 97 246 86 262 84 C282 82 292 96 312 108 C332 120 356 132 400 140 L400 172 Z"
          fill={hill[1]}
        />
      </g>

      {/* Destellos del agua */}
      <g stroke="#ffffff" strokeLinecap="round" className="animate-shimmer">
        <path d="M40 188 H78 M120 198 H146 M210 186 H250 M300 204 H336 M60 214 H84 M180 222 H214" strokeWidth="1.4" opacity="0.6" />
      </g>

      {/* Reflejo del sol */}
      {ocaso && (
        <g className="animate-shimmer">
          <path d="M276 180 H308 M270 190 H314 M280 200 H304 M274 210 H310 M284 220 H300 M280 230 H304" stroke="#ffe29a" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
