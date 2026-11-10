"use client";

import Link from "next/link";
import { ICONS, TINTS } from "./candy";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";

/* One clock drives everything: a long Web Animation's currentTime. */
const SLOT = 1.75; // seconds per word
const ENTER = 0.5;
const LEAVE = 0.42;
const FADE = 0.77; // panel crossfade window straddling each word change
const ICON_DELAY = 0.06;
const WORDS = ["Exit", "Verify", "Bridge", "Protect"] as const;
const T = SLOT * WORDS.length;

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
const easeIn = (p: number) => p * p * p;
const smooth = (p: number) => p * p * (3 - 2 * p);

/** Weight of panel layer i at time t (0..1), crossfading across a window centred on each word change. */
function layerWeight(i: number, t: number): number {
  const h = FADE / 2;
  const start = i * SLOT;
  const end = start + SLOT;
  let w = 0;
  for (const k of [-1, 0, 1]) {
    const s = start + k * T;
    const e = end + k * T;
    w += smooth(clamp((t - (s - h)) / FADE)) - smooth(clamp((t - (e - h)) / FADE));
  }
  return clamp(w);
}

const Chevron = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 4.5L6 8l3.5-3.5" />
  </svg>
);

const MQ = "(prefers-reduced-motion: reduce)";
const subscribeMQ = (cb: () => void) => {
  const m = window.matchMedia(MQ);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export default function Hero() {
  const [idx, setIdx] = useState(0);
  const reduced = useSyncExternalStore(subscribeMQ, () => window.matchMedia(MQ).matches, () => false);
  const layers = useRef<(HTMLDivElement | null)[]>([]);
  const word = useRef<HTMLSpanElement>(null);
  const icon = useRef<HTMLSpanElement>(null);
  const cta = useRef<HTMLAnchorElement>(null);
  const clockEl = useRef<HTMLDivElement>(null);
  const idxRef = useRef(0);

  useEffect(() => {
    if (reduced) {
      // A still "Verify" state: no clock, no motion.
      layers.current.forEach((l, i) => l && (l.style.opacity = i === 1 ? "1" : "0"));
      if (word.current) word.current.style.cssText = "";
      if (icon.current) icon.current.style.cssText = "";
      return;
    }
    const el = clockEl.current!;
    const anim = el.animate([{ opacity: 1 }, { opacity: 1 }], { duration: 1e9 });
    let raf = 0;
    const frame = () => {
      const t = Number(anim.currentTime ?? 0) / 1000;
      const tt = t % T;
      const i = Math.floor(tt / SLOT) % WORDS.length;
      const local = tt - i * SLOT;
      if (i !== idxRef.current) {
        idxRef.current = i;
        setIdx(i);
      }
      // Word: enter, then leave.
      const pe = easeOut(clamp(local / ENTER));
      let op = pe;
      let y = (1 - pe) * 0.32;
      let blur = (1 - pe) * 10;
      let sc = 0.96 + 0.04 * pe;
      if (local > SLOT - LEAVE) {
        const q = easeIn((local - (SLOT - LEAVE)) / LEAVE);
        op = 1 - q;
        y = -0.16 * q;
        blur = 8 * q;
        sc = 1;
      }
      if (word.current) {
        word.current.style.opacity = String(op);
        word.current.style.transform = `translateY(${y}em) scale(${sc})`;
        word.current.style.filter = `blur(${blur}px)`;
      }
      // Icon follows 60 ms later.
      const pi = easeOut(clamp((local - ICON_DELAY) / ENTER));
      let iop = pi;
      let iy = 0;
      let iblur = 0;
      let isc = 0.7 + 0.3 * pi;
      let rot = -14 * (1 - pi);
      if (local > SLOT - LEAVE) {
        const q = easeIn((local - (SLOT - LEAVE)) / LEAVE);
        iop = 1 - q;
        iy = -0.16 * q;
        iblur = 8 * q;
        isc = 1;
        rot = 0;
      }
      if (icon.current) {
        icon.current.style.opacity = String(iop);
        icon.current.style.transform = `translateY(${iy}em) scale(${isc}) rotate(${rot}deg)`;
        icon.current.style.filter = iblur ? `blur(${iblur}px)` : "none";
      }
      // Panel colour crossfade.
      layers.current.forEach((l, k) => l && (l.style.opacity = String(layerWeight(k, tt))));
      // Primary button fills black while the last word holds.
      if (cta.current) {
        const holding = i === WORDS.length - 1 && local > ENTER && local < SLOT - LEAVE;
        cta.current.classList.toggle("hx-filled", holding);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const vis = () => (document.hidden ? anim.pause() : anim.play());
    document.addEventListener("visibilitychange", vis);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", vis);
      anim.cancel();
    };
  }, [reduced]);

  const shown = reduced ? 1 : idx;
  const Icon = ICONS[shown];
  return (
    <section className="hx" style={{ "--tint": TINTS[shown] } as CSSProperties}>
      <div className="hx-clock" ref={clockEl} aria-hidden />
      <div className="hx-panel">
        {WORDS.map((w, i) => (
          <div key={w} className={`hx-layer hx-l${i}`} ref={(el) => { layers.current[i] = el; }} style={{ opacity: i === 0 && !reduced ? 1 : i === 1 && reduced ? 1 : 0 }} />
        ))}
        <div className="hx-grain" />

        <nav className="hx-nav">
          <Link href="/" className="hx-logo">evac</Link>
          <div className="hx-links">
            <a href="#how">How it works <Chevron /></a>
            <a href="#protocols">Protocols <Chevron /></a>
            <a href="#security">Security <Chevron /></a>
            <Link href="/dashboard" className="hx-join">Open Evac</Link>
          </div>
        </nav>

        <h1 className="hx-h1">
          <span className="hx-line1">
            <span className="hx-icon" ref={icon}>
              <span className="hx-bob"><Icon /></span>
            </span>
            <span className="hx-word" ref={word}>{WORDS[shown]}</span>
          </span>
          <span className="hx-line2">on your terms</span>
        </h1>

        <div className="hx-row">
          <Link href="/dashboard" className="hx-btn" ref={cta}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Open the exit
          </Link>
          <a href="#how" className="hx-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3zM9 12l2 2 4-4" />
            </svg>
            How it works
          </a>
          <p className="hx-cap">
            Evac is a fire exit for NEAR DeFi. It reads your position from the contracts,
            <br />
            checks every withdrawal, and proves the money came back.
          </p>
        </div>
      </div>

      <div className="hx-strip">
        <svg className="hx-notch" viewBox="0 0 1440 62" preserveAspectRatio="none" aria-hidden>
          <path d="M0 62 H1062 C1092 62 1098 54 1116 34 C1138 9 1146 1 1178 1 H1440 V62 Z" fill="#FBF6EF" />
        </svg>
        <span className="hx-hint">↓ Scroll to learn more</span>
        <div className="hx-strip-in">
          <p className="hx-tag">Know your exit
            <br />before you need it</p>
          <dl className="hx-stats">
            <div><dt>3</dt><dd>RPC providers must agree</dd></div>
            <div><dt>21</dt><dd>attack payloads refused in tests</dd></div>
            <div><dt>0</dt><dd>servers of ours in the path</dd></div>
          </dl>
          <svg className="hx-art" viewBox="0 0 90 110" fill="none" stroke="#0D0D0C" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M10 104h70" />
            <path d="M24 104V30a6 6 0 0 1 5-6l22-5v85" />
            <path d="M51 104V19" />
            <circle cx="45" cy="64" r="2" />
            <path d="M58 58h16m-5-5 5 5-5 5" />
          </svg>
        </div>
      </div>
    </section>
  );
}
