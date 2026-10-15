import { z } from 'zod';

// معرّف الدخول: اسم المستخدم (بديل البريد). يقبل حروف (عربية/لاتينية) وأرقام
// ونقطة/شرطة/شرطة سفلية، بلا مسافات، وطوله 3..50.
export const usernameSchema = z
  .string()
  .trim()
  .min(3, 'اسم المستخدم لازم 3 حروف على الأقل')
  .max(50, 'اسم المستخدم طويل أوي')
  .regex(/^[\p{L}\p{N}._-]+$/u, 'اسم المستخدم يقبل حروف وأرقام ونقطة أو شرطة أو شرطة سفلية فقط');

export const loginSchema = z
  .object({
    email: z.string().trim().email('ايميل مش صحيح').max(255).optional(),
    username: usernameSchema.optional(),
    password: z.string().min(1, 'الباسورد مطلوب').max(128),
  })
  .refine((d) => !!(d.email || d.username), {
    message: 'ادخل البريد الإلكتروني أو اسم المستخدم',
    path: ['email'],
  });

export const registerSchema = z.object({
  email: z.string().email('ايميل مش صحيح').max(255),
  password: z.string().min(8, 'الباسورد قصير أوي (على الأقل 8 حروف)').max(128).regex(/[A-Za-z]/, 'الباسورد لازم يضم حروف إنجليزية').regex(/\d/, 'الباسورد لازم يضم رقم'),
  name: z.string().min(1, 'الاسم مطلوب').max(100),
  gender: z.enum(['male', 'female']).optional(),
});

// ─── Event ───
export const eventRuleSchema = z.object({
  id: z.string().max(128).nullable().optional(),
  condition_status: z.enum(['late', 'absent', 'unexcused']),
  condition_min_late_minutes: z.number().int().min(0).max(10000).nullable().optional(),
  condition_max_late_minutes: z.number().int().min(0).max(10000).nullable().optional(),
  action_type: z.enum(['NONE', 'DEDUCT_POINTS', 'FINANCIAL_FEE', 'SEND_NOTIFICATION', 'EXCLUDE_FROM_RESIDENCE']).default('NONE'),
  points_amount: z.number().int().min(0).max(100000).default(0),
  fee_amount: z.number().min(0).max(1000000).default(0),
  notification_message: z.string().max(2000).nullable().optional(),
  enabled: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(1000).default(0),
});

