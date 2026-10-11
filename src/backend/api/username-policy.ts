import { AppPermission, UserRole } from "../../types/permissions";
import { checkUserPermission } from "../infrastructure/db";

/**
 * سياسة تغيير اسم المستخدم (username) — مَن يملك تغيير اسم مَن.
 *
 * التسلسل: مدير التطبيق > الأسقف > الكاهن > مشرف السكن.
 *   - مدير التطبيق: كل الأدوار التي تحته (أساقفة/كهنة/مشرفين/مساعدين/موظفين/طلاب/أولياء أمور).
 *   - الأسقف أو الكاهن: المشرفين والكهنة فقط (والمساعدين ضمن نطاقهم).
 *   - مشرف السكن: الطلاب والموظفين (وأولياء الأمور) فقط.
 *   - موظف مُخوَّل بصلاحية إدارة المشرفين (MANAGE_SUPERVISORS): المشرفين والكهنة — "الموظف المعيّن من قبل الأسقف".
 *
 * ملاحظة: النطاق الداخلي (أي سكن) يُفرض منفصلاً عبر canManageTargetUser.
 * الحساب نفسه (تغيير الاسم) لا يجوز إلا لمن يملك إدارة الهدف — فمدير التطبيق
 * لا يُغيّر اسم نفسه/أقرانه هنا إلا إذا كان دوره يسمح بالهدف (admin يستثني نفسه بالأسفل).
 */
export const USERNAME_TARGETS_BY_ROLE: Record<string, string[]> = {
  [UserRole.Admin]: [
    UserRole.Bishop,
    UserRole.Priest,
    UserRole.Supervisor,
    UserRole.AssistantSupervisor,
    UserRole.Employee,
    UserRole.Student,
    UserRole.Parent,
  ],
  [UserRole.Bishop]: [UserRole.Priest, UserRole.Supervisor, UserRole.AssistantSupervisor],
  [UserRole.Priest]: [UserRole.Priest, UserRole.Supervisor, UserRole.AssistantSupervisor],
  [UserRole.Supervisor]: [UserRole.Student, UserRole.Employee, UserRole.Parent],
};

// "الموظف المعيّن من قبل الأسقف" = موظف ممنوح صلاحية إدارة المشرفين.
const ELEVATED_EMPLOYEE_TARGETS = [UserRole.Priest, UserRole.Supervisor, UserRole.AssistantSupervisor];

export async function getAllowedUsernameTargets(actorId: string, actorRole: string): Promise<string[]> {
  if (actorRole === UserRole.Employee) {
    const isElevated = await checkUserPermission(actorId, AppPermission.MANAGE_SUPERVISORS);
    return isElevated ? ELEVATED_EMPLOYEE_TARGETS : [];
  }
  return USERNAME_TARGETS_BY_ROLE[actorRole] || [];
}
