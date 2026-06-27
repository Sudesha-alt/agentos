import { useEffect, useState } from "react";
import { useAuth } from "../providers/useAuth";
import AppPreloader from "./AppPreloader";

function hasStoredAuthToken() {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.token);
  } catch {
    return false;
  }
}

const MIN_BOOT_MS = 0;

function removeInitialLoader() {
  document.getElementById("app-initial-loader")?.remove();
  document.getElementById("root")?.classList.add("app-ready");
}

export default function AppBootstrapGate({ children }) {
  const { loading: authLoading } = useAuth();
  const [docReady, setDocReady] = useState(() => document.readyState === "complete");
  const [minElapsed, setMinElapsed] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setMinElapsed(true), MIN_BOOT_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (docReady) return undefined;
    const onLoad = () => setDocReady(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, [docReady]);

  const booting = authLoading || !docReady || !minElapsed;

  useEffect(() => {
    if (booting) return undefined;

    setExiting(true);
    const revealTimer = window.setTimeout(() => {
      removeInitialLoader();
      setShowApp(true);
    }, 120);

    const unmountTimer = window.setTimeout(() => {
      setOverlayMounted(false);
    }, 280);

    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(unmountTimer);
    };
  }, [booting]);

  return (
    <>
      {overlayMounted ? (
        <AppPreloader overlay exiting={exiting} label="Loading Agentos" />
      ) : null}
      <div className={showApp ? "app-boot-visible" : "app-boot-hidden"}>{children}</div>
    </>
  );
}