export const createEventSchema = z.object({
  title: z.string().min(1, 'عنوان الفعالية مطلوب').max(255),
  description: z.string().max(2000).optional(),
  event_date: z.string().min(1, 'تاريخ الفعالية مطلوب').max(50),
  location: z.string().max(500).optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_radius: z.number().min(0).max(100000).optional(),
  is_paid: z.boolean().or(z.number()).optional().default(false),
  price: z.number().min(0).optional().default(0),
  is_competition: z.boolean().or(z.number()).optional().default(false),
  winning_threshold: z.number().min(0).max(999999).optional().default(100),
  max_score: z.number().min(0).max(999999).optional().default(200),
  responsibleIds: z.array(z.string().max(128)).optional().default([]),
  targeting: z.any().optional(),
  type: z.string().max(50).optional(),
  registration_deadline: z.string().max(50).optional(),
  available_payment_methods: z.array(z.string().max(128)).optional(),
  max_participants: z.number().int().positive().max(100000).optional(),
  start_time: z.string().max(50).optional(),
  end_time: z.string().max(50).optional(),
  duration_minutes: z.number().int().min(1).max(100000).optional(),
  is_required_attendance: z.boolean().optional(),
  evaluation_mode: z.enum(['FIRST_APPLICABLE', 'ALL_APPLICABLE']).optional(),
  excuse_deadline_minutes: z.union([z.number().int().min(0).max(100000), z.string(), z.null()]).optional(),
  // nested legacy tier-rule (validated at the route with attendanceRuleSchema)
  rule: z.object({
    grace_period_minutes: z.number().int().min(0).max(600).optional(),
    penalty_mode: z.enum(['NONE', 'FINANCIAL', 'POINTS', 'BOTH']).optional(),
    base_penalty: z.number().min(0).max(1000000).optional(),
    base_points: z.number().int().min(0).max(100000).optional(),
    additional_penalty: z.number().min(0).max(1000000).optional(),
    additional_penalty_unit: z.enum(['PER_MINUTE', 'PER_BLOCK', 'FIXED']).optional(),
    additional_penalty_block_minutes: z.number().int().min(1).max(600).optional(),
    maximum_penalty: z.number().min(0).max(1000000).nullable().optional(),
    maximum_points_deduction: z.number().int().min(0).max(100000).nullable().optional(),
    absent_after_minutes: z.number().int().min(1).max(10000).nullable().optional(),
    auto_apply_penalty: z.boolean().optional(),
    enabled: z.boolean().optional(),
    tiers: z.array(z.object({}).passthrough()).max(50).nullable().optional(),
    required_attendance: z.boolean().optional(),
    counts_toward_absence_limit: z.boolean().optional(),
    attendance_weight: z.number().min(0.5).max(100).optional(),
  }).optional(),
  rules: z.array(eventRuleSchema).max(100).optional(),
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'عنوان الفعالية مطلوب').optional(),
  description: z.string().optional(),
  event_date: z.string().min(1, 'تاريخ الفعالية مطلوب').optional(),
  location: z.string().optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_radius: z.number().min(0).max(100000).optional(),
  is_paid: z.boolean().or(z.number()).optional(),
  price: z.number().optional(),
  is_competition: z.boolean().or(z.number()).optional(),
  winning_threshold: z.number().optional(),
  max_score: z.number().optional(),
  responsibleIds: z.array(z.string()).optional(),
  targeting: z.any().optional(),
  type: z.string().optional(),
  registration_deadline: z.string().optional(),
  available_payment_methods: z.array(z.string()).optional(),
  max_participants: z.number().int().positive().optional(),
  start_time: z.string().max(50).optional(),
  end_time: z.string().max(50).optional(),
  duration_minutes: z.number().int().min(1).max(100000).optional(),
  is_required_attendance: z.boolean().optional(),
  evaluation_mode: z.enum(['FIRST_APPLICABLE', 'ALL_APPLICABLE']).optional(),
  excuse_deadline_minutes: z.union([z.number().int().min(0).max(100000), z.string(), z.null()]).optional(),
  rule: z.any().optional(),
  rules: z.array(eventRuleSchema).max(100).optional(),
});

// ─── Attendance ───
export const eventAttendanceSchema = z.object({
  eventId: z.string().min(1, 'معرف الفعالية مطلوب'),
  studentId: z.string().optional(),
  status: z.enum(['present', 'absent', 'unexcused', 'late', 'excused']).optional().default('present'),
  checkInMethod: z.string().optional().default('qr'),
  excuseReason: z.string().nullable().optional(),
});

export const eventAttendanceDetailedSchema = z.object({
  eventId: z.string().optional(),
  sessionId: z.string().min(1, 'معرف الجلسة مطلوب'),
  studentId: z.string().min(1, 'معرف الطالب مطلوب'),
  status: z.enum(['present', 'absent', 'unexcused', 'late', 'excused']).optional().default('present'),
  absenceReason: z.string().nullable().optional(),
  notifiedParent: z.boolean().optional().default(false),
  notifiedPriest: z.boolean().optional().default(false),
});

export const attendanceBulkSchema = z.object({
  records: z.array(z.object({
    studentId: z.string().min(1),
    status: z.string().optional(),
    excuseReason: z.string().nullable().optional(),
  })).min(1, 'فيه سجلات على الأقل'),
});

export const attendanceDetailedBatchSchema = z.object({
  records: z.array(z.object({
    studentId: z.string().min(1),
    eventId: z.string().optional(),
    sessionId: z.string().optional(),
    status: z.string().optional(),
    reason: z.string().nullable().optional(),
    notifyParent: z.boolean().optional(),
    notifyPriest: z.boolean().optional(),
  })).min(1),
});

// ─── Event Session ───
export const createEventSessionSchema = z.object({
  title: z.string().min(1, 'عنوان الجلسة مطلوب'),
  description: z.string().optional(),
  start_time: z.string().min(1, 'وقت البداية مطلوب'),
  type: z.string().optional(),
});

// ─── Event Teams & Scores ───
export const createEventTeamSchema = z.object({
  name: z.string().min(1, 'اسم الفريق مطلوب'),
  responsibleId: z.string().optional(),
  memberIds: z.array(z.string()).optional().default([]),
});

