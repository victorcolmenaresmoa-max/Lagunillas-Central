import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import Landscape from './Landscape';
import { LogoMark } from './Logo';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

/** Página de texto legal (términos, privacidad) con índice y buena lectura en el teléfono */
export default function LegalPage({
  title,
  intro,
  updated,
  sections,
  other,
}: {
  title: string;
  intro: ReactNode;
  updated: string;
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-md pb-16">
      <header className="relative h-[170px] overflow-hidden bg-[#79a9c6]">
        <Landscape variant="laguna" priority position="center 40%" className="absolute inset-0" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#10263a]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent via-cal-100/60 to-cal-100" />
        <div className="pt-safe-top relative flex items-center justify-between px-5">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/30 text-white ring-1 ring-white/40 backdrop-blur-md" aria-label="Volver al inicio">
            <ArrowLeft size={20} />
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-2xl bg-white/25 py-1.5 pl-1.5 pr-3 ring-1 ring-white/40 backdrop-blur-md">
            <LogoMark className="h-7 w-7 rounded-lg" />
            <span className="text-sm font-bold text-white">Lagunillas Central</span>
          </Link>
        </div>
      </header>

      <div className="relative -mt-6 px-5">
        <h1 className="heading text-[30px] leading-[1.1]">{title}</h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-tinta-400">Vigente desde el {updated}</p>
        <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-tinta-600">{intro}</div>

        <nav aria-label="Contenido" className="card mt-6 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-tinta-500">Contenido</p>
          <ol className="space-y-1.5 text-sm">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2 font-semibold text-laguna-700 hover:underline">
                  <span className="w-5 shrink-0 text-right tabular-nums text-tinta-400">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 space-y-9">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-6">
              <h2 className="heading text-xl leading-snug">
                <span className="text-tinta-400">{i + 1}.</span> {s.title}
              </h2>
              <div className="legal-body mt-3 space-y-3 text-[15px] leading-relaxed text-tinta-600">{s.body}</div>
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-cal-300 pt-6">
          <Link href={other.href} className="btn-ghost w-full py-3">
            Ver {other.label}
          </Link>
          <Link href="/" className="text-center text-sm font-semibold text-tinta-500">
            Volver al inicio
          </Link>
        </div>
      </div>
    </main>
  );
}
