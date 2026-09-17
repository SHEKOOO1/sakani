import knex from 'knex';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { assertProductionDbConfig, describeDbConfigRejection } from '../src/backend/config/db-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// حماية FAIL-CLOSED: لا كلمة مرور/بيانات قاعدة مضمّنة — كل شيء من البيئة.

const password = process.env.SET_ALL_USERS_PASSWORD;
if (!password || password.trim().length < 12) {
  console.error(
    '❌ SET_ALL_USERS_PASSWORD غير مضبوط (12 حرفًا على الأقل). هذا السكربت يعيد تعريف كلمة مرور كل المستخدمين — لا يُسمح بأي قيمة افتراضية.'
  );
  process.exit(1);
}
const WEAK = new Set(['123456', 'admin123', 'password', 'changeme', '12345678']);
if (WEAK.has(password.toLowerCase())) {
  console.error('❌ SET_ALL_USERS_PASSWORD قيمة افتراضية/ضعيفة معروفة. رُفض التشغيل.');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production' && process.env.SET_ALL_USERS_PASSWORD_ALLOW_PRODUCTION !== 'true') {
  console.error(
    '❌ رُفض إعادة تعريف كلمات المرور في الإنتاج. اضبط SET_ALL_USERS_PASSWORD_ALLOW_PRODUCTION=true للموافقة الصريحة.'
  );
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === 'production';

// P1-SCR-1: enforce the same production DB hardening as the app (no `sa`, no
// weak password, no missing vars) and never disable TLS in production.
const dbConfigCheck = assertProductionDbConfig(process.env);
if (!dbConfigCheck.ok) {
  console.error(`❌ DB configuration ${describeDbConfigRejection(dbConfigCheck)}. Refusing to run.`);
  process.exit(1);
}
if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD غير مضبوط. رُفض التشغيل.');
  process.exit(1);
}

let dbCa: { ca: string } | undefined;
if (process.env.DB_SSL_CA_PATH) {
  try {
    dbCa = { ca: fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8') };
  } catch {
    console.error('❌ DB_SSL_CA_PATH مضبوط لكن تعذّر قراءة شهادة CA. رُفض التشغيل.');
    process.exit(1);
  }
}

const kdb = knex({
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST || (isProduction ? undefined : '127.0.0.1'),
    user: process.env.DB_USER || (isProduction ? undefined : 'sa'),
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || (isProduction ? undefined : 'DormMaster'),
    port: parseInt(process.env.DB_PORT || '1433', 10),
    options: {
      encrypt: isProduction,
      trustServerCertificate: !isProduction,
      enableArithAbort: true,
      connectTimeout: 10000,
      ...(dbCa ? { cryptoCredentialsDetails: dbCa } : {}),
    },
  },
  pool: { min: 1, max: 1 },
});

try {
  // نفس الميكانيزم المستخدم في seed-admin: رفع token_version مع تغيير كلمة
  // المرور في نفس التحديث ⇒ إبطال كل الجلسات القديمة.
  const hash = await bcrypt.hash(password, 10);
  await kdb('users').update({ password: hash, token_version: kdb.raw('token_version + 1') });
  console.log('✅ تم تحديث كلمة مرور كل المستخدمين وإبطال كل الجلسات القديمة.');
} catch (e: any) {
  console.error('ERR: ' + e.message);
  process.exitCode = 1;
}
await kdb.destroy();
console.log('DONE');