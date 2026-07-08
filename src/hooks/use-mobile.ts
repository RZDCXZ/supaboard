"use client";

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 1024;
const mediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(callback: () => void) {
  const query = window.matchMedia(mediaQuery);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(mediaQuery).matches;
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
