"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || iosStandalone;
}

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (installed) return;

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }

    if (isIOS()) {
      setShowIOSHelp(true);
      return;
    }

    alert("To install this app, open your browser menu and choose ‘Install app’ or ‘Add to Home screen’. If the option is not shown yet, reload the page once and try again.");
  }

  if (installed) return null;

  return (
    <>
      <button className="install-button" type="button" onClick={install} aria-label="Install Equipment Reservation app">
        <span className="install-icon" aria-hidden="true">↓</span>
        Install App
      </button>

      {showIOSHelp && (
        <div className="install-help-backdrop" onMouseDown={() => setShowIOSHelp(false)}>
          <div className="install-help" onMouseDown={(e) => e.stopPropagation()}>
            <button className="install-help-close" onClick={() => setShowIOSHelp(false)} aria-label="Close">×</button>
            <p className="eyebrow">INSTALL ON IPHONE / IPAD</p>
            <h2>Add to Home Screen</h2>
            <ol className="install-steps">
              <li>Open this page in <strong>Safari</strong>.</li>
              <li>Tap the <strong>Share</strong> button.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>.</li>
            </ol>
            <button className="btn primary" onClick={() => setShowIOSHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
