# خطة إصلاح الثغرات الأمنية — تطبيق سكني

> تاريخ الإنشاء: 7 يونيو 2026  
> الأولوية: **حرج** — يجب البدء فوراً

---

## 🔴 حرج — يجب التصرف فوراً

### 1. أسرار حية مسربة في المستودع (`.env`)

**الوصف:**
ملف `.env` يحتوي أسراراً حقيقية وهو غير مضاف لـ `.gitignore`، مما يعني أن كل هذه الأسرار منشورة في تاريخ المستودع.

**الأسرار المكشوفة:**
| السر | القيمة | الخطورة |
|------|--------|---------|
| `DB_PASSWORD` | `123` | كلمة سر قاعدة البيانات — حساب `sa` |
| `JWT_SECRET` | `sakani-secret-key-...` | مفتاح توقيع التوكن — يمكن تزوير أي JWT |
| `ENCRYPTION_KEY` | `sakani-encryption-key-32chars!!` | مفتاح تشفير البيانات |
| `YOUTUBE_API_KEY` | `AIzaSyBTjv2SHPMRbRlTi9Dd-m8...` | مفتاح YouTube API حقيقي |
| `VAPID_PRIVATE_KEY` | `Gb9gulZaC1dlJjgZnIa...` | مفتاح الإشعارات الخاص |
| `VAPID_PUBLIC_KEY` | `BAazhTY4BAIhi-eUAt5rWHw7...` | مفتاح الإشعارات العام |

**خطوات الإصلاح:**

