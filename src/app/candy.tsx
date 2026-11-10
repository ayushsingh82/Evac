// Glossy "inflated candy" icons drawn in SVG and tinted by the --tint custom property.
import type { CSSProperties, ReactNode } from "react";

export const TINTS = ["#E9C22E", "#F2772F", "#3FB874", "#C564C4"];

/** Glossy "inflated candy" icons, drawn in SVG and tinted by --tint. */
function Candy({ id, children }: { id: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden>
      <defs>
        <radialGradient id={`b${id}`} cx="32%" cy="26%" r="85%">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--tint) 35%, white)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--tint)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--tint) 62%, #5a2b00)" }} />
        </radialGradient>
        <radialGradient id={`e${id}`} cx="50%" cy="40%" r="70%">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--tint) 70%, #5a2b00)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--tint) 45%, #3a1a00)" }} />
        </radialGradient>
        <linearGradient id={`h${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g fill={`url(#b${id})`}>{children}</g>
    </svg>
  );
}

const Shine = ({ x, y, rx, ry, rot = -25, id }: { x: number | string; y: number | string; rx: number | string; ry: number | string; rot?: number; id: string }) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={`url(#h${id})`} transform={`rotate(${rot} ${x} ${y})`} />
);

export function IconExit() {
  return (
    <Candy id="x">
      <rect x="14" y="10" width="50" height="80" rx="14" />
      <rect x="24" y="20" width="30" height="60" rx="8" fill="url(#ex)" />
      <circle cx="46" cy="52" r="4" fill="#fff" fillOpacity="0.85" />
      <path d="M58 40h14V28l22 22-22 22V60H58z" />
      <Shine id="x" x="32" y="22" rx="14" ry="6" />
    </Candy>
  );
}
export function IconVerify() {
  return (
    <Candy id="v">
      <path d="M50 8l36 12v26c0 22-15 38-36 46C29 84 14 68 14 46V20z" />
      <path d="M33 50l12 12 24-26" fill="none" stroke="url(#ev)" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <Shine id="v" x="36" y="24" rx="16" ry="7" />
    </Candy>
  );
}
export function IconBridge() {
  return (
    <Candy id="r">
      <path d="M6 70V56C6 34 26 20 50 20s44 14 44 36v14H78V58c0-12-12-22-28-22S22 46 22 58v12z" />
      <rect x="4" y="68" width="92" height="16" rx="8" />
      <rect x="30" y="58" width="9" height="14" rx="3" fill="url(#er)" />
      <rect x="61" y="58" width="9" height="14" rx="3" fill="url(#er)" />
      <Shine id="r" x="38" y="30" rx="20" ry="6" rot={-10} />
    </Candy>
  );
}
export function IconProtect() {
  return (
    <Candy id="p">
      <path d="M30 46V34c0-12 8-22 20-22s20 10 20 22v12h-12V34c0-6-3-10-8-10s-8 4-8 10v12z" />
      <rect x="18" y="42" width="64" height="48" rx="16" />
      <circle cx="50" cy="63" r="7" fill="url(#ep)" />
      <rect x="47" y="65" width="6" height="14" rx="3" fill="url(#ep)" />
      <Shine id="p" x="36" y="52" rx="14" ry="6" />
    </Candy>
  );
}
export const ICONS = [IconExit, IconVerify, IconBridge, IconProtect];


/** One candy icon at any size, in the tint of its word (0 yellow, 1 orange, 2 green, 3 violet). */
export function CandyIcon({ kind, size = 64 }: { kind: 0 | 1 | 2 | 3; size?: number }) {
  const I = ICONS[kind];
  return (
    <span className="candy" style={{ width: size, height: size, "--tint": TINTS[kind] } as CSSProperties}>
      <I />
    </span>
  );
}
