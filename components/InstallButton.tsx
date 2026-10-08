"use client";
import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    setInstalled(standalone);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (installed) return null;

  async function install() {
    if (ios) {
      setHelp(true);
      return;
    }
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      return;
    }
    setHelp(true);
  }

  return (
    <>
      <button className="pill" onClick={install}>Install App</button>
      {help && (
        <div className="modal-backdrop" onMouseDown={() => setHelp(false)}>
          <div className="modal" onMouseDown={e => e.stopPropagation()}>
            <div className="modal-head">
              <div><p className="eyebrow">INSTALL APP</p><h2>Equipment Reservation</h2></div>
              <button className="close" onClick={() => setHelp(false)}>×</button>
            </div>
            {ios ? (
              <p className="subtitle">On iPhone/iPad: open this site in Safari → Share → Add to Home Screen.</p>
            ) : (
              <p className="subtitle">
                In Microsoft Edge: open the ⋯ menu → Apps → Install Equipment Reservation.
                In Chrome: use the install icon in the address bar or ⋮ → Cast, save, and share → Install page as app.
              </p>
            )}
            <div className="actions"><button className="btn primary" onClick={() => setHelp(false)}>OK</button></div>
          </div>
        </div>
      )}
    </>
  );
}
