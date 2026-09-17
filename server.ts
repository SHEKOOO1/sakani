import dotenv from "dotenv";
dotenv.config();

// Global error handlers to prevent server crashes
const logError = (label: string, err: unknown) => {
  const ts = new Date().toISOString();
  const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
  console.error(`[${ts}] ${label}\n${msg}`);
};
process.on('unhandledRejection', (reason) => {
  logError('UNHANDLED PROMISE REJECTION', reason);
});
process.on('uncaughtException', (err) => {
  logError('UNCAUGHT EXCEPTION', err);
});

let activeHttpServer: import("http").Server | null = null;
let activeKnex: any = null;

const gracefulShutdown = async (signal: string) => {
  console.log(`\n⚠️  ${signal} received — shutting down gracefully...`);
  if (activeHttpServer) {
    await new Promise<void>((resolve) => activeHttpServer!.close(() => resolve()));
    console.log('✅ HTTP server closed');
  }
  if (activeKnex) {
    try { await activeKnex.destroy(); console.log('✅ Knex pool closed'); } catch { /* ok */ }
  }
  try {
    const { poolPromise: rawPool } = await import('./src/backend/infrastructure/knex.ts');
    const pool = await rawPool;
    if (pool) { await pool.close(); console.log('✅ MSSQL pool closed'); }
  } catch { /* pool may already be closed */ }
  process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import cookieParser from "cookie-parser";
import fs from "fs";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeDb } from "./src/backend/infrastructure/db.ts";
import { validateJwtSecret, describeJwtSecretRejection, MIN_JWT_SECRET_LENGTH } from "./src/backend/config/jwt-secret.ts";
import { assertProductionDbConfig, describeDbConfigRejection } from "./src/backend/config/db-config.ts";
import { resolveCorsOrigins, describeCorsRejection } from "./src/backend/config/cors-config.ts";
import authRoutes from "./src/backend/api/auth.routes.ts";
import tenantRoutes from "./src/backend/api/tenant.routes.ts";
import apartmentRoutes from "./src/backend/api/apartment.routes.ts";
import roomRoutes from "./src/backend/api/room.routes.ts";
import financeRoutes from "./src/backend/api/finance.routes.ts";
import eventRoutes from "./src/backend/api/event.routes.ts";
import studentRoutes from "./src/backend/api/students/index.ts";
import attendanceRoutes from "./src/backend/api/attendance.routes.ts";
import maintenanceRoutes from "./src/backend/api/maintenance.routes.ts";
import laundryRoutes from "./src/backend/api/laundry.routes.ts";
import inventoryRoutes from "./src/backend/api/inventory.routes.ts";
import userRoutes from "./src/backend/api/user.routes.ts";
import statsRoutes from "./src/backend/api/stats.routes.ts";
import reportsRoutes from "./src/backend/api/reports.routes.ts";
import notificationsRoutes from "./src/backend/api/notifications.routes.ts";
import auditRoutes from "./src/backend/api/audit.routes.ts";
import employeesRoutes from "./src/backend/api/employees.routes.ts";
import adminManagementRoutes from "./src/backend/api/admin_management.routes.ts";
import behaviorRoutes from "./src/backend/api/behavior.routes.ts";
import competitionsRoutes from "./src/backend/api/competitions.routes.ts";
import decisionsRoutes from "./src/backend/api/decisions.routes.ts";
import priestRoutes from "./src/backend/api/priest.routes.ts";
import parentRoutes from "./src/backend/api/parent.routes.ts";
import dashboardRoutes from "./src/backend/api/dashboard.routes.ts";
import broadcastRoutes from "./src/backend/api/broadcast.routes.ts";
import supervisorRoutes from "./src/backend/api/supervisor.routes.ts";
import badgesRoutes from "./src/backend/api/badges.routes.ts";
import paymentRoutes from "./src/backend/api/payment.routes.ts";
import radioRoutes from "./src/backend/api/radio.routes.ts";
import itemManagersRoutes from "./src/backend/api/itemManagers.routes.ts";
import uploadsRoutes from "./src/backend/api/uploads.routes.ts";
import { startRadiojarService } from "./src/backend/services/radiojar.service.ts";
import { auditLogger, sanitizeInput, authenticate, authorizePermission, resolveSocketUser } from "./src/backend/api/middleware.ts";
import { AppPermission } from "./src/types/permissions.ts";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./src/backend/infrastructure/swagger.ts";

