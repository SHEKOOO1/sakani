import { Shield, Users, Home, BookOpen, Calendar, DollarSign, Settings, Bell, AlertTriangle, CheckCircle, XCircle, Target, BarChart3, Wrench } from 'lucide-react';

export interface PermissionGroup {
  icon: any;
  label: string;
  permissions: { key: string; label: string; }[];
}

export interface RolePermissions {
  can: string[];
  cannot: string[];
  dataScope: string;
  groups: PermissionGroup[];
}

export interface PermissionInfo {
  key: string;
  label: string;
  description: string;
  group: string;
}

export const ALL_PERMISSIONS: PermissionInfo[] = [
  // ====== الطلاب ======
  { key: 'VIEW_STUDENT', label: 'عرض بيانات الطلاب', description: 'مشاهدة قائمة الطلاب المسجلين وبياناتهم الأساسية (الاسم، الغرفة، السكن، رقم الهاتف)', group: 'الطلاب' },
  { key: 'ADD_STUDENT', label: 'إضافة طالب جديد', description: 'إنشاء سجل طالب جديد في النظام يتضمن بياناته الشخصية ومعلومات السكن', group: 'الطلاب' },
  { key: 'EDIT_STUDENT', label: 'تعديل بيانات الطالب', description: 'تغيير وتحديث معلومات الطالب مثل الغرفة، الشقة، بيانات ولي الأمر، الحالة الدراسية', group: 'الطلاب' },
  { key: 'DELETE_STUDENT', label: 'حذف طالب', description: 'إزالة طالب من النظام بالكامل مع جميع بياناته وسجلاته', group: 'الطلاب' },
  { key: 'ASSIGN_ROOM', label: 'تسكين طالب', description: 'تعيين طالب في غرفة معينة داخل شقة محددة في السكن', group: 'الطلاب' },
  { key: 'MOVE_STUDENT', label: 'نقل طالب', description: 'نقل طالب من غرفة/شقة إلى أخرى داخل نفس السكن أو سكن آخر', group: 'الطلاب' },

  // ====== السكن والغرف ======
  { key: 'VIEW_HOUSING', label: 'عرض السكنات', description: 'مشاهدة قائمة السكنات المتاحة وبياناتها الأساسية (الاسم، الموقع، السعة)', group: 'السكن والغرف' },
  { key: 'MANAGE_HOUSING', label: 'إدارة السكنات', description: 'إنشاء وتعديل وحذف السكنات، تغيير اسم السكن وموقعه وإعداداته', group: 'السكن والغرف' },
  { key: 'VIEW_ROOMS', label: 'عرض الغرف', description: 'مشاهدة قائمة الغرف في كل سكن مع حالتها (متاحة/مشغولة) وعدد الأسرّة', group: 'السكن والغرف' },
  { key: 'ADD_ROOM', label: 'إضافة غرفة', description: 'إنشاء غرفة جديدة في سكن معين مع تحديد عدد الأسرّة والمرافق', group: 'السكن والغرف' },
  { key: 'EDIT_ROOM', label: 'تعديل غرفة', description: 'تغيير بيانات الغرفة مثل عدد الأسرّة، رقم الغرفة، المرافق المتاحة', group: 'السكن والغرف' },
  { key: 'DELETE_ROOM', label: 'حذف غرفة', description: 'إزالة غرفة من النظام بشرط أن تكون فارغة (لا يوجد طلاب مسكنين فيها)', group: 'السكن والغرف' },

  // ====== الحضور ======
  { key: 'VIEW_ATTENDANCE', label: 'عرض الحضور', description: 'مشاهدة سجلات حضور وانصراف الطلاب والموظفين وتقارير الغياب', group: 'الحضور' },
  { key: 'CHECKIN_ATTENDANCE', label: 'تسجيل حضور/انصراف', description: 'تسجيل وقت الحضور والانصراف للطلاب أو للمستخدم نفسه (بصمة/كيو آر كود)', group: 'الحضور' },
  { key: 'MANAGE_ATTENDANCE', label: 'إدارة الحضور', description: 'تعديل سجلات الحضور، إضافة غياب بعذر، تصحيح أخطاء التسجيل، طباعة تقارير', group: 'الحضور' },

  // ====== المغسلة ======
  { key: 'JOIN_LAUNDRY', label: 'حجز المغسلة', description: 'حجز موعد في المغسلة لغسل الملابس واختيار الوقت المناسب', group: 'المغسلة' },
  { key: 'VIEW_LAUNDRY_QUEUE', label: 'عرض طابور المغسلة', description: 'مشاهدة قائمة الانتظار للمغسلة ومعرفة الأوقات المتاحة والحجوزات الحالية', group: 'المغسلة' },
  { key: 'MANAGE_LAUNDRY', label: 'إدارة المغسلة', description: 'التحكم في جدول المغسلة، تأكيد الحجوزات، إلغاء الحجوزات، تسليم الملابس', group: 'المغسلة' },
  { key: 'MANAGE_LAUNDRY_OPERATORS', label: 'إدارة مشغّلي المغسلة', description: 'تعيين وإدارة الأشخاص المسؤولين عن تشغيل المغسلة وتوزيع المناوبات', group: 'المغسلة' },
  { key: 'START_LAUNDRY_SESSION', label: 'بدء جلسة غسيل', description: 'بدء تشغيل دورة غسيل جديدة في إحدى الغسالات وتسجيلها في النظام', group: 'المغسلة' },
  { key: 'CLOSE_LAUNDRY_SESSION', label: 'إنهاء جلسة غسيل', description: 'إنهاء جلسة الغسيل الحالية وتحديث حالة الغسالة وتسليم الملابس', group: 'المغسلة' },

  // ====== إدارة النظام ======
  { key: 'MANAGE_BISHOPS', label: 'إدارة الأساقفة', description: 'إضافة وتعديل وحذف حسابات الأساقفة المسؤولين عن الأبرشيات', group: 'إدارة النظام' },
  { key: 'MANAGE_GLOBAL_TENANTS', label: 'إدارة السكنات', description: 'التحكم الكامل في جميع السكنات على مستوى النظام (إنشاء، تعديل، حذف، تعيين مسؤول)', group: 'إدارة النظام' },
  { key: 'ASSIGN_GLOBAL_STAFF', label: 'تعيين الموظفين عالمياً', description: 'تعيين موظفين ومشرفين عبر جميع السكنات دون التقيد بسكن واحد', group: 'إدارة النظام' },
  { key: 'MANAGE_SUPERVISORS', label: 'إدارة المشرفين', description: 'إضافة وتعديل وحذف المشرفين وتحديد صلاحياتهم ونطاق إشرافهم', group: 'إدارة النظام' },
  { key: 'VIEW_SYSTEM_LOGS', label: 'سجلات النظام', description: 'مشاهدة سجل حركة النظام الكامل (تسجيل الدخول، التعديلات، الأخطاء) للأغراض الرقابية', group: 'إدارة النظام' },

  // ====== السلوك والنقاط ======
  { key: 'MANAGE_POINTS', label: 'إدارة النقاط', description: 'إضافة أو خصم نقاط للطلاب بناءً على سلوكهم مع إمكانية وضع أسباب وتعليقات', group: 'السلوك والنقاط' },
  { key: 'VIEW_POINTS', label: 'عرض النقاط', description: 'مشاهدة رصيد نقاط الطلاب وتاريخ إضافة وخصم النقاط والأسباب', group: 'السلوك والنقاط' },
  { key: 'MANAGE_REWARDS', label: 'إدارة المكافآت', description: 'إنشاء وتعديل وحذف المكافآت والأوسمة التي يمكن للطلاب الحصول عليها', group: 'السلوك والنقاط' },
  { key: 'MANAGE_PENALTIES', label: 'إدارة العقوبات', description: 'إدارة نظام العقوبات والإنذارات للطلاب المخالفين لأنظمة السكن', group: 'السلوك والنقاط' },

  // ====== المسابقات ======
  { key: 'MANAGE_COMPETITIONS', label: 'إدارة المسابقات', description: 'إنشاء وتعديل وحذف المسابقات، تحديد قواعد المشاركة والجوائز', group: 'المسابقات' },
  { key: 'VIEW_COMPETITIONS', label: 'عرض المسابقات', description: 'مشاهدة المسابقات المتاحة والحالية والسابقة مع نتائجها', group: 'المسابقات' },
  { key: 'JOIN_COMPETITIONS', label: 'المشاركة في المسابقات', description: 'الاشتراك والتسجيل في المسابقات المتاحة للطلاب', group: 'المسابقات' },

  // ====== الصيانة ======
  { key: 'REQUEST_MAINTENANCE', label: 'طلب صيانة', description: 'تقديم بلاغ صيانة جديد (مثل: كسر في السباكة، عطل في الكهرباء، تلف في الأثاث)', group: 'الصيانة' },
  { key: 'VIEW_MAINTENANCE', label: 'عرض طلبات الصيانة', description: 'مشاهدة قائمة بلاغات الصيانة المقدمة مع حالتها (قيد الانتظار، قيد العمل، تم الإصلاح)', group: 'الصيانة' },
  { key: 'HANDLE_MAINTENANCE', label: 'معالجة الصيانة', description: 'تسلم بلاغ صيانة والعمل عليه، تحديث حالة البلاغ، إضافة ملاحظات، إتمام الإصلاح', group: 'الصيانة' },

  // ====== المخزون ======
  { key: 'VIEW_INVENTORY', label: 'عرض المخزون', description: 'مشاهدة المواد والأدوات المتاحة في المخزون وكمياتها', group: 'المخزون' },
  { key: 'MANAGE_INVENTORY', label: 'إدارة المخزون', description: 'إضافة وتعديل وحذف مواد المخزون، تسجيل الإضافات والاستخدامات، جرد المخزون', group: 'المخزون' },

  // ====== المالية ======
  { key: 'VIEW_FINANCE', label: 'عرض المالية', description: 'مشاهدة الحسابات المالية والحركات (المصروفات والإيرادات) الخاصة بالسكن', group: 'المالية' },
  { key: 'ADD_EXPENSE', label: 'إضافة مصروف', description: 'تسجيل مصروف جديد (فاتورة كهرباء، مواد تموين، صيانة، رواتب) مع الفئة والتاريخ', group: 'المالية' },
  { key: 'ADD_REVENUE', label: 'إضافة إيراد', description: 'تسجيل إيراد جديد (إيجار، تبرعات، رسوم) مع تحديد المصدر والتاريخ', group: 'المالية' },
  { key: 'VIEW_FINANCE_REPORTS', label: 'تقارير مالية', description: 'عرض تقارير مالية شاملة (إيرادات vs مصروفات، كشف حساب، ملخص شهري)', group: 'المالية' },

  // ====== الأحداث ======
  { key: 'CREATE_EVENT', label: 'إنشاء حدث', description: 'إنشاء حدث أو نشاط جديد (اجتماع، رحلة، محاضرة، ورشة عمل) مع تحديد التاريخ والمكان', group: 'الأحداث' },
  { key: 'EDIT_EVENT', label: 'تعديل حدث', description: 'تعديل بيانات حدث قائم (تغيير الموعد، المكان، الوصف، قائمة المشاركين)', group: 'الأحداث' },
  { key: 'DELETE_EVENT', label: 'حذف حدث', description: 'إلغاء حدث وإزالته من النظام مع إشعار المشاركين المسجلين', group: 'الأحداث' },
  { key: 'ATTEND_EVENT', label: 'حضور حدث', description: 'تسجيل حضور في حدث أو نشاط (المشاركة في الفعالية)', group: 'الأحداث' },
  { key: 'VIEW_EVENTS', label: 'عرض الأحداث', description: 'مشاهدة قائمة الأحداث والأنشطة القادمة والسابقة مع التفاصيل', group: 'الأحداث' },
  { key: 'MANAGE_EVENT_ATTENDANCE', label: 'إدارة حضور الأحداث', description: 'متابعة وتسجيل حضور وانصراف المشاركين في الأحداث والأنشطة', group: 'الأحداث' },

  // ====== الإعدادات ======
  { key: 'VIEW_SETTINGS', label: 'عرض الإعدادات', description: 'مشاهدة إعدادات النظام وقواعد السكن (موعد الإغلاق، نطاق الموقع الجغرافي)', group: 'الإعدادات' },
  { key: 'MANAGE_SETTINGS', label: 'إدارة الإعدادات', description: 'تعديل إعدادات السكن (تغيير موعد الإغلاق، تفعيل/تعطيل ميزات، إعدادات عامة)', group: 'الإعدادات' },

  // ====== الإشعارات ======
  { key: 'VIEW_NOTIFICATIONS', label: 'عرض الإشعارات', description: 'مشاهدة الإشعارات الشخصية والتنبيهات المرسلة من المشرفين', group: 'الإشعارات' },
  { key: 'SEND_NOTIFICATIONS', label: 'إرسال إشعارات', description: 'إرسال إشعارات وتنبيهات فورية للمستخدمين (رسائل خاصة)', group: 'الإشعارات' },

  // ====== التقارير ======
  { key: 'VIEW_DASHBOARD', label: 'لوحة المعلومات', description: 'مشاهدة الصفحة الرئيسية للمستخدم التي تعرض الملخصات والإحصائيات', group: 'التقارير' },
  { key: 'VIEW_REPORTS', label: 'عرض التقارير', description: 'مشاهدة التقارير المتاحة (تقارير الطلاب، الحضور، الأنشطة)', group: 'التقارير' },
  { key: 'VIEW_GLOBAL_REPORTS', label: 'تقارير شاملة', description: 'مشاهدة تقارير على مستوى الأبرشية أو النظام بالكامل (مشرف عام)', group: 'التقارير' },

  // ====== الكهنة ======
  { key: 'VIEW_PRIEST_DASHBOARD', label: 'لوحة الكهنة', description: 'مشاهدة لوحة المعلومات المخصصة للكهنة مع بيانات السكنات التابعة لهم', group: 'الكهنة' },
  { key: 'MANAGE_PRIEST_REPORTS', label: 'إدارة تقارير الكهنة', description: 'إرسال وإدارة التقارير المرفوعة من الكهنة إلى الأسقف المسؤول', group: 'الكهنة' },

  // ====== إدارة المستخدمين ======
  { key: 'VIEW_USERS', label: 'عرض المستخدمين', description: 'مشاهدة قائمة جميع مستخدمي النظام وأدوارهم', group: 'إدارة المستخدمين' },
  { key: 'MANAGE_USERS', label: 'إدارة المستخدمين', description: 'إضافة وتعديل وحذف المستخدمين وتغيير أدوارهم وصلاحياتهم', group: 'إدارة المستخدمين' },
  { key: 'MANAGE_EMPLOYEES', label: 'إدارة الموظفين', description: 'إدارة الموظفين (إضافة، تعديل، حذف، تعيين أدوار مخصصة، منح صلاحيات استثنائية)', group: 'إدارة المستخدمين' },
  { key: 'ASSIGN_ROLES', label: 'تعيين الأدوار', description: 'تحديد الأدوار والصلاحيات المناسبة لكل مستخدم في النظام', group: 'إدارة المستخدمين' },

  // ====== البث والإعلانات ======
  { key: 'SEND_BROADCAST', label: 'إرسال بث', description: 'إرسال إعلانات وبثوث جماعية لجميع مستخدمي السكن أو الأبرشية', group: 'البث والإعلانات' },
  { key: 'VIEW_BROADCASTS', label: 'عرض البثوث', description: 'مشاهدة الإعلانات والبثوث المرسلة من المسؤولين والمشرفين', group: 'البث والإعلانات' },

  // ====== السجل والرقابة ======
  { key: 'VIEW_DECISION_LOG', label: 'سجل القرارات', description: 'مشاهدة سجل القرارات الإدارية المتخذة (تعديلات، حذف، إضافات) مع توقيت وتفاصيل كل قرار', group: 'السجل والرقابة' },
  { key: 'UNDO_DECISION', label: 'التراجع عن قرار', description: 'التراجع عن قرار سابق (مثل استرجاع طالب محذوف أو إلغاء تعديل) واستعادة الحالة السابقة', group: 'السجل والرقابة' },
];