1. **فوراً — إبطال الأسرار الحالية:**
   - غيّر كلمة سر قاعدة البيانات (DB_PASSWORD) في SQL Server
   - اذهب إلى [Google Cloud Console](https://console.cloud.google.com) > APIs & Services > Credentials، واحذف أو قيد مفاتیح YouTube API
   - غيّر VAPID keys (أنشئ زوج جديد)
   - غيّر JWT_SECRET
   - غيّر ENCRYPTION_KEY

2. **إزالة `.env` من تتبع Git:**
```bash
git rm --cached .env
echo ".env" >> .gitignore
git add .gitignore
git commit -m "إزالة .env من التتبع وإضافته لـ .gitignore"
```

3. **تنظيف تاريخ Git من الأسرار (اختياري لكن موصى به):**
```bash
# استخدم BFG Repo-Cleaner أو git filter-branch
# brew install bfg  أو استخدام أداة مشابهة
bfg --delete-files .env
git reflog expire --expire=now --all && git gc --prune=now --aggressive
```

4. **إنشاء `.env.example` جديد بأسرار وهمية:**
```env
DB_PASSWORD=your_db_password_here
JWT_SECRET=change-this-to-a-random-secret
ENCRYPTION_KEY=change-this-to-32-char-key
YOUTUBE_API_KEY=your_youtube_api_key
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
```

5. **ملفات متأثرة:**
   - `H:\sakani\.env` — الملف الأصلي (أضف لـ .gitignore)
   - `H:\sakani\.env.example` — أنشئ نسخة آمنة
   - `H:\sakani\server.ts:107-115` — التحقق من JWT_SECRET
   - `H:\sakani\src\backend\controllers\radio.controller.ts:548-579` — استخدام YouTube API key

---

### 2. `dangerouslySetInnerHTML` بدون تعقيم — XSS

**الملف:** `src/components/DailyReadingsCard.tsx:378`

**الوصف:**
السطر التالي يحقن HTML مباشرة في DOM بدون أي تعقيم:
```tsx
dangerouslySetInnerHTML={{ __html: item.html }}
```
إذا تم اختراق API `/api/dashboard/daily-readings` أو قاعدة البيانات، يمكن للمهاجم تنفيذ JavaScript في متصفح كل المستخدمين.

**خطوات الإصلاح:**

1. **تثبيت مكتبة تعقيم HTML:**
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

2. **تعديل `DailyReadingsCard.tsx`:**
```tsx
// قبل
import React from 'react';

// بعد
import React from 'react';
import DOMPurify from 'dompurify';
```

ثم غيّر السطر 378:
```tsx
// قبل
dangerouslySetInnerHTML={{ __html: item.html }}

// بعد
dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.html) }}
```

3. **ملفات متأثرة:**
   - `H:\sakani\src\components\DailyReadingsCard.tsx:378`

---

### 3. JWT في `localStorage` — سرقة التوكن عبر XSS

**الملف:** `src/contexts/AuthContext.tsx:130-131, 176-177`

**الوصف:**
التوكن مخزن في `localStorage` وهو قابل للقراءة من أي كود JavaScript في الصفحة. أي ثغرة XSS تسمح بسرقة التوكن والتحكم الكامل بحساب المستخدم.

**خطوات الإصلاح — تغيير كامل لآلية المصادقة:**

1. **تعديل السيرفر — إرسال JWT كـ httpOnly cookie بدلاً من response body:**

   في `src/backend/api/auth.routes.ts`:
```ts
// قبل - إرسال التوكن في body
res.json({ token, user, message: 'تم تسجيل الدخول بنجاح' });

// بعد - إرسال التوكن كـ httpOnly cookie
res.cookie('token', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000, // 24 ساعة
});
res.json({ user, message: 'تم تسجيل الدخول بنجاح' });
```

2. **تعديل `server.ts` — إضافة `cookie-parser`:**
```bash
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

```ts
import cookieParser from 'cookie-parser';
app.use(cookieParser());
```

3. **تعديل `src/backend/api/middleware.ts` — قراءة التوكن من الكوكيز:**
```ts
// قبل
const token = req.headers.authorization?.split(' ')[1];

// بعد
const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
```

4. **تعديل `AuthContext.tsx` — إزالة localStorage:**
```tsx
// قبل
localStorage.setItem('token', newToken);
localStorage.setItem('user', JSON.stringify(newUser));

// بعد
// فقط حفظ بيانات المستخدم (بدون توكن)
localStorage.setItem('user', JSON.stringify(newUser));
// التوكن يُدار تلقائياً عبر الكوكيز
```

5. **تعديل `useApi` hook — إزالة إرفاق التوكن يدوياً (لأن الكوكي يُرسل تلقائياً):**

   في `src/hooks/useApi.ts`:
```ts
// قبل
headers: { Authorization: `Bearer ${token}` }

// بعد
// إزالة السطر — الكوكي يُرسل تلقائياً مع كل طلب
```

6. **إضافة مسار لتحديث التوكن:**
   - أنشئ `POST /api/auth/refresh` endpoint
   - يستخدم refresh token في كوكي منفصل

7. **ملفات متأثرة:**
   - `H:\sakani\src\contexts\AuthContext.tsx:130-131, 176-177`
   - `H:\sakani\src\hooks\useApi.ts` — كل الاستدعاءات التي تقرأ `localStorage.getItem('token')`
   - `H:\sakani\src\backend\api\auth.routes.ts` — مسارات تسجيل الدخول
   - `H:\sakani\src\backend\api\middleware.ts` — التحقق من التوكن
   - `H:\sakani\server.ts` — إضافة cookie-parser
   - `H:\sakani\src\components\FinancePage.tsx:146` — قراءة التوكن من localStorage
   - `H:\sakani\src\components\NotificationBell.tsx` — قراءة التوكن
   - `H:\sakani\src\components\Layout.tsx` — قراءة التوكن

---

### 4. كلمة سر قاعدة البيانات ضعيفة (`sa` / `123`)

**الملف:** `.env:5-6`

**الوصف:**
حساب `sa` (System Administrator) في SQL Server بكلمة سر `123`. هذا الحساب لديه صلاحية كاملة على قاعدة البيانات — حذف، تعديل، قراءة أي شيء.

**خطوات الإصلاح:**

1. **تغيير كلمة سر `sa` في SQL Server:**
```sql
ALTER LOGIN sa WITH PASSWORD = 'أدخل_كلمة_سر_قوية_عشوائية_هنا';
```

2. **تحديث `DB_PASSWORD` في `.env`:**
```env
DB_PASSWORD=أدخل_كلمة_سر_قوية_عشوائية_هنا
```

3. **إنشاء مستخدم مخصص بدلاً من `sa`:**
```sql
CREATE LOGIN sakani_user WITH PASSWORD = 'كلمة_سر_قوية';
CREATE USER sakani_user FOR LOGIN sakani_user;
ALTER ROLE db_datareader ADD MEMBER sakani_user;
ALTER ROLE db_datawriter ADD MEMBER sakani_user;
```

4. **تحديث `.env` لاستخدام المستخدم الجديد:**
```env
DB_USER=sakani_user
DB_PASSWORD=كلمة_سر_قوية
```

5. **ملفات متأثرة:**
   - `H:\sakani\.env:5-6`
   - `H:\sakani\src\backend\infrastructure\mssql_db.ts:8-10`
   - `H:\sakani\src\backend\infrastructure\knex.ts:8-10`

---

## 🟠 عالي — يحتاج معالجة قريباً

### 5. WebSocket بدون مصادقة

**الملف:** `server.ts:362-370`

**الوصف:**
أي عميل يستطيع الاتصال بالـ WebSocket والانضمام لأي `tenant` أو `user` room دون تحقق من هويته، مما يسمح باستقبال الإشعارات والبثوث الخاصة بمستخدمين آخرين.

**خطوات الإصلاح:**

1. **تعديل `server.ts` — إضافة middleware للمصادقة على الـ Socket:**
```ts
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('مصادقة مطلوبة'));

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    (socket as any).user = decoded;
    next();
  } catch (err) {
    next(new Error('توكن غير صالح'));
  }
});
```

2. **تعديل حدثي `join-tenant` و `join-user` — التحقق من الصلاحية:**
```ts
socket.on("join-tenant", (tenantId) => {
  // السماح فقط إذا كان المستخدم يتبع هذا الـ tenant
  if (socket.user?.tenantId === tenantId || socket.user?.role === 'admin') {
    socket.join(`tenant-${tenantId}`);
  }
});

