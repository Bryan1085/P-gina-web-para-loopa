/**
 * Configuración centralizada de enlaces externos y recursos multimedia de la web oficial de LOOPA.
 *
 * Reemplaza los valores marcadores de posición cuando dispongas de las direcciones definitivas.
 * Todos los botones, enlaces de redes sociales, correo y reproductor de video de la web
 * leen directamente desde este archivo.
 */

export interface SiteLinksConfig {
  /** URL externa hacia la demo pública de LOOPA */
  demoUrl: string;
  /** URL externa del formulario de comentarios y sugerencias */
  feedbackUrl: string;
  /** URL de video de demostración (.mp4, .webm o enlace embebible de YouTube/Vimeo). Vacío = estado preparado para video. */
  demoVideoUrl: string;
  /** Correo de contacto oficial */
  contactEmail: string;
  /** Perfiles oficiales en redes sociales */
  social: {
    instagram: string;
    tiktok: string;
    youtube: string;
  };
}

export const SITE_LINKS: SiteLinksConfig = {
  demoUrl: '#configurar-url-demo',
  feedbackUrl: '#configurar-url-comentarios',
  demoVideoUrl: '',
  contactEmail: 'contacto@loopa-pendiente.example',
  social: {
    instagram: '#configurar-instagram',
    tiktok: '#configurar-tiktok',
    youtube: '#configurar-youtube',
  },
};

export function isPlaceholderLink(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return true;
  return (
    trimmed.startsWith('#configurar-') ||
    trimmed.includes('-pendiente.example') ||
    trimmed.includes('pendiente-loopa')
  );
}