export const createEventCriterionSchema = z.object({
  title: z.string().min(1, 'عنوان المعيار مطلوب'),
  max_score: z.number().int().positive().optional().default(10),
});

export const eventScoreSchema = z.object({
  scores: z.array(z.object({
    studentId: z.string().optional(),
    criterionId: z.string().min(1),
    score: z.number(),
  })).min(1),
});

export const parentEnrollSchema = z.object({
  parent_can_enroll: z.boolean().or(z.number()),
});

// ─── Laundry ───
export const createMachineSchema = z.object({
  name: z.string().min(1, 'اسم الغسالة مطلوب'),
  id: z.string().optional(),
});

export const updateMachineStatusSchema = z.object({
  status: z.string().min(1, 'الحالة مطلوبة'),
});

export const createOperatorSchema = z.object({
  userId: z.string().min(1, 'معرف المستخدم مطلوب'),
});

export const laundrySettingsSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1, 'اختار يوم على الأقل'),
  start_hour: z.string().regex(/^\d{2}:\d{2}$/, 'الصيغة HH:MM'),
  end_hour: z.string().regex(/^\d{2}:\d{2}$/, 'الصيغة HH:MM'),
});

export const queueCallSchema = z.object({
  queueId: z.string().min(1, 'معرف الطابور مطلوب'),
  machineId: z.string().min(1, 'معرف الغسالة مطلوب'),
});

export const queueActionSchema = z.object({
  queueId: z.string().min(1, 'معرف الطابور مطلوب'),
});

// ─── Competition ───
export const createCompetitionSchema = z.object({
  title: z.string().min(1, 'عنوان المسابقة مطلوب'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  prizePoints: z.number().int().positive('نقاط الجائزة لازم تكون أكبر من صفر').optional(),
  questionsCount: z.number().int().optional().default(0),
  responsibleId: z.string().nullable().optional().default(null),
  criteria: z.array(z.object({
    title: z.string().min(1),
    maxPoints: z.number().int().positive(),
  })).optional(),
});

export const updateCompetitionStatusSchema = z.object({
  status: z.enum(['draft', 'active', 'finished', 'cancelled'], { message: 'حالة مش صحيحة' }),
});

export const createCompetitionTeamSchema = z.object({
  name: z.string().min(1, 'اسم الفريق مطلوب'),
  responsibleId: z.string().optional(),
  studentIds: z.array(z.string()).optional().default([]),
});

export const scoreTeamSchema = z.object({
  points: z.number().int('النقاط لازم تكون رقم صحيح'),
});

export const finishCompetitionSchema = z.object({
  winners: z.array(z.string()).optional().default([]),
});

// ─── Tenant ───
export const createTenantSchema = z.object({
  name: z.string().min(1, 'اسم السكن مطلوب'),
  location: z.string().optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_radius: z.number().int().min(1).max(100000).optional().default(50),
  curfew_time: z.string().optional(),
  open_time: z.string().optional(),
  semester1_start: z.string().optional(),
  semester1_end: z.string().optional(),
  semester2_start: z.string().optional(),
  semester2_end: z.string().optional(),
  bishop_id: z.string().nullable().optional().default(null),
  supervisor_ids: z.array(z.string()).min(1, 'يجب اختيار مشرف واحد على الأقل'),
  priest_ids: z.array(z.string()).optional().default([]),
  daily_readings_enabled: z.boolean().or(z.number()).optional().default(true),
  radio_514_enabled: z.boolean().or(z.number()).optional().default(true),
  laundry_enabled: z.boolean().or(z.number()).optional().default(true),
  restaurant_enabled: z.boolean().or(z.number()).optional().default(true),
  canteen_enabled: z.boolean().or(z.number()).optional().default(true),
});

export const updateTenantSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  supervisor_ids: z.array(z.string()).optional(),
  daily_readings_enabled: z.boolean().or(z.number()).optional(),
  radio_514_enabled: z.boolean().or(z.number()).optional(),
  laundry_enabled: z.boolean().or(z.number()).optional(),
  restaurant_enabled: z.boolean().or(z.number()).optional(),
  canteen_enabled: z.boolean().or(z.number()).optional(),
  priest_ids: z.array(z.string()).optional(),
  bishop_id: z.string().nullable().optional(),
  is_active: z.boolean().or(z.number()).optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  location_radius: z.number().int().min(1).max(100000).optional(),
  curfew_time: z.string().optional(),
  open_time: z.string().optional(),
  semester1_start: z.string().optional(),
  semester1_end: z.string().optional(),
  semester2_start: z.string().optional(),
  semester2_end: z.string().optional(),
});