export const PERMISSION_GROUPS: Record<string, PermissionGroup[]> = {
  admin: [
    {
      icon: Shield, label: 'إدارة النظام',
      permissions: [
        { key: 'MANAGE_GLOBAL_TENANTS', label: 'إدارة جميع السكنات' },
        { key: 'MANAGE_BISHOPS', label: 'إدارة الأساقفة' },
        { key: 'MANAGE_SUPERVISORS', label: 'إدارة المشرفين' },
        { key: 'VIEW_SYSTEM_LOGS', label: 'عرض سجلات النظام' },
        { key: 'MANAGE_USERS', label: 'إدارة جميع المستخدمين' },
        { key: 'ASSIGN_GLOBAL_STAFF', label: 'تعيين الموظفين عالمياً' },
        { key: 'ASSIGN_ROLES', label: 'تعيين الأدوار' },
        { key: 'VIEW_SETTINGS', label: 'إعدادات النظام' },
      ],
    },
    {
      icon: Home, label: 'السكن والطلاب',
      permissions: [
        { key: 'VIEW_STUDENT', label: 'عرض بيانات الطلاب' },
        { key: 'VIEW_HOUSING', label: 'عرض السكنات' },
        { key: 'VIEW_ROOMS', label: 'عرض الغرف' },
        { key: 'VIEW_ATTENDANCE', label: 'عرض الحضور' },
      ],
    },
    {
      icon: DollarSign, label: 'المالية',
      permissions: [
        { key: 'VIEW_FINANCE', label: 'عرض المالية' },
        { key: 'VIEW_FINANCE_REPORTS', label: 'تقارير مالية' },
        { key: 'ADD_EXPENSE', label: 'إضافة مصروف' },
        { key: 'ADD_REVENUE', label: 'إضافة إيراد' },
      ],
    },
    {
      icon: Bell, label: 'الإشعارات والبث',
      permissions: [
        { key: 'SEND_BROADCAST', label: 'إرسال بث للجميع' },
        { key: 'VIEW_BROADCASTS', label: 'عرض البثوث' },
        { key: 'SEND_NOTIFICATIONS', label: 'إرسال إشعارات' },
      ],
    },
  ],
  bishop: [
    {
      icon: Shield, label: 'إدارة الأبراشية',
      permissions: [
        { key: 'MANAGE_GLOBAL_TENANTS', label: 'إدارة سكنات الأبراشية' },
        { key: 'MANAGE_EMPLOYEES', label: 'إدارة الموظفين' },
        { key: 'ASSIGN_GLOBAL_STAFF', label: 'تعيين الموظفين' },
      ],
    },
    {
      icon: Users, label: 'التقارير',
      permissions: [
        { key: 'VIEW_REPORTS', label: 'عرض التقارير' },
        { key: 'VIEW_GLOBAL_REPORTS', label: 'تقارير شاملة' },
      ],
    },
    {
      icon: Bell, label: 'البث',
      permissions: [
        { key: 'SEND_BROADCAST', label: 'إرسال بث للأبراشية' },
        { key: 'VIEW_BROADCASTS', label: 'عرض البثوث' },
      ],
    },
  ],
  priest: [
    {
      icon: Users, label: 'الطلاب',
      permissions: [
        { key: 'VIEW_STUDENT', label: 'عرض بيانات الطلاب' },
        { key: 'ADD_STUDENT', label: 'إضافة طالب' },
        { key: 'EDIT_STUDENT', label: 'تعديل بيانات طالب' },
        { key: 'DELETE_STUDENT', label: 'حذف طالب' },
        { key: 'ASSIGN_ROOM', label: 'تسكين طالب' },
        { key: 'MOVE_STUDENT', label: 'نقل طالب' },
      ],
    },
    {
      icon: Home, label: 'السكن',
      permissions: [
        { key: 'VIEW_HOUSING', label: 'عرض السكنات المسؤول عنها' },
        { key: 'MANAGE_HOUSING', label: 'إدارة السكن' },
        { key: 'VIEW_ROOMS', label: 'عرض الغرف' },
        { key: 'ADD_ROOM', label: 'إضافة غرفة' },
        { key: 'EDIT_ROOM', label: 'تعديل غرفة' },
        { key: 'DELETE_ROOM', label: 'حذف غرفة' },
      ],
    },
    {
      icon: Calendar, label: 'الفعاليات',
      permissions: [
        { key: 'VIEW_EVENTS', label: 'عرض الفعاليات' },
        { key: 'CREATE_EVENT', label: 'إنشاء فعالية' },
        { key: 'EDIT_EVENT', label: 'تعديل فعالية' },
        { key: 'DELETE_EVENT', label: 'حذف فعالية' },
        { key: 'ATTEND_EVENT', label: 'تسجيل حضور' },
        { key: 'MANAGE_EVENT_ATTENDANCE', label: 'إدارة حضور الفعاليات' },
        { key: 'MANAGE_EVENT_PAYMENTS', label: 'إدارة مدفوعات الفعاليات' },
      ],
    },
    {
      icon: Target, label: 'المسابقات والأنشطة',
      permissions: [
        { key: 'VIEW_POINTS', label: 'عرض النقاط' },
        { key: 'MANAGE_POINTS', label: 'إدارة النقاط' },
        { key: 'MANAGE_REWARDS', label: 'إدارة المكافآت والأوسمة' },
        { key: 'MANAGE_PENALTIES', label: 'إدارة العقوبات' },
        { key: 'VIEW_COMPETITIONS', label: 'عرض المسابقات' },
        { key: 'MANAGE_COMPETITIONS', label: 'إدارة المسابقات' },
        { key: 'JOIN_COMPETITIONS', label: 'المشاركة في المسابقات' },
      ],
    },
    {
      icon: BarChart3, label: 'التقارير',
      permissions: [
        { key: 'VIEW_FINANCE_REPORTS', label: 'تقارير مالية' },
        { key: 'VIEW_DASHBOARD', label: 'لوحة المعلومات' },
        { key: 'VIEW_REPORTS', label: 'عرض التقارير' },
        { key: 'VIEW_PRIEST_DASHBOARD', label: 'لوحة الكهنة' },
        { key: 'VIEW_DECISION_LOG', label: 'سجل القرارات' },
        { key: 'UNDO_DECISION', label: 'إلغاء قرار' },
      ],
    },
    {
      icon: Wrench, label: 'الصيانة والخدمات',
      permissions: [
        { key: 'VIEW_MAINTENANCE', label: 'عرض طلبات الصيانة' },
        { key: 'REQUEST_MAINTENANCE', label: 'طلب صيانة' },
        { key: 'HANDLE_MAINTENANCE', label: 'معالجة الصيانة' },
        { key: 'VIEW_INVENTORY', label: 'عرض المخزون' },
        { key: 'MANAGE_INVENTORY', label: 'إدارة المخزون' },
      ],
    },
    {
      icon: Bell, label: 'الإشعارات والبث',
      permissions: [
        { key: 'SEND_BROADCAST', label: 'إرسال بث للسكنات' },
        { key: 'VIEW_BROADCASTS', label: 'عرض البثوث' },
        { key: 'VIEW_NOTIFICATIONS', label: 'عرض الإشعارات' },
        { key: 'SEND_NOTIFICATIONS', label: 'إرسال إشعارات' },
      ],
    },
    {
      icon: Settings, label: 'الإعدادات',
      permissions: [
        { key: 'VIEW_SETTINGS', label: 'عرض الإعدادات' },
        { key: 'MANAGE_SETTINGS', label: 'إدارة الإعدادات' },
        { key: 'VIEW_USERS', label: 'عرض المستخدمين' },
        { key: 'MANAGE_USERS', label: 'إدارة المستخدمين' },
        { key: 'MANAGE_EMPLOYEES', label: 'إدارة الموظفين' },
        { key: 'ASSIGN_ROLES', label: 'تعيين الأدوار' },
      ],
    },
  ],
  assistant_supervisor: [
    {
      icon: Users, label: 'الطلاب',
      permissions: [
        { key: 'VIEW_STUDENT', label: 'عرض بيانات الطلاب' },
        { key: 'VIEW_POINTS', label: 'عرض النقاط' },
      ],
    },
    {
      icon: Home, label: 'السكن',
      permissions: [
        { key: 'VIEW_ROOMS', label: 'عرض الغرف' },
        { key: 'VIEW_ATTENDANCE', label: 'عرض الحضور' },
        { key: 'MANAGE_EVENT_ATTENDANCE', label: 'إدارة حضور الأحداث' },
      ],
    },
    {
      icon: BookOpen, label: 'الصيانة والخدمات',
      permissions: [
        { key: 'VIEW_MAINTENANCE', label: 'عرض طلبات الصيانة' },
        { key: 'HANDLE_MAINTENANCE', label: 'معالجة الصيانة' },
        { key: 'VIEW_LAUNDRY_QUEUE', label: 'عرض طابور المغسلة' },
      ],
    },
    {
      icon: Calendar, label: 'التقارير',
      permissions: [
        { key: 'VIEW_DASHBOARD', label: 'لوحة المعلومات' },
        { key: 'VIEW_REPORTS', label: 'عرض التقارير' },
        { key: 'VIEW_COMPETITIONS', label: 'عرض المسابقات' },
        { key: 'VIEW_EVENTS', label: 'عرض الأحداث' },
      ],
    },
  ],
  supervisor: [
    {
      icon: Users, label: 'الطلاب',
      permissions: [
        { key: 'VIEW_STUDENT', label: 'عرض بيانات الطلاب' },
        { key: 'ADD_STUDENT', label: 'إضافة طالب' },
        { key: 'EDIT_STUDENT', label: 'تعديل بيانات طالب' },
        { key: 'DELETE_STUDENT', label: 'حذف طالب' },
        { key: 'ASSIGN_ROOM', label: 'تسكين طالب' },
        { key: 'MOVE_STUDENT', label: 'نقل طالب' },
      ],
    },
    {
      icon: Home, label: 'السكن',
      permissions: [
        { key: 'VIEW_HOUSING', label: 'عرض السكن' },
        { key: 'MANAGE_HOUSING', label: 'إدارة السكن' },
        { key: 'VIEW_ROOMS', label: 'عرض الغرف' },
        { key: 'ADD_ROOM', label: 'إضافة غرفة' },
        { key: 'EDIT_ROOM', label: 'تعديل غرفة' },
        { key: 'DELETE_ROOM', label: 'حذف غرفة' },
      ],
    },
    {
      icon: Calendar, label: 'الحضور والأنشطة',
      permissions: [
        { key: 'VIEW_ATTENDANCE', label: 'عرض الحضور' },
        { key: 'MANAGE_ATTENDANCE', label: 'إدارة الحضور' },
        { key: 'VIEW_EVENTS', label: 'عرض الأحداث' },
        { key: 'CREATE_EVENT', label: 'إنشاء حدث' },
        { key: 'MANAGE_EVENT_ATTENDANCE', label: 'إدارة حضور الأحداث' },
      ],
    },
    {
      icon: DollarSign, label: 'المالية',
      permissions: [
        { key: 'VIEW_FINANCE', label: 'عرض المالية' },
        { key: 'VIEW_FINANCE_REPORTS', label: 'تقارير مالية' },
        { key: 'ADD_EXPENSE', label: 'إضافة مصروف' },
        { key: 'ADD_REVENUE', label: 'إضافة إيراد' },
      ],
    },
    {
      icon: AlertTriangle, label: 'السلوك والنقاط',
      permissions: [
        { key: 'MANAGE_POINTS', label: 'إدارة النقاط' },
        { key: 'VIEW_POINTS', label: 'عرض النقاط' },
        { key: 'MANAGE_REWARDS', label: 'إدارة المكافآت' },
        { key: 'MANAGE_PENALTIES', label: 'إدارة العقوبات' },
      ],
    },
    {
      icon: Bell, label: 'البث والإشعارات',
      permissions: [
        { key: 'SEND_BROADCAST', label: 'إرسال بث' },
        { key: 'VIEW_BROADCASTS', label: 'عرض البثوث' },
        { key: 'SEND_NOTIFICATIONS', label: 'إرسال إشعارات' },
      ],
    },
  ],
  employee: [],
  parent: [
    {
      icon: Users, label: 'الأبناء',
      permissions: [
        { key: 'VIEW_STUDENT', label: 'عرض بيانات أبنائه فقط' },
        { key: 'VIEW_ATTENDANCE', label: 'عرض حضور أبنائه' },
        { key: 'VIEW_POINTS', label: 'عرض نقاط أبنائه' },
      ],
    },
    {
      icon: Bell, label: 'الإشعارات',
      permissions: [
        { key: 'VIEW_NOTIFICATIONS', label: 'عرض الإشعارات' },
        { key: 'VIEW_BROADCASTS', label: 'عرض البثوث' },
      ],
    },
  ],
  student: [
    {
      icon: Users, label: 'البيانات الشخصية',
      permissions: [
        { key: 'VIEW_STUDENT', label: 'عرض بياناته فقط' },
        { key: 'VIEW_POINTS', label: 'عرض نقاطه' },
        { key: 'VIEW_DASHBOARD', label: 'لوحة المعلومات' },
      ],
    },
    {
      icon: Calendar, label: 'الحضور والأنشطة',
      permissions: [
        { key: 'CHECKIN_ATTENDANCE', label: 'تسجيل حضوره' },
        { key: 'VIEW_EVENTS', label: 'عرض الأحداث' },
        { key: 'ATTEND_EVENT', label: 'حضور حدث' },
        { key: 'VIEW_COMPETITIONS', label: 'عرض المسابقات' },
        { key: 'JOIN_COMPETITIONS', label: 'المشاركة في المسابقات' },
      ],
    },
    {
      icon: Home, label: 'الخدمات',
      permissions: [
        { key: 'JOIN_LAUNDRY', label: 'حجز المغسلة' },
        { key: 'VIEW_LAUNDRY_QUEUE', label: 'عرض طابور المغسلة' },
        { key: 'REQUEST_MAINTENANCE', label: 'طلب صيانة' },
        { key: 'VIEW_NOTIFICATIONS', label: 'عرض الإشعارات' },
      ],
    },
  ],
};

