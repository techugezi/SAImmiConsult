"use client";

import { useEffect } from "react";

/**
 * When the URL hash matches `anchorId`, re-assert scroll + focus after mount.
 * Needed because:
 *  - these pages are `force-dynamic` and the browser can paint before async
 *    content exists, so the native hash scroll hits an empty node;
 *  - server actions redirect back with `?open=...&stage=...&saved=...` and
 *    some browsers drop the hash-based scroll on that transition;
 *  - we also want keyboard/AT users to land on the wizard, not the top.
 */
export default function AnchorFocus({ anchorId }: { anchorId: string }) {
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash !== anchorId) return;

    const el = document.getElementById(anchorId);
    if (!el) return;

    // Defer a frame so layout (fonts, async children) settles before we scroll.
    const raf = requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "auto", block: "start" });

      // Make the wizard focusable programmatically without adding it to the
      // tab order (tabIndex={-1}); then move focus so AT announces it.
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
      (el as HTMLElement).focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(raf);
  }, [anchorId]);

  return null;
}