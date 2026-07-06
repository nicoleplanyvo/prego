import type { CSSProperties, ReactNode } from 'react';
import type { Branding } from './types';

export const DEFAULT_ACCENT = '#C9A96A';
export const DEFAULT_BG = '#0B0A08';

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1] as string, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function triplet(rgb: [number, number, number]): string {
  return rgb.join(' ');
}

/** Kanäle additiv verschieben (negativ = dunkler), fürs Ableiten von Flächen-/Hover-Tönen. */
function shift(rgb: [number, number, number], amount: number): [number, number, number] {
  return [
    Math.min(255, Math.max(0, rgb[0] + amount)),
    Math.min(255, Math.max(0, rgb[1] + amount)),
    Math.min(255, Math.max(0, rgb[2] + amount)),
  ];
}

/**
 * CSS-Variablen-Overrides für das Gastronomen-Branding.
 * Aus zwei Farben werden die abgeleiteten Töne berechnet:
 * Akzent → Hover-Variante, Hintergrund → Kartenfläche.
 */
export function brandingStyle(branding: Branding | null | undefined): CSSProperties {
  const style: Record<string, string> = {};
  const accent = branding?.accent ? hexToRgb(branding.accent) : null;
  if (accent) {
    style['--c-champagne'] = triplet(accent);
    style['--c-champagne-dark'] = triplet(shift(accent, -28));
  }
  const bg = branding?.bg ? hexToRgb(branding.bg) : null;
  if (bg) {
    style['--c-noir'] = triplet(bg);
    style['--c-carta'] = triplet(shift(bg, 11));
  }
  return style as CSSProperties;
}

/** Wrapper für Gast-Seiten: wendet die Branding-Farben lokal an (Admin/Board bleiben im prego-Look). */
export function BrandedShell(props: { branding: Branding | null | undefined; children: ReactNode }): JSX.Element {
  return (
    <div style={brandingStyle(props.branding)} className="min-h-screen bg-noir text-ivory">
      {props.children}
    </div>
  );
}

/** Logo-Block für Gast-Header und Statusseite. */
export function BrandLogo(props: { branding: Branding | null | undefined; barName: string; className?: string }): JSX.Element | null {
  if (!props.branding?.logoDataUrl) return null;
  return (
    <img
      src={props.branding.logoDataUrl}
      alt={`${props.barName} Logo`}
      className={`max-h-14 w-auto max-w-[180px] object-contain ${props.className ?? ''}`}
    />
  );
}
