import { useCallback, useEffect, useRef, useState } from "react";

/** Tracks elapsed active play time (pauses when tab is hidden). */
export function useActivePlayTime(running: boolean) {
  const [activePlayMs, setActivePlayMs] = useState(0);
  const accumulatedRef = useRef(0);
  const lastTickRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    accumulatedRef.current = 0;
    lastTickRef.current = null;
    setActivePlayMs(0);
  }, []);

  useEffect(() => {
    if (!running) {
      lastTickRef.current = null;
      return;
    }

    let raf = 0;

    const tick = (now: number) => {
      if (lastTickRef.current !== null && !document.hidden) {
        accumulatedRef.current += now - lastTickRef.current;
        setActivePlayMs(accumulatedRef.current);
      }
      lastTickRef.current = now;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    const onVisibility = () => {
      if (document.hidden) lastTickRef.current = null;
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [running]);

  return { activePlayMs, resetActivePlayTime: reset };
}
