'use client';

/** Alerta sonora hecha en el propio teléfono (no necesita archivos). */
let ctx: AudioContext | null = null;

/** Debe llamarse tras un toque del usuario (los navegadores lo exigen). */
export function unlockAudio() {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch {}
}

export function playChime(times = 2) {
  try {
    ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)();
    const notes = [880, 1174.7, 1568];
    for (let r = 0; r < times; r++) {
      notes.forEach((freq, i) => {
        const t = ctx!.currentTime + r * 0.75 + i * 0.13;
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.connect(gain).connect(ctx!.destination);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    }
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
  } catch {}
}
