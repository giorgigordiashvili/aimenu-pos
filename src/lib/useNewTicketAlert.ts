import { useEffect, useMemo, useRef, useState } from "react";

import { playNewTicketChime } from "./kitchenSound";

/**
 * Watches the ids in the "New" lane; whenever one shows up that we have not
 * seen before (after the first load) it chimes and flags the ticket so the
 * card can flash for a couple of seconds.
 */
export function useNewTicketAlert(
  ids: string[],
  opts: { soundOn: boolean; ready: boolean },
): { flash: Set<string> } {
  const seen = useRef<Set<string> | null>(null);
  const [flash, setFlash] = useState<Set<string>>(() => new Set());
  const key = useMemo(() => ids.join("|"), [ids]);

  useEffect(() => {
    if (!opts.ready) return;
    const current = key ? key.split("|") : [];
    if (seen.current === null) {
      seen.current = new Set(current);
      return;
    }
    const fresh = current.filter((id) => !seen.current!.has(id));
    current.forEach((id) => seen.current!.add(id));
    if (fresh.length === 0) return;
    if (opts.soundOn) playNewTicketChime();
    setFlash((prev) => new Set([...prev, ...fresh]));
    const timer = setTimeout(() => {
      setFlash((prev) => {
        const next = new Set(prev);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 2_500);
    return () => clearTimeout(timer);
    // soundOn is read at fire time on purpose; toggling it must not replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, opts.ready]);

  return { flash };
}
