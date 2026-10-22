/*
DOC NAME: ActionSplitDropdown.tsx
LOCATION: /src/components/ui/actions/ActionSplitDropdown.tsx
SCOPE: Global composition-only primitive: single trigger button + portal dropdown menu.
STATUS: UNLOCKED (lock after approved)
*/

"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./ActionSplitDropdown.module.css";

export type SplitAction = {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
};

type MenuPos = { top: number; left: number };

export function ActionSplitDropdown({
  label,
  pendingLabel,
  isPending,
  disabled,
  actions,
  menuAriaLabel,
  toggleAriaLabel,
  className,
  primaryButtonClassName,
  menuClassName,
  itemButtonClassName,
}: {
  label: string;
  pendingLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  actions: SplitAction[];
  menuAriaLabel: string;
  toggleAriaLabel: string;

  className?: string;
  primaryButtonClassName?: string;
  menuClassName?: string;
  itemButtonClassName?: string;
}) {
  const popId = useId();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos>({ top: 0, left: 0 });

  const effectiveDisabled = Boolean(disabled || isPending);

  const safeActions = useMemo(() => {
    return (actions ?? []).filter((a) => a && typeof a.id === "string" && a.id.length > 0);
  }, [actions]);

  function isClickInside(target: Node) {
    const root = rootRef.current;
    const menu = menuRef.current;
    if (root && root.contains(target)) return true;
    if (menu && menu.contains(target)) return true;
    return false;
  }

  useEffect(() => {
    function onDocDown(e: MouseEvent | TouchEvent) {
      if (!open) return;
      const target = e.target as Node | null;
      if (!target) return;
      if (isClickInside(target)) return;
      setOpen(false);
    }

    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("touchstart", onDocDown);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onDocDown);
      document.removeEventListener("touchstart", onDocDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function computePosition() {
    const btn = buttonRef.current;
    const menu = menuRef.current;
    if (!btn || !menu) return;

    const gap = 8;
    const viewportPad = 8;

    const a = btn.getBoundingClientRect();
    const m = menu.getBoundingClientRect();

    // Align menu to left edge of button; clamp to viewport.
    let left = a.left;
    left = Math.max(viewportPad, Math.min(left, window.innerWidth - viewportPad - m.width));

    // Prefer below button; flip above if needed.
    const belowTop = a.bottom + gap;
    const aboveTop = a.top - gap - m.height;

    const canFitBelow = belowTop + m.height <= window.innerHeight - viewportPad;
    const top = canFitBelow ? belowTop : Math.max(viewportPad, aboveTop);

    setPos({ top, left });
  }

  useLayoutEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => computePosition());
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, safeActions.length]);

  useEffect(() => {
    if (!open) return;

    function onResizeOrScroll() {
      computePosition();
    }

    window.addEventListener("resize", onResizeOrScroll);
    window.addEventListener("scroll", onResizeOrScroll, true);

    return () => {
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runAction(a: SplitAction) {
    if (effectiveDisabled || a.disabled) return;
    setOpen(false);
    await a.onClick();
  }

  const triggerText = isPending && pendingLabel ? pendingLabel : label;

  const menu = open ? (
    <div
      id={popId}
      ref={menuRef}
      className={`${styles.menu} ${menuClassName ?? ""}`}
      role="menu"
      aria-label={menuAriaLabel}
      style={{ top: pos.top, left: pos.left }}
    >
      {safeActions.map((a) => (
        <button
          key={a.id}
          type="button"
          role="menuitem"
          className={`${itemButtonClassName ?? "button button-secondary"} ${styles.item}`}
          disabled={Boolean(effectiveDisabled || a.disabled)}
          onClick={() => {
            void runAction(a);
          }}
        >
          {a.label}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className={`${styles.wrap} ${className ?? ""}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`${primaryButtonClassName ?? "button button-primary"} ${styles.trigger}`}
        disabled={effectiveDisabled}
        onClick={() => {
          if (effectiveDisabled) return;
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={popId}
        aria-label={toggleAriaLabel}
      >
        <span className={styles.label}>{triggerText}</span>
        <span className={styles.chevron} aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined" ? createPortal(menu, document.body) : null}
    </div>
  );
}
