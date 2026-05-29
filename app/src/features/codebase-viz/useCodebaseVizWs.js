import { useEffect, useRef } from "react";
import { apiOrigin } from "../../shared/config/apiBase";

function wsUrl(branch) {
  const origin = apiOrigin();
  const base =
    origin ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  const path = origin ? "/codebase/viz/ws" : "/api/codebase/viz/ws";
  return `${base.replace(/^http/, "ws")}${path}?branch=${encodeURIComponent(branch)}`;
}

export function useCodebaseVizWs(branch, onDelta) {
  const handlerRef = useRef(onDelta);

  useEffect(() => {
    handlerRef.current = onDelta;
  }, [onDelta]);

  useEffect(() => {
    let socket;
    try {
      socket = new WebSocket(wsUrl(branch));
    } catch {
      return undefined;
    }

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handlerRef.current?.(message);
      } catch {
        /* ignore */
      }
    };

    return () => {
      socket.close();
    };
  }, [branch]);
}
