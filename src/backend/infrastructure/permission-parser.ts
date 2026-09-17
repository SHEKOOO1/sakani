import {
  UserRole,
  isValidPermission,
  VALID_PERMISSIONS,
  validatePermissionArray,
} from "../../types/permissions";

/**
 * ═══════════════════════════════════════════════════════════════════
 * محلِّل صلاحيات صارم (FAIL-CLOSED) — وحدة نقية بلا الاعتماد على قاعدة
 * بيانات، توحّد كل مسارات "الكتابة إلى الصلاحيات" على سلوك واحد.
 *
 * القاعدة الذهبية (الأمان بالتصميم):
 *  1. القيمة المُخزَّنة (custom_permissions، permissions الخاصة بدور مخصص)
 *     تكون صالحةً **فقط** إذا كانت مصفوفة JSON من نصوص مسموحة.
 *     أي شيء آخر — سلسلة نصية (مثل `"ALL"`)، كائن، رقم، null — يُرفض
 *     (يُرجَّع []) فلا تُمنح أي صلاحية.
 *  2. `ALL` (صلاحية "كل الصلاحيات") لا تُقرأ أبدًا كمصفوفة مخزّنة: عنصر
 *     `"ALL"` داخل مصفوفة مخزّنة لا يمنح شيئًا بمعزلٍ عن الدور — منحها
 *     الفعلي قرار سياسةٍ يُدعَّم في canGrantSubset (permission-grants.ts)
 *     لأنه يحتاج دور المستخدم الحالي، بينما هنا نرفض فقط أي قيمة زائفة.
 *  3. элементы غير معروفة (مثل صلاحية "MANAGE_BISHOPS" الوهمية المسرّبة
 *     في سيناريو التصعيد) تُرفض صراحةً — لا «نُقلّد» صلاحيةً غير معروفة
 *     لأن المحلِّل نفسه لا يعرفها فيرفضها (لا تُمنح).
 *
 * ملاحظة أمنية هامة: هذا الملف يجب أن يبقى "نقيًّا" (بلا استيراد db/knex)
 * حتى تُستخدم دواله داخل أي طبقة (routes/middleware/db) دون تحميل قاعدة.
 *
 * أي تعديل في الصلاحيات يجب أن يمرّ عبر هذه الدالة أو عبر canGrantSubset —
 * لا يجوز أن يكتب أي مسار "قوائم صلاحيات مخزّنة" بخارج هذه الطبقة.
 */

/** نتيجة تحليل قيمة صلاحيات مخزّنة (من قاعدة البيانات). */
export interface ParsedStoredResult {
  /** مصفوفة الصلاحيات الصالحة ([] عندما كانت القيمة غير صالحة/غير مصفوفة). */
  perms: string[];
  /** هل كانت القيمة الأصلية مصفوفة؟ (يُستخدم للتدقيق/التسجيل). */
  wasArray: boolean;
  /** القيمة الخام (للتصحيح/سجلات التدقيق). */
  raw: any;
}

/**
 * تحليل قيمة صلاحيات مخزّنة (custom_permissions أو permissions لدور مخصص)
 * بشكل صارم آمن.
 *
 * FAIL-CLOSED:
 * - غير مصفوفة (سلسلة نصية مثل `"ALL"` أو كائن أو رقم أو null) ⇐ تُرجَّع
 *   [] و wasArray=false. حتى وإن كانت السلسلة تحتوي على كلمة "ALL" — لأن
 *   السلسلةَ لا تُعدُّ مصفوفةً أبدًا، فلا يحق لنا قراءة أي صلاحية منها.
 * - مصفوفة تحتوي على عناصر غير معروفة (بما فيها 'ALL' لغير مدير التطبيق
 *   عند الاستخدام المنفرد) ⇐ تُسقَط تلك العناصر (لا تُمنح). وبما أن
 *   «ALL» تُدار بالكامل في canGrantSubset (لا تُقرأ كمصفوفة مخزّنة)،
 *   نستبعدها هنا من القائمة المعتمَدة للمدقق العام.
 */