socket.on("join-user", (userId) => {
  // السماح فقط للمستخدم بنفسه
  if (socket.user?.id === userId) {
    socket.join(`user-${userId}`);
  }
});
```

3. **تعديل الـ Frontend — إرسال التوكن عند الاتصال:**
```ts
// src/hooks/useSocket.ts أو المكان المناسب
const socket = io('https://your-server.com', {
  auth: { token: getToken() }
});
```

4. **ملفات متأثرة:**
   - `H:\sakani\server.ts:362-370`

---

### 6. CSP يسمح `unsafe-inline` + `unsafe-eval`

**الملف:** `server.ts:193`

**الوصف:**
سياسة CSP الحالية تسمح بـ `unsafe-inline` و `unsafe-eval` في `scriptSrc`، مما يلغي معظم الحماية التي يوفرها CSP ضد هجمات XSS.

**خطوات الإصلاح:**

1. **في بيئة الإنتاج — تشديد CSP:**
```ts
// server.ts — قسم helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
      styleSrc: ["'self'", "'unsafe-inline'"], // 'unsafe-inline' للـ styles ضروري أحياناً
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https://stream.radiojar.com", "https://www.googleapis.com"],
      // ... باقي التوجيهات
    }
  }
}));
```

2. **إضافة nonce لكل `<script>` في الصفحة:**
   - استخدم `crypto.randomBytes(16).toString('hex')` لكل request
   - أضف `nonce={nonce}` لكل `<script>` tag

3. **ملفات متأثرة:**
   - `H:\sakani\server.ts:193`

---

### 7. تشفير قاعدة البيانات معطل

**الملف:**
- `src/backend/infrastructure/mssql_db.ts:15`
- `src/backend/infrastructure/knex.ts:17`

**الوصف:**
`encrypt: false` يعني أن البيانات (بما فيها كلمة سر DB) تُنقل نصاً صريحاً بين السيرفر و SQL Server.

**خطوات الإصلاح:**

1. **تعديل `mssql_db.ts`:**
```ts
// قبل
encrypt: false,

// بعد
encrypt: process.env.NODE_ENV === 'production',
```

2. **تعديل `knex.ts`:**
```ts
// قبل
encrypt: false,

