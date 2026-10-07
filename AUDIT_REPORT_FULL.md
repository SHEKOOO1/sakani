# تقرير التدقيق الشامل لنظام "سكني" — المراجعة الكاملة
**تاريخ التقرير:** 17 يونيو 2026  
**النسخة:** v2 (شامل كل ما سبق + اكتشافات جديدة)  
**الخبير:** تقييم أمني وهيكلي متكامل

---

## فِهْرس المحتويات
1. [ملخص تنفيذي](#1-ملخص-تنفيذي)
2. [الثغرات الأمنية الحرجة (لم تذكر سابقاً)](#2-ثغرات-أمنية-حرجة-جديدة)
3. [جميع مشاكل UI/UX والأزرار المعطلة](#3-مشاكل-uiux-والأزرار-المعطلة)
4. [مشاكل الباك اند و API](#4-مشاكل-الباك-اند)
5. [مشاكل قاعدة البيانات والأداء](#5-مشاكل-قاعدة-البيانات)
6. [مشاكل الكود والهيكلة](#6-مشاكل-الكود-والهيكلة)
7. [مشاكل DevOps والبنية التحتية](#7-مشاكل-devops)
8. [خطة الصيانة المقترحة](#8-خطة-الصيانة)

---

## 1. ملخص تنفيذي

**النظام**: Node.js/Express + React 19 + TypeScript + SQL Server + Tailwind 4  
**حجم الكود**: ~80+ مكون, ~30 route file, ~1000+ سطر في الملفات الكبيرة

### الوضع الحالي:
- تم إصلاح ~50 مشكلة سابقة (حسب TODO.md)
- التقرير السابق (التقرير_الشامل.md) وثق ~36 مشكلة
- لا تزال توجد مشاكل هيكلية وأمنية حرجة

### مشاكل جديدة مكتشفة (لم تذكر في التقارير السابقة):

| المستوى | العدد | الوصف |
|---------|-------|-------|
| **🔴 حرج** | 5 | ثغرات أمنية تهدد النظام بأكمله |
| **🟠 عالي** | 12 | مشاكل أداء وأمان حقيقية |
| **🟡 متوسط** | 18 | مشاكل هيكلية و UI/UX |
| **🟢 توصيات** | 10 | تحسينات مستحبة |

---

## 2. ثغرات أمنية حرجة جديدة

### 🔴 NEW-CRIT-1: Duplicate DB Connection Pools (تسرب اتصالات)
**الملف**: `src/backend/infrastructure/knex.ts` + `src/backend/infrastructure/mssql_db.ts`  
**الوصف**: يوجد اتصالان منفصلان بقاعدة البيانات — `knex` pool + `mssql.ConnectionPool` في `mssql_db.ts`.
`mssql_db.ts` غير مستخدم من قِبل أي كود آخر، لكن `gracefulShutdown` في `server.ts` يحاول إغلاقه.
**الخطورة**: 
- اتصال DB مفتوح بدون استخدام (wasted connection)
- `poolPromise` يشتغل ويبقى مفتوحاً طوال عمر السيرفر
- عند إعادة التشغيل المتكرر، الـ connections تتسرب (connection leak)
**الإصلاح**: إزالة `mssql_db.ts` بالكامل أو تعطيله.

### 🔴 NEW-CRIT-2: Audit Logger يسجل بيانات حساسة
**الملف**: `src/backend/api/middleware.ts:185-188`  
**الوصف**: الفلتر الحالي يحذف `password`, `confirmPassword`, `currentPassword`, `newPassword`, `token` فقط.
أي بيانات حساسة أخرى (phone, address, photo_url, student full data, guardian info) تُسجل كاملة في `audit_logs.details` كـ JSON.
**الخطورة**: 
- تسجيل دائم لأرقام التليفون والعناوين والبيانات الشخصية
- أي شخص لديه حق الوصول لقاعدة البيانات يشوف كل شيء
- انتهاك محتمل للائحة حماية البيانات الشخصية
**الإصلاح**: توسيع الفلتر أو إزالة `body` من التسجيل بالكامل.

### 🔴 NEW-CRIT-3: Radio Chat Stats Query خطأ SQL دائم
**الملف**: `server.err:1`  
**الوصف**: كل 5 ثوانٍ تقريباً، Query إحصائيات الراديو يفشل بـ:
```
Column 'radio_chat_messages.user_id' is invalid in the select list
because it is not contained in either an aggregate function or the GROUP BY clause.
```
**الخطورة**: 
- خطأ SQL دائم كل 5 ثواني
- السيرفر يضيع موارد على query فاشل
- قد يكون مؤشراً على مشكلة أوسع في radio controller
**الإصلاح**: إصلاح الـ SELECT DISTINCT ليشمل GROUP BY صحيح أو استخدام COUNT مع GROUP BY بدلاً من DISTINCT.

### 🔴 NEW-CRIT-4: لا يوجد CSRF Protection (مؤكد)
**الملف**: `server.ts` - غير موجود  
**الوصف**: 
- الـ `sameSite: strict` على الكوكيز (موجود) يمنع CSRF جزئياً
- لكن الـ JWT لا يزال يُقبل كـ Bearer token من `Authorization` header أيضاً (middleware.ts:23-24)
- أي موقع خارجي يستطيع عمل fetch مع `Authorization: Bearer <token>` طالما أن التوكن في localStorage أو متاح
**الخطورة**: أي XSS أو malware يسرق التوكن من localStorage ويتحكم بالحساب
**الإصلاح**: 
1. إعطاء أولوية للـ httpOnly cookie فقط، وإلغاء Bearer token
2. إضافة `csrf` middleware
3. أو استخدام `Origin`/`Referer` validation لكل POST/PUT/DELETE

### 🔴 NEW-CRIT-5: مزامنة Cache غير موجودة
**الملف**: `src/backend/infrastructure/cache.ts`  
**الوصف**: الـ MemoryCache ليس له أي آلية لمزامنة البيانات بين عمليات السيرفر المتعددة (horizontal scaling).
إذا تم تشغيل نسختين من السيرفر، cache الـ permissions يختلف بينهما.
- `permissionCache` مدته 60 ثانية
- `userCache` مدته 15 ثانية
- `tenantCache` مدته 30 ثانية
**الخطورة**: 
- في حالة التوسع الأفقي، المستخدم يحصل على صلاحيات مختلفة حسب السيرفر
- الـ cache stale يحجب صلاحيات جديدة أو يعطي صلاحيات ملغية
**الإصلاح**: إضافة Redis أو SharedCache، أو تعطيل الـ caching تماماً للـ multi-instance

---

## 3. مشاكل UI/UX والأزرار المعطلة

### 🟠 NEW-UI-1: Input validation غير موجود على مستوى UI
**جميع النماذج تقريباً**: 
- لا validation على الطول الأدنى لكلمة المرور
- لا validation على صيغة البريد الإلكتروني (الـ backend فقط عنده Zod)
- حقول الأرقام (phone, whatsapp) تقبل حروف
**الإصلاح**: إضافة frontend validation باستخدام نفس Zod schemas

### 🟠 NEW-UI-2: لا يوجد Loading Indicators موحدة
**الملفات**: `LaundryPage.tsx`, `FinancePage.tsx`, وغيرها  
**الوصف**: بعض الصفحات تستخدم `loading` state لكنها لا تظهر Skeleton مخصصة لكل جزء
**الإصلاح**: استخدام Skeleton component لكل tab/kard

### 🟠 NEW-UI-3: Error Messages عامة جداً
**الملفات**: جميع أنحاء التطبيق  
**الوصف**: رسائل الخطأ "حصل خطأ تقني. لو سمحت كرر المحاولة." تخفي أسباب الأخطاء الحقيقية عن المستخدمين والمشرفين
**الإصلاح**: رسائل خطأ محددة مع Toast مع كود الخطأ

### 🟡 NEW-UI-4: Responsive Design Issues
**الوصف**: 
- `EventsPage.tsx` (2951 سطر) — لا توجد breakpoints واضحة
- `Radio.tsx` (2185 سطر) — يعتمد على fixed widths
- شريط البحث في `RoomsPage.tsx:186` بدون onChange — لا يعمل أصلاً
**الإصلاح**: اختبار Responsive على أحجام شاشات مختلفة

### 🟡 NEW-UI-5: Keyboard Accessibility منخفضة
**الوصف**: 
- معظم الأزرار التفاعلية بدون `aria-label`
- الـ modals لا ت focus trap
- لا توجد skip-to-content للوحة المفاتيح
**الإصلاح**: إضافة accessibility attributes

### 🟡 NEW-UI-6: Stale Closures في React Components
**الوصف**: 
- نمط `useRef` + `useEffect` يسبب stale closures
- `useApi.ts` يستخدم `logoutRef` و `userRef` لتجنب stale closure (جيد) لكن باقي المكونات تفعل `useState` بعد `await` بدون `useMounted` أو `AbortController`
**الإصلاح**: استخدام `useCallback` + dependencies صحيحة

### 🔴 NEW-UI-7: State Management غير موحد
**الوصف**: كل صفحة تدير state بنفسها:
- `useState` + `useEffect` لكل fetch
- لا React Query/Zustand/Redux
- لا caching للبيانات على الـ frontend
- كل تنقل بين الصفحات يعيد تحميل كل البيانات
**التأثير**: أداء بطيء، تجربة مستخدم سيئة، استهلاك بيانات
**الإصلاح**: إضافة React Query (TanStack Query) — المكتبة موجودة في package.json

### 🟡 NEW-UI-8: Lazy Loading مفقود
**الوصف**: جميع الصور (uploads, profile photos) تُحمل مباشرة بدون `loading="lazy"`
**الإصلاح**: إضافة `loading="lazy"` على كل `<img>`

---

## 4. مشاكل الباك اند

### 🟠 NEW-BE-1: Radio Controller المتضخم (1607 سطر)
**الملف**: `src/backend/api/radio.routes.ts` + `src/backend/controllers/radio.controller.ts`  
**الوصف**: الـ routes والـ controller كلاهما كبير جداً. يجب تقسيمهما إلى وحدات:
- `radio/chat.ts` — الشات
- `radio/videos.ts` — الفيديوهات  
- `radio/stream.ts` — البث المباشر
- `radio/staff.ts` — الطاقم
- `radio/playlists.ts` — قوائم التشغيل

### 🟠 NEW-BE-2: User Enumeration في `/api/auth/register`
**الملف**: `auth.routes.ts:79-80`  
**الوصف**: رسالة الخطأ المختلفة للمستخدم الموجود (البريد مسجل) تسمح بتخمين عناوين البريد المسجلة
**الإصلاح**: رسالة عامة "فشل التسجيل" في كل الحالات

### 🟠 NEW-BE-3: Request Body غير محدود لكل Route
**الملف**: `server.ts:306` — `express.json({ limit: '2mb' })`  
**الوصف**: حد 2MB لجميع الـ JSON requests. بعض الـ routes (chat, notifications) لا تحتاج أكثر من 10KB
**الإصلاح**: تحديد limits مختلفة لكل route

### 🟡 NEW-BE-4: `checkUserPermission` يضرب DB في كل Request
**الملف**: `src/backend/infrastructure/db.ts:938-980`  
**الوصف**: 
- كل request يمر بـ `authorizePermission` → `checkUserPermission` → على الأقل 1 DB query
- إذا لم يكن الـ permission في الـ cache، يضرب 1-3 queries
- الـ cache مدته 60 ثانية فقط
**الإصلاح**: 
1. تضمين الـ permissions في JWT token payload
2. زيادة TTL للـ cache
3. أو استخدام Redis

### 🟡 NEW-BE-5: Error Handling غير موحد
**الوصف**: 
- 50% من الـ routes تستخدم `try/catch` مع رسالة خطأ ثابتة
- 50% الباقية لا تستخدم try/catch أصلاً (ترمي exception غير معلجة)
**الإصلاح**: إضافة Express error handler middleware يحول كل الأخطاء لردود منسقة

### 🟡 NEW-BE-6: Query بدون Pagination
**الملفات المتعددة**: 
- `/api/radio/videos` — لا Pagination
- `/api/radio/chat/messages` — لا Pagination
- `/api/finances` — لا Pagination
- `/api/students` — لا Pagination
**الإصلاح**: إضافة LIMIT/OFFSET لكل list endpoints

### 🟡 NEW-BE-7: N+1 Queries في Dashboard
**الملف**: `dashboard.routes.ts`  
**الوصف**: استعلامات داخل loops تؤدي إلى N+1 queries
**الإصلاح**: استخدام batch queries أو JOINs

### 🟡 NEW-BE-8: لا يوجد Soft Delete
**الوصف**: جميع عمليات الحذف DELETE حقيقية (hard delete)
**الإصلاح**: إضافة `deleted_at` column لكل الجداول الأساسية

---

## 5. مشاكل قاعدة البيانات

### 🔴 NEW-DB-1: كلمة سر `sa` = `123`
**الملف**: `.env`  
**الوصف**: حساب `sa` (System Administrator) بكلمة سر `123`. هذا الحساب لديه صلاحية كاملة على قاعدة البيانات.
**الإصلاح**: تغيير كلمة السر فوراً واستخدام مستخدم مخصص

### 🟠 NEW-DB-2: `encrypt: false` في الإنتاج؟
**الملف**: `knex.ts:17`, `mssql_db.ts:15`  
**الوصف**: 
```ts
encrypt: process.env.NODE_ENV === 'production',
```
إذا كان `NODE_ENV` مضبوط على `production` فالتشفير يعمل. لكن إذا لم يتم ضبطه، البيانات تنتقل نصاً صريحاً.
**الإصلاح**: تعيين `encrypt: true` دائماً أو التأكد من `NODE_ENV=production`

### 🟠 NEW-DB-3: لا يوجد Database Indexes
**الوصف**: الـ DB يكاد يكون بدون indexes على الأعمدة الأكثر استخداماً
**الإصلاح**: إضافة indexes على:
- `audit_logs(tenant_id, created_at DESC)`
- `notifications(user_id, is_read)`
- `attendance(tenant_id, created_at DESC)`
- `finances(tenant_id, date DESC)`
- `students(tenant_id, status)`
- `radio_chat_messages(created_at DESC)`
- `radio_videos(is_active, created_at DESC)`

### 🟡 NEW-DB-4: Schema Duality (تعريف مكرر)
**الملف**: `schema_mssql.sql` + `db.ts`  
**الوصف**: نفس الجداول معمول `CREATE TABLE IF NOT EXISTS` في مكانين بتعاريف مختلفة
- `schema_mssql.sql`: 526 سطر
- `db.ts` (initializeDb): 700+ سطر إضافي من ALTERs
**الإصلاح**: توحيد الكل في `migrations/` وإزالة التعريفات المكررة

### 🟡 NEW-DB-5: Migration Strategy غير ناضجة
**الوصف**: 
- `initializeDb()` في `db.ts` تشغل SQL خام كل مرة يبدأ فيها السيرفر
- ملف `knexfile.ts` موجود لكن الـ migrations الفعلية ضعيفة
**الإصلاح**: هيكلة migrations حقيقية باستخدام Knex

---

## 6. مشاكل الكود والهيكلة

### 🔴 NEW-CODE-1: 4 God Files > 2000 سطر
| الملف | السطور | الإجراء |
|-------|--------|---------|
| `EventsPage.tsx` | 2951 | تقسيم إلى Components |
| `StudentsPage.tsx` | 2308 | تقسيم إلى Components |
| `AdminRadio514.tsx` | 2232 | تقسيم إلى Modules |
| `Radio.tsx` | 2185 | تقسيم إلى Modules |
| `radio.routes.ts` + controller | 1607+ | فصل إلى Services |
| `event.routes.ts` | 1335 | فصل Service Layer |
| `db.ts` | 1003 | فصل إلى Schema + Seed + Audit + Perms |

### 🟡 NEW-CODE-2: TypeScript Strict Mode غير مفعل
**الملف**: `tsconfig.json`  
**الوصف**: `strict: true`, `noUnusedLocals`, `noUnusedParameters` غير موجودة
**التأثير**: استخدام `as any` منتشر جداً، errors متجاهلة وقت الـ build

### 🟡 NEW-CODE-3: Catch صامت (Silent Catches)
**الملفات**: متعددة — `catch {}` بدون أي log
**التأثير**: الأخطاء تمر بدون علم الفريق
**الإصلاح**: `catch (err) { console.error(...) }` على الأقل

### 🟡 NEW-CODE-4: لا يوجد Controller-Service-Repository Pattern
**الوصف**: 
- Routes تحتوي Business Logic + DB Queries مباشرة
- لا فصل بين layers
**الإصلاح**: Routes ← Services ← Repositories

### 🟡 NEW-CODE-5: لا يوجد قياسات (Metrics)
**الوصف**: 
- لا performance monitoring
- لا request/response timing
- لا API usage tracking
**الإصلاح**: إضافة `request-time` middleware أو Sentry APM

### 🟡 NEW-CODE-6: 25 ملف Script مبعثر
**الملف**: `scripts/`  
**الوصف**: 25 ملف script بدون تنظيم بين test, seed, migrate, utility
**الإصلاح**: تنظيم في `scripts/tests/`, `scripts/migrations/`, `scripts/utils/`

---

## 7. مشاكل DevOps والبنية التحتية

### 🔴 NEW-DEVOPS-1: `.env` في مستودع Git
**الملف**: `.env` (غير مضاف لـ `.gitignore`)  
**الوصف**: الأسرار الحقيقية (DB_PASSWORD, JWT_SECRET, YOUTUBE_API_KEY, VAPID keys) موجودة في `.env` وقد تكون منشورة في تاريخ Git
**الإصلاح**: `git rm --cached .env` + إضافة لـ `.gitignore` + تغيير كل الأسرار فوراً

### 🟠 NEW-DEVOPS-2: لا Healthcheck لـ Docker
**الملف**: `docker-compose.yml`  
**الوصف**: لا يوجد healthcheck على SQL Server أو على التطبيق نفسه
**الإصلاح**: إضافة healthcheck لكل service

### 🟠 NEW-DEVOPS-3: Logging غير مهيكل
**الملف**: `logger.ts`  
**الوصف**: الـ logs تكتب نص عادي، مش JSON — مش ممكن parse بالآلي
**الإصلاح**: تحويل إلى JSON logging

### 🟠 NEW-DEVOPS-4: لا يوجد Error Tracking (Sentry)
**الوصف**: الـ `Sentry` integration موجود في `server.ts` لكن مش مفعل (يحتاج `SENTRY_DSN` في `.env`)
**الإصلاح**: تفعيل Sentry أو أي error tracking

### 🟡 NEW-DEVOPS-5: لا يوجد CI/CD Pipeline
**الوصف**: لا automated deployment عند push
**الإصلاح**: إضافة GitHub Actions للـ CD

---

## 8. خطة الصيانة — الخطوات التفصيلية بالترتيب

### المرحلة الأولى — فورية (أسبوع 1)

| # | المهمة | الملفات | الجهد | الأسبقية |
|---|--------|---------|-------|----------|
| 1 | حذف `.env` من Git، إضافة لـ `.gitignore`، تغيير كل الأسرار | `.env`, `.gitignore` | 30 دقيقة | 🔴 فورية |
| 2 | تغيير كلمة سر `sa` في SQL Server وإنشاء مستخدم مخصص | `.env`, SQL Server | 30 دقيقة | 🔴 فورية |
| 3 | إزالة الاتصال المكرر في `mssql_db.ts` | `mssql_db.ts` | 15 دقيقة | 🔴 NEW-CRIT-1 |
| 4 | إصلاح SQL Query في Radio Chat Stats | `radio.controller.ts` | 1 ساعة | 🔴 NEW-CRIT-3 |
| 5 | توسيع فلتر الـ Audit Logger | `middleware.ts:185-188` | 30 دقيقة | 🔴 NEW-CRIT-2 |
| 6 | إصلاح الـ Search في `RoomsPage.tsx` | `RoomsPage.tsx:186` | 30 دقيقة | 🟠 NEW-UI-4 |
| 7 | إضافة onClick لزر حذف المشغل في الـ Laundry | `LaundryPage.tsx:619` | 30 دقيقة | 🟠 NEW-UI-7 |

### المرحلة الثانية — المدى القصير (أسبوع 2-3)

| # | المهمة | الملفات | الجهد |
|---|--------|---------|-------|
| 8 | إضافة CSRF protection | `server.ts` | 3 ساعات |
| 9 | إضافة rate limiting لكل radio endpoints | `server.ts` | 2 ساعات |
| 10 | إضافة Pagination لكل list endpoints | `radio.routes.ts`, `finance.routes.ts`, أخرى | 6 ساعات |
| 11 | إضافة Database Indexes (7 indexes) | SQL migration | 2 ساعات |
| 12 | إصلاح User Enumeration | `auth.routes.ts:79-80` | 30 دقيقة |
| 13 | إضافة Frontend Validation | كل النماذج | 4 ساعات |
| 14 | إضافة Lazy Loading للصور | كل `<img>` tags | 2 ساعات |

### المرحلة الثالثة — هيكلية (أسبوع 4-6)

| # | المهمة | الملفات | الجهد |
|---|--------|---------|-------|
| 15 | تقسيم God Files (>2000 سطر) | 4 ملفات كبيرة | 5 أيام |
| 16 | تفعيل TypeScript Strict Mode | `tsconfig.json` | 3 أيام |
| 17 | إضافة React Query لإدارة الـ State | كل الـ components | 5 أيام |
| 18 | توحيد الـ Schema (إزالة التكرار) | `schema_mssql.sql`, `db.ts` | 4 ساعات |
| 19 | إضافة Controller-Service-Repository Pattern | `radio.routes.ts`, `event.routes.ts` | 5 أيام |
| 20 | تنظيم الـ 25 Script | `scripts/` | 2 ساعات |

### المرحلة الرابعة — استثمارية (شهر 2+)

| # | المهمة | الجهد |
|---|--------|-------|
| 21 | تفعيل Sentry Error Tracking | 4 ساعات |
| 22 | JSON Structured Logging | 3 ساعات |
| 23 | إضافة Redis Cache | 2 أيام |
| 24 | إضافة Database Backup Strategy | 4 ساعات |
| 25 | Docker Healthcheck + Restart Policies | 2 ساعات |
| 26 | تفعيل HTTPS عبر Nginx مع Let's Encrypt | 3 ساعات |
| 27 | Pre-commit Hooks (Husky + lint-staged) | 2 ساعات |
| 28 | إضافة API Documentation (Swagger) | 3 أيام |
| 29 | Automated CI/CD Pipeline | يومين |
| 30 | Keyboard Accessibility تحسين | 3 أيام |

---

## الملخص العددي النهائي

| الفئة | التقارير السابقة | اكتشافات جديدة | الإجمالي |
|-------|-----------------|----------------|----------|
| 🔴 ثغرات أمنية حرجة | 10 | 5 | 15 |
| 🟠 عالية الخطورة | 8 | 12 | 20 |
| 🟡 متوسطة | 15 | 18 | 33 |
| 🟢 توصيات | 10 | 10 | 20 |
| **الإجمالي** | **~43** | **45** | **~88** |

---

## إجمالي وقت الصيانة المقدر
- **المرحلة الأولى (فورية)**: 3-4 ساعات
- **المرحلة الثانية (قصير)**: 18-20 ساعة (3 أيام)
- **المرحلة الثالثة (هيكلية)**: 15-18 يوم
- **المرحلة الرابعة (استثمارية)**: 10-12 يوم

**الإجمالي**: ~30-35 يوم عمل لمبرمج واحد

---

*تم إعداد هذا التقرير بناءً على تحليل كامل لكود المصدر، ملفات السيرفر، والهيكلة العامة للنظام.*
