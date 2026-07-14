import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { verifyToken } from "./utils/jwt";

let io: Server | null = null;

export function initSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token =
        (socket.handshake.auth?.token as string) ||
        (socket.handshake.headers.authorization as string)?.replace("Bearer ", "");
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyToken(token);
      (socket as typeof socket & { userId: string }).userId = payload.userId;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join:business", (businessId: string) => {
      if (businessId) socket.join(`business:${businessId}`);
    });

    socket.on("leave:business", (businessId: string) => {
      if (businessId) socket.leave(`business:${businessId}`);
    });
  });

  return io;
}

export function emitBusiness(businessId: string, event: string, payload: unknown) {
  if (!io) return;
  io.to(`business:${businessId}`).emit(event, payload);
}

export function getIO() {
  return io;
}