export function parseStoredPermissionsArray(value: any): ParsedStoredResult {
  if (!Array.isArray(value)) {
    return { perms: [], wasArray: false, raw: value };
  }

  const cleaned: string[] = [];
  for (const p of value) {
    if (typeof p !== 'string') continue;
    const perm = p.toUpperCase().trim();
    if (!isValidPermission(perm)) continue;
    // استبعاد 'ALL' من القائمة "المخزّنة" المعتمدة للمدقق العام — لأن منح
    // ALL هو قرار سياسةٍ يمرّ عبر canGrantSubset (انظر permission-grants.ts).
    if (perm === 'ALL') continue;
    if (!cleaned.includes(perm)) cleaned.push(perm);
  }
  return { perms: cleaned, wasArray: true, raw: value };
}

/** نوع ناتج فحص مدخلات صلاحيات مرسلة من المستخدم الحالي (قبل التعيين). */
export interface PermissionInputResult {
  ok: boolean;
  status?: number;
  message?: string;
  permissions?: string[];
}

/**
 * فحص صارم (FAIL-CLOSED) لمصفوفة صلاحيات مرسَلة من قِبل المستخدم الحالي
 * لتعيينها على مستخدم آخر أو على دور مخصص.
 *
 * - غير مصفوفة (سلسلة نصية، كائن، رقم، null / undefined) ⇐ 400.
 * - `"ALL"` لغير Admin ⇐ 403.
 * - صلاحية غير معروفة أو عنصر غير نصي ⇐ 400.
 *
 * ملاحظة: منح "ALL" مسموح فقط لمدير التطبيق (Admin) — يتم عبر هذه الدالة
 * عبر حقل `granterRole`. القرار النهائي (التحقق من الدور + النطاق) يتم
 * في canGrantSubset (permission-grants.ts) لعدم تحميل DB هنا.
 */
export function validatePermissionsInput(
  permissions: any,
  granterRole: string
): PermissionInputResult {
  if (!Array.isArray(permissions)) {
    return {
      ok: false,
      status: 400,
      message:
        'يجب أن تكون الصلاحيات مصفوفة من النصوص (مثال: ["VIEW_STUDENT"]). إرسال القيم كسلسلة أو كائن أو رقم أو قيمة مفردة غير مقبول.',
    };
  }

  const upper = permissions.map((p: any) => String(p ?? '').toUpperCase().trim());

  if (upper.includes('ALL') && granterRole !== UserRole.Admin) {
    return {
      ok: false,
      status: 403,
      message: 'صلاحية "ALL" (كل الصلاحيات) غير مسموحة إلا لمدير التطبيق',
    };
  }

  for (const perm of upper) {
    if (!isValidPermission(perm) || perm === 'ALL') {
      return {
        ok: false,
        status: 400,
        message: `صلاحية غير معروفة: ${perm}`,
      };
    }
  }

  return {
    ok: true,
    permissions: upper.filter((p: string) => p !== 'ALL'),
  };
}

/**
 * هل يمكن لهذا الدور منح هذه الصلاحية (من ناحية القيمة فقط — النطاق يتم
 * في canGrantSubset)؟ تستخدم للتحقق العام قبل إجراء أي كتابة.
 */
export function canGrantPermissionByRole(permission: string, role: string): boolean {
  if (permission === 'ALL') return role === UserRole.Admin || role === (UserRole.Admin as string);
  if (!isValidPermission(permission)) return false;
  if (permission === 'MANAGE_BISHOPS') {
    // صلاحية فائقة لا تُمنح إلا لمدير التطبيق (لا يمكن لغير Admin منحها)
    return role === UserRole.Admin;
  }
  return true;
}

/** قائمة بكل الصلاحيات الصالحة — مفيدة للبناء العام للمصفوفات. */
export function allValidPermissions(): string[] {
  return Array.from(VALID_PERMISSIONS).filter((p) => p !== 'ALL');
}

/** اختصار: تحقّق أن قيمة مخزّنة في DB آمنة (مصفوفة). */
export function isSafeStoredPermissionValue(value: any): boolean {
  return Array.isArray(value);
}
