// Small inline icons and the Evac mark. No icon library, no network requests.
import type { ReactNode } from "react";

const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className: "icon", "aria-hidden": true };

const I = ({ children }: { children: ReactNode }) => <svg {...base}>{children}</svg>;

export const IconExit = () => (
  <I>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </I>
);
export const IconShield = () => (
  <I>
    <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z" />
    <path d="M9 12l2 2 4-4" />
  </I>
);
export const IconSearch = () => (
  <I>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </I>
);
export const IconWallet = () => (
  <I>
    <path d="M3 7a2 2 0 0 1 2-2h13v4" />
    <path d="M3 7v11a2 2 0 0 0 2 2h14V9H5a2 2 0 0 1-2-2z" />
    <circle cx="16" cy="14.5" r="1" />
  </I>
);
export const IconCheck = () => (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12.5l2.7 2.7L16 9.5" />
  </I>
);
export const IconAlert = () => (
  <I>
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v5" />
    <path d="M12 18h.01" />
  </I>
);
export const IconInfo = () => (
  <I>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5" />
    <path d="M12 8h.01" />
  </I>
);
export const IconLayers = () => (
  <I>
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </I>
);
export const IconBridge = () => (
  <I>
    <path d="M3 18V9a9 9 0 0 1 18 0v9" />
    <path d="M3 18h18" />
    <path d="M9 18v-5M15 18v-5" />
  </I>
);

/** Evac mark: a lime tile with an open door and an arrow leaving it. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brandmark" width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Evac">
      <rect width="32" height="32" rx="8" fill="#c4fa4f" />
      <path d="M11 24V9.5a1.5 1.5 0 0 1 1.2-1.5L19 6.5v17" fill="none" stroke="#141615" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M17 16h8m-3-3l3 3-3 3" fill="none" stroke="#141615" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
