# سكني — نظام إدارة السكن الجامعي الذكي

نظام متكامل (Multi-Tenant) لإدارة السكن الجامعي بكل جوانبة: السكن والغرف والإشغال، الطلاب وأولياء الأمور، الموظفون، الحضور الذكي بالـ GPS/Geofencing، الفعاليات والأنشطة والمسابقات، السلوك والنقاط والإنذارات، المالية (مع دفتر يومية محاسبي)، الصيانة، المغسلة، الإشعارات والبث، وراديو 5:14 للبث المباشر — كل ذلك بواجهة عربية RTL بثيم نيون ووضعين ليلي/فاتح.

> تم تطوير وبناء هذا التطبيق لخدمة الكنيسة وتسهيل التواصل بين الأبناء وأولياء الأمور والكنيسة.
> **المطوّر:** شكري شفيق جاد إبراهيم.

---

## المحتويات
1. [نظرة عامة](#نظرة-عامة)
2. [المميزات حسب الوحدة](#المميزات-حسب-الوحدة)
3. [الأدوار والصلاحيات (RBAC)](#الأدوار-والصلاحيات-rbac)
4. [البنية التقنية](#البنية-التقنية)
5. [الإعداد والتشغيل المحلي](#الإعداد-والتشغيل-المحلي)
6. [متغيّرات البيئة](#متغيّرات-البيئة)
7. [قاعدة البيانات و TLS](#قاعدة-البيانات-و-tls)
8. [النشر عبر Docker](#النشر-عبر-docker)
9. [السكربتات](#السكربتات)
10. [الاختبارات](#الاختبارات)
11. [الأمان](#الأمان)
12. [استكشاف الأخطاء](#استكشاف-الأخطاء)
13. [ملاحظات وبنود مفتوحة](#ملاحظات-وبنود-مفتوحة)

---

## نظرة عامة

- **التطبيق**: واجهة ويب (PWA) + خادم API + قاعدة بيانات **Microsoft SQL Server**.
- **تعدّد السكنات (Multi-Tenancy)**: الأسقف يعيّن أكثر من كاهن/مشرف لكل سكن، والكاهن/المشرف يدير أكثر من سكن، مع **عزل بيانات صارم server-side** عبر ترويسة `X-Tenant-Id`.
- **مبدأ الأمان الأساسي**: الواجهة الأمامية ليست حدًا أمنيًا؛ كل التحقق والتخويل يتم على الخادم.
- **اسم قاعدة البيانات الافتراضي**: `DormMaster`.
- **النطاق الإنتاجي**: `sakani.mase7y.org`.

---

## المميزات حسب الوحدة

### 1. السكن والغرف والشقق (Housing)
- **الشقق**: مرافق عامة (تكييف، مروحة، تلفزيون، واي فاي)، تفاصيل المطبخ (ثلاجة، بوتاجاز، سخان، مطبخ خاص)، وتفاصيل الحمام (سخان غاز/كهرباء، غسالة).
- **الغرف**: تسعير مرن لكل غرفة (يومي / شهري / ترم دراسي)، محتويات الغرفة (مكتب، دولاب، تكييف)، وتتبّع حيّ لنسبة الإشغال مع شريط لوني (أزرق → برتقالي → أحمر). **لا يمكن حذف غرفة بها طلاب مسجّلون**.
- **الأترام الدراسية**: ضبط تواريخ الترم الأول/الثاني من الإعدادات لضبط الفواتير والتقارير.
- **الهيكل الهرمي**: طالب → غرفة → شقة → مبنى/سكن (Tenant).
- **الصلاحيات**: `VIEW_HOUSING` / `MANAGE_HOUSING` / `VIEW_ROOMS` / `ADD_ROOM` / `EDIT_ROOM` / `DELETE_ROOM`.

### 2. الطلاب والأرشفة (Students & Archiving)
- ملف تعريف شامل (بيانات أكاديمية وشخصية وديانة + بيانات ولي الأمر + الرقم الجامعي).
- **إنشاء حساب دخول تلقائي للطالب** فور التسجيل، وربطه بالغرفة مع تحديث سعة الغرفة.
- **الأرشفة الذكية (Data Snapshot)**: عند المغادرة (تخرج/انسحاب/فصل) يتم إخلاء السرير، تجميد الحساب، وحفظ لقطة كاملة (الاسم، الرقم الجامعي، بيانات أولياء الأمور) + سبب وتاريخ المغادرة. APIs: `/api/students/archive` و `/api/students/:id/leave`.
- **ترميز لوني للأرشيف**: 🟢 خريج، 🔴 فصل إداري، 🟠 انسحاب بالرغبة.
- **QR Code** حقيقي لكل طالب، ووجهات: حضور/انصراف GPS، عرض QR، طلبات الصيانة/الغسيل، رصيد النقاط، تسجيل السفر والعودة.
- **الصلاحيات**: `VIEW_STUDENT`, `ADD_STUDENT`, `EDIT_STUDENT`, `DELETE_STUDENT`, `ASSIGN_ROOM`, `MOVE_STUDENT`.

### 3. أولياء الأمور (Guardians / Parents)
- حساب مستخدم منفصل لكل ولي أمر، مع إمكانية ربط **أكثر من ولي أمر** بنفس الطالب (أب، أم، قريب) وتحديد الصفة (الوظيفة، واتساب، إيميل).
- لوحة `ParentDashboard`: التقارير المالية (مدفوعات ومستحقات)، سجل الحضور/الانصراف اليومي، إشعارات فورية عند الدخول/الخروج/التأخير، التحذيرات والدرجات والمكافآت.
- إشعارات السلوك والغياب تُرسَل تلقائيًا. المسار: `/api/parents`.

### 4. الموظفون (Employees)
- إضافة مستخدمين (مشرفين، مساعدين، موظفين) بكلمة مرور مؤقتة، مع أدوار: `priest`, `supervisor`, `assistant_supervisor`, `employee`.
- **منع إدارة موظف في سكن آخر (Tenant)**، وكلمات المرور مشفّرة بـ Bcrypt.
- يمكن للأسقف/الأدمن تعيين كاهن/مشرف لعدة سكنات → يظهر له **مبدّل السكن (TenantSelector)**.
- **الصلاحيات**: `MANAGE_EMPLOYEES`, `ASSIGN_ROLES`, `VIEW_USERS`, `MANAGE_USERS`.

### 5. الحضور والغياب الذكي (Attendance — GPS / Geofencing)
- **Geofencing**: لا يُسجَّل الحضور إلا داخل نطاق السكن (نطاق عام ~300 متر)، مع نقاط **دخول/خروج مخصصة** وقطر مخصص لكل نقطة (مثل 50 م).
- **غلق السكن (Curfew)**: وقت غلق رسمي (مثل 10:00 مساءً)؛ أي دخول بعده يُسجَّل **Late** تلقائيًا، وسجل التأخيرات غير قابل للحذف.
- **نظام السفر**: تسجيل "مسافر" (وجهة + سبب) → إعفاء تلقائي من التأخير وتعطيل الحضور، وزر "عدت من السفر".
- **QR**: الطالب يمسح كود الفعالية/الجلسة، أو المشرف يمسح كود الطالب.
- **الصلاحيات**: `VIEW_ATTENDANCE`, `CHECKIN_ATTENDANCE`, `MANAGE_ATTENDANCE`.

### 6. الفعاليات والأنشطة (Events / Activities)
- **هيكل شجري**: فعالية رئيسية (Master Event) → جلسات/أقسام (محاضرات/صلوات).
- الخصائص: عنوان/وصف/تاريخ/مكان، **Geofencing + Radius**، سعر (مجاني/مدفوع)، تعيين **أكثر من مسؤول**، وكود QR فريد.
- لوحة الفعالية بأربعة تبويبات: التفاصيل / الأقسام والمحاضرات / كشف الحضور والغياب (زر QR) / التقرير الإجمالي.
- **إدارة الأعذار**: حاضر / غائب / **معذور** / **غير معذور** + كتابة السبب، مع إشعار تلقائي لولي الأمر والأب الكاهن.
- الطالب له تبويب موحّد **"الأنشطة والمسابقات والفعاليات"** (`UnifiedActivitiesPage`) للعرض/الاشتراك فقط.
- **الصلاحيات**: `CREATE_EVENT`, `EDIT_EVENT`, `DELETE_EVENT`, `ATTEND_EVENT`, `VIEW_EVENTS`, `MANAGE_EVENT_ATTENDANCE`, `MANAGE_EVENT_PAYMENTS`, `OPERATE_EVENT_ATTENDANCE`.

### 7. المسابقات (Competitions)
- إنشاء فرق متعددة (مسؤول + قائمة أعضاء)، **معايير تقييم** بدرجة قصوى لكل معيار.
- **نظام الدرجات**: جماعية / فردية / سالبة (خصم) + نقاط تشجيعية تتوزع **تلقائيًا** على الأعضاء.
- **Live Leaderboard** مباشر (ترتيب تلقائي، Winning Threshold، Presentation Mode، ثيم نيون).
- مسابقات ثقافية (Quizzes بعدد أسئلة)، نقاط الجائزة الكبرى، توزيع جوائز دفعة واحدة، وأرشفة.
- **الصلاحيات**: `MANAGE_COMPETITIONS`, `VIEW_COMPETITIONS`, `JOIN_COMPETITIONS`.

### 8. السلوك والنقاط (Behavior & Points)
- **محرّك النقاط**: حضور +2، غياب −5، تأخير −2 (قيم موثّقة وقابلة للضبط).
- سجل عمليات شفاف (السبب، النقاط، التاريخ، المسؤول) بلون أخضر للمكافأة وأحمر للخصم.
- **الإنذارات الرسمية — 4 مستويات**: 🔵 منخفض / 🟡 متوسط / 🟠 عالٍ / 🔴 حرج (تحذير شفهي، إنذار كتابي، إنذار نهائي/فصل مؤقت)، مع إبلاغ ولي الأمر بضغطة زر.
- **المتجر التحفيزي (Rewards Store)**: شراء مكافآت بالنقاط وإدارة طلبات الاستبدال (موافقة/رفض + خصم آلي).
- **الأوسمة اليدوية (Badges)**: المنضبط، المبادر، المثقف، الروح الرياضية — كل وسام يمنح نقاطًا فورية.
- **سجل القرارات (Decisions Log + Undo)**: مراجعة كل قرار إداري والتراجع عنه وعكس آثاره.
- **الصلاحيات**: `MANAGE_POINTS`, `VIEW_POINTS`, `MANAGE_REWARDS`, `MANAGE_PENALTIES`, `VIEW_DECISION_LOG`, `UNDO_DECISION`.

### 9. المالية (Finance)
- **ملخص الخزينة**: صافي الرصيد = الإيرادات − المصروفات؛ إجمالي الإيرادات؛ إجمالي المصروفات.
- **التصنيفات**: رسوم سكن، رسوم فعاليات، صيانة، رواتب، مع **ربط المعاملات بالطلاب**.
- **التكامل مع الفعاليات**: زر "تأكيد الدفع" في كشف الحضور المدفوع، وتمييز الدافعين، وإحصائيات دفع في التقرير.
- **Journal Ledger**: قيود محاسبية مع backfill/verify، وعزل مالية الأدمن.
- **تصدير** تقارير PDF (`pdfkit`, `pdf-lib`) وExcel (`exceljs`).
- **الصلاحيات**: `VIEW_FINANCE`, `ADD_EXPENSE`, `ADD_REVENUE`, `VIEW_FINANCE_REPORTS`.

### 10. الصيانة (Maintenance)
- فتح بلاغ (وصف العطل، المكان/رقم الغرفة، صورة، أولوية) من الطالب أو المشرف.
- **الأولويات**: 🔴 عاجل جدًا / 🟠 عالية / 🔵 عادي. الحالات: قيد الانتظار → جاري العمل → تم الإصلاح.
- تعيين موظف صيانة، سجل إصلاحات لكل غرفة، وإشعارات بالمهام الجديدة.
- **الصلاحيات**: `REQUEST_MAINTENANCE`, `VIEW_MAINTENANCE`, `HANDLE_MAINTENANCE`.

### 11. المغسلة (Laundry)
- حجز مواعيد غسيل مسبقة، إدارة الطابور، وحالات الماكينات (قيد الانتظار / قيد الغسيل / جاهز للاستلام)، مع إشعارات الاستلام.
- **الصلاحيات**: `JOIN_LAUNDRY`, `VIEW_LAUNDRY_QUEUE`, `MANAGE_LAUNDRY`, `MANAGE_LAUNDRY_OPERATORS`, `START_LAUNDRY_SESSION`, `CLOSE_LAUNDRY_SESSION`.

### 12. الراديو / البث (راديو 5:14)
- بث مباشر صوتي (RadioJar)، مكتبة فيديو، قوائم تشغيل، تيكرات، تصنيفات، شات مباشر، وإحصائيات/تحليلات.
- **إدارة الشات (Moderation)**: حظر/كتم/طرد (ban/mute/kick/unban)، قائمة المحظورين، وعرض رسائلهم.
- أدوار راديو مخصصة (`RadioRole`): `radio_admin`, `radio_audio_admin`, `radio_video_admin`, `radio_library_admin`, `radio_operator`.
- تكامل YouTube (رفع/معاينة) وإشعارات اشتراك البث (Web-Push/VAPID).
- **الصلاحيات**: `VIEW_RADIO`, `MANAGE_RADIO_BROADCAST`, `MANAGE_RADIO_VIDEO_LIBRARY`, `MANAGE_RADIO_PLAYLISTS`, `MANAGE_RADIO_TICKERS`, `MODERATE_RADIO_CHAT`, `VIEW_RADIO_ANALYTICS`.

### 13. الاستوديو (Studio)
- غرفة تحكّم للبث المباشر: البثّات النشطة، معاينة إدارية، حقن البث، معاينة YouTube، شات، معالج النشر (`PostWizardModal`)، مشغلات آلية (Automation Triggers)، ومتصفح أرشيف.

### 14. الشكاوى (Complaints)
- نظام شكاوى **مشفّر AES-256** يصل للإدارة العليا فقط، متابعة الحالة (قيد الانتظار / جاري التحقيق / تم الحل)، تنبيهات آلية للمشرفين، وربط تلقائي بالطلاب.

### 15. الإشعارات والبث الإداري والأخبار
- إشعارات داخل التطبيق + جرس تفاعلي (`NotificationBell`) + **Desktop/Browser Notifications** (web-push + VAPID) + اشتراكات push (migration `030`) + إشعارات بريد (nodemailer/SMTP).
- **Broadcast/News**: إدارة الأخبار والتيكر، مع صلاحيات `SEND_BROADCAST` / `VIEW_BROADCASTS`.
- **فلتر الإعلانات الذكي (cascading tenant filter)**: فلتر "المساكن" كفلتر رئيسي يصفّي الطلاب/الموظفين/المشرفين/الكهنة/الكليات/المحافظات/الكنائس حسب السكن المختار.

### 16. لوحات القيادة والتقارير (Dashboards & Reports)
- **مشرف السكن**: نظرة عامة على السكن (بطاقات ملخّص) + قائمة "يحتاج متابعة".
- **الكاهن (Priest Dashboard)**: إحصائيات الإشغال والأسرة، **مقترحات الفصل** (مع الأسباب والإنذارات)، صندوق البلاغات (اعتماد/رفض التنبيهات)، تحذير جماعي بضغطة واحدة، سجل الخريجين، وأزرار `handleApproveExpulsion` / `handleRejectExpulsion`.
- **الأسقف (Bishop)**: رؤية شاملة لكل السكنات التابعة + تقارير الأبرشية (إحصائيات الطلاب/المالية/الإشغال ورسوم بيانية سنوية).
- **الأدمن**: تحكم كامل بالنظام والسكنات والأساقفة والإعدادات.
- **الصلاحيات**: `VIEW_DASHBOARD`, `VIEW_REPORTS`, `VIEW_GLOBAL_REPORTS`, `VIEW_PRIEST_DASHBOARD`, `MANAGE_PRIEST_REPORTS`.

### 17. المخزون والعهدة (Inventory)
- إدارة المستلزمات والعهد، مع `VIEW_INVENTORY` / `MANAGE_INVENTORY`.

### 18. الإعدادات و PWA والقراءات اليومية
- **الإعدادات** (`SettingsPage`): إدارة المستخدمين، **خريطة الصلاحيات**، وأترام الدراسة.
- **PWA** (قابل للتثبيت) عبر `vite-plugin-pwa`, `manifest.webmanifest`, `sw.js`, ومطالبة التثبيت `PwaInstallPrompt`.
- **تفعيل الحساب بالبريد** (`ActivationPage`) وتسجيل الدخول (`LoginPage`).
- **القراءات اليومية**: بطاقة HTML تُنقّى بـ **DOMPurify**، مع أعمدة تفعيل/تعطيل لكل مستخدم.

---

## الأدوار والصلاحيات (RBAC)

النظام **RBAC مدفوع بقاعدة البيانات**: كل فعل مرتبط بصلاحية (`AppPermission`)، والربط في جدول `role_permissions`، مع `custom_permissions` لكل مستخدم و`tenant_custom_roles` لكل سكن. عناصر الواجهة تُخفى/تُظهر تلقائيًا حسب `hasPermission`. إدارة الأدوار المخصصة عبر `/api/admin/roles` و`/api/users/custom-roles`.

### الأدوار الأساسية (`UserRole`)
| الدور | الوصف | أمثلة صلاحيات |
|---|---|---|
| **admin** | سلطة كاملة على النظام والسكنات والأساقفة والإعدادات | كل الصلاحيات + `MANAGE_GLOBAL_TENANTS`, `MANAGE_BISHOPS`, `MANAGE_SETTINGS` |
| **bishop** | إشرافي رفيع + تقارير الأبرشية + التعيينات | `VIEW_GLOBAL_REPORTS`, `MANAGE_GLOBAL_TENANTS`, `ASSIGN_GLOBAL_STAFF`, `MANAGE_EMPLOYEES`, `MANAGE_USERS` |
| **priest** | إدارة كاملة داخل السكن + دور رعوي | `ADD_STUDENT`, `EDIT_STUDENT`, `MANAGE_ATTENDANCE`, `MANAGE_EVENTS`, `VIEW_FINANCE`, `MANAGE_POINTS`, `VIEW_PRIEST_DASHBOARD` |
| **supervisor** | سلطة تشغيلية داخل السكن | `VIEW_HOUSING`, `MANAGE_HOUSING`, `MANAGE_EMPLOYEES`, `ASSIGN_ROLES`, `VIEW_FINANCE`, `MANAGE_USERS`, `JOIN_LAUNDRY`, `CREATE_EVENT` |
| **assistant_supervisor** | مساعدة يومية بصلاحيات محدودة | مجموعة فرعية من صلاحيات المشرف |
| **employee** | تنفيذي (حضور يدوي، صيانة، مغسلة) | `VIEW_STUDENT`, `VIEW_ROOMS`, `VIEW_HOUSING`, `HANDLE_MAINTENANCE`, عمليات المغسلة |
| **student** | تفاعلي (GPS، QR، صيانة، غسيل، نقاط) | `JOIN_LAUNDRY`, `ATTEND_EVENT`, `REQUEST_MAINTENANCE`, `VIEW_POINTS`, `JOIN_COMPETITIONS` |
| **parent** | متابعة الابن (قراءة فقط) | مالية/حضور/إشعارات (قراءة) |

`STAFF_ROLES` = admin, bishop, priest, supervisor, assistant_supervisor.
أدوار الراديو: `radio_admin`, `radio_audio_admin`, `radio_video_admin`, `radio_library_admin`, `radio_operator`.

### قائمة الصلاحيات (`AppPermission` — `src/types/permissions.ts`)
- **Students**: `VIEW_STUDENT`, `ADD_STUDENT`, `EDIT_STUDENT`, `DELETE_STUDENT`, `ASSIGN_ROOM`, `MOVE_STUDENT`
- **Housing**: `VIEW_HOUSING`, `MANAGE_HOUSING`, `VIEW_ROOMS`, `ADD_ROOM`, `EDIT_ROOM`, `DELETE_ROOM`
- **Attendance**: `VIEW_ATTENDANCE`, `CHECKIN_ATTENDANCE`, `MANAGE_ATTENDANCE`
- **Laundry**: `JOIN_LAUNDRY`, `VIEW_LAUNDRY_QUEUE`, `MANAGE_LAUNDRY`, `MANAGE_LAUNDRY_OPERATORS`, `START_LAUNDRY_SESSION`, `CLOSE_LAUNDRY_SESSION`
- **System Admin**: `MANAGE_BISHOPS`, `MANAGE_GLOBAL_TENANTS`, `ASSIGN_GLOBAL_STAFF`, `MANAGE_SUPERVISORS`, `VIEW_SYSTEM_LOGS`
- **Behavior & Points**: `MANAGE_POINTS`, `VIEW_POINTS`, `MANAGE_REWARDS`, `MANAGE_PENALTIES`
- **Competitions**: `MANAGE_COMPETITIONS`, `VIEW_COMPETITIONS`, `JOIN_COMPETITIONS`
- **Logs & Undo**: `VIEW_DECISION_LOG`, `UNDO_DECISION`
- **Maintenance**: `REQUEST_MAINTENANCE`, `VIEW_MAINTENANCE`, `HANDLE_MAINTENANCE`
- **Inventory**: `VIEW_INVENTORY`, `MANAGE_INVENTORY`
- **Finance**: `VIEW_FINANCE`, `ADD_EXPENSE`, `ADD_REVENUE`, `VIEW_FINANCE_REPORTS`
- **Events**: `CREATE_EVENT`, `EDIT_EVENT`, `DELETE_EVENT`, `ATTEND_EVENT`, `VIEW_EVENTS`, `MANAGE_EVENT_ATTENDANCE`, `MANAGE_EVENT_PAYMENTS`, `OPERATE_EVENT_ATTENDANCE`
- **Settings**: `VIEW_SETTINGS`, `MANAGE_SETTINGS`
- **Notifications**: `VIEW_NOTIFICATIONS`, `SEND_NOTIFICATIONS`
- **Reports**: `VIEW_DASHBOARD`, `VIEW_REPORTS`, `VIEW_GLOBAL_REPORTS`
- **Priest**: `VIEW_PRIEST_DASHBOARD`, `MANAGE_PRIEST_REPORTS`
- **User Mgmt**: `VIEW_USERS`, `MANAGE_USERS`, `MANAGE_EMPLOYEES`, `ASSIGN_ROLES`
- **Broadcast/News**: `SEND_BROADCAST`, `VIEW_BROADCASTS`
- **Radio 5:14**: `VIEW_RADIO`, `MANAGE_RADIO_BROADCAST`, `MANAGE_RADIO_VIDEO_LIBRARY`, `MANAGE_RADIO_PLAYLISTS`, `MANAGE_RADIO_TICKERS`, `MODERATE_RADIO_CHAT`, `VIEW_RADIO_ANALYTICS`
- **خاص**: `ALL`

### آلية عزل السكنات (Tenant Isolation)
- جدول `user_tenant_assignments` يربط أي مستخدم بعدد غير محدود من السكنات.
- `computeUserTenantIds()` يُحسب **server-side** (لا يُوثق بالـ JWT/العميل).
- ترويسة `X-Tenant-Id` مُتحقّقة ومقيّدة (admin→الكل، bishop→سكناته، غيره→التعيينات)، وغير المصرّح به يُتجاهل.
- مبدأ: **لا يمكن لمستخدم في سكن "أ" الوصول لبيانات سكن "ب" إلا بتصريح صريح**.

---

## البنية التقنية

### الواجهة الأمامية
- **React 19** + **TypeScript ~5.8** + **Vite 6**.
- **Tailwind CSS 4** — ثيم "Neon Modernism" (Neon Green `#97ff00`، `neon-primary #00F5FF`، `neon-secondary #A020F0`، `neon-accent #FF007F`).
- دعم كامل **RTL** + **Dark/Light Mode** + خط Cairo.
- **motion** (Framer Motion) للحركات، **lucide-react** للأيقونات، **recharts** للرسوم.
- **react-router-dom 7**, **AuthContext** + `useApi`, و**React Query** (`@tanstack/react-query`).
- **QR**: `html5-qrcode` (مسح) + `react-qr-code` (توليد). **الخرائط**: `leaflet`.

### الخادم (Backend)
- **Node.js 22** + **Express 4**، يعمل عبر **`tsx`**.
- **Socket.IO** للوقت الفعلي (شات، إشعارات، طوابير المغسلة، بث).
- Middleware: `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, `multer`, `zod`, `bcryptjs`, `jsonwebtoken`.
- **PDF/Excel**: `pdfkit`, `pdf-lib`, `exceljs`. **بريد**: `nodemailer`. **Push**: `web-push`. **AI**: `@google/genai`.
- **توثيق API**: Swagger على `/api-docs` (محمي بـ `authenticate` + `MANAGE_SETTINGS`).
- البنية: `src/backend/api/*.routes.ts` + `controllers/` + `services/` + `infrastructure/` + `domain/`.

### قاعدة البيانات
- **Microsoft SQL Server (MSSQL)** عبر **Knex.js** + `mssql`/`tedious`.
- كل المعرّفات **UUID `NVarChar(128)`** (لا تعداد رقمي)، والاسم الافتراضي `DormMaster`.
- المخطط: `schema_mssql.sql` + DDL داخل `initializeDb()`, مع **ترحيلات Knex** (`migrations/001` … `047`).

### نموذج المصادقة
- **JWT** يُسلَّم فقط عبر **httpOnly cookie** مع `SameSite=strict` و`secure` في الإنتاج (صلاحية 24 ساعة).
- **`users.token_version`** يُبطل كل الجلسات فورًا عند تغيير كلمة المرور (HTTP + Socket.io).
- **Token blacklist** (`token_blacklist`) + `POST /api/auth/logout`.
- `authenticate` يعيد التحقق من وجود المستخدم + الدور + السكن + token_version + blacklist في كل طلب.
- **WebSocket**: `io.use(resolveSocketUser)` مع نفس التحققات + قيود `join-tenant`/`join-user`.
- **تفعيل الحساب بالبريد** إلزامي للحسابات المنشأة إداريًا. تسجيل `POST /auth/register` متاح **لأول مستخدم فقط** + `SETUP_REGISTRATION_TOKEN` في الإنتاج.
- ملاحظة: لا يوجد refresh-token حاليًا (24h ثم إعادة تسجيل دخول).

---

## الإعداد والتشغيل المحلي

### المتطلبات
- Node.js 22، npm، وSQL Server (محلي أو Azure) أو حاوية SQL Server.

### الخطوات
```bash
npm install                 # تثبيت الاعتماديات
cp .env.example .env        # ثم عدّل القيم (DB/JWT/ENCRYPTION_KEY ...)
npm run migrate             # تنفيذ ترحيلات قاعدة البيانات
npm run dev                 # تشغيل التطوير (Vite middleware داخل Express)
```
- الإنتاج المحلي: `npm run build` ثم `npm start` (`tsx server.ts`).
- بديل تهيئة الجداول: افتح `schema_mssql.sql` في SSMS واختر قاعدة البيانات ثم **Execute**.
- تأكد أن SQL Server يقبل الاتصال على المنفذ **1433**.

### الأخطاء الشائعة أثناء التشغيل
- عدم وجود `.env` أو `DB_PASSWORD`/`JWT_SECRET` صحيح → الخادم **يفشل عمدًا** (fail-closed).
- `super-secret-key-change-me-in-production` مرفوض كـ `JWT_SECRET`.

---

## متغيّرات البيئة

| المتغيّر | الوصف |
|---|---|
| `NODE_ENV` | `production`/`development`/`test` (يفرضه compose في الإنتاج). |
| `PORT` | منفذ الخادم (افتراضي 3000). |
| `DATABASE_URL` | سلسلة اتصال MSSQL كاملة (بديل عن المتغيرات التفصيلية). |
| `DB_CLIENT` | `mssql`. |
| `DB_HOST`, `DB_PORT`, `DB_INSTANCE` | المضيف/المنفذ (1433)/اسم النسخة (مثل `SQLEXPRESS`). |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | بيانات دخول قاعدة البيانات (`DormMaster`). |
| `DB_SSL_CA_PATH` | مسار شهادة CA بصيغة PEM (للتثبيت مع بقاء التحقق مفعّلًا). |
| `MSSQL_SA_PASSWORD` | كلمة مرور `sa` لحاوية SQL Server في compose (إلزامية). |
| `JWT_SECRET` | مفتاح توقيع JWT (يُرفض الضعيف/الافتراضي). |
| `ENCRYPTION_KEY` | مفتاح تشفير (32 حرفًا) للشكاوى وغيرها. |
| `SETUP_REGISTRATION_TOKEN` | رمز مطلوب لتسجيل أول مستخدم في الإنتاج. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | بيانات أدمن البذرة (`SEED_ADMIN_PASSWORD` ≥ 12 حرفًا)، و`SEED_ADMIN_ALLOW_PRODUCTION` للسماح في الإنتاج. |
| `DEFAULT_USER_PASSWORD` | كلمة المرور الافتراضية للمستخدمين المنشأين إداريًا (إلزامية وقوية). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | إعداد البريد/التفعيل. |
| `PUBLIC_APP_URL` | الرابط العام للتطبيق (روابط التفعيل/الإشعارات). |
| `CORS_ORIGIN` | قائمة أصول مسموحة (إلزامي في الإنتاج، لا `*`). |
| `CSRF_ALLOW_LOCAL` | السماح بـ loopback في فحص CSRF. |
| `ENFORCE_HTTPS` | إعادة التوجيه لـ HTTPS. |
| `YOUTUBE_API_KEY` | تكامل يوتيوب للراديو. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | مفاتيح إشعارات الويب. |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE` | المراقبة (اختياري). |
| `APP_IMAGE` | صورة Docker المستخدمة في compose. |

---

## قاعدة البيانات و TLS

- **الإنتاج**: `encrypt: true`, `trustServerCertificate: false` (في `knexfile.ts` و`knex.ts`) — لا يوجد مفتاح لتعطيل التحقق.
- **التطوير**: `encrypt: false`, `trustServerCertificate: true`.
- **لشهادة خاصة/ذاتية التوقيع**: ضع الشهادة بصيغة PEM في `./ssl/db/ca.pem` واضبط `DB_SSL_CA_PATH=./ssl/db/ca.pem`.
  - تُثبَّت الشهادة كمرساة ثقة **مع بقاء التحقق مفعّلًا**.
  - إذا كانت الشهادة بلا `SAN`، يُشتقّ `serverName` من `CN` للشهادة ويعُرض على `tedious` ليمرّ فحصُ اسم المضيف.
  - **FAIL-CLOSED**: إذا كان الملف مفقودًا أو ليس PEM صالحًا، يفشل الاتصال عمدًا (`readCaCertificate`).
- `docker-compose.yml` يركّب `./ssl/db:/app/ssl/db:ro`.

### الترحيلات (Migrations)
- `migrations/` تحتوي **47** ملفًا (`001_initial_schema.ts` … `047_journal_attendance_reference.ts`).
- إدارة عبر: `npm run migrate` / `migrate:up` / `migrate:down` / `migrate:status` / `migrate:make`.
- دفتر اليومية: `npm run backfill:ledger` و`npm run verify:ledger` و`npm run verify:scope`.

---

## النشر عبر Docker

### الملفات
- **`Dockerfile`**: multi-stage `node:22-alpine`؛ مرحلة البناء تشغّل `npx tsc --noEmit && npm run build` ثم تُنسخ المخرجات؛ التشغيل بمستخدم غير جذر `appuser` (uid 1001)، مع `HEALTHCHECK` على `/api/ready`، و`CMD npx tsx server.ts`.
- **`docker-entrypoint.sh`**: chown على `./uploads` و`./logs` ثم الهبوط إلى `appuser`، والتحقق من `DB_SSL_CA_PATH` (fail-closed).
- **`docker-compose.yml`**: خدمات `app` + `nginx` (80/443) + `db` (`mcr.microsoft.com/mssql/server:2022-latest`)، و`app` تنتظر `db` حتى تصبح healthy.
- **`docker-compose.prod.yml`**: الإنتاج `sakani.mase7y.org`؛ يعيد استخدام stacks خارجية (SQL Server على `sql_default`، Nginx Proxy Manager على `proxy`)؛ منافذ `127.0.0.1:3000` و`127.0.0.1:3100` (غير معروضة للشبكة)؛ `CSRF_ALLOW_LOCAL=true`.
- **`docker-compose.dev.yml`**: override اختياري (`NODE_ENV=development` ومنفذ `1433`).
- **`nginx.conf`**: TLSv1.2/1.3، HSTS، ترويسات أمان، gzip، `client_max_body_size 10M`، ووكالة `/api/`, `/socket.io/`, `/uploads/`, `/api-docs/`، مع SPA fallback وتمرير `X-Forwarded-Proto`.

### أوامر النشر
```bash
# بناء وإعادة تشغيل حاوية التطبيق (الإنتاج)
docker compose -f docker-compose.prod.yml up -d --build

# على السيرفر، يمكن استخدام سكربت النشر الآمن (خارج المستودع): deploy.cmd / deploy.ps1
# يبني، ينتظر فحص الصحة، ويرجع تلقائيًا (rollback) عند الفشل.
```

### CI/CD (`.github/workflows/ci.yml`)
- خمس مراحل: `lint` (`tsc --noEmit`) → `test` (حاوية MSSQL 2022 + تشغيل السيرفر + `npm test`) → `build` (رفع `dist`) → `docker` (buildx) → `deploy` (نشر إلى GHCR + SSH إلى `/opt/sakani` مع rollback وانتظار `/api/ready`). الفروع: `main`/`master`/`develop`.

---

## السكربتات

### من `package.json`
| الأمر | الوصف |
|---|---|
| `npm run dev` | تشغيل التطوير (`tsx watch server.ts` مع Vite middleware). |
| `npm run build` | بناء الواجهة (`vite build`). |
| `npm start` | تشغيل الإنتاج (`tsx server.ts`). |
| `npm run preview` | معاينة البناء. |
| `npm run clean` | حذف `dist`. |
| `npm run migrate` + `migrate:up/down/status/make` | إدارة الترحيلات. |
| `npm run reset-db` | إعادة تهيئة قاعدة البيانات. |
| `npm run cleanup-uploads` | تنظيف ملفات الرفع القديمة. |
| `npm run backfill:ledger` / `verify:ledger` / `verify:scope` | ترحيل/التحقق من دفتر اليومية. |
| `npm test` / `test:watch` / `test:coverage` | الاختبارات. |
| `npm run lint` | فحص الأنواع (`tsc --noEmit`). |

### سكربتات مساعدة في `scripts/`
- **تشغيل/ترحيل**: `migrate.ts`, `reset-db.ts`, `cleanup-uploads.ts`, `backfill-ledger.ts`, `verify-ledger-scope-sql.ts`.
- **إدارة قاعدة البيانات**: `init_mssql.ts`, `check-db.ts`, `test-db-conn.ts`, `verify_mssql_setup.ts`, `20240514_UpdateDormMasterSchema.sql`.
- **الحسابات الإدارية**: `seed-admin.ts`, `seed-admin-lib.ts`, `set-passwords.ts` (env-driven + fail-closed + prod guard). تُشغَّل يدويًا وليست مرتبطة في `package.json`.
- **نسخ احتياطي**: `backup.sh`.
- **`ops/`**: `verify-ledger.sql`, `backup-preledger.sql`.

---

## الاختبارات

- **Vitest** (وحدة/تكامل): `npm test` / `npm run test:watch` / `npm run test:coverage`.
  - الإعداد: `include: ['src/**/*.test.ts(x)']`، بيئة `node`، `testTimeout: 30000`، `setupFiles ./src/test/setup.ts`، `globalSetup ./src/test/global-setup.ts`.
  - `global-setup.ts`: لو الخادم غير شغّال، يُشغّل `tsx server.ts` بـ`NODE_ENV=test` وينتظر `/api/health`، ثم يغلقه.
- **E2E (Playwright)**: `testDir ./e2e`، `baseURL http://localhost:3000`، headless، مع `webServer npx tsx server.ts`.
- **فحص الأنواع**: `npm run lint` = `npx tsc --noEmit`.
- **قاعدة أساسية**: بعد كل إصلاح شغّل `npx tsc --noEmit` ثم الاختبارات.

---

## الأمان

**المبدأ**: الواجهة الأمامية ليست حدًا أمنيًا — لا ثقة بأي `UserId`/`RoleId`/`PermissionId`/`TenantId` قادم من العميل.

الضوابط المطبّقة:
1. **تخويل server-side فقط** لكل العمليات.
2. **JWT في httpOnly cookie** (`SameSite=strict`, `secure` في الإنتاج) بدل `localStorage`.
3. **إبطال الجلسات فورًا** عبر `users.token_version` عند تغيير كلمة المرور (HTTP + Socket.io).
4. **Token blacklist** + `POST /api/auth/logout`.
5. **مصادقة WebSocket كاملة** عبر `resolveSocketUser` + قيود الانضمام.
6. **bcryptjs** لكلمات المرور.
7. **RBAC مدفوع بقاعدة البيانات** مع cache invalidation.
8. **منع تصعيد الصلاحيات (grantor-subset)**: لا يمنح أحد صلاحية لا يملكها؛ `"ALL"` كسلسلة لا يُعترف به (fail-closed).
9. **عزل السكنات fail-closed** بحساب النطاق من قاعدة البيانات.
10. **`X-Tenant-Id`** مُتحقّق ومقيّد.
11. **Rate limiting**: عام 5000/min؛ الراديو حسب النوع؛ auth 10/15min؛ register 3/h؛ broadcasts 60/min؛ رفع الطلاب 20/min؛ تغيير كلمة المرور 20/15min.
12. **helmet + CSP** (الإنتاج يزيل `unsafe-inline`/`unsafe-eval`).
13. **CORS allow-list** + credentials (لا `*` في الإنتاج).
14. **CSRF**: فحص Origin/Referer + `SameSite=strict`.
15. **تحقق المدخلات**: Zod على 36+ مسار + `sanitizeInput` + `stripXSS`.
16. **DOMPurify** لتنقية HTML القراءات اليومية.
17. **رفع الملفات**: magic-bytes + MIME + امتدادات مسموحة + منع path traversal + تحقق الملكية/Sكن + أسماء عشوائية + حدود الحجم + منع الملفات التنفيذية.
18. **تشفير قاعدة البيانات في الإنتاج** + تثبيت CA.
19. **تنقية الأخطاء**: رسائل عربية ثابتة بلا SQL/stack/paths.
20. **Audit logging** مع فلترة الحقول الحساسة (لا كلمات مرور/توكنات في السجلات).
21. **إدارة الأسرار**: `.env` مستثنى + `.env.example` placeholders + guard يرفض `JWT_SECRET` الضعيف/الافتراضي + سكربتات env-driven fail-closed + منع تسريب الأسرار في الـ bundle.
22. **تفعيل الحساب بالبريد** + تسجيل أول مستخدم فقط + `SETUP_REGISTRATION_TOKEN`.
23. **Swagger محمي** بـ `authenticate` + `MANAGE_SETTINGS`.
24. **`ENFORCE_HTTPS`** وترويسات Nginx الأمنية.
25. **اختبارات انحدار أمني** مصاحبة لكل إصلاح (تحت `src/test/security*.test.ts`).

الأصول الأمنية موثّقة في التقارير التاريخية للتطوير (تم دمجها هنا).

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---|---|
| الخادم لا يقلع ويرفض `JWT_SECRET`/`ENCRYPTION_KEY` | استخدم مفاتيح قوية غير افتراضية، ولا تستخدم `super-secret-key-change-me-in-production`. |
| `Failed to connect to SQL Server` | تحقق من `DB_HOST/PORT/USER/PASSWORD/NAME`، وأن المنفذ 1433 مفتوح، وأن `MSSQL_SA_PASSWORD` مطابق. |
| فشل التحقق من شهادة DB في الإنتاج | ضع `./ssl/db/ca.pem` واضبط `DB_SSL_CA_PATH` (fail-closed). |
| التعديلات لا تظهر في التطبيق | التطبيق يعمل داخل Docker؛ أعد البناء: `docker compose -f docker-compose.prod.yml up -d --build`. |
| `getaddrinfo ENOTFOUND sqlserver` أثناء الاختبارات من الجهاز | شغّل الحاوية (يُعيد الاختبار استخدام الحاوية الشغّالة على المنفذ 3000) أو شغّل السيرفر محليًا. |
| إعادة توجيه HTTPS في حلقة | تأكد من تمرير `X-Forwarded-Proto` من الوكيل. |

---

## ملاحظات وبنود مفتوحة

- **ملفات ضخمة (God Files) مرشّحة للتقسيم**: `EventsPage.tsx`، `StudentsPage.tsx`، `AdminRadio514.tsx`، `Radio.tsx`، `radio.routes.ts`، `event.routes.ts`، `db.ts`، `server.ts`.
- **بنود أمنية/تشغيلية مفتوحة**: refresh token، forgot/reset password + email verification، per-account rate limit خلف `trust proxy`، idempotency للمدفوعات، مراقبة/تسجيل منضبط (Sentry)، طبقة Cache (Redis)، فهارس قاعدة بيانات إضافية، وتقسيم الحزمة (code splitting).
- **التوحيد**: التوثيق القديم كان يذكر SQLite في مواضع؛ الفعلي المعتمد هو **MSSQL** كما هو موثّق أعلاه.

---

*المطوّر: شكري شفيق جاد إبراهيم — تم تطوير وبناء هذا التطبيق لخدمة الكنيسة وتسهيل التواصل بين الأبناء وأولياء الأمور والكنيسة.*
