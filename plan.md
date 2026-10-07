# خطة تطوير فلتر الإعلانات الذكي

## المشكلة
حاليا في صفحة الإعلانات (`BroadcastManagement.tsx`)، كل حقول الاستهداف (المساكن، الطلاب، الموظفين، المشرفين، الكهنة، إلخ) مستقلة عن بعضها. المطلوب جعل فلتر "المساكن" فلتراً رئيسياً يتحكم في بقية الحقول.

## المتطلبات
1. المشرف (سوبرفايزر) يشوف كل السكنات اللي هو مسؤول عنها (حتى لو متعدد)
2. لما يختار سكن/سكنات، الباقي يتفلتر بناءً عليه
3. الشغلة تنطبق على كل الأدوار اللي عندها صلاحية إعلانات (مدير، أسقف، كاهن، مشرف)

## التعديلات المطلوبة

### 1. Backend: `broadcast.service.ts`

#### أ. تعديل `getScopedTenants` لدعم multi-tenant
- تستقبل `tenantIds` بدل `tenantId` فقط
- للسوبرفايزر/الكاهن: ترجع كل السكنات في `tenantIds`
- للأسقف: ترجع السكنات اللي عنده (كما هو)
- للمدير: الكل (كما هو)

#### ب. إضافة `tenant_id` في SELECT لدوال الجلب
- `getScopedPriests`: `kdb("users").select("id", "name", "tenant_id")`
- `getScopedSupervisors`: `kdb("users").select("id", "name", "tenant_id")`
- `getScopedEmployees`: `kdb("users").select("id", "name", "tenant_id")`

### 2. Backend: `broadcast.routes.ts`

- تمرير `tenantIds` من `req.user` إلى دوال الخدمة
```ts
const user = {
  id: req.user.id,
  tenantId: req.user.tenantId,
  tenantIds: (req.user as any).tenantIds,
  role: req.user.role
};
```

### 3. Frontend: `BroadcastManagement.tsx`

#### أ. إضافة `tenant_id` للـ types
كل item في target data لازم يكون فيه `tenant_id`

#### ب. إعادة ترتيب الـ UI
- فلتر "المساكن" يبقى أول حقل وبحجم أكبر
- إضافة text توضيحي: "اختر السكن أولاً لتفلترة بقية الخيارات"
- بقية الحقول تحت

#### ج. تطبيق cascading filter
```ts
// تصفية كل القوائم حسب المساكن المختارة
const filteredByTenant = (items: any[], tenantIdField: string = 'tenant_id') => {
  const selected = targeting.tenants || [];
  if (selected.length === 0) return items; // لو مفيش اختيار → كل حاجة
  return items.filter((item: any) => selected.includes(item[tenantIdField]));
};
```

#### د. UI hints
- اختيار مسكن → تفعيل بقية الفلاتر
- إظهار badge عدد المساكن المختارة
- لو مسكن واحد مختار → إظهار اسمه في الـ placeholder

### ه. الفئات المتأثرة بالفلترة
| الفئة | الحقل المستخدم للفلترة |
|-------|------------------------|
| الطلاب (students) | `tenant_id` (موجود) |
| الموظفين (employees) | `tenant_id` (سيتم إضافته) |
| المشرفين (supervisors) | `tenant_id` (سيتم إضافته) |
| الكهنة (priests) | `tenant_id` (سيتم إضافته) |
| الكليات (colleges) | عن طريق students |
| المحافظات (governorates) | عن طريق students |
| الكنائس (churches) | عن طريق students |
| الأساقفة (bishops) | غير متأثر (للمدير فقط) |
| صلة القرابة (guardian_types) | غير متأثر (نوع علاقة) |

### و. الفئات الغير متأثرة
- الأساقفة (bishops): ليس لهم `tenant_id`
- صلة القرابة (guardian_types): أنواع العلاقات فقط

## ملفات التعديل
- `src/backend/api/broadcast.service.ts`
- `src/backend/api/broadcast.routes.ts`
- `src/components/BroadcastManagement.tsx`

## التحقق
1. تسجيل الدخول كمشرف على عدة مساكن → فتح صفحة الإعلانات
2. التأكد من ظهور كل المساكن في فلتر "المساكن"
3. اختيار مسكن واحد → التأكد من تقليل الخيارات في بقية الحقول
4. اختيار مساكن متعددة → التأكد من ظهور بيانات المساكن المختارة فقط
5. إلغاء اختيار المساكن → عودة كل الخيارات
6. تجربة مع الأدوار المختلفة (مدير، أسقف، كاهن، مشرف)
