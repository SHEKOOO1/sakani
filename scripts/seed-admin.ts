import knex from 'knex';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';
import config from '../knexfile';
import {
  resolveSeedAdminEmail,
  validateSeedAdminPassword,
  assertSeedAdminProductionSafety,
  buildAdminPasswordReset,
} from './seed-admin-lib';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  // ── حماية FAIL-CLOSED قبل أي اتصال/كتابة ──────────────────────────
  // لا كلمة مرور افتراضية إطلاقًا: تُقرأ من البيئة فقط.
  const email = resolveSeedAdminEmail();
  const password = process.env.SEED_ADMIN_PASSWORD;

  const productionCheck = assertSeedAdminProductionSafety();
  if (!productionCheck.ok) {
    console.error(`❌ ${productionCheck.message}`);
    process.exit(1);
  }

  const passwordCheck = validateSeedAdminPassword(password);
  if (!passwordCheck.ok) {
    console.error(`❌ ${passwordCheck.message}`);
    process.exit(1);
  }

  const connection = process.env.NODE_ENV === 'production'
    ? (config as any).production
    : (config as any).development;
  const kdb = knex(connection);
  try {
    const existing = await kdb('users').where({ email }).first();
    // نفس تكلفة bcrypt المستخدمة في بقية التطبيق (10) — لا تُوَهَّن.
    const hashed = await bcrypt.hash(password as string, 10);

    if (existing) {
      // إعادة تعيين: رفع token_version بنفس التحديث ⇒ إبطال كل JWT قديم.
      const reset = buildAdminPasswordReset(existing, hashed);
      await kdb('users').where({ id: existing.id }).update(reset);
      console.log(`✅ تمت إعادة تعيين كلمة مرور المدير (${email}) وتم إبطال الجلسات القديمة.`);
    } else {
      await kdb('users').insert({
        id: uuidv4(),
        tenant_id: null,
        email,
        password: hashed,
        role: 'admin',
        name: 'مدير النظام',
        gender: 'male',
        token_version: 0,
        daily_readings_enabled: 1,
        radio_514_enabled: 1,
      });
      console.log(`✅ تم إنشاء حساب المدير: ${email}`);
    }
  } catch (e: any) {
    // لا نطبع أي كلمة مرور — الرسالة فقط.
    console.error('ERR:', e.message);
    process.exitCode = 1;
  } finally {
    await kdb.destroy();
  }
}

main();
