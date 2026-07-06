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

/** prego-Logo „Wasserring": Wortmarke im unterbrochenen Glasabdruck-Ring. */
export function PregoLogo(props: { width?: number; className?: string }): JSX.Element {
  const width = props.width ?? 460;
  return (
    <svg
      width={width}
      height={(width / 720) * 440}
      viewBox="0 0 720 440"
      className={props.className}
      role="img"
      aria-label="prego."
    >
      <defs>
        <linearGradient id="prego-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#DFC08A" />
          <stop offset=".55" stopColor="#C9A96A" />
          <stop offset="1" stopColor="#9C7B42" />
        </linearGradient>
      </defs>
      <g fill="none" strokeLinecap="round">
        <circle
          cx="360"
          cy="220"
          r="150"
          stroke="url(#prego-gold)"
          strokeWidth="2.8"
          strokeDasharray="800 143"
          transform="rotate(-18 360 220)"
          opacity=".9"
        />
        <circle
          cx="360"
          cy="220"
          r="138"
          stroke="#C9A96A"
          strokeWidth="1.1"
          strokeDasharray="250 617"
          transform="rotate(105 360 220)"
          opacity=".3"
        />
      </g>
      <g fill="#C9A96A">
        <circle cx="472" cy="94" r="5" opacity=".9" />
        <circle cx="494" cy="66" r="3.2" opacity=".6" />
        <circle cx="478" cy="40" r="2" opacity=".35" />
      </g>
      <text
        x="352"
        y="248"
        textAnchor="middle"
        fontFamily="Fraunces, Georgia, serif"
        fontSize="92"
        fill="#F2EDE3"
        letterSpacing="-1.5"
      >
        prego
      </text>
      <circle cx="490" cy="242" r="8" fill="url(#prego-gold)" />
    </svg>
  );
}

/** Dezenter „powered by"-Hinweis am Ende der Gast-Seiten – die Marke der Bar bleibt vorn. */
export function PoweredByPrego(props: { className?: string }): JSX.Element {
  return (
    <p
      className={`text-center text-[10px] font-semibold uppercase tracking-[0.25em] text-ivory/25 ${props.className ?? ''}`}
    >
      powered by <span style={{ fontFamily: 'Fraunces, Georgia, serif' }} className="normal-case text-[13px] tracking-normal text-ivory/40">prego<span style={{ color: '#C9A96A' }}>.</span></span>
    </p>
  );
}