// ─── Maintenance ───
export const createMaintenanceSchema = z.object({
  apartmentId: z.string().optional(),
  roomId: z.string().optional(),
  description: z.string().min(1, 'وصف بلاغ الصيانة مطلوب'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional().default('medium'),
});

export const updateMaintenanceStatusSchema = z.object({
  status: z.string().min(1, 'الحالة مطلوبة'),
  assignedTo: z.string().nullable().optional(),
});

// ─── Payment ───
export const submitPaymentSchema = z.object({
  eventId: z.string().min(1, 'معرف الفعالية مطلوب'),
  paymentMethodId: z.string().min(1, 'وسيلة الدفع مطلوبة'),
  amount: z.number().positive('المبلغ لازم يكون أكبر من صفر').optional(),
});

export const createPaymentMethodSchema = z.object({
  name: z.string().min(1, 'اسم وسيلة الدفع مطلوب'),
  phone_number: z.string().min(1, 'رقم الهاتف مطلوب'),
  type: z.string().optional().default('instapay'),
});

export const updatePaymentMethodSchema = z.object({
  name: z.string().optional(),
  phone_number: z.string().optional(),
  type: z.string().optional(),
  is_active: z.boolean().or(z.number()).optional(),
});

// ─── Notification ───
export const pushSubscriptionSchema = z.object({
  subscription: z.object({
    endpoint: z.string().min(1),
    keys: z.object({
      auth: z.string().min(1),
      p256dh: z.string().min(1),
    }).optional(),
  }),
});

// ─── Pagination / Params ───
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

export const idParamSchema = z.object({
  id: z.string().uuid('معرف مش صحيح'),
});

export const createStudentSchema = z.object({
  userId: z.string().min(1, 'معرف المستخدم مطلوب'),
  studentIdNumber: z.string().optional(),
  university: z.string().optional(),
  phone: z.string().optional(),
  parentPhone: z.string().optional(),
  roomId: z.string().uuid().optional().nullable(),
  whatsappNumber: z.string().optional(),
  idCardNumber: z.string().optional(),
  birthDate: z.string().optional(),
  college: z.string().optional(),
  major: z.string().optional(),
  enrollmentYear: z.number().int().optional(),
  studentPhoto: z.string().optional(),
  address: z.string().optional(),
  billingCycle: z.string().optional(),
  agreedPrice: z.number().optional(),
  daily_readings_enabled: z.union([z.boolean(), z.number()]).optional(),
});

export const updateStudentSchema = z.object({
  studentIdNumber: z.string().optional(),
  university: z.string().optional(),
  phone: z.string().optional(),
  parentPhone: z.string().optional(),
  roomId: z.string().uuid().optional().nullable(),
  room_id: z.string().uuid().optional().nullable(),
  whatsappNumber: z.string().optional(),
  idCardNumber: z.string().optional(),
  birthDate: z.string().optional(),
  college: z.string().optional(),
  major: z.string().optional(),
  enrollmentYear: z.number().int().optional(),
  studentPhoto: z.string().optional(),
  address: z.string().optional(),
  billingCycle: z.string().optional(),
  agreedPrice: z.number().optional(),
  status: z.enum(['active', 'in_pause', 'vacation', 'withdrawn', 'archived'], { message: 'حالة الطالب غير صحيحة' }).optional(),
  governorate: z.string().optional(),
  village: z.string().optional(),
  churchName: z.string().optional(),
  church_name: z.string().optional(),
  confessionFatherName: z.string().optional(),
  confession_father_name: z.string().optional(),
  confession_father_phone: z.string().optional(),
  confession_father_whatsapp: z.string().optional(),
  confession_father_service: z.string().optional(),
  isServant: z.boolean().optional(),
  is_servant: z.boolean().optional(),
  servantServices: z.string().optional(),
  servant_services: z.string().optional(),
  isDeacon: z.boolean().optional(),
  is_deacon: z.boolean().optional(),
  deaconRank: z.string().optional(),
  deacon_rank: z.string().optional(),
  deacon_details: z.string().optional(),
  deacon_ordination_date: z.string().optional(),
  serviceTrainingCertificate: z.string().optional(),
  service_training_certificate: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  daily_readings_enabled: z.union([z.boolean(), z.number()]).optional(),
});

export const createFinanceSchema = z.object({
  type: z.enum(['revenue', 'expense'], { message: 'النوع يا وارد يا مصروف' }),
  category: z.string().min(1, 'التصنيف مطلوب'),
  amount: z.number().positive('المبلغ لازم يكون أكبر من صفر'),
  description: z.string().optional(),
  date: z.string().optional(),
  studentId: z.string().uuid().optional().nullable(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  paymentMethodName: z.string().max(128).optional(),
});

export const updateFinanceSchema = z.object({
  type: z.enum(['revenue', 'expense'], { message: 'النوع يا وارد يا مصروف' }).optional(),
  category: z.string().min(1, 'التصنيف مطلوب').optional(),
  amount: z.number().positive('المبلغ لازم يكون أكبر من صفر').optional(),
  description: z.string().optional(),
  date: z.string().optional().nullable(),
  studentId: z.string().uuid().optional().nullable(),
  paymentMethodId: z.string().uuid().optional().nullable(),
  paymentMethodName: z.string().max(128).optional(),
});

// Manual income/expense entry for a service book (restaurant/canteen محضر يومي).
export const serviceLedgerEntrySchema = z.object({
  type: z.enum(['income', 'expense'], { message: 'النوع يا وارد يا مصروف' }),
  category: z.string().trim().min(1, 'التصنيف مطلوب').max(100),
  amount: z.number().positive('المبلغ لازم يكون أكبر من صفر'),
  description: z.string().trim().max(500).optional(),
  date: z.string().optional(),
});

export const createApartmentSchema = z.object({
  name: z.string().min(1, 'اسم السكن مطلوب').max(200),
  building: z.string().max(200).optional().nullable(),
  supervisor_id: z.string().uuid().optional().nullable(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  amenities: z.any().optional(),
  has_kitchen: z.union([z.boolean(), z.number()]).optional(),
  kitchen_details: z.any().optional(),
  has_bathroom: z.union([z.boolean(), z.number()]).optional(),
  bathroom_details: z.any().optional(),
});

export const updateApartmentSchema = createApartmentSchema.partial();

export const createRoomSchema = z.object({
  apartmentId: z.string().uuid('معرف السكن غير صالح'),
  roomNumber: z.string().min(1, 'رقم الغرفة مطلوب').max(50),
  capacity: z.number().int('السعة لازم تكون رقم صحيح').positive('السعة لازم تكون أكبر من صفر'),
  price_daily: z.number().min(0).optional(),
  price_monthly: z.number().min(0).optional(),
  price_semester: z.number().min(0).optional(),
  amenities: z.any().optional(),
  has_kitchen: z.union([z.boolean(), z.number()]).optional(),
  kitchen_details: z.any().optional(),
  has_bathroom: z.union([z.boolean(), z.number()]).optional(),
  bathroom_details: z.any().optional(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createUserSchema = z
  .object({
    email: z.string().trim().email('البريد الإلكتروني غير صالح').max(255).optional(),
    username: usernameSchema.optional(),
    password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').max(128).optional(),
    name: z.string().min(1, 'الاسم مطلوب').max(100),
    role: z.string().min(1, 'الدور مطلوب'),
  })
  .refine((d) => !!(d.email || d.username), {
    message: 'ادخل البريد الإلكتروني أو اسم المستخدم',
    path: ['email'],
  });

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().trim().email().max(255).optional(),
  username: usernameSchema.optional(),
  role: z.string().min(1).optional(),
});

export const changeUsernameSchema = z.object({
  username: usernameSchema.nullable(),
});

export const addToTenantSchema = z.object({
  userId: z.string().uuid('معرف المستخدم غير صالح'),
  role: z.string().min(1, 'الدور مطلوب'),
});

// ─── Event Attendance Management (rules / scan / penalties / excuses / policy) ───

export const attendanceRuleTierSchema = z.object({
  minMinutes: z.number().int().min(0),
  maxMinutes: z.number().int().min(0).nullable().optional(),
  penalty: z.number().min(0).optional().default(0),
  points: z.number().int().min(0).optional().default(0),
});

export const attendanceRuleSchema = z.object({
  grace_period_minutes: z.number().int().min(0).max(600).optional(),
  penalty_mode: z.enum(['NONE', 'FINANCIAL', 'POINTS', 'BOTH']).optional(),
  base_penalty: z.number().min(0).max(1000000).optional(),
  base_points: z.number().int().min(0).max(100000).optional(),
  additional_penalty: z.number().min(0).max(1000000).optional(),
  additional_penalty_unit: z.enum(['PER_MINUTE', 'PER_BLOCK', 'FIXED']).optional(),
  additional_penalty_block_minutes: z.number().int().min(1).max(600).optional(),
  maximum_penalty: z.number().min(0).max(1000000).nullable().optional(),
  maximum_points_deduction: z.number().int().min(0).max(100000).nullable().optional(),
  absent_after_minutes: z.number().int().min(1).max(10000).nullable().optional(),
  auto_apply_penalty: z.boolean().optional(),
  enabled: z.boolean().optional(),
  tiers: z.array(attendanceRuleTierSchema).max(50).nullable().optional(),
  required_attendance: z.boolean().optional(),
  counts_toward_absence_limit: z.boolean().optional(),
  attendance_weight: z.number().min(0.5).max(100).optional(),
}).refine(
  (r) => !(r.penalty_mode === 'POINTS' || r.penalty_mode === 'BOTH') || r.base_points !== undefined || r.tiers,
  { message: 'وضع خصم النقاط يتطلب نقاط أساس أو شرائح' }
);

// Combined body for PUT /api/events/:id/attendance/rules → either the legacy
// flat tier-rule fields, a nested `rule`, the independent `rules` list, and/or
// the evaluation mode. Flat legacy usage stays backward-compatible with the UI.
export const attendanceRulesBodySchema = z.object({
  rule: attendanceRuleSchema.optional(),
  rules: z.array(eventRuleSchema).max(100).nullable().optional(),
  evaluation_mode: z.enum(['FIRST_APPLICABLE', 'ALL_APPLICABLE']).optional(),
  grace_period_minutes: z.number().int().min(0).max(600).optional(),
  penalty_mode: z.enum(['NONE', 'FINANCIAL', 'POINTS', 'BOTH']).optional(),
  base_penalty: z.number().min(0).max(1000000).optional(),
  base_points: z.number().int().min(0).max(100000).optional(),
  additional_penalty: z.number().min(0).max(1000000).optional(),
  additional_penalty_unit: z.enum(['PER_MINUTE', 'PER_BLOCK', 'FIXED']).optional(),
  additional_penalty_block_minutes: z.number().int().min(1).max(600).optional(),
  maximum_penalty: z.number().min(0).max(1000000).nullable().optional(),
  maximum_points_deduction: z.number().int().min(0).max(100000).nullable().optional(),
  absent_after_minutes: z.number().int().min(1).max(10000).nullable().optional(),
  auto_apply_penalty: z.boolean().optional(),
  enabled: z.boolean().optional(),
  tiers: z.array(attendanceRuleTierSchema).max(50).nullable().optional(),
  required_attendance: z.boolean().optional(),
  counts_toward_absence_limit: z.boolean().optional(),
  attendance_weight: z.number().min(0.5).max(100).optional(),
  excuseDeadlineMinutes: z.union([z.number().int().min(0).max(100000), z.string(), z.null()]).optional(),
}).refine(
  (r) => !(r.penalty_mode === 'POINTS' || r.penalty_mode === 'BOTH') || r.base_points !== undefined || r.tiers,
  { message: 'وضع خصم النقاط يتطلب نقاط أساس أو شرائح' }
);

// POST /api/events/:id/attendance/:attendanceId/review → supervisor classification
export const attendanceReviewBodySchema = z.object({
  classification: z.enum(['UNEXCUSED', 'EXCUSED', 'TRAVEL']),
  reason: z.string().min(2, 'سبب التصنيف مطلوب').max(2000).optional(),
});

export const qrScanSchema = z.object({
  qr: z.string().min(1, 'رمز QR مطلوب').max(2000),
  method: z.enum(['qr', 'manual']).optional().default('qr'),
});

export const manualScanSchema = z.object({
  studentId: z.string().min(1, 'معرف الطالب مطلوب').max(128),
  method: z.literal('manual').optional().default('manual'),
});

export const attendanceCorrectionSchema = z.object({
  status: z.enum(['present', 'late', 'absent', 'excused', 'travel']).optional().default('present'),
  reason: z.string().min(3, 'سبب التصحيح مطلوب (3 أحرف على الأقل)').max(2000),
});

export const penaltyReverseSchema = z.object({
  reason: z.string().min(3, 'سبب الإلغاء مطلوب').max(2000),
});

export const excuseSubmitSchema = z.object({
  eventId: z.string().min(1, 'معرف الفعالية مطلوب').max(128),
  sessionId: z.string().nullable().optional(),
  attendanceId: z.string().nullable().optional(),
  reason: z.string().min(5, 'سبب العذر مطلوب (5 أحرف على الأقل)').max(2000),
  notes: z.string().max(2000).nullable().optional(),
});

export const excuseDecideSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().max(2000).nullable().optional(),
});

export const attendancePolicyUpdateSchema = z.object({
  enforce_absence_thresholds: z.boolean().optional(),
  weighted_attendance_enabled: z.boolean().optional(),
  warning_1_threshold: z.number().int().min(0).max(1000).optional(),
  warning_2_threshold: z.number().int().min(0).max(1000).optional(),
  final_warning_threshold: z.number().int().min(0).max(1000).optional(),
  disciplinary_review_threshold: z.number().int().min(0).max(1000).optional(),
  residence_termination_review_threshold: z.number().int().min(0).max(1000).optional(),
  excuse_time_limit_hours: z.number().int().min(1).max(8760).optional(),
  parent_notify_on_absence: z.boolean().optional(),
  parent_notify_on_late: z.boolean().optional(),
  parent_notify_on_warning: z.boolean().optional(),
  note: z.string().max(2000).optional(),
}).refine(
  (p) => {
    const ord = [p.warning_1_threshold, p.warning_2_threshold, p.final_warning_threshold, p.disciplinary_review_threshold, p.residence_termination_review_threshold]
      .filter((x) => x !== undefined);
    return ord.every((v, i, a) => i === 0 || a[i - 1]! <= v!);
  },
  { message: 'عتبات الإنذارات يجب أن تكون تصاعدية (غير متناقصة)' }
);

export const disciplinaryDecisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'CLOSED']),
  reason: z.string().max(2000).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  effective_date: z.string().max(50).nullable().optional(),
});

