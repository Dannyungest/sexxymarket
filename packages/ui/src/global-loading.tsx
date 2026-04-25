"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import "./global-loading.css";

type LoadingApi = {
  begin: () => void;
  end: () => void;
};

const GlobalLoadingContext = createContext<LoadingApi | null>(null);

export function useOptionalGlobalLoading(): LoadingApi | null {
  return useContext(GlobalLoadingContext);
}

export function useGlobalLoading(): LoadingApi {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}

/** Increments global overlay while `active` is true (e.g. ActionButton isLoading). */
export function useRegisterGlobalLoadingWhile(active: boolean) {
  const ctx = useContext(GlobalLoadingContext);
  useEffect(() => {
    if (!ctx || !active) return;
    ctx.begin();
    return () => ctx.end();
  }, [ctx, active]);
}

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [depth, setDepth] = useState(0);
  const begin = useCallback(() => setDepth((d) => d + 1), []);
  const end = useCallback(() => setDepth((d) => Math.max(0, d - 1)), []);
  const value = useMemo(() => ({ begin, end }), [begin, end]);

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      {depth > 0 ? <GlobalLoadingOverlay /> : null}
    </GlobalLoadingContext.Provider>
  );
}

function GlobalLoadingOverlay() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        background: "color-mix(in oklab, var(--ui-bg) 55%, black)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 112,
          height: 112,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -4,
            borderRadius: "50%",
            background:
              "conic-gradient(from 0deg, color-mix(in srgb, var(--ui-accent) 55%, transparent), transparent, color-mix(in srgb, var(--ui-accent) 85%, #fff), transparent, color-mix(in srgb, var(--ui-accent) 55%, transparent))",
            animation: "sm-orbit 1.35s linear infinite",
            opacity: 0.9,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            border: "2px solid color-mix(in srgb, var(--ui-border) 70%, transparent)",
            animation: "sm-shimmer 1.8s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "relative",
            width: 76,
            height: 76,
            borderRadius: 18,
            display: "grid",
            placeItems: "center",
            border: "1px solid color-mix(in srgb, var(--ui-border) 55%, transparent)",
            background: "var(--ui-surface)",
            boxShadow: "0 20px 48px -28px color-mix(in srgb, var(--ui-accent) 45%, transparent)",
            animation: "sm-logo-breathe 2.2s ease-in-out infinite",
            overflow: "hidden",
          }}
        >
          <img
            src="/sexxymarketlogo.PNG"
            alt=""
            width={56}
            height={56}
            style={{
              objectFit: "contain",
              objectPosition: "center",
            }}
            onError={(event) => {
              const el = event.currentTarget;
              if (el.src.endsWith("/sexxymarketlogo.PNG")) {
                el.src = "/sexxymarketlogo.png";
                return;
              }
              el.style.display = "none";
              const fallback = el.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "grid";
            }}
          />
          <div
            style={{
              display: "none",
              position: "absolute",
              inset: 0,
              placeItems: "center",
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontWeight: 700,
              fontSize: "1.35rem",
              letterSpacing: "-0.04em",
              color: "color-mix(in srgb, var(--ui-accent) 55%, #1a1020)",
              background:
                "linear-gradient(145deg, color-mix(in srgb, var(--ui-accent) 42%, #fff), color-mix(in srgb, var(--ui-accent) 72%, #2a1810))",
            }}
          >
            S
          </div>
        </div>
      </div>
      <p
        style={{
          position: "absolute",
          bottom: "max(12%, 3.5rem)",
          left: 0,
          right: 0,
          textAlign: "center",
          margin: 0,
          fontSize: "0.82rem",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "color-mix(in oklab, var(--ui-muted) 92%, white)",
          fontWeight: 600,
        }}
      >
        Working…
      </p>
    </div>
  );
}

/** Full-screen loader for Next.js `loading.tsx` (no provider required). */
export function RouteTransitionLoader() {
  return (
    <div
      className="route-transition-loader-root"
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        background: "var(--ui-bg)",
      }}
    >
      <div style={{ position: "relative", width: 96, height: 96, display: "grid", placeItems: "center" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: -3,
            borderRadius: "50%",
            background:
              "conic-gradient(from 40deg, color-mix(in srgb, var(--ui-accent) 50%, transparent), transparent, color-mix(in srgb, var(--ui-accent) 90%, #fff), transparent)",
            animation: "sm-orbit 1.25s linear infinite",
          }}
        />
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: 16,
            border: "1px solid var(--ui-border)",
            background: "var(--ui-surface)",
            display: "grid",
            placeItems: "center",
            boxShadow: "var(--optical-shadow-soft, 0 18px 40px -30px rgba(0,0,0,.35))",
            animation: "sm-logo-breathe 2s ease-in-out infinite",
            overflow: "hidden",
          }}
        >
          <img
            src="/sexxymarketlogo.PNG"
            alt="Sexxy Market"
            width={50}
            height={50}
            style={{ objectFit: "contain" }}
            onError={(e) => {
              const el = e.currentTarget;
              if (el.src.endsWith("/sexxymarketlogo.PNG")) {
                el.src = "/sexxymarketlogo.png";
                return;
              }
              el.style.display = "none";
              const fb = el.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = "grid";
            }}
          />
          <div
            style={{
              display: "none",
              width: "100%",
              height: "100%",
              placeItems: "center",
              fontFamily: "Georgia, serif",
              fontWeight: 700,
              fontSize: "1.2rem",
              color: "color-mix(in srgb, var(--ui-accent) 50%, #1a1020)",
              background:
                "linear-gradient(145deg, color-mix(in srgb, var(--ui-accent) 38%, #fff), color-mix(in srgb, var(--ui-accent) 68%, #1a0f08))",
            }}
          >
            S
          </div>
        </div>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: "0.9rem", letterSpacing: "0.06em" }}>
        Loading experience…
      </p>
    </div>
  );
}
