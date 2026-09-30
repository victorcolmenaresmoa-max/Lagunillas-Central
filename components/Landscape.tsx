'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

/**
 * Paisaje de Lagunillas (Mérida), dibujado a mano en vectores:
 *  - la Laguna de Urao en calma, con el reflejo de los cerros,
 *  - la cordillera al fondo, más clara mientras más lejos (como con la bruma andina),
 *  - la iglesia blanca de techo de teja sobre una loma,
 *  - cardones del valle seco en la orilla.
 * Variantes: "dia" (cielo azul) y "ocaso" (atardecer dorado).
 * Es vectorial (no una foto): carga al instante y se ve nítido en cualquier teléfono.
 */

const PALETTES = {
  dia: {
    sky: ['#6aa6da', '#a8cdea', '#f4e6d2'],
    sunCore: '#fff7de',
    sunGlow: '#fff3c9',
    far: ['#b9cbe0', '#d6e1ea'],
    mid: ['#8fae9f', '#a9bfb1'],
    near: ['#9aa866', '#7a8c4f'],
    nearRight: ['#8c9c5b', '#6c7f45'],
    shore: '#5d7442',
    cactus: '#4d6a3c',
    church: '#fcf8f0',
    churchShade: '#e6ddcd',
    roof: '#c4553b',
    door: '#7a4a33',
    water: ['#a7d0d8', '#5ea596', '#2f7d6e'],
    reflect: '#4f8f7c',
    sparkle: '#ffffff',
    bird: '#3d5a66',
  },
  ocaso: {
    sky: ['#e2824c', '#f2b271', '#fde0a4'],
    sunCore: '#fff1c4',
    sunGlow: '#ffd98a',
    far: ['#cf8e7c', '#e4ae8f'],
    mid: ['#a9675a', '#bd7d68'],
    near: ['#7f4a39', '#62362b'],
    nearRight: ['#744234', '#562f25'],
    shore: '#4a2a22',
    cactus: '#43241b',
    church: '#f8e8d2',
    churchShade: '#e9ccaa',
    roof: '#b4452e',
    door: '#5a2f22',
    water: ['#f3c486', '#c7764f', '#7c3b2d'],
    reflect: '#7a3d2f',
    sparkle: '#ffe9b8',
    bird: '#5a2f24',
  },
} as const;

// Siluetas (se reutilizan para dibujar el reflejo en la laguna)
const FAR =
  'M0 150 C20 140 34 128 52 124 C66 121 76 110 90 103 C100 98 106 93 115 95 C127 98 135 112 151 116 C165 119 174 107 188 99 C198 93 205 85 215 87 C227 89 237 104 253 110 C269 116 281 101 295 95 C307 90 315 83 327 87 C341 92 351 108 367 114 C381 119 393 117 400 115 L400 178 L0 178 Z';
const MID =
  'M0 160 C24 154 42 145 66 141 C88 137 101 129 123 127 C145 125 157 135 177 139 C197 143 213 133 233 129 C255 125 269 135 291 139 C313 143 333 133 357 131 C375 129 389 135 400 138 L400 178 L0 178 Z';
const NEAR_LEFT = 'M0 131 C20 129 44 132 68 138 C96 146 122 158 148 169 C158 173 166 176 174 177 L0 177 Z';
const NEAR_RIGHT = 'M226 177 C252 171 278 161 304 153 C328 146 356 142 378 142 C389 142 396 143 400 144 L400 177 Z';