// ─── Tenant services (تفعيل/تعطيل الخدمات لكل سكن) ───
export const tenantServicesSchema = z.object({
  laundry_enabled: z.boolean().or(z.number()).optional(),
  restaurant_enabled: z.boolean().or(z.number()).optional(),
  canteen_enabled: z.boolean().or(z.number()).optional(),
});

// ─── Restaurant ───
const toggle = z.boolean().or(z.number());

export const restaurantCategorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب').max(100),
  sort_order: z.number().int().min(0).max(10000).optional().default(0),
  is_active: toggle.optional().default(true),
});

export const updateRestaurantCategorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب').max(100).optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
  is_active: toggle.optional(),
});

export const restaurantItemSchema = z.object({
  name: z.string().min(1, 'اسم الوجبة مطلوب').max(200),
  category_id: z.string().max(128).nullable().optional().default(null),
  description: z.string().max(2000).nullable().optional().default(null),
  price: z.number().min(0).max(10_000_000).optional().default(0),
  is_available: toggle.optional().default(true),
  is_included_meal: toggle.optional().default(false),
  sort_order: z.number().int().min(0).max(10000).optional().default(0),
  image_url: z.string().max(500).nullable().optional().default(null),
  discount_type: z.enum(['percent', 'amount'], { message: 'نوع الخصم غير صحيح' }).nullable().optional().default(null),
  discount_value: z.number().min(0).max(10_000_000).optional().default(0),
});