export const ROLE_DESCRIPTIONS: Record<string, { title: string; description: string; can: string[]; cannot: string[] }> = {
  admin: {
    title: 'مدير التطبيق',
    description: 'لديك صلاحية الوصول الكامل لجميع أجزاء النظام. يمكنك رؤية وإدارة كل شيء في جميع السكنات.',
    can: [
      'رؤية جميع السكنات والمستخدمين',
      'إدارة الأساقفة والمشرفين والموظفين',
      'إرسال بث لكل مستخدمي النظام',
      'الوصول لجميع التقارير والإحصائيات',
      'إدارة إعدادات النظام بالكامل',
    ],
    cannot: [
      'لا توجد قيود — لديك صلاحية الوصول الكامل',
    ],
  },
  bishop: {
    title: 'أسقف',
    description: 'لديك صلاحية الوصول لأبرشيتك فقط. يمكنك رؤية وإدارة السكنات والكهنة التابعين لك.',
    can: [
      'رؤية سكنات أبرشيتك فقط',
      'إدارة الكهنة والموظفين في أبرشيتك',
      'التقارير الشاملة لأبرشيتك',
      'إرسال بث لأبرشيتك',
    ],
    cannot: [
      'لا يمكنك رؤية سكنات أبرشيات أخرى',
      'لا يمكنك تعديل إعدادات النظام العامة',
    ],
  },
  priest: {
    title: 'كاهن',
    description: 'لديك صلاحية الإدارة الكاملة للسكنات المسؤول عنها.',
    can: [
      'إدارة كاملة للسكنات المخصصة لك (طلاب، غرف، شقق)',
      'إدارة الحضور والأنشطة والفعاليات',
      'إدارة النقاط والمكافآت والأوسمة والعقوبات',
      'إدارة المسابقات والفرق',
      'تقارير مالية فقط للسكنات المسؤول عنها',
      'إرسال بث وإشعارات لسكناتك',
      'إدارة الصيانة والمخزون',
      'إدارة المغسلة',
      'إدارة المستخدمين والموظفين في سكناتك',
    ],
    cannot: [
      'لا يمكنك رؤية سكنات أخرى غير المخصصة لك',
      'لا يمكنك إدارة النظام المالي (إضافة مصروفات أو إيرادات)',
      'لا يمكنك إدارة النظام (إعدادات عامة)',
    ],
  },
  supervisor: {
    title: 'مشرف سكن',
    description: 'لديك صلاحية الإدارة الكاملة لسكنك. يمكنك إدارة الطلاب والغرف والحضور والمالية.',
    can: [
      'إدارة كاملة لسكنك (طلاب، غرف، شقق)',
      'إدارة الحضور والأنشطة',
      'إدارة النقاط والمكافآت والعقوبات',
      'إدارة المالية (مصروفات وإيرادات)',
      'إرسال بث لسكنك',
      'إدارة الصيانة والمخزون',
      'إدارة المغسلة',
    ],
    cannot: [
      'لا يمكنك رؤية سكنات أخرى',
      'لا يمكنك إدارة النظام (إعدادات عامة)',
    ],
  },
  assistant_supervisor: {
    title: 'مساعد مشرف',
    description: 'لديك صلاحية مساعدة المشرف في مهام السكن اليومية.',
    can: [
      'عرض بيانات الطلاب',
      'عرض الغرف والحضور',
      'معالجة طلبات الصيانة',
      'إدارة حضور الأحداث',
      'عرض طابور المغسلة',
    ],
    cannot: [
      'لا يمكنك إضافة أو تعديل بيانات الطلاب',
      'لا يمكنك إدارة المالية',
      'لا يمكنك إرسال بث أو إشعارات',
    ],
  },
  employee: {
    title: 'موظف',
    description: 'ليس لديك أي صلاحيات افتراضية. الصلاحيات التي تظهر لك هي فقط الممنوحة لك عبر الدور المخصص.',
    can: [
      'حسب الدور المخصص لك فقط',
    ],
    cannot: [
      'لا يمكنك رؤية أو فعل أي شيء إلا حسب الصلاحيات الممنوحة لك',
    ],
  },
  parent: {
    title: 'ولي أمر',
    description: 'لديك صلاحية رؤية بيانات أبنائك فقط.',
    can: [
      'عرض بيانات أبنائك المسجلين',
      'عرض حضور أبنائك',
      'عرض نقاط وسلوك أبنائك',
      'التواصل مع المشرف المسؤول',
      'مشاهدة البثوث والإشعارات',
    ],
    cannot: [
      'لا يمكنك رؤية بيانات طلاب آخرين',
      'لا يمكنك إدارة أي شيء',
      'لا يمكنك رؤية المالية أو إدارتها',
      'لا يمكنك إرسال رسائل أو بثوث',
    ],
  },
  student: {
    title: 'طالب',
    description: 'لديك صلاحية رؤية بياناتك الشخصية فقط واستخدام الخدمات المتاحة.',
    can: [
      'رؤية بياناتك الشخصية (الغرفة، الشقة، السكن)',
      'رؤية نقاطك وإنذاراتك',
      'تسجيل حضورك',
      'المشاركة في الأحداث والمسابقات',
      'طلب صيانة لغرفتك',
      'حجز المغسلة',
    ],
    cannot: [
      'لا يمكنك رؤية بيانات طلاب آخرين',
      'لا يمكنك إدارة أو تعديل أي شيء',
      'لا يمكنك رؤية المالية',
    ],
  },
};

