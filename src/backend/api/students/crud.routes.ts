import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { kdb } from "../../infrastructure/db";
import { authenticate, authorizePermission, sanitizeInput } from "../middleware";
import { AppPermission } from "../../../types/permissions";
import { parsePagination, paginateQuery } from "../../services/radio/pagination.ts";
import { upload, UPLOADS_BASE, validateMagicBytes } from "../../middleware/upload";
import { validate } from "../../validation/middleware";
import { createStudentSchema } from "../../validation/schemas";

const router = express.Router();

// التحقق من أن الطالب ينتمي لسكن المستخدم الحالي
const getTenantStudent = async (id: string, tenantId: string | null | undefined) => {
  return kdb("students").where({ id, tenant_id: tenantId }).first();
};

/**
 * @openapi
 * /students:
 *   get:
 *     tags: [الطلاب]
 *     summary: جلب قائمة الطلاب مع pagination وفلاتر
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: enrollment_year
 *         schema: { type: string }
 *       - in: query
 *         name: major
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: قائمة الطلاب مع بيانات pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
// Get all students with optional filters/sorting/pagination
router.get("/", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const { search, room_number, status, enrollment_year, major, sortField, sortOrder, governorate, college, gender, university, graduation_year } = req.query;
  const { page, limit } = parsePagination(req.query);

  try {
    let query = kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .leftJoin('users as bishop_user', 't.bishop_id', 'bishop_user.id')
      .select(
        's.*',
        'u.name', 'u.email', 'u.daily_readings_enabled', 'u.radio_514_enabled',
        'r.room_number',
        'a.name as apartment_name',
        'a.building as apartment_building',
        't.name as tenant_name',
        't.location as tenant_governorate',
        't.daily_readings_enabled as tenant_daily_readings',
        't.radio_514_enabled as tenant_radio_514',
        'bishop_user.name as bishop_name',
        kdb.raw(`(
          SELECT STRING_AGG(us.name, ', ')
          FROM user_tenant_assignments uta
          JOIN users us ON uta.user_id = us.id AND us.role IN ('supervisor', 'assistant_supervisor')
          WHERE uta.tenant_id = s.tenant_id
        ) as supervisor_names`)
      );

    if (req.user.role === 'admin') {
      // Admin sees ALL students across all tenants
    } else if (req.user.role === 'bishop') {
      query = query.where('t.bishop_id', req.user.id);
    } else {
      query = query.where('s.tenant_id', req.user.tenantId);
    }

    if (search) {
      const escaped = (search as string).replace(/[%_]/g, '\\$&');
      query = query.where(builder =>
        builder
          .where('u.name', 'like', `%${escaped}%`)
          .orWhere('s.student_id_number', 'like', `%${escaped}%`)
          .orWhere('s.id_card_number', 'like', `%${escaped}%`)
          .orWhere('s.phone', 'like', `%${escaped}%`)
      );
    }
    if (room_number) query = query.where('r.room_number', room_number);
    if (status) query = query.where('s.status', status);
    if (enrollment_year) query = query.where('s.enrollment_year', enrollment_year);
    if (major) query = query.where('s.major', major);
    if (governorate) query = query.where('s.governorate', governorate);
    if (college) query = query.where('s.college', college);
    if (university) query = query.where('s.university', university);
    if (graduation_year) query = query.whereRaw('YEAR(s.graduation_date) = ?', [String(graduation_year)]);
    if (gender) query = query.where('u.gender', gender);

    const allowedSortFields = ['u.name', 's.student_id_number', 's.status', 's.enrollment_year', 's.created_at', 's.governorate', 's.college', 's.major', 's.university', 's.graduation_date', 'r.room_number'];
    const allowedOrders = ['asc', 'desc'];
    if (sortField && allowedSortFields.includes(sortField as string)) {
        const safeOrder = allowedOrders.includes(sortOrder as string) ? (sortOrder as string) : 'asc';
        query = query.orderBy(sortField as string, safeOrder);
    }

    const result = await paginateQuery<any>(query, { page, limit });
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Get archived students
router.get("/archive", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const tenantId = req.user.tenantId;
  try {
    const archives = await kdb('student_archive')
      .where({ tenant_id: tenantId })
      .orderBy('exit_date', 'desc');
    res.json({ success: true, data: archives.map((a: any) => ({ ...a, data_snapshot: JSON.parse(a.data_snapshot) })) });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Get detailed student profile (admin sees all, bishop sees across tenants, others see their tenant)
router.get("/:id", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  
  try {
    let studentQuery = kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .select('s.*', 'u.name', 'u.email', 'u.daily_readings_enabled', 'u.radio_514_enabled', 'r.room_number', 't.name as tenant_name', 't.bishop_id')
      .where('s.id', id);

    if (req.user.role === 'admin') {
      // Admin sees any student across all tenants
    } else if (req.user.role === 'bishop') {
      studentQuery = studentQuery.where('t.bishop_id', req.user.id);
    } else {
      studentQuery = studentQuery.where('s.tenant_id', tenantId);
    }

    const student = await studentQuery.first();

    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const guardians = await kdb('student_guardians as sg')
      .join('parents as p', 'sg.guardian_id', 'p.id')
      .join('users as u', 'p.user_id', 'u.id')
      .select('p.*', 'sg.relation_type', 'u.name', 'u.email')
      .where('sg.student_id', id);

    const delays = await kdb('student_delays')
      .where({ student_id: id })
      .orderBy('actual_entry_time', 'desc');

    let files: any[] = [];
    try {
      files = await kdb('StudentDocuments')
        .where({ student_id: id })
        .orderBy('upload_date', 'desc');
    } catch { }

    let phones: any[] = [];
    try {
      phones = await kdb('StudentPhones')
        .select('id', 'phone_type as phoneType', 'label', 'phone_number as phoneNumber')
        .where({ student_id: id });
    } catch {}

    res.json({
      success: true,
      data: {
        ...student,
        phones,
        guardians,
        delays,
        files
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Register a new student (Enriched)
router.post("/", authenticate, authorizePermission(AppPermission.ADD_STUDENT), validate(createStudentSchema), async (req, res) => {
  const { 
    userId, studentIdNumber, university, phone, parentPhone, roomId,
    whatsappNumber, idCardNumber, religion, birthDate, college, major,
    enrollmentYear, studentPhoto, address, billingCycle, agreedPrice,
    daily_readings_enabled, radio_514_enabled
  } = req.body;
  const tenantId = req.user.tenantId;
  const id = uuidv4();

  try {
    const tenant = await kdb('tenants').where({ id: tenantId }).first();
    // نتأكد ان مفيش طالب مسجل بنفس اليوزر قبل كده
    const existing = await kdb('students').where({ user_id: userId }).first();
    if (existing) {
      return res.status(400).json({ success: false, message: "اليوزر دا مسجل لطالب تاني بالفعل." });
    }

    // لا يجوز ربط حساب مستخدم من سكن آخر (أو بحساب مؤسسة) كطالب
    const targetUser = await kdb('users').where({ id: userId }).first();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: "حساب المستخدم غير موجود" });
    }
    if (req.user.role !== 'admin' && targetUser.tenant_id && targetUser.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: "لا يمكنك تنفيذ هذا الإجراء" });
    }
    if (['admin', 'bishop'].includes(targetUser.role)) {
      return res.status(403).json({ success: false, message: "لا يمكنك ربط حساب مدير/أسقف كطالب" });
    }
    if (roomId) {
      const room = await kdb('rooms').where({ id: roomId, tenant_id: tenantId }).first();
      if (!room) {
        return res.status(400).json({ success: false, message: "الغرفة غير موجودة في سكنك" });
      }
    }

    await kdb.transaction(async trx => {
      await trx('students').insert({
        id, tenant_id: tenantId, user_id: userId, room_id: roomId || null, student_id_number: studentIdNumber, 
        university, phone, parent_phone: parentPhone,
        whatsapp_number: whatsappNumber, id_card_number: idCardNumber, religion, birth_date: birthDate, college, major,
        enrollment_year: enrollmentYear, student_photo: studentPhoto, address, billing_cycle: billingCycle || null, 
        agreed_price: agreedPrice || 0
      });

      const userUpdate: any = {
        daily_readings_enabled: req.user.role === 'admin' && daily_readings_enabled !== undefined ? (daily_readings_enabled ? 1 : 0) : 1
      };
      if (req.user.role === 'admin' && radio_514_enabled !== undefined) {
        userUpdate.radio_514_enabled = radio_514_enabled ? 1 : 0;
      }
      await trx('users').where({ id: userId }).update(userUpdate);

      if (roomId) {
        await trx('rooms').where({ id: roomId }).increment('current_occupancy', 1);
      }
    });

    res.status(201).json({ success: true, data: { id, userId, roomId } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Add Guardian to Student (search before create)
router.post("/:id/guardians", authenticate, authorizePermission(AppPermission.ADD_STUDENT), async (req, res) => {
  const { id } = req.params;
  const { name, email, password, phone, whatsapp, occupation, relationType, photo } = req.body;
  const tenantId = req.user.tenantId;

  try {
    // الطالب المستهدف يجب أن ينتمي لسكن المستخدم الحالي
    const student = await getTenantStudent(id, tenantId);
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    // 0. Search for existing parent by email
    if (email) {
      const existingUser = await kdb("users").where({ email, role: "parent" }).first();
      if (existingUser) {
        // حساب ولي الأمر موجود في سكن آخر — لا يجوز ربطه بطلاب هذا السكن
        if (existingUser.tenant_id && existingUser.tenant_id !== tenantId) {
          return res.status(403).json({ success: false, message: "هذا الحساب مسجل في سكن آخر ولا يمكن ربطه" });
        }
        // Parent user exists — check if already linked to this student
        const existingParent = await kdb("parents").where({ user_id: existingUser.id }).first();
        if (existingParent) {
          const alreadyLinked = await kdb("student_guardians")
            .where({ student_id: id, guardian_id: existingParent.id })
            .first();
          if (alreadyLinked) {
            return res.json({ success: true, message: "ولي الأمر مرتبط بالفعل بهذا الطالب" });
          }
          // Just link existing parent to new student
          await kdb("student_guardians").insert({
            id: uuidv4(), student_id: id, guardian_id: existingParent.id, relation_type: relationType || 'father'
          });
          return res.json({ success: true, message: "تم ربط ولي الأمر الموجود بالطالب" });
        }
        // User exists but no parents record in this context — create parent record for current tenant
        const guardianId = uuidv4();
        await kdb("parents").insert({
          id: guardianId, tenant_id: tenantId, user_id: existingUser.id,
          phone: phone || null, whatsapp: whatsapp || null, occupation: occupation || null, photo: photo || null
        });
        await kdb("student_guardians").insert({
          id: uuidv4(), student_id: id, guardian_id: guardianId, relation_type: relationType || 'father'
        });
        return res.json({ success: true, message: "تم ربط ولي الأمر الموجود بالطالب في هذا السكن" });
      }
    }

    // No existing parent found — create new
    await kdb.transaction(async trx => {
      const userId = uuidv4();
      const parentDefaultPw = process.env.DEFAULT_USER_PASSWORD;
      if (!parentDefaultPw || parentDefaultPw.length < 8) {
        throw new Error('DEFAULT_USER_PASSWORD must be set in .env (min 8 chars)');
      }
      const hashedPassword = bcrypt.hashSync(password || parentDefaultPw, 10);
      if (!email) throw new Error('البريد الإلكتروني مطلوب');
      await trx('users').insert({ id: userId, tenant_id: tenantId, email, password: hashedPassword, role: 'parent', name });

      const guardianId = uuidv4();
      await trx('parents').insert({ id: guardianId, tenant_id: tenantId, user_id: userId, phone: phone || null, whatsapp: whatsapp || null, occupation: occupation || null, photo: photo || null });

      await trx('student_guardians').insert({ id: uuidv4(), student_id: id, guardian_id: guardianId, relation_type: relationType || 'father' });
    });

    res.json({ success: true, message: "تم إنشاء حساب ولي الأمر وربطه بالطالب" });
  } catch (error: any) {
    console.error('[Guardian Create Error]', error);
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Update Guardian
router.put("/:studentId/guardians/:guardianId", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  const { studentId, guardianId } = req.params;
  const { name, email, phone, whatsapp, occupation, relationType, password } = req.body;
  const tenantId = req.user.tenantId;

  try {
    // الطالب وولي الأمر يجب أن ينتميا لسكن المستخدم الحالي
    const student = await getTenantStudent(studentId, tenantId);
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    const guardian = await kdb('parents as p')
      .join('student_guardians as sg', 'p.id', 'sg.guardian_id')
      .select('p.id', 'p.user_id', 'p.tenant_id')
      .where('p.id', guardianId)
      .where('sg.student_id', studentId)
      .first();
    if (!guardian) return res.status(404).json({ success: false, message: "ولي الأمر غير موجود" });
    if (guardian.tenant_id && guardian.tenant_id !== tenantId) {
      return res.status(403).json({ success: false, message: "ولي الأمر ينتمي لسكن آخر" });
    }

    const userUpdate: any = {};
    if (name !== undefined) userUpdate.name = name;
    if (email !== undefined) userUpdate.email = email;
    if (password) {
      // إعادة تعيين كلمة مرور ولي الأمر محدودة للمشرفين فقط
      if (!['admin', 'bishop', 'priest', 'supervisor', 'assistant_supervisor'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "غير مصرح لك بإعادة تعيين كلمة مرور ولي الأمر" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      userUpdate.password = hashedPassword;
    }
    if (Object.keys(userUpdate).length > 0) {
      await kdb('users').where({ id: guardian.user_id }).update(userUpdate);
    }

    const parentUpdate: any = {};
    if (phone !== undefined) parentUpdate.phone = phone;
    if (whatsapp !== undefined) parentUpdate.whatsapp = whatsapp;
    if (occupation !== undefined) parentUpdate.occupation = occupation;
    if (Object.keys(parentUpdate).length > 0) {
      await kdb('parents').where({ id: guardianId }).update(parentUpdate);
    }

    if (relationType !== undefined) {
      await kdb('student_guardians')
        .where({ student_id: studentId, guardian_id: guardianId })
        .update({ relation_type: relationType });
    }

    res.json({ success: true, message: "تم تحديث بيانات ولي الأمر بنجاح" });
  } catch (error: any) {
    console.error('[Guardian Update Error]', error);
    res.status(400).json({ success: false, message: "فشل تحديث بيانات ولي الأمر" });
  }
});

// Archive Student (Leave Dormitory)
router.post("/:id/leave", authenticate, authorizePermission(AppPermission.DELETE_STUDENT), async (req, res) => {
  const { id } = req.params;
  const { reason, notes } = req.body;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      // 1. Get full snapshot
      const student = await trx('students as s')
        .join('users as u', 's.user_id', 'u.id')
        .select('s.*', 'u.name as student_real_name')
        .where('s.id', id)
        .where('s.tenant_id', tenantId)
        .first();
      
      if (!student) throw new Error("Student not found");

      const guardians = await trx('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .join('users as u', 'p.user_id', 'u.id')
        .select('p.*', 'sg.relation_type', 'u.name as guardian_name', 'u.email as guardian_email')
        .where('sg.student_id', id);

      const snapshot = JSON.stringify({ student, guardians });

      // 2. Archive
      await trx('student_archive').insert({
        id: uuidv4(),
        tenant_id: tenantId,
        student_id: id,
        student_name: `${student.student_real_name} (${student.student_id_number})`,
        data_snapshot: snapshot,
        exit_reason: reason,
        exit_date: new Date(),
        notes: notes
      });

      // 3. Update status and remove room
      if (student.room_id) {
        await trx('rooms').where({ id: student.room_id }).decrement('current_occupancy', 1);
      }
      await trx('students').where({ id }).update({ status: 'archived', room_id: null, is_graduate: 0 });
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Restore Student from archive (assign to a new room, re-link guardians, then delete archive row)
router.post("/:id/restore", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  const { id } = req.params;
  const { roomId } = req.body;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      if (!roomId) throw new Error("roomId is required");

      // 1) Get archive row
      const archiveRow = await trx('student_archive')
        .where({ tenant_id: tenantId, student_id: id })
        .orderBy('exit_date', 'desc')
        .first();

      if (!archiveRow) throw new Error("Student archive not found");

      const snapshot = JSON.parse(archiveRow.data_snapshot || "{}");
      const snapshotStudent = snapshot?.student;
      const snapshotGuardians = snapshot?.guardians || [];

      if (!snapshotStudent?.id) {
        // snapshot should contain students row; fallback to use path id
      }

      // 2) Verify room is inside current tenant and has capacity
      const room = await trx('rooms')
        .where({ id: roomId, tenant_id: tenantId })
        .first();

      if (!room) throw new Error("Room not found in current tenant");

      const nextOccupancy = Number(room.current_occupancy) + 1;
      const capacity = Number(room.capacity);

      if (nextOccupancy > capacity) {
        throw new Error("Room capacity exceeded");
      }

      // 3) Re-link guardians safely
      await trx('student_guardians').where({ student_id: id }).del();

      // Insert new guardian links from snapshot
      // snapshotGuardians rows come from leave query: select p.* + relation_type
      // p.id is guardian id
      for (const g of snapshotGuardians) {
        const guardianId = g.id;
        if (!guardianId) continue;

        await trx('student_guardians').insert({
          id: uuidv4(),
          student_id: id,
          guardian_id: guardianId,
          relation_type: g.relation_type
        });
      }

      // 4) Restore student into the new room
      // - Restore snapshot fields, but override only room_id + status
      const restoreData: any = { ...snapshotStudent };
      delete restoreData.id;
      delete restoreData.tenant_id;
      delete restoreData.user_id;
      delete restoreData.room_id;
      delete restoreData.student_real_name;
      restoreData.status = 'active';
      restoreData.room_id = roomId;

      await trx('students').where({ id, tenant_id: tenantId }).update(restoreData);

      // 5) Update occupancy
      await trx('rooms').where({ id: roomId, tenant_id: tenantId }).increment('current_occupancy', 1);

      // 6) Delete archive row (final removal)
      await trx('student_archive').where({ id: archiveRow.id }).del();
    });

    res.json({ success: true, message: "تمت الاستعادة بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

router.delete("/:id", authenticate, authorizePermission(AppPermission.DELETE_STUDENT), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      // 1. Get room_id
      const student = await trx('students').select('room_id').where({ id, tenant_id: tenantId }).first();
      
      if (!student) throw new Error("Student not found");

      // 2. Decrement room occupancy if assigned
      if (student.room_id) {
        await trx('rooms').where({ id: student.room_id }).decrement('current_occupancy', 1);
      }
      
      // 3. Delete student record
      await trx('students').where({ id, tenant_id: tenantId }).del();
    });

    res.json({ success: true, message: "Student deleted successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Update student registration
router.put("/:id", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  const { id } = req.params;
  const {
    studentIdNumber, university, phone, parentPhone, roomId, room_id,
    whatsappNumber, idCardNumber, religion, birthDate, college, major,
    enrollmentYear, studentPhoto, address, billingCycle, agreedPrice, status,
    governorate, village, churchName, church_name, confessionFatherName, confession_father_name,
    confession_father_phone, confession_father_whatsapp, confession_father_service,
    isServant, is_servant, servantServices, servant_services,
    isDeacon, is_deacon, deaconRank, deacon_rank, deacon_details, deacon_ordination_date,
    serviceTrainingCertificate, service_training_certificate,
    name, email, daily_readings_enabled, radio_514_enabled,
    phoneNumbers, password
  } = req.body;
  const tenantId = req.user.tenantId;

  try {
    await kdb.transaction(async trx => {
      const oldStudent = await trx('students as s')
        .join('users as u', 's.user_id', 'u.id')
        .select('s.room_id', 'u.id as user_id')
        .where('s.id', id)
        .where('s.tenant_id', tenantId)
        .first();
      if (!oldStudent) throw new Error("Student not found");

      const userUpdate: any = {};
      if (name) userUpdate.name = name;
      // تغيير البريد/كلمة المرور للطالب يقتصر على مدير التطبيق فقط
      // (منع أي مشرف من الاستيلاء على حساب الطالب بتغيير البريد وكلمة المرور)
      if (email) {
        if (req.user.role !== 'admin') {
          throw new Error("تغيير البريد الإلكتروني للطالب مسموح لمدير التطبيق فقط");
        }
        userUpdate.email = email;
      }
      if (password) {
        if (req.user.role !== 'admin') {
          throw new Error("إعادة تعيين كلمة مرور الطالب مسموح لمدير التطبيق فقط");
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        userUpdate.password = hashedPassword;
      }
      if (daily_readings_enabled !== undefined && req.user.role === 'admin') {
        userUpdate.daily_readings_enabled = daily_readings_enabled ? 1 : 0;
      }
      if (radio_514_enabled !== undefined && req.user.role === 'admin') {
        userUpdate.radio_514_enabled = radio_514_enabled ? 1 : 0;
      }
      if (Object.keys(userUpdate).length > 0) {
        await trx('users').where({ id: oldStudent.user_id }).update(userUpdate);
      }

      // Handle room change - prefer roomId, then room_id, then keep existing
      const newRoomId = (roomId !== undefined ? roomId : room_id) ?? oldStudent.room_id;
      if (oldStudent.room_id !== newRoomId) {
        // منع نقل الطالب لغرفة في سكن آخر (عزل البيانات بين السكنات)
        if (newRoomId) {
          const targetRoom = await trx('rooms').select('id').where({ id: newRoomId, tenant_id: tenantId }).first();
          if (!targetRoom) throw new Error("الغرفة غير موجودة في سكنك");
        }
        if (oldStudent.room_id) {
          await trx('rooms').where({ id: oldStudent.room_id }).decrement('current_occupancy', 1);
        }
        if (newRoomId) {
          await trx('rooms').where({ id: newRoomId }).increment('current_occupancy', 1);
        }
      }

      const finalWhatsappNumber = whatsappNumber !== undefined ? whatsappNumber : req.body.whatsapp_number;

      await trx('students').where({ id, tenant_id: tenantId }).update({
        room_id: newRoomId || null,
        student_id_number: studentIdNumber,
        university,
        phone,
        parent_phone: parentPhone,
        whatsapp_number: finalWhatsappNumber,
        id_card_number: idCardNumber,
        religion,
        birth_date: birthDate,
        college,
        major,
        enrollment_year: enrollmentYear,
        student_photo: studentPhoto,
        address,
        billing_cycle: billingCycle,
        ...(agreedPrice !== undefined ? { agreed_price: agreedPrice } : {}),
        ...(status !== undefined ? { status } : {}),
        governorate,
        village,
        church_name: churchName ?? church_name,
        confession_father_name: confessionFatherName ?? confession_father_name,
        confession_father_phone,
        confession_father_whatsapp,
        confession_father_service,
        is_servant: isServant ?? is_servant ?? false,
        servant_services: servantServices ?? servant_services,
        is_deacon: isDeacon ?? is_deacon ?? false,
        deacon_rank: deaconRank ?? deacon_rank,
        deacon_details,
        deacon_ordination_date,
        service_training_certificate: serviceTrainingCertificate ?? service_training_certificate
      });

      if (phoneNumbers !== undefined) {
        const parsed = typeof phoneNumbers === 'string' ? JSON.parse(phoneNumbers) : phoneNumbers;
        await trx('StudentPhones').where({ student_id: id }).del();
        for (const p of parsed) {
          await trx('StudentPhones').insert({
            student_id: id,
            phone_type: p.phoneType || p.phone_type,
            label: p.label || '',
            phone_number: p.phoneNumber || p.phone_number
          });
        }
      }
    });

    res.json({ success: true, message: "تم تحديث بيانات الطالب بنجاح" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Mark student as graduated / undo graduation (switch in the students list)
router.patch("/:id/graduate", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  const { id } = req.params;
  const { is_graduate } = req.body;
  const tenantId = req.user.tenantId;

  try {
    let scopeQuery = kdb('students as s')
      .join('tenants as t', 's.tenant_id', 't.id')
      .where('s.id', id)
      .select('s.id');

    if (req.user.role === 'admin') {
      // Admin sees any student across all tenants
    } else if (req.user.role === 'bishop') {
      scopeQuery = scopeQuery.where('t.bishop_id', req.user.id);
    } else {
      scopeQuery = scopeQuery.where('s.tenant_id', tenantId);
    }

    const student = await scopeQuery.first();
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    const graduate = !!is_graduate;
    await kdb('students').where({ id }).update({
      is_graduate: graduate ? 1 : 0,
      graduation_date: graduate ? new Date() : null
    });

    res.json({
      success: true,
      message: graduate ? "تم تسجيل الطالب كخريج في السكن" : "تم إلغاء تسجيل الطالب من الخريجين",
      data: { id, is_graduate: graduate }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Toggle student service flags (daily_readings / radio) — admin only
router.patch("/:id/toggle-services", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  const { id } = req.params;
  const { daily_readings_enabled, radio_514_enabled } = req.body;
  try {
    const student = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .select('u.id as user_id', 's.tenant_id')
      .where('s.id', id)
      .first();
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const userUpdate: any = {};
    if (daily_readings_enabled !== undefined) {
      userUpdate.daily_readings_enabled = daily_readings_enabled ? 1 : 0;
    }
    if (radio_514_enabled !== undefined) {
      userUpdate.radio_514_enabled = radio_514_enabled ? 1 : 0;
    }
    if (Object.keys(userUpdate).length > 0) {
      await kdb('users').where({ id: student.user_id }).update(userUpdate);

      // Cascade to parents of this student
      const parentUsers = await kdb('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .join('users as u_parent', 'p.user_id', 'u_parent.id')
        .where('sg.student_id', id)
        .select('u_parent.id as parent_user_id');
      if (parentUsers.length > 0) {
        const parentIds = parentUsers.map((p: any) => p.parent_user_id);
        await kdb('users').whereIn('id', parentIds).update(userUpdate);
      }
    }
    res.json({ success: true, message: 'تم تحديث الخدمات للطالب وأولياء الأمور' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ' });
  }
});

// Priest edit student - allows priest to update student data and notify supervisors
router.put("/:id/priest-edit", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  const { id } = req.params;
  const {
    phone, whatsappNumber, governorate, village, churchName, church_name,
    confessionFatherName, confession_father_name,
    confession_father_phone, confession_father_whatsapp, confession_father_service,
    isServant, is_servant, servantServices, servant_services,
    isDeacon, is_deacon, deaconRank, deacon_rank, deacon_details, deacon_ordination_date,
    serviceTrainingCertificate, service_training_certificate,
    name, email, address
  } = req.body;
  const tenantId = req.user.tenantId;
  const priestName = req.user.name;

  try {
    await kdb.transaction(async trx => {
      const oldStudent = await trx('students as s')
        .join('users as u', 's.user_id', 'u.id')
        .select('s.*', 'u.name as current_name', 'u.email as current_email')
        .where('s.id', id)
        .where('s.tenant_id', tenantId)
        .first();
      if (!oldStudent) throw new Error("Student not found");

      // Track changed fields for notification
      const changes: string[] = [];

      // Update user name/email if provided
      if (name && name !== oldStudent.current_name) {
        await trx('users').where({ id: oldStudent.user_id }).update({ name });
        changes.push(`الاسم: ${oldStudent.current_name} → ${name}`);
      }
      if (email && email !== oldStudent.current_email) {
        await trx('users').where({ id: oldStudent.user_id }).update({ email });
        changes.push(`البريد الإلكتروني: ${oldStudent.current_email} → ${email}`);
      }

      const updateData: any = {};
      if (phone !== undefined && phone !== oldStudent.phone) { updateData.phone = phone; changes.push(`رقم الهاتف: ${oldStudent.phone || 'فارغ'} → ${phone}`); }
      if (whatsappNumber !== undefined && whatsappNumber !== oldStudent.whatsapp_number) { updateData.whatsapp_number = whatsappNumber; changes.push(`رقم واتساب: ${oldStudent.whatsapp_number || 'فارغ'} → ${whatsappNumber}`); }
      if (governorate !== undefined && governorate !== oldStudent.governorate) { updateData.governorate = governorate; changes.push(`المحافظة: ${oldStudent.governorate || 'فارغ'} → ${governorate}`); }
      if (village !== undefined && village !== oldStudent.village) { updateData.village = village; changes.push(`القرية: ${oldStudent.village || 'فارغ'} → ${village}`); }
      if (address !== undefined && address !== oldStudent.address) { updateData.address = address; changes.push(`العنوان: ${oldStudent.address || 'فارغ'} → ${address}`); }

      const newChurch = churchName ?? church_name;
      if (newChurch !== undefined && newChurch !== oldStudent.church_name) { updateData.church_name = newChurch; changes.push(`الكنيسة: ${oldStudent.church_name || 'فارغ'} → ${newChurch}`); }

      const newConfName = confessionFatherName ?? confession_father_name;
      if (newConfName !== undefined && newConfName !== oldStudent.confession_father_name) { updateData.confession_father_name = newConfName; changes.push(`أبو الاعتراف: ${oldStudent.confession_father_name || 'فارغ'} → ${newConfName}`); }
      if (confession_father_phone !== undefined && confession_father_phone !== oldStudent.confession_father_phone) { updateData.confession_father_phone = confession_father_phone; changes.push(`تليفون أبي الاعتراف`); }
      if (confession_father_whatsapp !== undefined && confession_father_whatsapp !== oldStudent.confession_father_whatsapp) { updateData.confession_father_whatsapp = confession_father_whatsapp; changes.push(`واتساب أبي الاعتراف`); }
      if (confession_father_service !== undefined && confession_father_service !== oldStudent.confession_father_service) { updateData.confession_father_service = confession_father_service; changes.push(`خدمة أبي الاعتراف`); }

      const newIsServant = isServant ?? is_servant;
      if (newIsServant !== undefined && newIsServant !== oldStudent.is_servant) { updateData.is_servant = newIsServant ?? false; changes.push(`خادم: ${oldStudent.is_servant ? 'نعم' : 'لا'} → ${newIsServant ? 'نعم' : 'لا'}`); }
      if (servantServices !== undefined && servantServices !== oldStudent.servant_services) { updateData.servant_services = servantServices; changes.push(`خدمات الخادم`); }

      const newIsDeacon = isDeacon ?? is_deacon;
      if (newIsDeacon !== undefined && newIsDeacon !== oldStudent.is_deacon) { updateData.is_deacon = newIsDeacon ?? false; changes.push(`شماس: ${oldStudent.is_deacon ? 'نعم' : 'لا'} → ${newIsDeacon ? 'نعم' : 'لا'}`); }
      if (deaconRank !== undefined && deaconRank !== oldStudent.deacon_rank) { updateData.deacon_rank = deaconRank; changes.push(`رتبة الشماس`); }
      if (deacon_details !== undefined && deacon_details !== oldStudent.deacon_details) { updateData.deacon_details = deacon_details; changes.push(`تفاصيل الشماس`); }
      if (deacon_ordination_date !== undefined && deacon_ordination_date !== oldStudent.deacon_ordination_date) { updateData.deacon_ordination_date = deacon_ordination_date; changes.push(`تاريخ رسامة الشماس`); }

      const newCert = serviceTrainingCertificate ?? service_training_certificate;
      if (newCert !== undefined && newCert !== oldStudent.service_training_certificate) { updateData.service_training_certificate = newCert; changes.push(`شهادة تدريب الخدمة`); }

      if (Object.keys(updateData).length > 0) {
        await trx('students').where({ id, tenant_id: tenantId }).update(updateData);
      }

      // Notify supervisors about changes
      if (changes.length > 0) {
        const supervisors = await trx('user_tenant_assignments as uta')
          .join('users as u', 'uta.user_id', 'u.id')
          .where('uta.tenant_id', tenantId)
          .where('u.role', 'supervisor')
          .select('uta.user_id', 'u.name as sup_name');

        const studentName = name || oldStudent.current_name;
        const changesText = changes.join(' | ');
        const now = new Date();

        for (const sup of supervisors) {
          await trx('notifications').insert({
            id: uuidv4(),
            user_id: sup.user_id,
            tenant_id: tenantId,
            title: `تعديل بيانات الطالب ${studentName}`,
            message: `قام الأب ${priestName} بتحديث بيانات الطالب ${studentName}. التعديلات: ${changesText}`,
            type: "info",
            created_at: now
          });
        }
      }
    });

    res.json({ success: true, message: "تم تحديث بيانات الطالب وإخطار المشرفين" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "فشل العملية. تحقق من البيانات وحاول مرة أخرى." });
  }
});

// Priest upload files for student - notifies supervisors
router.post("/:id/priest-upload", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), upload.array('files'), validateMagicBytes, sanitizeInput, async (req, res) => {
  const { id } = req.params;
  const { doc_types, file_labels } = req.body;
  const tenantId = req.user.tenantId;
  const priestName = req.user.name;

  try {
    const student = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .select('s.id', 'u.name as student_name')
      .where('s.id', id)
      .where('s.tenant_id', tenantId)
      .first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const files = (req as any).files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

    const types: string[] = doc_types ? (Array.isArray(doc_types) ? doc_types : [doc_types]) : files.map(() => 'other');
    const labels: string[] = file_labels ? (Array.isArray(file_labels) ? file_labels : [file_labels]) : files.map(() => '');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await kdb.raw(`
        INSERT INTO StudentDocuments (student_id, doc_type, file_path, file_name)
        VALUES (?, ?, ?, ?)
      `, [id, types[i] || 'other', `${UPLOADS_BASE}/documents/${file.filename}`, labels[i] || file.originalname]);
    }

    // Notify supervisors
    const supervisors = await kdb('user_tenant_assignments as uta')
      .join('users as u', 'uta.user_id', 'u.id')
      .where('uta.tenant_id', tenantId)
      .where('u.role', 'supervisor')
      .select('uta.user_id');

    for (const sup of supervisors) {
      await kdb('notifications').insert({
        id: uuidv4(),
        user_id: sup.user_id,
        tenant_id: tenantId,
        title: `إضافة مستندات للطالب ${student.student_name}`,
        message: `قام الأب ${priestName} بإضافة ${files.length} مستند للملفات الخاصة بالطالب ${student.student_name}`,
        type: "info",
        created_at: new Date()
      });
    }

    res.json({ success: true, message: `تم رفع ${files.length} ملف وإخطار المشرفين` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Upload files for a student
router.post("/:id/files", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), upload.array('files'), validateMagicBytes, sanitizeInput, async (req, res) => {
  const { id } = req.params;
  const { doc_types, file_labels } = req.body;
  const tenantId = req.user.tenantId;

  try {
    const query = kdb('students').where({ id });
    if (tenantId) query.where({ tenant_id: tenantId });
    const student = await query.first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const files = (req as any).files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ success: false, message: "No files uploaded" });

    const types: string[] = doc_types ? (Array.isArray(doc_types) ? doc_types : [doc_types]) : files.map(() => 'other');
    const labels: string[] = file_labels ? (Array.isArray(file_labels) ? file_labels : [file_labels]) : files.map(() => '');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      await kdb.raw(`
        INSERT INTO StudentDocuments (student_id, doc_type, file_path, file_name)
        VALUES (?, ?, ?, ?)
      `, [id, types[i] || 'other', `${UPLOADS_BASE}/documents/${file.filename}`, labels[i] || file.originalname]);
    }

    res.json({ success: true, message: `تم رفع ${files.length} ملف بنجاح` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// List files for a student
router.get("/:id/files", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  try {
    if (req.user.role !== 'admin') {
      const student = await kdb('students').select('tenant_id').where({ id }).first();
      if (!student || student.tenant_id !== tenantId) {
        return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكنك" });
      }
    }
    const files = await kdb('StudentDocuments')
      .where({ student_id: id })
      .orderBy('upload_date', 'desc');
    res.json({ success: true, data: files });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Delete a file
router.delete("/:id/files/:fileId", authenticate, authorizePermission(AppPermission.EDIT_STUDENT), async (req, res) => {
  const { id, fileId } = req.params;
  const tenantId = req.user.tenantId;
  try {
    const student = await getTenantStudent(id, tenantId);
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    const result = await kdb.raw(`SELECT file_path FROM StudentDocuments WHERE id = ? AND student_id = ?`, [fileId, id]);
    const rows = result.recordset || [];
    if (rows.length === 0) return res.status(404).json({ success: false, message: "File not found" });

    const filePath = rows[0].file_path;
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    await kdb.raw(`DELETE FROM StudentDocuments WHERE id = ? AND student_id = ?`, [fileId, id]);

    res.json({ success: true, message: "تم حذف الملف بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

export default router;
