import React from 'react';
import { Maximize2 } from 'lucide-react';
import { GALLERY_ITEMS } from '../data/siteContent';

interface GallerySectionProps {
  onInspectImage: (image: string, title: string, alt: string) => void;
}

export const GallerySection: React.FC<GallerySectionProps> = ({
  onInspectImage,
}) => {
  return (
    <section
      id="galeria"
      className="border-b border-white/[0.08] bg-[#101215] py-16 sm:py-24"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs sm:text-sm font-medium text-[#6fe681] tracking-wide">
            Galería de modelos y escenas
          </p>
          <h2 className="mt-2.5 text-2xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
            Creaciones reales dentro de LOOPA.
          </h2>
          <p className="mt-4 text-base text-[#a1a7b3] leading-relaxed">
            Capturas auténticas de modelos y escenas construidas en la
            aplicación. Haz clic en cualquier imagen para inspeccionar la
            geometría y el entorno en detalle.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {GALLERY_ITEMS.map((item) => (
            <figure
              key={item.id}
              className={`group rounded-2xl border border-white/[0.08] bg-[#16181d] overflow-hidden flex flex-col transition-colors hover:border-white/20 ${
                item.featured ? 'md:col-span-2' : ''
              }`}
            >
              <button
                type="button"
                onClick={() =>
                  onInspectImage(item.image, item.title, item.imageAlt)
                }
                className="relative w-full text-left overflow-hidden bg-[#111317] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5ecd6e]"
                aria-label={`Inspeccionar ${item.title}`}
              >
                <div
                  className={`relative w-full overflow-hidden ${
                    item.featured ? 'aspect-[16/10] sm:aspect-[16/9]' : 'aspect-[4/3]'
                  }`}
                >
                  <img
                    src={item.image}
                    alt={item.imageAlt}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                  <span className="absolute bottom-3 right-3 w-10 h-10 rounded-lg bg-[#0b0c0e]/85 border border-white/15 flex items-center justify-center text-white group-hover:text-[#6fe681] transition-colors">
                    <Maximize2 className="w-4 h-4" aria-hidden="true" />
                  </span>
                </div>
              </button>

              <figcaption className="p-6 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <p className="text-xs text-[#9ca3af]">{item.context}</p>
                  <h3 className="mt-1.5 text-lg sm:text-xl font-semibold text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#a9b0bc] leading-relaxed">
                    {item.caption}
                  </p>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};