export function getRolePermissionGroups(role: string): PermissionGroup[] {
  return PERMISSION_GROUPS[role] || [];
}

export function getRoleDescription(role: string) {
  return ROLE_DESCRIPTIONS[role] || ROLE_DESCRIPTIONS.student;
}

// الصلاحيات التي يمكن لكل دور رؤيتها عند إنشاء دور مخصص
// المستخدم يرى فقط الصلاحيات الموجودة في دوره الأساسي + صلاحياته المخصصة
const ROLE_VISIBLE_PERMISSION_KEYS: Record<string, string[]> = {
  admin: ALL_PERMISSIONS.map(p => p.key),
  supervisor: [
    'VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT', 'ASSIGN_ROOM', 'MOVE_STUDENT',
    'VIEW_HOUSING', 'MANAGE_HOUSING', 'VIEW_ROOMS', 'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
    'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE', 'MANAGE_ATTENDANCE',
    'JOIN_LAUNDRY', 'VIEW_LAUNDRY_QUEUE', 'MANAGE_LAUNDRY', 'MANAGE_LAUNDRY_OPERATORS',
    'START_LAUNDRY_SESSION', 'CLOSE_LAUNDRY_SESSION',
    'MANAGE_POINTS', 'VIEW_POINTS', 'MANAGE_REWARDS', 'MANAGE_PENALTIES',
    'MANAGE_COMPETITIONS', 'VIEW_COMPETITIONS', 'JOIN_COMPETITIONS',
    'VIEW_MAINTENANCE', 'REQUEST_MAINTENANCE', 'HANDLE_MAINTENANCE',
    'VIEW_INVENTORY', 'MANAGE_INVENTORY',
    'VIEW_FINANCE', 'ADD_EXPENSE', 'ADD_REVENUE', 'VIEW_FINANCE_REPORTS',
    'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT', 'ATTEND_EVENT', 'VIEW_EVENTS', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS',
    'VIEW_SETTINGS', 'MANAGE_SETTINGS',
    'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
    'VIEW_DASHBOARD', 'VIEW_REPORTS',
    'VIEW_USERS', 'MANAGE_USERS', 'MANAGE_EMPLOYEES', 'ASSIGN_ROLES',
    'SEND_BROADCAST', 'VIEW_BROADCASTS',
    'VIEW_DECISION_LOG', 'UNDO_DECISION',
  ],
  bishop: [
    'VIEW_STUDENT',
    'VIEW_ATTENDANCE',
    'VIEW_DASHBOARD', 'VIEW_REPORTS', 'VIEW_GLOBAL_REPORTS',
    'MANAGE_GLOBAL_TENANTS', 'ASSIGN_GLOBAL_STAFF',
    'MANAGE_EMPLOYEES',
    'VIEW_USERS', 'MANAGE_USERS',
    'SEND_BROADCAST', 'VIEW_BROADCASTS',
  ],
  priest: [
    'VIEW_USERS', 'MANAGE_USERS', 'MANAGE_EMPLOYEES', 'ASSIGN_ROLES',
    'VIEW_STUDENT', 'ADD_STUDENT', 'EDIT_STUDENT', 'DELETE_STUDENT',
    'ASSIGN_ROOM', 'MOVE_STUDENT',
    'VIEW_HOUSING', 'MANAGE_HOUSING', 'VIEW_ROOMS', 'ADD_ROOM', 'EDIT_ROOM', 'DELETE_ROOM',
    'VIEW_ATTENDANCE', 'CHECKIN_ATTENDANCE', 'MANAGE_ATTENDANCE',
    'VIEW_PRIEST_DASHBOARD', 'MANAGE_PRIEST_REPORTS',
    'VIEW_DASHBOARD', 'VIEW_REPORTS',
    'VIEW_MAINTENANCE', 'REQUEST_MAINTENANCE', 'HANDLE_MAINTENANCE',
    'MANAGE_POINTS', 'VIEW_POINTS', 'MANAGE_REWARDS', 'MANAGE_PENALTIES',
    'MANAGE_COMPETITIONS', 'VIEW_COMPETITIONS', 'JOIN_COMPETITIONS',
    'VIEW_DECISION_LOG', 'UNDO_DECISION',
    'VIEW_EVENTS', 'CREATE_EVENT', 'EDIT_EVENT', 'DELETE_EVENT',
    'ATTEND_EVENT', 'MANAGE_EVENT_ATTENDANCE', 'MANAGE_EVENT_PAYMENTS',
    'VIEW_FINANCE_REPORTS',
    'VIEW_SETTINGS', 'MANAGE_SETTINGS',
    'SEND_BROADCAST', 'VIEW_BROADCASTS',
    'VIEW_INVENTORY', 'MANAGE_INVENTORY',
    'VIEW_NOTIFICATIONS', 'SEND_NOTIFICATIONS',
    'VIEW_RADIO',
  ],
  assistant_supervisor: [
    'VIEW_STUDENT',
    'VIEW_ROOMS',
    'VIEW_ATTENDANCE',
    'VIEW_LAUNDRY_QUEUE',
    'VIEW_DASHBOARD', 'VIEW_REPORTS',
    'VIEW_POINTS',
    'VIEW_COMPETITIONS',
    'VIEW_MAINTENANCE', 'HANDLE_MAINTENANCE',
    'VIEW_EVENTS', 'MANAGE_EVENT_ATTENDANCE',
  ],
  employee: [],
  student: [
    'VIEW_DASHBOARD', 'VIEW_STUDENT',
    'CHECKIN_ATTENDANCE',
    'JOIN_LAUNDRY', 'VIEW_LAUNDRY_QUEUE',
    'REQUEST_MAINTENANCE',
    'ATTEND_EVENT', 'VIEW_EVENTS',
    'VIEW_NOTIFICATIONS',
    'VIEW_POINTS',
    'VIEW_COMPETITIONS', 'JOIN_COMPETITIONS',
    'VIEW_BROADCASTS',
  ],
  parent: [
    'VIEW_DASHBOARD', 'VIEW_STUDENT',
    'VIEW_ATTENDANCE',
    'VIEW_REPORTS',
    'VIEW_POINTS',
    'VIEW_COMPETITIONS',
    'VIEW_EVENTS', 'ATTEND_EVENT',
    'VIEW_NOTIFICATIONS',
    'VIEW_BROADCASTS',
  ],
};

export function getVisiblePermissions(role: string, customPermissions?: string | null): string[] {
  const basePerms = ROLE_VISIBLE_PERMISSION_KEYS[role] || [];
  if (!customPermissions) return basePerms;
  try {
    const parsed = JSON.parse(customPermissions);
    if (parsed.includes('ALL')) return ALL_PERMISSIONS.map(p => p.key);
    const merged = [...basePerms];
    for (const perm of parsed) {
      if (!merged.includes(perm)) merged.push(perm);
    }
    return merged;
  } catch {
    return basePerms;
  }
}
