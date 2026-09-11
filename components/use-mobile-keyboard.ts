"use client";

import { useEffect } from "react";

const KEYBOARD_CLASS = "keyboard-open";
const KEYBOARD_THRESHOLD_PX = 120;

/**
 * Toggle html.keyboard-open when the soft keyboard is likely visible (iOS/Android).
 * Used to hide the mobile tab bar and tighten chat composer spacing.
 */
export function useMobileKeyboardClass() {
  useEffect(() => {
    const root = document.documentElement;
    let focusedEditable = false;

    function isEditable(el: EventTarget | null) {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    }

    function setOpen(open: boolean) {
      root.classList.toggle(KEYBOARD_CLASS, open);
    }

    function measureKeyboard() {
      const vv = window.visualViewport;
      if (!vv) {
        setOpen(focusedEditable);
        return;
      }
      const occluded = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setOpen(focusedEditable || occluded > KEYBOARD_THRESHOLD_PX);
    }

    function onFocusIn(event: FocusEvent) {
      if (!isEditable(event.target)) return;
      focusedEditable = true;
      measureKeyboard();
    }

    function onFocusOut() {
      focusedEditable = false;
      // iOS blurs briefly when tapping send; wait a tick before measuring.
      window.setTimeout(measureKeyboard, 150);
    }

    const vv = window.visualViewport;
    vv?.addEventListener("resize", measureKeyboard);
    vv?.addEventListener("scroll", measureKeyboard);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    measureKeyboard();

    return () => {
      vv?.removeEventListener("resize", measureKeyboard);
      vv?.removeEventListener("scroll", measureKeyboard);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      root.classList.remove(KEYBOARD_CLASS);
    };
  }, []);
}
