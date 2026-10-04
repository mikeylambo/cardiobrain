import { useStore } from "../state/store";
import { AddSquareIcon, IosShareIcon, Sheet } from "./components";

const isIosSafari = () => {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && webkit;
};
const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Offered once, on iOS Safari only, after the first round: never on first load. */
export function shouldOfferInstall(alreadyOffered: boolean, sessions: number): boolean {
  if (alreadyOffered || sessions < 1) return false;
  try {
    return isIosSafari() && !standalone();
  } catch {
    return false;
  }
}

export function InstallPrompt({ onClose }: { onClose: () => void }) {
  const markInstallOffered = useStore((s) => s.markInstallOffered);
  const close = () => {
    markInstallOffered();
    onClose();
  };
  return (
    <Sheet title="Add to Home Screen" onClose={close}>
      <p className="t-17">Add CardioBrain to your Home Screen. It opens full screen and works offline.</p>
      <ol className="install-steps t-17" style={{ listStyle: "none", padding: 0 }}>
        <li>
          <IosShareIcon /> Tap Share in Safari's toolbar.
        </li>
        <li>
          <AddSquareIcon /> Choose Add to Home Screen.
        </li>
      </ol>
      <button className="btn-primary" onClick={close}>
        Done
      </button>
    </Sheet>
  );
}