// بعد
encrypt: process.env.NODE_ENV === 'production',
```

3. **تأكد من أن SQL Server لديه شهادة SSL مثبتة في الإنتاج.**

4. **ملفات متأثرة:**
   - `H:\sakani\src\backend\infrastructure\mssql_db.ts:15`
   - `H:\sakani\src\backend\infrastructure\knex.ts:17`

---

### 8. رفع الملفات — التحقق فقط بالامتداد

**الملف:** `src/backend/middleware/upload.ts:13-18`

**الوصف:**
التحقق من نوع الملف يتم فقط بفحص `path.extname()` (الامتداد)، وليس بفحص MIME type أو التوقيع السحري (magic bytes). المهاجم يستطيع إعادة تسمية ملف `.exe` أو `.html` إلى `.pdf` ورفعه.

**خطوات الإصلاح:**

1. **تثبيت مكتبة فحص الملفات:**
```bash
npm install file-type
```

2. **تعديل `upload.ts` — إضافة فحص MIME وتوقيع سحري:**
```ts
import { fileTypeFromFile } from 'file-type';

// في middleware
const fileType = await fileTypeFromFile(file.path);
const allowedMimes = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword'
];

if (!fileType || !allowedMimes.includes(fileType.mime)) {
  // حذف الملف المرفوض
  fs.unlinkSync(file.path);
  return cb(new Error('نوع الملف غير مسموح به'), false);
}
```

3. **الاحتفاظ بفحص الامتداد كطبقة إضافية:**
```ts
const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
const ext = path.extname(file.originalname).toLowerCase();
if (!allowedExts.includes(ext)) {
  return cb(new Error('امتداد الملف غير مسموح'), false);
}
```

4. **ملفات متأثرة:**
   - `H:\sakani\src\backend\middleware\upload.ts`

---

### 9. اختبارات تحتوي كلمات سر إنتاجية

**الملف:** `src/test/*.test.ts`

**الوصف:**
ملفات الاختبار تحتوي كلمات سر مثل `admin123` و `test123` تشبه كلمات سر الإنتاج. يمكن أن تسرب إذا كان المستودع عاماً.

**خطوات الإصلاح:**

1. **استخدام متغيرات بيئة للاختبارات:**
```ts
// قبل
admin: { email: 'admin@sakani.com', password: 'admin123' },

// بعد
admin: {
  email: process.env.TEST_ADMIN_EMAIL || 'test-admin@sakani.com',
  password: process.env.TEST_ADMIN_PASSWORD || 'test-admin-password-123'
},
```

2. **إضافة `.env.test` (مضاف لـ `.gitignore`):**
```env
TEST_ADMIN_EMAIL=admin@sakani.com
TEST_ADMIN_PASSWORD=admin123
```

3. **ملفات متأثرة:**
   - `H:\sakani\src\test\pagination.test.ts`
   - `H:\sakani\src\test\rooms.test.ts`
   - `H:\sakani\src\test\students.test.ts`
   - `H:\sakani\src\test\employees.test.ts`
   - `H:\sakani\src\test\auth.test.ts`
   - `H:\sakani\src\test\health.test.ts`
   - `H:\sakani\src\test\setup.ts`

---

### 10. كلمة سر المستخدم الافتراضية ضعيفة

**الملف:**
- `.env.example:17`
- `src/backend/api/user.routes.ts:117-121`
- `src/backend/api/students/crud.routes.ts:287-289`
- `src/backend/api/tenant.routes.ts:348-350`
- `src/backend/api/student.service.ts:49-51, 132-134`

**الوصف:**
`DEFAULT_USER_PASSWORD` بقيمة `123456`. جميع حسابات المستخدمين الجدد تُنشأ بهذه الكلمة السرية.

**خطوات الإصلاح:**

1. **تغيير `DEFAULT_USER_PASSWORD` في `.env`:**
```env
DEFAULT_USER_PASSWORD=Aa#$(openssl rand -base64 12)
```

2. **إرسال إيميل تفعيل مع رابط لتغيير كلمة السر للمستخدمين الجدد:**
   - بدلاً من استخدام كلمة سر افتراضية، أرسل رابطاً لتحديد كلمة السر

3. **إجبار تغيير كلمة السر عند أول تسجيل دخول:**
```sql
-- أضف عمود must_change_password في جدول users
ALTER TABLE users ADD must_change_password BIT DEFAULT 1;
```

```ts
// في middleware
if (user.must_change_password && req.path !== '/api/auth/change-password') {
  return res.status(403).json({ message: 'يجب تغيير كلمة السر أولاً', mustChangePassword: true });
}
```

4. **ملفات متأثرة:**
   - `H:\sakani\.env.example:17`
   - `H:\sakani\src\backend\api\user.routes.ts:117-121`
   - `H:\sakani\src\backend\api\students\crud.routes.ts:287-289`
   - `H:\sakani\src\backend\api\tenant.routes.ts:348-350`
   - `H:\sakani\src\backend\api\student.service.ts:49-51, 132-134`

---

## 🟡 متوسط

### 11. السيرفر على HTTP/0.0.0.0 — لا يوجد HTTPS مباشر

**الملف:** `server.ts:406`

**الوصف:**
السيرفر يربط على `0.0.0.0` عبر HTTP بدون تشفير. في الإنتاج، يجب استخدام HTTPS.

**خطوات الإصلاح:**

1. **استخدام reverse proxy (Nginx) مع HTTPS:**
   - راجع `nginx.conf` — قم بتحديث اسم النطاق وشهادات SSL
   ```nginx
   server_name sakani.app; # غيّر لاسم النطاق الفعلي
   ```

2. **أو استخدام `https` module في Node.js مباشرة:**
```ts
import https from 'https';
import fs from 'fs';

const httpsServer = https.createServer({
  key: fs.readFileSync('/etc/ssl/private/sakani.key'),
  cert: fs.readFileSync('/etc/ssl/certs/sakani.crt')
}, app);
```

3. **تقييد `0.0.0.0` في الإنتاج — استخدم `localhost` في التطوير:**
```ts
const bindAddr = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
httpServer.listen(PORT, bindAddr, () => { ... });
```

4. **ملفات متأثرة:**
   - `H:\sakani\server.ts:406`
   - `H:\sakani\nginx.conf`

---

### 12. رابط الراديو يستخدم HTTP — mixed content

**الملف:**
- `src/components/radio/types.ts:80`
- `src/components/AdminRadio514.tsx:259`
- `src/components/LiveControlRoom.tsx:225`
- `src/components/radio/admin/AudioBroadcastTab.tsx:265`

**الوصف:**
استخدام `http://stream.radiojar.com/...` بدلاً من `https://`. يؤدي إلى mixed content warnings وقد يمنع المتصفح تحميل المحتوى.

**خطوات الإصلاح:**

1. **تغيير الرابط الافتراضي إلى HTTPS:**
```ts
// types.ts
export const DEFAULT_STREAM_URL = 'https://stream.radiojar.com/ps7z45v12k8uv';
```

2. **تحديث كل الأماكن التي تستخدم HTTP:**
```ts
// AdminRadio514.tsx, LiveControlRoom.tsx
await fetch('https://stream.radiojar.com/ps7z45v12k8uv', { ... });
```

3. **ملفات متأثرة:**
   - `H:\sakani\src\components\radio\types.ts:80`
   - `H:\sakani\src\components\AdminRadio514.tsx:259`
   - `H:\sakani\src\components\LiveControlRoom.tsx:225`
   - `H:\sakani\src\components\radio\admin\AudioBroadcastTab.tsx:265`

---

### 13. Swagger UI بدون مصادقة

**الملف:** `server.ts:306-309`

**الوصف:** توثيق API الكامل متاح للعامة في `/api-docs` بدون مصادقة، مما يكشف كل endpoints، parameters، و schemas.

**خطوات الإصلاح:**

1. **إضافة مصادقة لـ Swagger UI:**
```ts
import basicAuth from 'express-basic-auth';

app.use('/api-docs',
  basicAuth({
    users: { admin: process.env.SWAGGER_PASSWORD || 'swagger-admin' },
    challenge: true,
  }),
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);
```

2. **أو تعطيله في الإنتاج تماماً:**
```ts
if (process.env.NODE_ENV !== 'production') {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
```

3. **ملفات متأثرة:**
   - `H:\sakani\server.ts:306-309`

---

### 14. تسجيل معلومات حساسة في console

**الملف:**
- `src/backend/infrastructure/db.ts:28-33`
- `src/backend/infrastructure/knex.ts:26-30`

**الوصف:**
السيرفر يسجل DB_HOST، DB_NAME، DB_INSTANCE في console عند بدء التشغيل.

**خطوات الإصلاح:**

1. **إخفاء معلومات الاتصال الحساسة:**
```ts
// db.ts
console.log('📦 Database connected:', process.env.DB_NAME);
// لا تسجل DB_HOST أو DB_INSTANCE
```

2. **أو تسجيلها فقط في التطوير:**
```ts
if (process.env.NODE_ENV !== 'production') {
  console.log('DB runtime:', { DB_NAME: process.env.DB_NAME });
}
```

3. **ملفات متأثرة:**
   - `H:\sakani\src\backend\infrastructure\db.ts:28-33`
   - `H:\sakani\src\backend\infrastructure\knex.ts:26-30`

---

### 15. IDOR محتمل — مسار حذف المالية لا يتحقق tenant

**الملف:** `src/backend/api/finance.routes.ts:106-134`

**الوصف:**
استعلام الحذف الأولي لا يتحقق من أن السجل يتبع الـ tenant الحالي للمستخدم:
```ts
const record = await kdb('finances').where({ id: req.params.id }).first();
```
التحقق من tenant يحدث لاحقاً في استعلام الحذف، لكن الاستعلام الأولي يسمح بتسريب وجود السجل (enumeration).

**خطوات الإصلاح:**

```ts
// قبل
const record = await kdb('finances').where({ id: req.params.id }).first();
if (!record) return res.status(404).json({ message: 'السجل غير موجود' });

// بعد — أضف tenant_id للاستعلام
const record = await kdb('finances').where({
  id: req.params.id,
  tenant_id: req.user.tenantId  // إضافة التحقق
}).first();
if (!record) return res.status(404).json({ message: 'السجل غير موجود' });
```

**ملفات متأثرة:**
- `H:\sakani\src\backend\api\finance.routes.ts:107`

---

### 16. لا يوجد refresh token

**الملف:** `src/backend/api/auth.routes.ts:99-103, 189-193`

**الوصف:**
التوكن ينتهي بعد 24 ساعة ولا توجد آلية لتجديده بشكل آمن. المستخدم يُطرد بعد 24 ساعة.

**خطوات الإصلاح:**

1. **إضافة refresh token في جدول منفصل:**
```sql
CREATE TABLE refresh_tokens (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT GETDATE(),
  revoked BIT DEFAULT 0
);
```

2. **إضافة مسار `POST /api/auth/refresh`:**
```ts
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) return res.status(401).json({ message: 'Refresh token مطلوب' });

  // تحقق من صحة الـ refresh token في قاعدة البيانات
  const stored = await kdb('refresh_tokens').where({ token: refreshToken, revoked: false }).first();
  if (!stored || new Date(stored.expires_at) < new Date()) {
    return res.status(401).json({ message: 'Refresh token غير صالح أو منتهي' });
  }

  // إصدار توكن جديد
  const newToken = jwt.sign({ id: stored.user_id, ... }, process.env.JWT_SECRET, { expiresIn: '24h' });
  res.cookie('token', newToken, { httpOnly: true, secure: true, sameSite: 'strict', maxAge: 24 * 60 * 60 * 1000 });
  res.json({ message: 'تم تجديد التوكن' });
});
```

3. **ملفات متأثرة:**
   - `H:\sakani\src\backend\api\auth.routes.ts`

---

### 17. Nginx بإعدادات وهمية

**الملف:** `nginx.conf:9, 16, 19-20`

**الوصف:** اسم النطاق ومسارات شهادات SSL ما زالت قيماً وهمية.

**خطوات الإصلاح:**

1. **تحديث اسم النطاق:**
```nginx
server_name your-production-domain.com; # غيّر للنطاق الفعلي
```

2. **تأكد من وجود شهادات SSL في المسار الصحيح:**
```nginx
ssl_certificate     /etc/ssl/certs/sakani.crt;
ssl_certificate_key /etc/ssl/private/sakani.key;
```

3. **تحقق من `docker-compose.yml` — مجلد الـ ssl:**
```yaml
volumes:
  - ./ssl:/etc/nginx/ssl:ro  # تأكد من وجود الملفات في ./ssl
```

4. **ملفات متأثرة:**
   - `H:\sakani\nginx.conf`
   - `H:\sakani\docker-compose.yml`

---

## 🟢 توصيات سريعة — قائمة المهام

| # | المهمة | الأولوية | الملفات المتأثرة | الوقت المقدر |
|---|--------|----------|-----------------|--------------|
| 1 | `git rm --cached .env && echo ".env" >> .gitignore` | 🔴 فورية | `.env`, `.gitignore` | 5 دقائق |
| 2 | إبطال وتغيير كل الأسرار الفعلية (YouTube API, VAPID, JWT, DB) | 🔴 فورية | `.env` + منصات خارجية | 30 دقيقة |
| 3 | إضافة DOMPurify في `DailyReadingsCard.tsx` | 🔴 فورية | `DailyReadingsCard.tsx` | 10 دقائق |
| 4 | تغيير كلمة سر `sa` في SQL Server | 🔴 فورية | `.env` + SQL Server | 10 دقائق |
| 5 | تغيير JWT من localStorage إلى httpOnly cookies | 🟠 عالي | `AuthContext.tsx`, `useApi.ts`, `auth.routes.ts`, `middleware.ts` | 4-6 ساعات |
| 6 | إضافة مصادقة WebSocket | 🟠 عالي | `server.ts` | 2-3 ساعات |
| 7 | تحسين CSP (غير `unsafe-inline`/`unsafe-eval`) | 🟠 عالي | `server.ts` | 1 ساعة |
| 8 | تفعيل تشفير قاعدة البيانات (`encrypt: true`) | 🟠 عالي | `mssql_db.ts`, `knex.ts` | 30 دقيقة |
| 9 | فحص MIME type في رفع الملفات | 🟠 عالي | `upload.ts` | 1 ساعة |
| 10 | إخفاء كلمات سر الاختبارات في env | 🟠 عالي | `src/test/*.test.ts` | 30 دقيقة |
| 11 | تحسين كلمة السر الافتراضية للمستخدمين الجدد | 🟠 عالي | `user.routes.ts`, `student.service.ts` | 2 ساعات |
| 12 | تغيير رابط الراديو إلى HTTPS | 🟡 متوسط | `types.ts`, `AdminRadio514.tsx`, `LiveControlRoom.tsx` | 15 دقيقة |
| 13 | إضافة مصادقة لـ Swagger UI | 🟡 متوسط | `server.ts` | 30 دقيقة |
| 14 | إخفاء معلومات DB من console logs | 🟡 متوسط | `db.ts`, `knex.ts` | 10 دقائق |
| 15 | إصلاح IDOR في finance delete | 🟡 متوسط | `finance.routes.ts` | 10 دقائق |
| 16 | إضافة refresh token mechanism | 🟡 متوسط | `auth.routes.ts` | 3-4 ساعات |
| 17 | تحديث nginx.conf بالإعدادات الصحيحة | 🟡 متوسط | `nginx.conf` | 30 دقيقة |
| 18 | تركيب HTTPS عبر Nginx | 🟡 متوسط | `nginx.conf`, `docker-compose.yml` | 1 ساعة |

---

## ملاحظات إضافية

- **أولوية التنفيذ:** ابدأ من الأعلى إلى الأسفل.
- **الاختبار بعد كل إصلاح:** `npx tsc --noEmit` وتأكد من عدم وجود أخطاء.
- **للأسرار:** بعد تغيير كل السر، اختبر أن التطبيق لا يزال يعمل بشكل كامل.
- **Git:** اعمل feature branch لكل إصلاح منفصل لتسهيل الـ review والـ rollback.
