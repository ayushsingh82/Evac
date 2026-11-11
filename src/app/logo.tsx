/** The Evac mark: a frame with an arrow leaving it. Sized in em, so it follows the text next to it. */
export function EvacMark({ size = "1.55em" }: { size?: string }) {
  return (
    <svg viewBox="13 9 49 54" aria-hidden style={{ height: size, width: `calc(${size} * 0.907)`, flex: "none", display: "block" }}>
      <g fill="none" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M44 14H20v44h24" stroke="#0D0D0C" />
        <path d="M30 36h26M48 28l8 8-8 8" stroke="#294634" />
      </g>
    </svg>
  );
}
