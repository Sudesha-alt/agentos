import { useEffect } from "react";
import { marketingScrollStore } from "./scrollStore";

/** Sync window scroll → 3D scene (normal DOM scroll, not ScrollControls). */
export default function MarketingDocumentScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");

    html.classList.add("marketing-page");
    const prevHtmlHeight = html.style.height;
    const prevBodyHeight = body.style.height;
    const prevRootHeight = root?.style.height ?? "";

    html.style.height = "auto";
    body.style.height = "auto";
    if (root) root.style.height = "auto";

    const sync = () => {
      const max = html.scrollHeight - html.clientHeight;
      marketingScrollStore.setOffset(max > 0 ? window.scrollY / max : 0);
    };

    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });

    const observer = new ResizeObserver(sync);
    observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      observer.disconnect();
      html.classList.remove("marketing-page");
      html.style.height = prevHtmlHeight;
      body.style.height = prevBodyHeight;
      if (root) root.style.height = prevRootHeight;
    };
  }, []);

  return null;
}
