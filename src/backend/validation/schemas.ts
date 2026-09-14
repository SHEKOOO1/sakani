import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('ايميل مش صحيح').min(1, 'الايميل مطلوب').max(255),
  password: z.string().min(1, 'الباسورد مطلوب').max(128),
});

export const registerSchema = z.object({
  email: z.string().email('ايميل مش صحيح').max(255),
  password: z.string().min(8, 'الباسورد قصير أوي (على الأقل 8 حروف)').max(128).regex(/[A-Za-z]/, 'الباسورد لازم يضم حروف إنجليزية').regex(/\d/, 'الباسورد لازم يضم رقم'),
  name: z.string().min(1, 'الاسم مطلوب').max(100),
  gender: z.enum(['male', 'female']).optional(),
});

// ─── Event ───
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
});

export const updateEventSchema = z.object({
  title: z.string().min(1, 'عنوان الفعالية مطلوب').optional(),
  description: z.string().optional(),
  event_date: z.string().min(1, 'تاريخ الفعالية مطلوب').optional(),
  location: z.string().optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  location_radius: z.number().optional(),
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
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  location_radius: z.number().int().optional().default(50),
  entry_lat: z.number().optional(),
  entry_lng: z.number().optional(),
  entry_radius: z.number().int().optional().default(50),
  exit_lat: z.number().optional(),
  exit_lng: z.number().optional(),
  exit_radius: z.number().int().optional().default(50),
  curfew_time: z.string().optional(),
  open_time: z.string().optional(),
  semester1_start: z.string().optional(),
  semester1_end: z.string().optional(),
  semester2_start: z.string().optional(),
  semester2_end: z.string().optional(),
  bishop_id: z.string().nullable().optional().default(null),
  daily_readings_enabled: z.boolean().or(z.number()).optional().default(true),
  radio_514_enabled: z.boolean().or(z.number()).optional().default(true),
});

export const updateTenantSchema = z.object({
  name: z.string().optional(),
  location: z.string().optional(),
  supervisor_ids: z.array(z.string()).optional(),
  daily_readings_enabled: z.boolean().or(z.number()).optional(),
  radio_514_enabled: z.boolean().or(z.number()).optional(),
  priest_ids: z.array(z.string()).optional(),
  bishop_id: z.string().nullable().optional(),
  is_active: z.boolean().or(z.number()).optional(),
  location_lat: z.number().optional(),
  location_lng: z.number().optional(),
  location_radius: z.number().int().optional(),
  entry_lat: z.number().optional(),
  entry_lng: z.number().optional(),
  entry_radius: z.number().int().optional(),
  exit_lat: z.number().optional(),
  exit_lng: z.number().optional(),
  exit_radius: z.number().int().optional(),
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
  religion: z.string().optional(),
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
  religion: z.string().optional(),
  birthDate: z.string().optional(),
  college: z.string().optional(),
  major: z.string().optional(),
  enrollmentYear: z.number().int().optional(),
  studentPhoto: z.string().optional(),
  address: z.string().optional(),
  billingCycle: z.string().optional(),
  agreedPrice: z.number().optional(),
  status: z.string().optional(),
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

export const createUserSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صالح').max(255),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل').max(128).optional(),
  name: z.string().min(1, 'الاسم مطلوب').max(100),
  role: z.string().min(1, 'الدور مطلوب'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(255).optional(),
  role: z.string().min(1).optional(),
});

export const addToTenantSchema = z.object({
  userId: z.string().uuid('معرف المستخدم غير صالح'),
  role: z.string().min(1, 'الدور مطلوب'),
});
