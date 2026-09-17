import { UserRole, isValidPermission, VALID_PERMISSIONS } from "../../types/permissions";
import { kdb } from "./db";
import { parseStoredPermissionsArray } from "./permission-parser";

/**
 * ═══════════════════════════════════════════════════════════════════
 * منح الصلاحيات وفق قاعدة "منح ⧸ ‏التابعية الصارمة" (GRANTOR-SUBSET).
 *
 * هذه الوحدة هي **الطبقة السفلى الوحيدة** المسؤولة عن التحقق من أن أي دور
 * (مخصص أو مخزّن) لا يستطيع منح صلاحيةٍ لا يملكها دوره المنفِّذ — أي منع
 * التصعيد الأفقي/العمودي عبر «الصلاحيات الزائفة» وخاصة سلسلة "ALL".
 *
 * القاعدة الأساسية (subset):
 *   - مدير التطبيق (Admin) ⇐ يستطيع منح أي شيء (بما فيها ALL).
 *   - غير مدير التطبيق ⇐ يستطيع منح مصفوفةٍ **تحت** صلاحياته الفعلية فقط:
 *       requested ⊆ grantorEffectiveCodes
 *     ولا يجوز أبدًا أن تُمنح صلاحية لا يملكها الدوره المنفِّذ — حتى لو كانت
 *     الصلاحية قيمةً صالحة، فالمسموحُ من "الدور المُنفِّذ" وحده هو النطاق
 *     الذي يجبره هذا الفحص.
 *
 * FAIL-CLOSED: أي خطأ في قراءة بيانات المُنفّذ (مستخدم غير موجود، قيمة
 * غير مصفوفة، جداول مفقودة) ⇐ لا يُمنح أي شيء (false).
 *
 * ملاحظة بنيوية: تعتمد هذه الوحدة على `kdb` (قراءة فقط) وليس على
 * `hasPermission/checkUserPermission` — لأنها تُستخدم داخل db.ts نفسها وفي
 * middleware/실 tests التي قد تُقلّد hasPermission بحيث تُعيد `true` دائمًا.
 */

/** نتيجة حساب صلاحيات الدور الفعلية (آمنة للاستخدام في منح التصعيد). */
export interface EffectivePermissionSet {
  /** الصلاحيات الفعلية (بدون `ALL` — تُدار كمفتاح منفصل). */
  codes: string[];
  /** هل يملك الدور صلاحية `ALL` (كل الصلاحيات)؟ */
  hasAll: boolean;
  /** هل هو مدير التطبيق؟ */
  isAppAdmin: boolean;
}

/**
 * حساب "الصلاحيات الفعلية الكاملة" لدور/مستخدم من قاعدة البيانات، مع كل
 * المصادر المعروفة في checkUserPermission:
 *   1. الصلاحيات المباشرة (custom_permissions) — عبر المحلِّل الصارم.
 *   2. صلاحيات الدور المخصص (custom_role_id) — مع قيد النطاق (tenant_id).
 *   3. الصلاحيات الافتراضية من جدول role_permissions (دور أساسي).
 *
 * يُعاد ALL=صحيح فقط إذا كانت الصلاحيات المخزّنة مصفوفةً تحتوي "ALL" **أو**
 * كان الدور هو Admin — وكل ذلك يمرّ عبر parseStoredPermissionsArray الصارم.
 *
 * FAIL-CLOSED: لا تقرأ القيم المخزّنة إلا عبر محلِّل يرفض غير المصفوفة،
 * لذا أي قيمة مخزّنة بصيغة نصية (مثل `"ALL"` كنص) لا تمنح أي شيء.
 */
