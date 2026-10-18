# تطبيق سكني الأصلي (Android / iOS) — دليل البناء

> تطبيق **Capacitor** يغلّف موقع سكني المنشور (`https://sakani.mase7y.org`) ويعطيه
> الوصول إلى **GPS الحقيقي** وتتبّع الموقع في **الخلفية**، وهو ما لا يوفّره متصفح الموبايل.

---

## لماذا تطبيق أصلي؟

المتصفح على الموبايل كثيرًا ما يحدّد الموقع عبر الواي فاي / عنوان الـ IP، فتظهر
إحداثيات خاطئة بفارق مئات الأمتار أو كيلومترات. التطبيق الأصلي يستخدم مزوّد الموقع
الأصلي (Fused / Core Location) بدقة GPS، ويعمل أيضًا أثناء وجود التطبيق في الخلفية.

---

## نظرة على البنية

| الملف | الوظيفة |
|------|---------|
| `capacitor.config.ts` | إعداد الغلاف: `appId`, `appName`, و`server.url` (الموقع المنشور). |
| `src/utils/location.ts` | مصدر موحّد للموقع: GPS الأصلي + بديل المتصفح، مع `getBestFix` لأدق قراءة. |
| `src/utils/backgroundLocation.ts` | تتبّع الخلفية الأصلي وإرسال `POST /api/attendance/presence`. |
| `src/hooks/useBackgroundTracking.ts` | يبدأ/يوقف تتبّع الخلفية للطلاب تلقائيًا. |
| `android/` | مشروع أندرويد المولّد (Android Studio). |
| `ios/` | مشروع iOS المولّد (Xcode). |

**نمط الغلاف (Remote URL Shell):** التطبيق يحمّل الموقع المنشور مباشرة، فيبقى سلوك
الكوكيز (sameSite)، وSocket.IO، والتحديثات كما هو دون أي تغيير. الإضافات الأصلية
(GPS، الإشعارات) تُحقَن فوقه.

> ⚠️ **Service Worker**: مُعطَّل داخل الغلاف الأصلي عمدًا (`injectRegister: false` +
> تسجيل يدوي في `main.tsx`)، لأنه يعترض الطلبات ويمنع تحميل الإضافات الأصلية.

---

## المتطلبات

- **Node.js 22+** و **npm**.
- **Android**: Android Studio (يحتوي Android SDK)، و JDK 17+.
- **iOS**: جهاز **macOS** + Xcode + CocoaPods (لا يمكن بناؤه على Windows).

---

## الخطوات (Android)

من جذر المشروع:

```bash
# 1) بناء الواجهة ونسخها إلى المشروع الأصلي + مزامنة الإضافات
npm run cap:sync

# 2) فتح المشروع في Android Studio
npm run cap:open:android
```

داخل **Android Studio**:

1. انتظر انتهاء Gradle Sync.
2. للتشغيل على جهاز/محاكي: زر ▶️ **Run**.
3. لإخراج نسخة للتوزيع: **Build → Generate Signed Bundle / APK**.
   - اختر **Android App Bundle (.aab)** للنشر على Google Play.
   - أو **APK** للتوزيع المباشر.
4. أنشئ/اختر **keystore** واحفظ كلمة المرور في مكان آمن.

---

## الخطوات (iOS) — على Mac

```bash
npm run cap:sync
npm run cap:open:ios
```

داخل **Xcode**: اختر فريق التوقيع (Signing Team)، ثم Run أو Archive للنشر.

---

## الأذونات المستخدمة

### أندرويد (`android/app/src/main/AndroidManifest.xml`)

| الإذن | الغرض |
|------|-------|
| `ACCESS_FINE_LOCATION` | موقع دقيق (GPS). |
| `ACCESS_COARSE_LOCATION` | موقع تقريبي. |
| `ACCESS_BACKGROUND_LOCATION` | التتبّع والتطبيق في الخلفية. |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_LOCATION` | خدمة أمامية تُبقي التتبّع حيًّا. |
| `POST_NOTIFICATIONS` | إشعار الخدمة الأمامية (Android 13+). |
| `INTERNET` | الاتصال بالخادم. |

### iOS (`ios/App/App/Info.plist`)

- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `UIBackgroundModes` → `location`, `remote-notification`

---

## ملاحظات مهمة

- **Google Play وموقع الخلفية**: نشر التطبيق على المتجر مع إذن
  `ACCESS_BACKGROUND_LOCATION` يتطلّب **مراجعة وموافقة من Google Play** مع تبرير
  سبب الاستخدام. إن لم يكن مطلوبًا الآن، يمكن إزالة الإذن مؤقتًا والاكتفاء
  بالموقع أثناء فتح التطبيق.
- **iOS لا يعيد تشغيل التطبيق** بعد إنهائه من قِبل المستخدم (قيد من النظام)، بخلاف
  أندرويد الذي تعيد خدمته الأمامية التشغيل (`START_STICKY`).
- تتبّع الخلفية يعمل للطلاب فقط ويبدأ بعد تسجيل الدخول، ويتوقّف عند تسجيل الخروج.

---

## تغيير عنوان الخادم

افتراضيًا يحمّل التطبيق `https://sakani.mase7y.org`. لتوجيهه إلى بيئة أخرى:

```bash
# PowerShell
$env:CAP_SERVER_URL="https://staging.example.com"; npm run cap:sync
```

ثم أعد المزامنة (`npm run cap:sync`) وأعد البناء من Android Studio.

---

## سكربتات مساعدة

| الأمر | الوظيفة |
|------|---------|
| `npm run cap:sync` | `vite build` ثم `cap sync` (نسخ الواجهة + تحديث الإضافات). |
| `npm run cap:add:android` / `cap:add:ios` | إضافة منصّة (تُنفَّذ مرة واحدة عند الانطلاق). |
| `npm run cap:open:android` / `cap:open:ios` | فتح المشروع الأصلي في IDE. |
| `npm run cap:run:android` | تشغيل على جهاز/محاكي أندرويد. |

> بعد أي تعديل على كود الواجهة لا بد من `npm run cap:sync` قبل البناء من الاستوديو.

---

## استكشاف الأخطاء

| المشكلة | الحل |
|--------|------|
| الموقع غير دقيق | تأكد أن الإذن **دقيق** (Fine / Precise) مُفعّل من إعدادات النظام. |
| التتبّع لا يعمل في الخلفية (أندرويد) | تأكد من منح إذن **الخلفية** + إشعارات، وأن **تحسين البطارية** غير مقيّد للتطبيق. |
| صفحة بيضاء بعد التحديث | أعد `npm run cap:sync` (الـservice worker معطّل داخل الغلاف، فتأكد من إعادة النسخ). |
| الإضافات الأصلية لا تحمّل | تأكد أنك لا تُفعّل Service Worker يدويًا في المسار الأصلي. |
| `cap` غير معروف | نفّذ الأوامر عبر `npx cap ...` أو تأكد من تثبيت `@capacitor/cli`. |

---

## التحقّق قبل التسليم

```bash
npx tsc --noEmit      # سلامة الأنواع
npm test              # الاختبارات (678)
npm run build         # بناء الواجهة
npm run cap:sync      # مزامنة المشروع الأصلي
```
