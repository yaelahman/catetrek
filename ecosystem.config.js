/**
 * PM2 ecosystem — Catetrek
 *
 * Usage (production server):
 *   cd /var/www/catetrek
 *   # adjust cwd paths below if deploy path differs
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *
 * Rebuild before restart when code changes:
 *   (frontend) npm run build
 *   (backend)  npx prisma db push && npx prisma generate && npm run build
 *   pm2 restart ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: "catetrek-frontend",
      cwd: "/var/www/catetrek/frontend", // CHANGE if deploy path differs
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "800M",
      node_args: "--max-old-space-size=768",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        NEXT_PUBLIC_API_URL: "https://api.catetrek.com",
        NEXT_PUBLIC_SOCKET_URL: "https://api.catetrek.com",
        NEXT_PUBLIC_REALTIME: "false",
      },
    },
    {
      name: "catetrek-backend",
      cwd: "/var/www/catetrek/backend", // CHANGE if deploy path differs
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      node_args: "--max-old-space-size=512",
      // Secrets (DATABASE_URL, JWT_SECRET, …) loaded by dotenv from backend/.env
      env: {
        NODE_ENV: "production",
        PORT: 4001,
        FRONTEND_URL: "https://catetrek.com",
        UPLOAD_DIR: "./uploads",
      },
    },
  ],
};
