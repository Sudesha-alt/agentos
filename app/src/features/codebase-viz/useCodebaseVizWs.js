import { useCallback, useEffect, useRef, useState } from "react";
import { apiOrigin } from "../../shared/config/apiBase";

function wsUrl(branch) {
  const origin = apiOrigin();
  const base =
    origin ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  const path = origin ? "/codebase/viz/ws" : "/api/codebase/viz/ws";
  return `${base.replace(/^http/, "ws")}${path}?branch=${encodeURIComponent(branch)}`;
}

const BACKOFF_MS = [1000, 2000, 4000, 8000, 15000];

/**
 * @returns {{ status: 'connecting'|'live'|'offline', reconnect: () => void }}
 */
export function useCodebaseVizWs(branch, onDelta) {
  const handlerRef = useRef(onDelta);
  const [status, setStatus] = useState("connecting");
  const reconnectRef = useRef(() => {});

  useEffect(() => {
    handlerRef.current = onDelta;
  }, [onDelta]);

  useEffect(() => {
    let socket = null;
    let reconnectTimer = null;
    let attempt = 0;
    let closed = false;

    function scheduleReconnect() {
      const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      attempt += 1;
      reconnectTimer = setTimeout(openSocket, delay);
    }

    function openSocket() {
      if (closed) return;

      try {
        socket = new WebSocket(wsUrl(branch));
      } catch {
        setStatus("offline");
        return;
      }

      socket.onopen = () => {
        attempt = 0;
        setStatus("live");
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "connected") return;
          handlerRef.current?.(message);
        } catch {
          /* ignore */
        }
      };

      socket.onerror = () => {
        setStatus("offline");
      };

      socket.onclose = () => {
        socket = null;
        if (closed) {
          setStatus("offline");
          return;
        }
        setStatus("offline");
        scheduleReconnect();
      };
    }

    reconnectRef.current = () => {
      attempt = 0;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socket) {
        socket.close();
        socket = null;
      }
      setStatus("connecting");
      openSocket();
    };

    openSocket();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [branch]);

  const reconnect = useCallback(() => {
    reconnectRef.current();
  }, []);

  return { status, reconnect };
}