function Cardon({ x, y, s = 1, color }: { x: number; y: number; s?: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={color} strokeLinecap="round" strokeLinejoin="round" fill="none">
      <path d="M0 0 V-22" strokeWidth="4.2" />
      <path d="M0 -9 H-4.5 Q-6 -9 -6 -11 V-17" strokeWidth="3" />
      <path d="M0 -6 H4 Q5.5 -6 5.5 -8 V-14" strokeWidth="3" />
    </g>
  );
}

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
  const c = PALETTES[variant];
  const skyTop = !ocaso && tint ? tint : c.sky[0];
  const u = (name: string) => `url(#${id}${name})`;

  return (
    <svg viewBox="0 -300 400 540" preserveAspectRatio="xMidYMax slice" className={cn('h-full w-full', className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}sky`} gradientUnits="userSpaceOnUse" x1="0" y1="-300" x2="0" y2="177">
          <stop offset="0" stopColor={skyTop} />
          <stop offset="0.5" stopColor={skyTop} />
          <stop offset="0.82" stopColor={c.sky[1]} />
          <stop offset="1" stopColor={c.sky[2]} />
        </linearGradient>
        <linearGradient id={`${id}far`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.far[0]} />
          <stop offset="0.7" stopColor={c.far[1]} />
        </linearGradient>
        <linearGradient id={`${id}mid`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.mid[0]} />
          <stop offset="1" stopColor={c.mid[1]} />
        </linearGradient>
        <linearGradient id={`${id}near`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.near[0]} />
          <stop offset="1" stopColor={c.near[1]} />
        </linearGradient>
        <linearGradient id={`${id}nearR`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.nearRight[0]} />
          <stop offset="1" stopColor={c.nearRight[1]} />
        </linearGradient>
        <linearGradient id={`${id}water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c.water[0]} />
          <stop offset="0.45" stopColor={c.water[1]} />
          <stop offset="1" stopColor={c.water[2]} />
        </linearGradient>
        <radialGradient id={`${id}sun`}>
          <stop offset="0" stopColor={c.sunGlow} stopOpacity="0.9" />
          <stop offset="1" stopColor={c.sunGlow} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}soft`} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id={`${id}haze`} x="-10%" y="-50%" width="120%" height="200%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <clipPath id={`${id}clipWater`}>
          <rect x="0" y="177" width="400" height="63" />
        </clipPath>
      </defs>

      {/* Cielo */}
      <rect y="-300" width="400" height="540" fill={u('sky')} />

      {/* Sol */}
      {ocaso ? (
        <g className="origin-[300px_146px] animate-glow">
          <circle cx="300" cy="146" r="70" fill={u('sun')} />
          <circle cx="300" cy="146" r="17" fill={c.sunCore} />
        </g>
      ) : (
        <g>
          <circle cx="318" cy="50" r="46" fill={u('sun')} opacity="0.7" />
          <circle cx="318" cy="50" r="11" fill={c.sunCore} />
        </g>
      )}

      {/* Nubes finas que se deslizan (dos copias para que el movimiento sea continuo) */}
      <g className="animate-drift" filter={u('soft')} opacity={ocaso ? 0.35 : 0.55}>
        {[0, 400].map((dx) => (
          <g key={dx} transform={`translate(${dx} 0)`} fill="#ffffff">
            <rect x="40" y="58" width="96" height="6" rx="3" />
            <rect x="70" y="66" width="60" height="4" rx="2" opacity="0.7" />
            <rect x="210" y="80" width="120" height="7" rx="3.5" />
            <rect x="250" y="89" width="70" height="4" rx="2" opacity="0.7" />
          </g>
        ))}
      </g>

      {/* Pájaros */}
      <g stroke={c.bird} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.55">
        <path d="M246 24 q3 -3 6 0 q3 -3 6 0" />
        <path d="M264 16 q2.2 -2.2 4.4 0 q2.2 -2.2 4.4 0" />
      </g>

      {/* Cordillera lejana */}
      <path d={FAR} fill={u('far')} filter={u('haze')} />

      {/* Cerros intermedios */}
      <path d={MID} fill={u('mid')} />

      {/* Loma izquierda con cardones del valle seco */}
      <path d={NEAR_LEFT} fill={u('near')} />
      <Cardon x={104} y={154} s={0.8} color={c.cactus} />
      <Cardon x={126} y={162} s={0.55} color={c.cactus} />
      <Cardon x={84} y={147} s={0.45} color={c.cactus} />
      <g fill={c.cactus} opacity="0.55">
        <ellipse cx="116" cy="158" rx="6" ry="2.4" />
        <ellipse cx="60" cy="141" rx="6" ry="2.2" />
        <ellipse cx="146" cy="168" rx="5" ry="1.8" />
      </g>

      {/* Loma derecha con la iglesia del pueblo */}
      <path d={NEAR_RIGHT} fill={u('nearR')} />
      <g transform="translate(348 148) scale(0.74) translate(0 -136)">
        {/* torre */}
        <rect x="0" y="111" width="9" height="25" fill={c.church} />
        <path d="M-0.8 111.4 Q4.5 101.5 9.8 111.4 Z" fill={c.roof} />
        <path d="M4.5 97.5 V102.5 M2.8 99.4 H6.2" stroke={c.roof} strokeWidth="1.2" strokeLinecap="round" />
        <rect x="2.6" y="115" width="3.8" height="5.2" rx="1.9" fill={c.door} opacity="0.85" />
        {/* nave */}
        <path d="M9 124 L20 116 L31 124 Z" fill={c.church} />
        <rect x="9" y="124" width="22" height="12" fill={c.church} />
        <path d="M20 116 L40 118 L43 124 L31 124 Z" fill={c.roof} />
        <rect x="31" y="124" width="12" height="12" fill={c.churchShade} />
        <path d="M17 136 V130.5 A3 3 0 0 1 23 130.5 V136 Z" fill={c.door} />
        <circle cx="20" cy="121.5" r="1.4" fill={c.door} opacity="0.7" />
      </g>
      <ellipse cx="364" cy="148.5" rx="26" ry="2.6" fill={c.nearRight[0]} />
      <g fill={c.cactus} opacity="0.55">
        <ellipse cx="300" cy="156" rx="7" ry="2.6" />
        <ellipse cx="334" cy="150" rx="5" ry="2" />
        <ellipse cx="270" cy="166" rx="5" ry="2" />
      </g>
      <Cardon x={318} y={152} s={0.6} color={c.cactus} />

      {/* Orilla */}
      <path d="M0 175 C70 172.5 130 174.5 200 173.5 C270 172.5 330 174.5 400 172.5 L400 178 L0 178 Z" fill={c.shore} />

      {/* Laguna */}
      <rect x="0" y="177" width="400" height="63" fill={u('water')} />

      {/* Reflejo de los cerros */}
      <g clipPath={u('clipWater')}>
        <g transform="translate(0 354) scale(1 -1)" filter={u('haze')}>
          <path d={FAR} fill={c.far[0]} opacity="0.35" />
          <path d={MID} fill={c.reflect} opacity="0.35" />
          <path d={NEAR_LEFT} fill={c.reflect} opacity="0.4" />
          <path d={NEAR_RIGHT} fill={c.reflect} opacity="0.4" />
        </g>
      </g>

      {/* Reflejo del sol en el agua */}
      {ocaso && (
        <g className="animate-shimmer" stroke={c.sunCore} strokeLinecap="round">
          <path d="M284 184 H316 M278 193 H322 M288 202 H312 M282 212 H318 M292 222 H308" strokeWidth="2.4" />
        </g>
      )}

      {/* Destellos suaves del agua */}
      <g stroke={c.sparkle} strokeLinecap="round" className="animate-shimmer" opacity="0.55">
        <path d="M34 190 H70 M126 199 H150 M200 186 H236 M58 214 H80 M170 224 H198 M340 206 H368" strokeWidth="1.2" />
      </g>
    </svg>
  );
}
