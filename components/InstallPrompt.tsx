'use client';

import { useEffect, useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';
import { LogoMark } from './Logo';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const KEY = 'lc-install-dismissed-at';
const SNOOZE_DAYS = 7;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (standalone) return;

    try {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (last && Date.now() - last < SNOOZE_DAYS * 864e5) return;
    } catch {}

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    setIsIOS(ios);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);

    // En iPhone no existe el evento: mostramos el aviso con instrucciones.
    // En otros navegadores, lo mostramos igual tras unos segundos.
    const t = setTimeout(() => setShow(true), 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(KEY, String(Date.now()));
    } catch {}
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setShow(false);
      setDeferred(null);
    } else {
      setIosHelp(true);
    }
  };

  if (!show) return null;

  return (
    <div className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md px-3">
      <div className="glass animate-slide-up rounded-3xl p-2.5 pl-3 shadow-lift">
        <div className="flex items-center gap-3">
          <LogoMark className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-tinta-900">Instala la app</p>
            <p className="truncate text-xs text-tinta-500">Ábrela directo desde tu pantalla</p>
          </div>
          {!(iosHelp || (isIOS && !deferred)) && (
            <button onClick={install} className="btn-primary shrink-0 rounded-xl px-3.5 py-2 text-sm">
              <Download size={15} /> Instalar
            </button>
          )}
          <button onClick={dismiss} aria-label="Cerrar" className="shrink-0 rounded-full p-1.5 text-tinta-400 transition hover:bg-cal-200 hover:text-tinta-700">
            <X size={18} />
          </button>
        </div>

        {(iosHelp || (isIOS && !deferred)) && (
          <div className="mt-2.5 space-y-1.5 rounded-2xl bg-cal-100 p-3 text-xs text-tinta-700">
            <p className="flex items-center gap-2">
              1. Toca <Share size={14} className="text-cielo-500" /> <b>Compartir</b> en tu navegador
            </p>
            <p className="flex items-center gap-2">
              2. Elige <PlusSquare size={14} className="text-cielo-500" /> <b>Agregar a inicio</b>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