export const updateRestaurantItemSchema = restaurantItemSchema.partial();

export const restaurantOrderItemInputSchema = z.object({
  item_id: z.string().min(1, 'معرف الوجبة مطلوب').max(128),
  quantity: z.number().int('الكمية لازم تكون رقم صحيح').min(1, 'الكمية لازم تكون 1 على الأقل').max(100),
});

export const placeRestaurantOrderSchema = z.object({
  items: z.array(restaurantOrderItemInputSchema).min(1, 'اختار وجبة واحدة على الأقل').max(50),
  student_id: z.string().max(128).nullable().optional().default(null),
  meal_slot: z.string().max(50).nullable().optional().default(null),
  notes: z.string().max(2000).nullable().optional().default(null),
});

export const restaurantOrderStatusSchema = z.object({
  action: z.enum(['confirm', 'preparing', 'ready', 'serve', 'cancel'], {
    message: 'إجراء غير صحيح',
  }),
  reason: z.string().max(2000).nullable().optional(),
});

export const restaurantOperatorSchema = z.object({
  userId: z.string().min(1, 'معرف المستخدم مطلوب').max(128),
});

// ─── Canteen ───
export const canteenCategorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب').max(100),
  sort_order: z.number().int().min(0).max(10000).optional().default(0),
  is_active: toggle.optional().default(true),
});

