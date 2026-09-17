/**
 * ═══════════════════════════════════════════════════════════════════
 * seed-admin-lib — منطق نقيّ (بلا قاعدة بيانات) لتأمين سكربت seed-admin.
 *
 * يُفصل هنا حتى يمكن اختباره بشكل حتمي، وحتى لا يعتمد السكربت الرئيسي
 * على كلمات مرور مضمّنة في الكود. كل الدوال FAIL-CLOSED: أي إدخال غير
 * آمن يُرفض ولا يسمح بأي كتابة صلاحيات على قاعدة البيانات.
 * ═══════════════════════════════════════════════════════════════════
 */

/** الحد الأدنى لطول كلمة مرور المدير المسموح بها. */
export const MIN_SEED_ADMIN_PASSWORD_LENGTH = 12;

/**
 * كلمات مرور افتراضية/ضعيفة معروفة — يُرفض استخدامها صراحةً حتى لا
 * يُعاد إدخال أي قيمة من القيم المسرّبة سابقًا أو الشائعة.
 * (التحقق مقارنةً بحروف صغيرة — لا يُخزَّن أي سر هنا، فقط قائمة منع).
 */
const KNOWN_WEAK_PASSWORDS = new Set([
  'admin123',
  'admin',
  'password',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'changeme',
  'change-me',
  'letmein',
  'qwerty',
  'test123',
  'welcome',
  'default',
  'secret',
  'sakani',
]);

export interface ValidationResult {
  ok: boolean;
  message?: string;
}

/** بريد حساب المدير: من البيئة أو القيمة الافتراضية التقليدية. */
export function resolveSeedAdminEmail(env: NodeJS.ProcessEnv = process.env): string {
  return (env.SEED_ADMIN_EMAIL || 'admin@sakani.com').trim().toLowerCase();
}

/**
 * فحص كلمة مرور المدير قبل الإعداد/إعادة التعيين — FAIL-CLOSED:
 *   - مفقودة أو فارغة ⇐ رفض (لا كلمة مرور افتراضية إطلاقًا).
 *   - أقصر من الحد الأدنى ⇐ رفض.
 *   - ضمن قائمة الكلمات الضعيفة المعروفة ⇐ رفض.
 *   - تساوي كلمة `DEFAULT_USER_PASSWORD` الموثّقة ⇐ رفض (منع سلسلة
 *     بيانات الاعتماد الافتراضية).
 */
export function validateSeedAdminPassword(
  password: unknown,
  env: NodeJS.ProcessEnv = process.env
): ValidationResult {
  if (typeof password !== 'string' || password.trim().length === 0) {
    return {
      ok: false,
      message:
        'SEED_ADMIN_PASSWORD غير مضبوط. لا توجد كلمة مرور افتراضية؛ عيّن كلمة مرور قوية (12 حرفًا على الأقل) في البيئة قبل التشغيل.',
    };
  }
  if (password.length < MIN_SEED_ADMIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      message: `SEED_ADMIN_PASSWORD يجب ألا تقل عن ${MIN_SEED_ADMIN_PASSWORD_LENGTH} حرفًا.`,
    };
  }
  if (KNOWN_WEAK_PASSWORDS.has(password.toLowerCase())) {
    return {
      ok: false,
      message: 'SEED_ADMIN_PASSWORD قيمة افتراضية/ضعيفة معروفة. رُفض التشغيل.',
    };
  }
  const documentedDefault = env.DEFAULT_USER_PASSWORD;
  if (documentedDefault && password === documentedDefault) {
    return {
      ok: false,
      message: 'SEED_ADMIN_PASSWORD يجب ألا تعيد استخدام كلمة المرور الافتراضية الموثّقة للمستخدمين.',
    };
  }
  return { ok: true };
}

/**
 * حماية الإنتاج: يُرفض تشغيل السكربت في الإنتاج إلا بموافقة صريحة عبر
 * `SEED_ADMIN_ALLOW_PRODUCTION=true` (يمنع التشغيل العرضي ضد بيانات حقيقية).
 */
export function assertSeedAdminProductionSafety(
  env: NodeJS.ProcessEnv = process.env
): ValidationResult {
  if (env.NODE_ENV === 'production' && env.SEED_ADMIN_ALLOW_PRODUCTION !== 'true') {
    return {
      ok: false,
      message:
        'رُفض إعداد حساب المدير في بيئة الإنتاج. لتفعيل ذلك صراحةً اضبط SEED_ADMIN_ALLOW_PRODUCTION=true (واعلم أنه يستبدل بيانات اعتماد حساب مدير حقيقي).',
    };
  }
  return { ok: true };
}

/**
 * بناء تحديث إعادة تعيين كلمة مرور المدير: يضمن رفع `token_version`
 * بنفس التحديث حتى تُبطَل كل جلسات JWT القديمة (نفس آلية Batch #3).
 * لا ينشئ آلية إبطال ثانية.
 */
export function buildAdminPasswordReset(
  existing: { token_version?: number | string | null } | null | undefined,
  hashedPassword: string
): { password: string; token_version: number } {
  const current = Number(existing?.token_version ?? 0);
  const currentVersion = Number.isFinite(current) && current >= 0 ? current : 0;
  return { password: hashedPassword, token_version: currentVersion + 1 };
}
