"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { flushSync } from "react-dom";
import "./global-loading.css";
import { useRegisterGlobalLoadingWhile } from "./global-loading";

export function BrandMark({ size = 46 }: { size?: number }) {
  return (
    <div
      aria-label="Sexxy Market monogram"
      style={{
        position: "relative",
        width: size,
        height: size,
        borderRadius: 14,
        display: "grid",
        placeItems: "center",
        border: "1px solid var(--ui-border)",
        background: "var(--ui-surface)",
        boxShadow: "0 16px 30px -18px color-mix(in srgb, var(--ui-accent) 38%, transparent)",
        overflow: "hidden",
      }}
    >
      <img
        src="/sexxymarketlogo.png"
        alt="Sexxy Market logo"
        style={{
          width: "86%",
          height: "86%",
          objectFit: "contain",
          objectPosition: "center",
        }}
        onError={(event) => {
          const target = event.currentTarget;
          if (/\/sexxymarketlogo\.(png|PNG)$/.test(target.src)) {
            target.src = "/sexxymarketlogo.png";
            return;
          }
          target.style.display = "none";
          const fb = target.nextElementSibling as HTMLElement | null;
          if (fb) fb.style.display = "grid";
        }}
      />
      <div
        aria-hidden
        style={{
          display: "none",
          position: "absolute",
          inset: 0,
          placeItems: "center",
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontWeight: 700,
          fontSize: `${Math.max(12, Math.round(size * 0.38))}px`,
          letterSpacing: "-0.05em",
          color: "color-mix(in srgb, var(--ui-accent) 50%, #1a1020)",
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--ui-accent) 35%, #fff), color-mix(in srgb, var(--ui-accent) 65%, #1a0f08))",
        }}
      >
        S
      </div>
    </div>
  );
}

export function SurfaceCard({
  title,
  subtitle,
  children,
  style,
  className,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  style?: CSSProperties;
  className?: string;
}) {
  const mergedClassName = `surface-card${className ? ` ${className}` : ""}`;
  return (
    <section
      className={mergedClassName}
      style={{
        background: "var(--ui-surface)",
        border: "1px solid var(--ui-border)",
        borderRadius: "var(--optical-card-radius, 17px)",
        padding: "var(--optical-card-pad, 0.92rem)",
        boxShadow: "var(--optical-shadow-soft, 0 22px 54px -44px rgba(35, 20, 4, 0.45))",
        ...style,
      }}
    >
      {title ? <h2 style={{ margin: 0, fontSize: "1.02rem" }}>{title}</h2> : null}
      {subtitle ? <p style={{ marginTop: 8, color: "var(--ui-muted)" }}>{subtitle}</p> : null}
      {children}
    </section>
  );
}

