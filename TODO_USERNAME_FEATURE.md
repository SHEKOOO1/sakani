# TODO - Username Feature (تحديث: اكتمل)

## حالة التنفيذ: مكتمل بالكامل ✅

### 1. قاعدة البيانات (Migrations + DB Init)

- [x] **migrations/052_users_username.ts**
  - إضافة `users.username NVARCHAR(100) NULL`
  - جعل `email` NULLable
  - حذف `UQ_Users_Email`
  - إنشاء `UX_users_email` (فلتر `WHERE email IS NOT NULL`)
  - إنشاء `UX_users_username` (فريد عالمي مع فلتر `WHERE username IS NOT NULL`)
  - مقسّم على batches للتوافق مع SQL Server

- [x] **src/backend/infrastructure/db.ts (initializeDb)**
  - مطابق لـ Three-way mirror rule
  - يضيف عمود `username`
  - ينشئ الفهارس/Constraints المناسبة
  - يحافظ على التوافق مع Migrations 001-052

- [x] **Migrations**: حتى 051 مطبقة، 052 جاهز للتشغيل

### 2. التحقق من الصحة + Backend + Validation

- [x] **src/backend/validation/schemas.ts**
  - `loginSchema`: يقبل `email` أو `username` مع `.refine(...)`
  - `usernameSchema`: `^[\p{L}\p{N}._-]{3,50}$` مع trim
  - `createUserSchema`: يدعم `email` أو `username` (إلزامي واحد على الأقل)
  - `updateUserSchema`: يدعم `username`
  - `changeUsernameSchema`: `username` nullable (للمسح)

- [x] **src/backend/api/auth.routes.ts**
  - تسجيل دخول بـ username OR email
  - يبحث بـ `username` أولاً (فريد عالمي)، ثم `email`
  - يمنع دخول حساب بدون `activated_at` (يرجع `ACCOUNT_NOT_ACTIVATED`)
  - يُعيد `username` في استجابة تسجيل الدخول

- [x] **src/backend/api/user.routes.ts**
  - إنشاء مستخدم يدعم email أو username
  - لو فيه username → `activated_at = now()` (فعال فوراً، بدون دعوة تفعيل بالبريد)
  - `PUT /:id/username`: تغيير اسم المستخدم مع صلاحيات هرمية ونطاق سكن
  - يستخدم `canManageTargetUser` + `getAllowedUsernameTargets`
  - يعالج أخطاء `UX_users_username`/`UNIQUE` برسالة عربية واضحة

- [x] **src/backend/api/username-policy.ts**
  - Admin → جميع الأدوار
  - Bishop/Priest → Priest, Supervisor, AssistantSupervisor
  - Supervisor → Student, Employee, Parent
  - Elevated Employee (MANAGE_SUPERVISORS) → Priest, Supervisor, AssistantSupervisor

- [x] **src/backend/api/employees.routes.ts**
  - إنشاء موظف يقبل `username` (اختياري)
  - التحقق من صيغة username (3-50) والتفرد
  - لو فيه username → `activated_at = now()` (فعال فوراً)
  - عرض `username` في قائمة الموظفين

- [x] **src/backend/api/students/crud.routes.ts**
  - إضافة ولي أمر: يبحث موجود بـ `email` **أو** `username` role='parent'
  - إنشاء جديد: يقبل `email` أو `username` (واحد على الأقل)
  - لو استخدم `username` → حساب فعال فوراً (بدون دعوة تفعيل)
  - لو استخدم `email` فقط → السلوك القديم (إرسال رابط تفعيل)
  - تحديث ولي أمر `PUT /:studentId/guardians/:guardianId`: يدعم تحديث `username`, `email` (تحويل فارغ لـ null)
  - معالجة خطأ تفرد username برسالة مناسبة

### 3. الواجهة الأمامية (Frontend)

- [x] **src/components/LoginPage.tsx**
  - تسمية: "البريد الإلكتروني أو اسم المستخدم"
  - input type="text" بدل email
  - التحقق يميز بين setup (يحتاج email صحيح) ودخول عادي (يقبل username أو email)
  - يرسل `{username}` لو ما فيه `@` وإلا `{email}`

- [x] **src/components/StudentsPage.tsx**
  - `defaultFormData` يتضمن `username: ''`
  - إرسال FormData يضيف `username`

- [x] **src/components/student/modals/AddStudentModal.tsx**
  - `FormData` interface يضيف `username: string`
  - حقل username مضاف (اختياري)
  - نص توضيحي "للدخول بالبريد الإلكتروني أو اسم المستخدم"

- [x] **src/hooks/useStudentProfile.ts**
  - `guardianData` يتضمن `username: ''`
  - `handleAddGuardian` يرسل `username` لو موجود
  - `handleEditGuardian` يرسل `username` لو موجود

- [x] **src/components/student/modals/GuardianModal.tsx**
  - interface يضيف `username`
  - حقل username مضاف (اختياري)

- [x] **src/components/student/modals/GuardianEditModal.tsx**
  - interface يضيف `username`
  - حقل username مضاف للتعديل
  - تحديث وصف كلمة المرور

- [x] **src/components/EmployeesPage.tsx**
  - `Employee` interface يضيف `username?: string`
  - `formData` يتضمن `username: ''`
  - عند فتح Edit يملأ `username || ''`
  - عند الحفظ: يفصل تغيير username ويُرسل `PUT /api/users/:id/username` بعد نجاح العملية الأساسية

- [x] **src/components/employees/EmployeeFormModal.tsx**
  - `formData` interface يضيف `username: string`
  - حقل username مضاف مع أيقونة UserCheck
  - نص توضيحي "معرّف فريد للدخول بدون بريد إلكتروني"
  - Email أصبح اختياري

- [x] **src/test/AddStudentModal.test.tsx**
  - تحديث `defaultFormData` ليشمل `username: ''`

### 4. فحص نهائي

- [x] **TypeScript**: `npx tsc --noEmit` → **0 أخطاء**
- [x] **Tests**: `npx vitest run` → **33 files, 503 passed**

## ملاحظات
- لا يتم عمل commit/push تلقائياً (حسب التعليمات)
- جميع التعديلات مطابقة للـ requirements المذكورة
- حالة: **مكتمل 100%**