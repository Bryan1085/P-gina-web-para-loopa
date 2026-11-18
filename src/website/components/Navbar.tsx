import React, { useState } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { SITE_LINKS } from '../../config/siteLinks';
import { HERO_MEDIA } from '../data/siteContent';

interface NavbarProps {
  onExternalAction: (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
    label: string,
    configKey: string,
  ) => void;
}

const NAV_ITEMS = [
  { href: '#caracteristicas', label: 'Características' },
  { href: '#demostracion', label: 'Demostración' },
  { href: '#galeria', label: 'Galería' },
  { href: '#comunidad', label: 'Comunidad' },
  { href: '#preguntas', label: 'Preguntas' },
] as const;

export const Navbar: React.FC<NavbarProps> = ({ onExternalAction }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#0b0c0e]/90 backdrop-blur-md">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark (single clean element) */}
        <a
          href="#inicio"
          className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ecd6e] rounded-md"
          aria-label="LOOPA inicio"
        >
          <img
            src={HERO_MEDIA.symbol}
            alt=""
            aria-hidden="true"
            className="w-7 h-7 object-contain shrink-0"
          />
          <span className="text-lg font-bold tracking-tight text-white">
            LOOPA
          </span>
        </a>

        {/* Zone 2: 5 concise single-line text links */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#b4b9c4]"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap shrink-0 py-1 hover:text-white transition-colors underline-offset-4 hover:underline decoration-[#5ecd6e]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ecd6e] rounded-sm"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary CTA + mobile drawer toggle */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href={SITE_LINKS.demoUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) =>
              onExternalAction(
                e,
                SITE_LINKS.demoUrl,
                'Probar LOOPA gratis',
                'demoUrl',
              )
            }
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#5ecd6e] hover:bg-[#7def8e] text-[#07140a] text-sm font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ecd6e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0c0e]"
          >
            <span>Probar LOOPA gratis</span>
            <ArrowUpRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </a>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-drawer"
            aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="md:hidden w-11 h-11 inline-flex items-center justify-center rounded-lg border border-white/10 text-[#e4e6eb] hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5ecd6e]"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation-drawer"
          aria-label="Navegación móvil"
          className="md:hidden border-t border-white/[0.08] bg-[#111317] px-4 py-4 flex flex-col gap-1"
        >
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-3 rounded-lg text-sm font-medium text-[#d1d5db] hover:text-white hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
};
