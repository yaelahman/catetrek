"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./auth";

/** Sementara dimatikan — set NEXT_PUBLIC_REALTIME=true untuk mengaktifkan lagi. */
export const REALTIME_ENABLED = process.env.NEXT_PUBLIC_REALTIME === "true";

type SocketContextValue = {
  socket: Socket | null;
  connected: boolean;
  version: number;
  bump: () => void;
  realtimeEnabled: boolean;
};

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  version: 0,
  bump: () => {},
  realtimeEnabled: REALTIME_ENABLED,
});

const EVENTS = [
  "transaction:changed",
  "account:changed",
  "category:changed",
  "budget:changed",
  "debt:changed",
  "member:changed",
  "business:changed",
  "savings:changed",
];

export function SocketProvider({ children }: { children: ReactNode }) {
  const { token, business } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!REALTIME_ENABLED || !token) {
      setSocket(null);
      setConnected(false);
      return;
    }

    const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
    const s = io(url, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));

    EVENTS.forEach((event) => {
      s.on(event, () => bump());
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [token, bump]);

  useEffect(() => {
    if (!REALTIME_ENABLED || !socket || !business?.id) return;
    socket.emit("join:business", business.id);
    return () => {
      socket.emit("leave:business", business.id);
    };
  }, [socket, business?.id]);

  const value = useMemo(
    () => ({ socket, connected, version, bump, realtimeEnabled: REALTIME_ENABLED }),
    [socket, connected, version, bump]
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

/** Re-fetch on mount, when fetcher deps change, and when version bumps (socket atau bump lokal). */
export function useRealtimeRefresh(fetcher: () => void | Promise<void>) {
  const { version } = useSocket();
  useEffect(() => {
    void fetcher();
  }, [version, fetcher]);
}
