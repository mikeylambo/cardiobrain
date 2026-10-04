import React from "react";

let applyUpdate: (() => void) | null = null;
const listeners = new Set<() => void>();

/** Called by main.tsx when a new service worker is waiting. */
export function announceUpdate(apply: () => void): void {
  applyUpdate = apply;
  listeners.forEach((l) => l());
}

/** "Update ready" on Home only, never mid-session. */
export function UpdateToast() {
  const [ready, setReady] = React.useState(applyUpdate !== null);
  React.useEffect(() => {
    const l = () => setReady(true);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (!ready) return null;
  return (
    <div className="toast" role="status">
      <span>Update ready.</span>
      <button className="btn-text" onClick={() => applyUpdate?.()}>
        Restart
      </button>
    </div>
  );
}