export const updateCanteenCategorySchema = z.object({
  name: z.string().min(1, 'اسم التصنيف مطلوب').max(100).optional(),
  sort_order: z.number().int().min(0).max(10000).optional(),
  is_active: toggle.optional(),
});

export const canteenProductSchema = z.object({
  name: z.string().min(1, 'اسم المنتج مطلوب').max(200),
  category_id: z.string().max(128).nullable().optional().default(null),
  unit: z.string().max(20).optional().default('قطعة'),
  barcode: z.string().max(128).nullable().optional().default(null),
  cost_price: z.number().min(0).max(10_000_000).optional().default(0),
  sell_price: z.number().min(0).max(10_000_000).optional().default(0),
  quantity_on_hand: z.number().min(0).max(100_000_000).optional().default(0),
  min_quantity: z.number().min(0).max(100_000_000).optional().default(0),
  is_active: toggle.optional().default(true),
  image_url: z.string().max(500).nullable().optional().default(null),
  discount_type: z.enum(['percent', 'amount'], { message: 'نوع الخصم غير صحيح' }).nullable().optional().default(null),
  discount_value: z.number().min(0).max(10_000_000).optional().default(0),
});

export const updateCanteenProductSchema = canteenProductSchema.partial();

export const canteenStockInSchema = z.object({
  product_id: z.string().min(1, 'معرف المنتج مطلوب').max(128),
  quantity: z.number().positive('الكمية لازم تكون أكبر من صفر').max(100_000_000),
  unit_cost: z.number().min(0).max(10_000_000).optional().default(0),
  note: z.string().max(2000).nullable().optional(),
});

