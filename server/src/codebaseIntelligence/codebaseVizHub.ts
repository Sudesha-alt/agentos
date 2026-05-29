import type { Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { logger } from "../utils/logger";
import { visualizationCache, type VizDeltaMessage } from "./visualizationCache";

interface ClientState {
  branchName: string;
}

const clients = new Map<WebSocket, ClientState>();
let unsubscribe: (() => void) | null = null;

export function initCodebaseVizWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true });

  if (!unsubscribe) {
    unsubscribe = visualizationCache.subscribe((message) => {
      broadcast(message);
    });
  }

  server.on("upgrade", (request, socket, head) => {
    const url = request.url ?? "";
    if (!url.includes("/viz/ws")) return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url ?? "", "http://localhost");
    const branchName = url.searchParams.get("branch") ?? "main";
    clients.set(socket, { branchName });

    socket.send(
      JSON.stringify({
        type: "connected",
        branchName,
        message: "Subscribed to visualization deltas",
      })
    );

    socket.on("close", () => {
      clients.delete(socket);
    });
  });

  logger.info("codebase visualization WebSocket on */viz/ws");
}

function broadcast(message: VizDeltaMessage): void {
  const payload = JSON.stringify(message);
  for (const [socket, state] of clients) {
    if (socket.readyState !== socket.OPEN) continue;
    if (state.branchName !== message.branchName) continue;
    socket.send(payload);
  }
}