export function ActionButton({
  children,
  onClick,
  type = "button",
  disabled,
  ghost = false,
  className,
  isLoading = false,
  loadingText,
  instantLoading = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  ghost?: boolean;
  className?: string;
  isLoading?: boolean;
  loadingText?: string;
  /**
   * Primary buttons arm the global loader on pointer down so feedback appears before the next frame
   * (e.g. before `isLoading` is set). Ghost buttons rely on `isLoading` only.
   */
  instantLoading?: boolean;
}) {
  const [pressArmed, setPressArmed] = useState(false);
  const showLoadingUi = isLoading || (!ghost && instantLoading && pressArmed);
  useRegisterGlobalLoadingWhile(showLoadingUi);

  useEffect(() => {
    if (isLoading) {
      setPressArmed(false);
    }
  }, [isLoading]);

  useEffect(() => {
    if (!pressArmed || isLoading) {
      return;
    }
    const t = window.setTimeout(() => setPressArmed(false), 12_000);
    return () => window.clearTimeout(t);
  }, [pressArmed, isLoading]);

  const locked = disabled || isLoading;
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.38rem",
    borderRadius: 999,
    minHeight: "var(--optical-btn-height, 40px)",
    padding: `0.54rem var(--optical-btn-pad-x, 0.96rem)`,
    border: "1px solid transparent",
    fontWeight: 680,
    fontSize: "0.92rem",
    letterSpacing: "0.012em",
    lineHeight: 1.1,
    cursor: locked ? "not-allowed" : "pointer",
    opacity: locked ? 0.6 : 1,
    transition: "transform var(--motion-fast) var(--motion-ease), box-shadow var(--motion-fast) var(--motion-ease), filter var(--motion-fast) var(--motion-ease)",
  } satisfies CSSProperties;

  return (
    <button
      type={type}
      onClick={onClick}
      onPointerDownCapture={
        ghost || !instantLoading || disabled
          ? undefined
          : (event) => {
              if (isLoading) {
                return;
              }
              if (event.button !== 0) {
                return;
              }
              flushSync(() => {
                setPressArmed(true);
              });
            }
      }
      disabled={locked}
      aria-busy={showLoadingUi}
      className={className ?? "action-button"}
      data-variant={ghost ? "ghost" : "primary"}
      data-press-pending={pressArmed && !isLoading && !ghost ? "true" : undefined}
      style={
        ghost
          ? {
              ...base,
              borderColor: "var(--ui-border)",
              color: "var(--ui-text)",
              background: "var(--ui-card-soft)",
              boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--ui-border) 66%, transparent)",
            }
          : {
              ...base,
              borderColor: "color-mix(in srgb, var(--ui-accent) 60%, transparent)",
              color: "#241609",
              background:
                "linear-gradient(130deg, color-mix(in srgb, var(--ui-accent) 76%, #fff), var(--ui-accent), color-mix(in srgb, var(--ui-accent) 80%, #8e5e24))",
              boxShadow: "0 11px 24px -20px rgba(34, 20, 4, 0.66)",
            }
      }
    >
      {showLoadingUi ? (
        <>
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              border: "2px solid color-mix(in srgb, currentColor 35%, transparent)",
              borderTopColor: "currentColor",
              animation: "sk 1s linear infinite",
            }}
          />
          <span>
            {loadingText ?? (isLoading ? "Processing…" : "Working…")}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function MetricTile({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <SurfaceCard>
      <p style={{ margin: 0, color: "var(--ui-muted)", fontSize: "0.82rem", letterSpacing: "0.02em" }}>{label}</p>
      <p style={{ margin: "0.5rem 0", fontWeight: 700, fontSize: "1.33rem", lineHeight: 1.2 }}>{value}</p>
      {meta ? <p style={{ margin: 0, color: "var(--ui-muted)", fontSize: "0.83rem", lineHeight: 1.45 }}>{meta}</p> : null}
    </SurfaceCard>
  );
}

export function StarRow({ rating, count }: { rating: number; count: number }) {
  const safe = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-label={`${safe} stars`} style={{ color: "var(--ui-accent)" }}>
        {"★".repeat(safe)}
        {"☆".repeat(5 - safe)}
      </span>
      <small style={{ color: "var(--ui-muted)" }}>
        {rating.toFixed(1)} ({count})
      </small>
    </div>
  );
}

export function ProductCodePill({ code }: { code: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid var(--ui-border)",
        borderRadius: 999,
        padding: "0.19rem 0.54rem",
        fontSize: "0.71rem",
        letterSpacing: "0.045em",
        textTransform: "uppercase",
        color: "var(--ui-muted)",
        background: "var(--ui-card-soft)",
      }}
    >
      Product No: {code}
    </span>
  );
}

export function QuantityStepper({
  value,
  onDecrease,
  onIncrease,
}: {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: "1px solid var(--ui-border)",
        borderRadius: 999,
        padding: "0.24rem 0.52rem",
        minHeight: "var(--optical-btn-height, 40px)",
        background: "color-mix(in srgb, var(--ui-card-soft) 90%, transparent)",
      }}
    >
      <button
        type="button"
        onClick={onDecrease}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          width: 22,
          height: 22,
          borderRadius: 999,
          color: "var(--ui-muted)",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        -
      </button>
      <strong style={{ minWidth: 16, textAlign: "center", fontSize: "0.94rem", lineHeight: 1 }}>{value}</strong>
      <button
        type="button"
        onClick={onIncrease}
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          width: 22,
          height: 22,
          borderRadius: 999,
          color: "var(--ui-muted)",
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        +
      </button>
    </div>
  );
}

export {
  GlobalLoadingProvider,
  RouteTransitionLoader,
  useGlobalLoading,
  useOptionalGlobalLoading,
  useRegisterGlobalLoadingWhile,
} from "./global-loading";
