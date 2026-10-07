# دليل نظام الصلاحيات (RBAC - Role Based Access Control)

يعتمد التطبيق نظاماً متطوراً للصلاحيات يربط كل فعل (Action) بصلاحية محددة (Permission)، بدلاً من الاعتماد المباشر على الأدوار.

## كيف يعمل النظام؟
1. **الصلاحيات (Permissions):** تم تعريف قائمة شاملة من الصلاحيات في ملف `src/types/permissions.ts`. مثال: `VIEW_STUDENT`, `DELETE_STUDENT`.
2. **الأدوار (Roles):** الأدوار هي مجرد حاويات لمجموعة من الصلاحيات.
3. **الربط (Mapping):** يتم تخزين الربط بين الأدوار والصلاحيات في جدول `role_permissions` في قاعدة البيانات.

## الفوائد المخفية لهذا النظام:
- **المرونة:** يمكنك تعديل صلاحيات دور معين (مثل المساعد) دون الحاجة لتغيير كود الـ Backend.
- **الأمان:** كل مسار (Route) في الـ API محمي بـ Middleware يتأكد من امتلاك المستخدم للصلاحية المطلوبة قبل التنفيذ.
- **واجهة مستخدم ذكية:** الواجهة تخفي الأزرار والقوائم التي لا يملك المستخدم صلاحية الوصول إليها تلقائياً.

## كيفية إضافة صلاحية جديدة:
1. أضف الصلاحية في Enum `AppPermission` في ملف `src/types/permissions.ts`.
2. أضف الصلاحية للأدوار المناسبة في دالة `seedPermissions` بملف `src/backend/infrastructure/db.ts`.
3. استخدم الصلاحية في الـ Route المناسب في الـ Backend:
   ```typescript
   router.post('/', authorizePermission(AppPermission.ADD_STUDENT), (req, res) => { ... });
   ```
4. استخدم الصلاحية في الـ Frontend لإخفاء/إظهار العناصر:
   ```typescript
   const { hasPermission } = useAuth();
   {hasPermission(AppPermission.ADD_STUDENT) && <AddButton />}
   ```

هذا النظام يضمن بقاء التطبيق آمناً واحترافياً.