export const canteenSaleItemInputSchema = z.object({
  product_id: z.string().min(1, 'معرف المنتج مطلوب').max(128),
  quantity: z.number().positive('الكمية لازم تكون أكبر من صفر').max(1_000_000),
});

export const canteenSaleSchema = z.object({
  sale_ref: z.string().min(1, 'معرف الفاتورة مطلوب').max(64),
  items: z.array(canteenSaleItemInputSchema).min(1, 'الفاتورة فاضية').max(100),
  student_id: z.string().max(128).nullable().optional().default(null),
  payment_method: z.enum(['cash', 'card', 'wallet', 'account', 'other']).optional().default('cash'),
  note: z.string().max(2000).nullable().optional(),
});

export const canteenReturnSchema = z.object({
  sale_id: z.string().min(1, 'معرف الفاتورة مطلوب').max(128),
  items: z.array(canteenSaleItemInputSchema).min(1, 'اختار منتج للإرجاع').max(100),
  reason: z.string().min(3, 'سبب الإرجاع مطلوب').max(2000),
  // Optional client idempotency key: a retried/double-submitted return carrying
  // the same ref is treated as already processed (no double restock/reversal).
  return_ref: z.string().min(1).max(100).nullable().optional().default(null),
});

export const canteenWasteSchema = z.object({
  product_id: z.string().min(1, 'معرف المنتج مطلوب').max(128),
  quantity: z.number().positive('الكمية لازم تكون أكبر من صفر').max(100_000_000),
  reason: z.string().min(3, 'سبب التالف مطلوب').max(2000),
});

export const canteenAdjustmentSchema = z.object({
  product_id: z.string().min(1, 'معرف المنتج مطلوب').max(128),
  new_quantity: z.number().min(0, 'الكمية لازم تكون صفر أو أكبر').max(100_000_000),
  reason: z.string().min(3, 'سبب الجرد مطلوب').max(2000),
});

export const canteenOperatorSchema = z.object({
  userId: z.string().min(1, 'معرف المستخدم مطلوب').max(128),
});
