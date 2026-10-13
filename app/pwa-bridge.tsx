import {studyStorage} from "../community/storage";
"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }
}

const DISMISS_KEY = "gre-pwa-install-dismissed";

export default function PwaBridge() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register(import.meta.env.BASE_URL+"sw.js").catch(() => undefined);
    }

    const standalone = navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = studyStorage.getItem(DISMISS_KEY) === "yes";
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    const iosPromptTimer = !standalone && !dismissed && ios
      ? window.setTimeout(() => setShowBanner(true), 0)
      : undefined;

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      if (!dismissed) setShowBanner(true);
    };
    const onInstalled = () => {
      setShowBanner(false);
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (iosPromptTimer !== undefined) window.clearTimeout(iosPromptTimer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!installPrompt) {
      setShowIosGuide((current) => !current);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setShowBanner(false);
    setInstallPrompt(null);
  }

  function dismiss() {
    studyStorage.setItem(DISMISS_KEY, "yes");
    setShowBanner(false);
  }

  if (!showBanner) return null;

  return (
    <aside className="pwaBanner" aria-label="安装 GRE 背词 App">
      <span className="pwaBannerIcon">Q</span>
      <div>
        <strong>装到手机，随手背词</strong>
        <p>{showIosGuide ? "在 Safari 点“分享” → “添加到主屏幕”，并打开“作为 Web App 打开”。" : "添加到主屏幕后会像 App 一样独立打开，打开更方便。"}</p>
      </div>
      <button className="pwaInstall" type="button" onClick={install}>{installPrompt ? "安装" : showIosGuide ? "知道了" : "怎么装"}</button>
      <button className="pwaDismiss" type="button" onClick={dismiss} aria-label="关闭安装提示">×</button>
    </aside>
  );
}
