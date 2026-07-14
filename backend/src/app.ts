import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import path from "path";
import authRoutes from "./routes/auth";
import accountRoutes from "./routes/accounts";
import categoryRoutes from "./routes/categories";
import transactionRoutes from "./routes/transactions";
import budgetRoutes from "./routes/budgets";
import debtRoutes from "./routes/debts";
import dashboardRoutes from "./routes/dashboard";
import reportRoutes from "./routes/reports";
import businessRoutes from "./routes/businesses";
import savingsRoutes from "./routes/savings";
import adminRoutes from "./routes/admin";

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use("/uploads", express.static(path.resolve(process.env.UPLOAD_DIR || "./uploads")));

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Catetrek API OK", time: new Date().toISOString() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/businesses", businessRoutes);
  app.use("/api/accounts", accountRoutes);
  app.use("/api/categories", categoryRoutes);
  app.use("/api/transactions", transactionRoutes);
  app.use("/api/budgets", budgetRoutes);
  app.use("/api/debts", debtRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/savings", savingsRoutes);
  app.use("/api/admin", adminRoutes);

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Endpoint tidak ditemukan" });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    if (err?.name === "MulterError") {
      return res.status(400).json({ success: false, message: err.message });
    }
    return res.status(500).json({ success: false, message: "Terjadi kesalahan server" });
  });

  return app;
}