export async function getEffectivePermissionCodes(userId: string): Promise<EffectivePermissionSet> {
  const user = await kdb("users").where({ id: userId }).first();
  if (!user) {
    return { codes: [], hasAll: false, isAppAdmin: false };
  }

  if (user.role === UserRole.Admin) {
    return { codes: Array.from(excludeBishopAll()), hasAll: true, isAppAdmin: true };
  }

  const effective = new Set<string>();
  let hasAll = false;

  // 1. الصلاحيات المباشرة المخزنة
  const direct = parseStoredPermissionsArray(user.custom_permissions);
  for (const p of direct.perms) {
    if (p === "ALL") {
      hasAll = true;
    } else if (isValidPermission(p)) {
      effective.add(p);
    }
  }

  // 2. الدور المخصص (نفس قيد النطاق المستخدم في checkUserPermission)
  if (!hasAll && user.custom_role_id) {
    let query = kdb("tenant_custom_roles").where({ id: user.custom_role_id });
    if (user.tenant_id) query = query.andWhere({ tenant_id: user.tenant_id });
    else query = query.whereNotNull("tenant_id");
    const customRole = await query.first();
    if (customRole) {
      const role = parseStoredPermissionsArray(customRole.permissions);
      for (const p of role.perms) {
        if (p === "ALL") hasAll = true;
        else if (isValidPermission(p)) effective.add(p);
      }
    }
  }

  // 3. الصلاحيات الافتراضية من دور الأساسي (role_permissions)
  if (!hasAll) {
    try {
      const rolePerms = await kdb("role_permissions").where({ role: user.role });
      for (const rp of rolePerms || []) {
        const val = parseStoredPermissionsArray(rp?.permission ?? rp?.permissions);
        for (const p of val.perms) {
          if (p === "ALL") hasAll = true;
          else if (isValidPermission(p)) effective.add(p);
        }
      }
    } catch {
      // تجاهل — الأدوار الافتراضية قد لا تكون محفورة في بعض البيئات؛ الفحص
      // يبقى FAIL-CLOSED (لا تُمنح صلاحية افتراضية زائفة في حال الفشل).
    }
  }

  return {
    codes: Array.from(effective),
    hasAll,
    isAppAdmin: false,
  };
}

/** نسخة نقيّة من مجموعة صلاحيات الأساس (بلا "ALL") — للاستخدام في الفحص النهائي. */
function excludeBishopAll(): Set<string> {
  const s = new Set<string>();
  for (const p of VALID_PERMISSIONS) {
    if (p === "ALL") continue;
    s.add(p);
  }
  return s;
}

/** نتيجة فحص "هل يُسمح للمنفِّذ بمنح هذه المجموعة؟". */
export type GrantSubsetResult =
  | { ok: true; permissions: string[] }
  | { ok: false; status: number; message: string };

/**
 * الفحص النهائي الصارم: هل الصلاحيات المطلوبة تُمنح ضمن صلاحيات المنفِّذ؟
 *
 * FAIL-CLOSED:
 *   - non-array / مخزّنة بصيغة زائفة ⇐ رفض.
 *   - `ALL` لغير Admin ⇐ 403.
 *   - أي صلاحية لا يملكها المنفِّذ ⇐ 403 (subset).
 *   - أي صلاحية غير معروفة ⇐ 400.
 */
export function canGrantSubset(
  requested: string[],
  grantorEffective: string[],
  grantorHasAll: boolean,
  grantorIsAdmin: boolean
): GrantSubsetResult {
  if (!Array.isArray(requested)) {
    return { ok: false, status: 400, message: "الصلاحيات يجب أن تكون مصفوفة من النصوص" };
  }

  const reqUpper = requested.map((p: any) => String(p ?? '').toUpperCase().trim());
  const requestedSet = new Set(reqUpper.filter((p: string) => p !== "ALL"));
  const wantsAll = reqUpper.includes("ALL");

  if (wantsAll && !grantorIsAdmin) {
    return { ok: false, status: 403, message: 'صلاحية "ALL" غير مسموحة إلا لمدير التطبيق' };
  }

  for (const p of reqUpper) {
    if (p === "ALL") continue;
    if (!isValidPermission(p)) {
      return { ok: false, status: 400, message: `صلاحية غير معروفة: ${p}` };
    }
  }

  const effectiveSet = new Set(grantorEffective);
  if (grantorHasAll) {
    for (const p of VALID_PERMISSIONS) effectiveSet.add(p);
  }

  for (const p of requestedSet) {
    if (!effectiveSet.has(p)) {
      return {
        ok: false,
        status: 403,
        message: `لا يمكنك منح صلاحية لا تملكها: ${p}`,
      };
    }
  }

  return { ok: true, permissions: reqUpper };
}
