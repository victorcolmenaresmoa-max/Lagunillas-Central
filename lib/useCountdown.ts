'use client';

import { useEffect, useState } from 'react';

export function useCountdown(target: string) {
  const [left, setLeft] = useState(() => Math.max(0, new Date(target).getTime() - Date.now()));

  useEffect(() => {
    const tick = () => setLeft(Math.max(0, new Date(target).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);

  const s = Math.floor(left / 1000);
  return {
    expired: left <= 0,
    hours: Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    /** menos de 1 hora → urgencia máxima */
    urgent: left > 0 && left < 60 * 60 * 1000,
  };
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