// Periodic upload cleanup (every 6 hours)
setInterval(() => {
  const uploadDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadDir)) return;
  const now = Date.now();
  const maxAge = 30 * 24 * 60 * 60 * 1000;
  for (const sub of fs.readdirSync(uploadDir)) {
    const subPath = path.join(uploadDir, sub);
    try {
      if (fs.statSync(subPath).isDirectory()) {
        for (const file of fs.readdirSync(subPath)) {
          const filePath = path.join(subPath, file);
          const age = now - fs.statSync(filePath).mtimeMs;
          if (age > maxAge) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old upload: ${filePath}`);
          }
        }
      }
    } catch {}
  }
}, 6 * 60 * 60 * 1000);

// Validate required environment variables (fail closed; the value is never logged)
const jwtValidation = validateJwtSecret(process.env.JWT_SECRET);
if (!jwtValidation.ok) {
  console.error(
    `❌ ERROR: JWT_SECRET ${describeJwtSecretRejection(jwtValidation.reason)}. ` +
      `Set a strong unique secret (>= ${MIN_JWT_SECRET_LENGTH} chars) in .env or the environment.`,
  );
  process.exit(1);
}
// DB config: production FAILS CLOSED on missing/weak credentials or `sa`;
// development keeps the permissive warning (local SQL Express is valid there).
const dbConfigCheck = assertProductionDbConfig(process.env);
if (!dbConfigCheck.ok) {
  console.error(
    `❌ ERROR: database configuration ${describeDbConfigRejection(dbConfigCheck)}. ` +
      `Set DB_HOST, DB_NAME, DB_USER and DB_PASSWORD (a dedicated non-sa account) in the production environment.`,
  );
  process.exit(1);
}
if (process.env.NODE_ENV !== 'production') {
  const dbVars = [
    { key: 'DB_HOST', label: 'DB_HOST' },
    { key: 'DB_USER', label: 'DB_USER' },
    { key: 'DB_PASSWORD', label: 'DB_PASSWORD' },
    { key: 'DB_NAME', label: 'DB_NAME' },
  ];
  for (const { key, label } of dbVars) {
    if (!process.env[key]) {
      console.warn(`⚠️  WARNING: ${label} is not set in .env — will try default connection`);
    }
  }
}

// CORS: production FAILS CLOSED unless CORS_ORIGIN is an explicit, valid origin
// (never `*`, never a silent localhost fallback). Development/test keep the
// permissive local workflow. The same resolved list is shared by Express CORS,
// Socket.IO and the CSRF origin check.
const corsConfig = resolveCorsOrigins(process.env);
if (!corsConfig.ok) {
  console.error(
    `❌ ERROR: CORS_ORIGIN ${describeCorsRejection(corsConfig.reason)}. ` +
      `Set CORS_ORIGIN to your production frontend origin(s) in the environment.`,
  );
  process.exit(1);
}

// Initialize DB
await initializeDb();

// Auto-run pending migrations
try {
  const { kdb } = await import('./src/backend/infrastructure/knex');
  activeKnex = kdb;
  const [batch, migrations] = await kdb.migrate.latest();
  if (migrations.length > 0) {
    console.log(`✅ Migrations up: batch ${batch}, ${migrations.length} file(s)`);
  }
} catch (migrationError) {
  console.warn('⚠️  Migration auto-run skipped:', migrationError instanceof Error ? migrationError.message : String(migrationError));
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  activeHttpServer = httpServer;
  const io = new Server(httpServer, {
    cors: {
      // Same validated origin list as Express CORS / CSRF (corsConfig is
      // resolved once at startup and fails closed in production).
      origin: corsConfig.origins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  // Make io available globally for routes to emit events
  (global as any).__io = io;

  const PORT = parseInt(process.env.PORT || '3000', 10);

  // HTTPS redirect (behind proxy like Nginx)
  if (process.env.ENFORCE_HTTPS === 'true') {
    app.use((req, res, next) => {
      const proto = req.headers['x-forwarded-proto'] || req.protocol;
      if (proto !== 'https' && req.method !== 'HEALTH') {
        return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      }
      next();
    });
  }

  // Sentry integration (optional via SENTRY_DSN env)
  if (process.env.SENTRY_DSN) {
    try {
      const Sentry = await import('@sentry/node');
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      });
      app.use(Sentry.Handlers.requestHandler());
      console.log('✅ Sentry initialized');
    } catch (e) {
      console.warn('⚠️  Sentry DSN set but @sentry/node not installed');
    }
  }

  // Security headers
  const isProd = process.env.NODE_ENV === 'production';
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          // Vite/React HMR need unsafe-inline in dev; production removes eval
          ...(isProd ? [] : ["'unsafe-inline'", "'unsafe-eval'"]),
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
          "https://s.ytimg.com",
          "https://cdn.jsdelivr.net",
          "https://connect.facebook.net",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https://*.radiojar.com", "https://radiojar-lib.appspot.com", "https://i.ytimg.com", "https://img.youtube.com", "https://*.fbcdn.net", "https://*.cdninstagram.com", "https://*.whatsapp.net"],
        connectSrc: ["'self'", "https://*.radiojar.com", "https://www.googleapis.com", "https://graph.facebook.com", "https://oembed.com", "https://www.youtube.com", ...(isProd ? [] : ["ws://localhost:24678", "ws://localhost:5173"])],
        frameSrc: ["'self'", "https://www.youtube.com", "https://www.youtube-nocookie.com", "https://www.facebook.com", "https://connect.facebook.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        mediaSrc: ["'self'", "https://*.radiojar.com", "blob:"],
        workerSrc: ["'self'", "blob:"],
        manifestSrc: ["'self'"],
      },
    },
  }));

  // CORS محدود — نفس القائمة المُتحقَّق منها عند الإقلاع (corsConfig)
  const allowedOrigins = corsConfig.origins;
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());

  // CSRF protection via Origin/Referer validation (defense-in-depth for JWT-based auth)
  // Always enabled — Bearer tokens in headers are immune but cookies (+ fallback token) are not.
  const isLocalDevHost = (host: string) => {
    const hostname = host?.split(':')[0];
    return ['localhost', '127.0.0.1', '::1', '0.0.0.0', '192.168'].some(h => hostname === h || hostname?.startsWith(h));
  };
  // التساهل مع الطلبات المحلية يُقفل في الإنتاج إلا إذا فُعّل صراحةً
  const allowLocalFallback = process.env.NODE_ENV !== 'production' || process.env.CSRF_ALLOW_LOCAL === 'true';
  app.use((req, res, next) => {
    // Skip for GET/HEAD/OPTIONS and health endpoint
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || req.path === '/api/health') {
      return next();
    }
    const authHeader = req.headers['authorization'] as string | undefined;
    if (authHeader?.startsWith('Bearer ')) {
      return next();
    }
    const origin = req.headers['origin'] as string | undefined;
    const referer = req.headers['referer'] as string | undefined;
    const source = origin || referer;
    if (!source) {
      // إذا الطلب بدون Origin/Referer ومصدره محلي، نسامحه (بشروط في الإنتاج)
      if (allowLocalFallback && isLocalDevHost(req.headers['host'] || '')) {
        console.warn(`[CSRF] No origin/referer from local host ${req.headers['host']} — allowing for dev`);
        return next();
      }
      return res.status(403).json({ success: false, message: 'CSRF: Missing origin or referer header.' });
    }
    try {
      const parsed = new URL(source);
      console.log(`[CSRF] source=${source} parsed.origin=${parsed.origin} | allowed=${allowedOrigins} | host=${req.headers['host']}`);
      const allowed = allowedOrigins.some((o: string) => {
        try {
          const allowedParsed = new URL(o);
          if (allowedParsed.origin === parsed.origin) return true;
          if (allowLocalFallback && allowedParsed.port === parsed.port && isLocalDevHost(allowedParsed.hostname) && isLocalDevHost(parsed.hostname) && allowedParsed.protocol === parsed.protocol) return true;
          return false;
        } catch { return o === '*' || parsed.origin === o; }
      });
      // أيضاً نسمح إذا الطلب من السيرفر نفسه (localhost:3000) — حصراً في التطوير/الحالات المفعلة
      if (!allowed && !allowedOrigins.includes('*')) {
        const host = req.headers['host'] as string | undefined;
        if (allowLocalFallback && host && isLocalDevHost(host)) {
          console.warn(`[CSRF] origin ${parsed.origin} not in allowed list, but host ${host} is local — allowing`);
          return next();
        }
        return res.status(403).json({ success: false, message: 'CSRF: Invalid origin.' });
      }
    } catch {
      return res.status(403).json({ success: false, message: 'CSRF: Malformed origin header.' });
    }
    next();
  });

  // Serve static files
  app.use('/uploads', uploadsRoutes);
  app.use('/img', express.static(path.join(process.cwd(), 'img')));

  // Health endpoint before rate limiter so monitoring always works
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const isTest = process.env.NODE_ENV === 'test';

  // Rate limiting عام على كل الـ API (5000 طلب/دقيقة)
  const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 5000,
    message: { success: false, message: "Too many requests, please try again later." },
    skip: (req) => isTest
      || req.path.startsWith('/uploads/')
      || req.path.startsWith('/health')
      || (req.method === 'GET' && (req.path.startsWith('/notifications') || req.path.startsWith('/students/') && req.path.endsWith('/export-profile') || req.path.endsWith('/toggle-services'))),
  });

  app.use("/api/", generalLimiter);

  // Rate limiting خاص بالراديو — لكل endpoint على حدة
  const radioReadLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 120, skip: () => isTest });
  const radioWriteLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 30, skip: () => isTest });
  const radioChatLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 20, skip: () => isTest });
  app.use("/api/radio", (req, res, next) => {
    if (req.method === 'GET') return radioReadLimiter(req, res, next);
    if (req.path.includes('/chat/messages') && req.method === 'POST') return radioChatLimiter(req, res, next);
    return radioWriteLimiter(req, res, next);
  });

  // Rate limiting صارم للـ endpoints الحساسة (POST only)
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { success: false, message: "محاولات دخول كثيرة جداً. استنى شوية." }, skip: () => isTest });
  app.use("/api/auth/login", (req, res, next) => {
    if (req.method === 'POST') return authLimiter(req, res, next);
    next();
  });
  app.use("/api/auth/register", (req, res, next) => {
    if (req.method === 'POST') return authLimiter(req, res, next);
    next();
  });
  app.use("/api/auth/logout", rateLimit({ windowMs: 15 * 60 * 1000, max: 30, skip: () => isTest }));


  const broadcastLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 60, skip: () => isTest });
  app.use("/api/broadcasts", broadcastLimiter);

  const uploadLimiter = rateLimit({ windowMs: 1 * 60 * 1000, max: 20, skip: () => isTest });
  app.use("/api/students", (req, res, next) => {
    if (req.method === 'POST' || req.path.includes('/files') || req.path.includes('/priest-upload')) {
      return uploadLimiter(req, res, next);
    }
    next();
  });
  app.use(express.json({ limit: '2mb' }));
  app.use(sanitizeInput);

  // Request timeout — 30s for normal, 120s for uploads
  app.use((req, res, next) => {
    const isUpload = req.path.startsWith('/api/students') && (req.method === 'POST' || req.path.includes('/files'));
    req.setTimeout(isUpload ? 120000 : 30000);
    next();
  });

  // Audit log middleware records every request in DB and console
  app.use(auditLogger);

  // --- Swagger UI (محمي بمصادقة الأدمن) ---
  app.use("/api-docs", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none } .swagger-ui { direction: ltr }',
    customSiteTitle: 'Sakani API Docs',
  }));

  // --- API Routes ---
  app.use("/api/auth", authRoutes);
  app.use("/api/tenants", tenantRoutes);
  app.use("/api/apartments", apartmentRoutes);
  app.use("/api/rooms", roomRoutes);
  app.use("/api/finances", financeRoutes);
  app.use("/api/events", eventRoutes);
  app.use("/api/students", studentRoutes);
  app.use("/api/attendance", attendanceRoutes);
  app.use("/api/maintenance", maintenanceRoutes);
  app.use("/api/laundry", laundryRoutes);
  app.use("/api/inventory", inventoryRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/stats", statsRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/employees", employeesRoutes);
  app.use("/api/admin", adminManagementRoutes);
  app.use("/api/behavior", behaviorRoutes);
  app.use("/api/competitions", competitionsRoutes);
  app.use("/api/decisions", decisionsRoutes);
  app.use("/api/priest", priestRoutes);
  app.use("/api/parents", parentRoutes);
  app.use("/api/dashboard", dashboardRoutes);
  app.use("/api/audit", auditRoutes);
  app.use("/api/broadcasts", broadcastRoutes);
  app.use("/api/supervisor", supervisorRoutes);
  app.use("/api/badges", badgesRoutes);
  app.use("/api/payments", paymentRoutes);
  app.use("/api/radio", radioRoutes);
app.use("/api/items", itemManagersRoutes);

  // روابط /api غير معروفة → 404 JSON موحّد (بدل تسريبات Vite أو رسائل الخطأ)
  app.use("/api", (req: express.Request, res: express.Response) => {
    res.status(404).json({ success: false, message: "المسار غير موجود" });
  });

  // Start Radiojar background polling service
  startRadiojarService();

  // Global error handler - يمنع تسريب تفاصيل قاعدة البيانات
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err?.message || err);
    try {
      const Sentry = global.__SENTRY__;
      if (Sentry?.captureException) Sentry.captureException(err);
    } catch {}
    res.status(err?.status || 500).json({
      success: false,
      message: "حصل خطأ فني. لو سمحت كرر المحاولة أو تواصل مع الدعم الفني."
    });
  });

  // --- Socket.io Logic with JWT Auth (mirrors HTTP authenticate: blacklist + user-exists + role/tenant recheck) ---
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (!token) return next(new Error("Authentication required"));
      (socket as any).user = await resolveSocketUser(token as string);
      next();
    } catch (err: any) {
      next(new Error(err?.message || "Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user;
    console.log(`Client connected: ${socket.id} (user: ${user?.id || 'unknown'})`);

    socket.on("join-tenant", (tenantId: string) => {
      const userTenantIds: string[] = user?.tenantIds || [];
      const allowed = user?.role === 'admin' || userTenantIds.includes(tenantId) || user?.tenantId === tenantId;
      if (!allowed) {
        return socket.emit("error", { message: "Unauthorized" });
      }
      socket.join(`tenant-${tenantId}`);
    });

    socket.on("join-user", (userId: string) => {
      if (user?.id !== userId && user?.role !== 'admin') {
        return socket.emit("error", { message: "Unauthorized" });
      }
      socket.join(`user-${userId}`);
    });

    socket.on("disconnect", () => {
      // cleaned up automatically
    });
  });

  // --- Vite / Frontend Serving ---
  if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);

    // تأمين عمل الـ SPA في بيئة التطوير وتحويل index.html برمجياً
    app.get("*", async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      if (req.originalUrl === '/manifest.webmanifest' || req.originalUrl === '/sw.js' || req.originalUrl === '/registerSW.js' || req.originalUrl.startsWith('/workbox-')) return next();
      try {
        let template = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
