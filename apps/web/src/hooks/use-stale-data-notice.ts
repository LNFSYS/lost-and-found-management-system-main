import { useCallback, useEffect, useState } from "react";

export function useStaleDataNotice(matchPath: (path: string) => boolean) {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const onStale = (event: Event) => {
      const path = (event as CustomEvent<{ path?: string }>).detail?.path ?? "";
      if (matchPath(path)) setStale(true);
    };
    window.addEventListener("lnfs:stale-data", onStale);
    return () => window.removeEventListener("lnfs:stale-data", onStale);
  }, [matchPath]);

  const clearStale = useCallback(() => setStale(false), []);
  return { stale, clearStale };
}
