import express from "express";
import { v4 as uuidv4 } from "uuid";
import fs from 'fs';
import path from 'path';
import { kdb } from "../../infrastructure/db";
import { authenticate, authorizePermission, computeUserTenantIds } from "../middleware";
import { AppPermission } from "../../../types/permissions";
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { getStudentAccount, notifyStudentFinance, formatMoney, roomPriceFor, logFinanceEdit } from "../../services/student-account.service";

const router = express.Router();

// التحقق من أن المستخدم الحالي يملك الوصول إلى سكن الطالب (سهل إعادة الاستخدام)
const canAccessStudentTenant = async (req: any, tenantId: string | null): Promise<boolean> => {
  if (req.user.role === 'admin') return true;
  if (!tenantId) return false;
  const allowedIds = await computeUserTenantIds(req.user);
  return allowedIds.includes(tenantId);
};

// جلب بيانات البروفايل للطالب الحالي (للدخول السريع والباش بورد)
router.get("/my-profile", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await kdb('students as s')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .select('s.*', 'r.room_number', 'a.name as apartment_name', 'a.building as building_name', 't.name as tenant_name')
      .where('s.user_id', userId)
      .first();

    if (!student) return res.status(404).json({ success: false, message: "Student record not found" });

    res.json({ success: true, data: student });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// جلب الملخص المالي للطالب الحالي (إجمالي الفاتورة، المدفوع، المتبقي)
router.get("/finance/my-summary", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const student = await kdb('students').where({ user_id: userId }).first();
    if (!student) return res.status(404).json({ success: false, message: "Student record not found" });

    const account = await getStudentAccount(student.id, { visibility: 'tenant' });

    res.json({
      success: true,
      data: {
        totalInvoice: account?.invoice || 0,
        totalPaid: account?.totalPaid || 0,
        remaining: account?.remaining || 0,
        balance: account?.balance || 0,
        debtStatus: account?.debtStatus || 'paid',
        creditAmount: account?.creditAmount || 0,
        roomPrice: account?.roomPrice || 0,
        source: account?.source || 'agreed',
        paymentPercent: account?.paymentPercent || 0,
        billingCycle: student.billing_cycle || null,
        transactions: account?.transactions || [],
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Export full profile as JSON (download)
router.get("/:id/export-profile", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const { id } = req.params;
  const { format } = req.query; // 'excel' | 'pdf'
  const tenantId = req.user.tenantId;
  const isAdmin = req.user.role === 'admin';
  try {
    let query = kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .select('s.*', 'u.name', 'u.email', 'r.room_number', 'a.name as apartment_name', 'a.building as apartment_building', 't.name as tenant_name', 't.location as tenant_governorate', 't.bishop_id as bishop_id')
      .where('s.id', id);
    if (!isAdmin) query = query.where('s.tenant_id', tenantId);
    const student = await query.first();

    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const guardians = await kdb('student_guardians as sg')
      .join('parents as p', 'sg.guardian_id', 'p.id')
      .join('users as u', 'p.user_id', 'u.id')
      .select('p.*', 'sg.relation_type', 'u.name', 'u.email')
      .where('sg.student_id', id);

    let files: any[] = [];
    try {
      const filesResult = await kdb.raw(`
        SELECT id, doc_type, file_path, file_name, upload_date
        FROM StudentDocuments
        WHERE student_id = ?
        ORDER BY upload_date DESC
      `, [id]);
      files = filesResult.recordset || [];
    } catch (e) { console.error("Profile files fetch error:", e); }

    const safeName = student.name?.replace(/[<>:"/\\|?*]/g, '_') || 'student';

    if (format === 'excel') {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Sakani System';
      const ws = workbook.addWorksheet('بيانات الطالب');
      (ws as any).rtl = true;

      ws.columns = [
        { header: 'الحقل', key: 'field', width: 30 },
        { header: 'القيمة', key: 'value', width: 50 }
      ];

      const addRow = (field: string, value: any) => ws.addRow({ field, value: value || '---' });
      addRow('الاسم', student.name);
      addRow('البريد الإلكتروني', student.email);
      addRow('السكن', student.tenant_name);
      addRow('المحافظة', student.tenant_governorate);
      addRow('الشقة', student.apartment_name);
      addRow('الغرفة', student.room_number);
      addRow('الرقم القومي', student.id_card_number);
      addRow('تاريخ الميلاد', student.birth_date ? new Date(student.birth_date).toLocaleDateString('ar-EG') : '---');
      addRow('العنوان', student.address);
      addRow('المحافظة (الطالب)', student.governorate);
      addRow('القرية', student.village);
      addRow('الجامعة', student.university);
      addRow('الكلية', student.college);
      addRow('التخصص', student.major);
      addRow('سنة الالتحاق', student.enrollment_year);
      addRow('الهاتف', student.phone);
      addRow('حالة السفر', student.is_traveling ? `مسافر إلى ${student.travel_destination || '---'}` : 'مقيم');
      addRow('حالة السكن', student.status);
      addRow('الكنيسة', student.church_name);
      addRow('أب الاعتراف', student.confession_father_name);
      addRow('خادم', student.is_servant ? 'نعم' : 'لا');
      addRow('شماس', student.is_deacon ? 'نعم' : 'لا');

      if (guardians.length > 0) {
        ws.addRow([]);
        ws.addRow({ field: 'أولياء الأمور', value: '' });
        ws.addRow({ field: '------------------------', value: '------------------------' });
        guardians.forEach((g: any) => {
          addRow(g.relation_type, g.name);
          addRow('تليفون ولي الأمر', g.phone || '---');
        });
      }

      if (files.length > 0) {
        ws.addRow([]);
        ws.addRow({ field: 'الملفات', value: '' });
        ws.addRow({ field: '------------------------', value: '------------------------' });
        files.forEach((f: any) => addRow(f.file_name, f.doc_type));
      }

      ws.getRow(1).font = { bold: true, size: 14 };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="profile-${safeName}.xlsx"; filename*=UTF-8''${encodeURIComponent(`profile-${safeName}.xlsx`)}`);
      await workbook.xlsx.write(res);
      res.end();
    } else if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="profile-${safeName}.pdf"; filename*=UTF-8''${encodeURIComponent(`profile-${safeName}.pdf`)}`);
      doc.pipe(res);

      const fontsDir = path.join(__dirname, '../../../public/fonts');
      doc.registerFont('Arabic', path.join(fontsDir, 'arabtype.ttf'));
      doc.registerFont('ArabicBold', path.join(fontsDir, 'arialbd.ttf'));

      const arabicText = (text: any) => (text || '---').toString();

      doc.font('ArabicBold').fontSize(22).text('بيانات الطالب', { align: 'right' });
      doc.moveDown(1.5);

      const drawField = (label: string, value: any) => {
        doc.font('ArabicBold').fontSize(11).fillColor('#333');
        const txt = `${label}: ${arabicText(value)}`;
        doc.font('Arabic').fontSize(11).fillColor('#000').text(txt, { align: 'right', features: ['arabic'] } as any);
      };

      drawField('الاسم', student.name);
      drawField('البريد الإلكتروني', student.email);
      drawField('السكن', student.tenant_name);
      drawField('المحافظة', student.tenant_governorate);
      drawField('الشقة', student.apartment_name);
      drawField('الغرفة', student.room_number);
      drawField('الرقم القومي', student.id_card_number);
      drawField('تاريخ الميلاد', student.birth_date ? new Date(student.birth_date).toLocaleDateString('ar-EG') : '---');
      drawField('العنوان', student.address);
      drawField('الجامعة', student.university);
      drawField('الكلية', student.college);
      drawField('التخصص', student.major);
      drawField('سنة الالتحاق', student.enrollment_year);
      drawField('الهاتف', student.phone);
      drawField('حالة السفر', student.is_traveling ? `مسافر إلى ${student.travel_destination || '---'}` : 'مقيم');
      drawField('الكنيسة', student.church_name);
      drawField('أب الاعتراف', student.confession_father_name);

      if (guardians.length > 0) {
        doc.moveDown(1);
        doc.font('ArabicBold').fontSize(16).fillColor('#333').text('أولياء الأمور', { align: 'right' });
        doc.moveDown(0.5);
        guardians.forEach((g: any) => {
          drawField(g.relation_type, g.name);
          drawField('تليفون', g.phone);
          doc.moveDown(0.3);
        });
      }

      if (files.length > 0) {
        doc.moveDown(1);
        doc.font('ArabicBold').fontSize(16).fillColor('#333').text('الملفات', { align: 'right' });
        doc.moveDown(0.5);
        files.forEach((f: any) => drawField(f.file_name, f.doc_type));
      }

      doc.end();
    } else {
      // Default JSON export for backward compatibility
      const profile = { student, guardians, files };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="profile-${safeName}.json"; filename*=UTF-8''${encodeURIComponent(`profile-${safeName}.json`)}`);
      res.json({ success: true, data: { student, guardians, files } });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Get available recipients for sending profile (bishop + priests of this tenant)
router.get("/:id/send-profile-options", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  const isAdmin = req.user.role === 'admin';
  try {
    let studentQuery = kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .select('s.*', 'u.name', 't.bishop_id', 't.name as tenant_name')
      .where('s.id', id);
    if (!isAdmin) studentQuery = studentQuery.where('s.tenant_id', tenantId);
    const student = await studentQuery.first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const effectiveTenantId = student.tenant_id;

    let bishop = null;
    if (student.bishop_id) {
      bishop = await kdb('users').select('id', 'name', 'email').where('id', student.bishop_id).first();
    }

    const priests = await kdb('user_tenant_assignments as uta')
      .join('users as u', 'uta.user_id', 'u.id')
      .where('uta.tenant_id', effectiveTenantId)
      .where('u.role', 'priest')
      .select('u.id', 'u.name', 'u.email');

    const supervisors = await kdb('user_tenant_assignments as uta')
      .join('users as u', 'uta.user_id', 'u.id')
      .where('uta.tenant_id', effectiveTenantId)
      .whereIn('u.role', ['supervisor', 'assistant_supervisor'])
      .select('u.id', 'u.name', 'u.email');

    const employees = await kdb('user_tenant_assignments as uta')
      .join('users as u', 'uta.user_id', 'u.id')
      .where('uta.tenant_id', effectiveTenantId)
      .where('u.role', 'employee')
      .select('u.id', 'u.name', 'u.email');

    res.json({ success: true, data: { bishop, priests, supervisors, employees } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

router.post("/:id/send-profile", authenticate, authorizePermission(AppPermission.VIEW_STUDENT), async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  const isAdmin = req.user.role === 'admin';
  try {
    let studentQuery = kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .select('s.*', 'u.name', 'u.email', 'r.room_number', 'a.name as apartment_name', 'a.building as apartment_building', 't.name as tenant_name', 't.location as tenant_governorate', 't.bishop_id as bishop_id')
      .where('s.id', id);
    if (!isAdmin) studentQuery = studentQuery.where('s.tenant_id', tenantId);
    const student = await studentQuery.first();
    if (!student) return res.status(404).json({ success: false, message: "Student not found" });

    const guardians = await kdb('student_guardians as sg')
      .join('parents as p', 'sg.guardian_id', 'p.id')
      .join('users as u', 'p.user_id', 'u.id')
      .select('p.*', 'sg.relation_type', 'u.name', 'u.email')
      .where('sg.student_id', id);

    let files: any[] = [];
    try {
      const filesResult = await kdb.raw(`
        SELECT id, doc_type, file_path, file_name, upload_date FROM StudentDocuments WHERE student_id = ?
      `, [id]);
      files = filesResult.recordset || [];
    } catch (e) { console.error("Profile documents fetch error:", e); }

    const guardianInfo = guardians.map((g: any) =>
      `  - ${g.relation_type}: ${g.name} (${g.phone || '---'})`
    ).join('\n');

    const fileInfo = files.length > 0
      ? '\n' + files.map((f: any) => `  - ${f.file_name} (${f.doc_type})`).join('\n')
      : '  - لا توجد ملفات مرفوعة';

    const servantInfo = student.is_servant
      ? `\n  - أنواع الخدمة: ${student.servant_services || '---'}`
      : '';
    const deaconInfo = student.is_deacon
      ? `\n  - الرتبة: ${student.deacon_rank || '---'}\n  - تفاصيل: ${student.deacon_details || '---'}`
      : '';

    const profileText = `بيانات الطالب:
─────────────────────
الاسم: ${student.name}
الإيميل: ${student.email}
الغرفة: ${student.room_number || 'غير مسكن'}
الرقم القومي: ${student.id_card_number || '---'}
تاريخ الميلاد: ${student.birth_date ? new Date(student.birth_date).toLocaleDateString('ar-EG') : '---'}
العنوان: ${student.address || '---'}
المحافظة: ${student.governorate || '---'} - القرية: ${student.village || '---'}
الجامعة: ${student.university || '---'} - الكلية: ${student.college || '---'}
التخصص: ${student.major || '---'}
سنة الالتحاق: ${student.enrollment_year || '---'}
حالة السفر: ${student.is_traveling ? `مسافر إلى ${student.travel_destination || '---'}` : 'مقيم'}
حالة السكن: ${student.status}

الملف الكنسي:
─────────────────────
الكنيسة: ${student.church_name || '---'}
أب الاعتراف: ${student.confession_father_name || '---'}
  - تليفون: ${student.confession_father_phone || '---'}
  - واتساب: ${student.confession_father_whatsapp || '---'}
  - الخدمة: ${student.confession_father_service || '---'}
خادم: ${student.is_servant ? 'نعم' : 'لا'}${servantInfo}
شماس: ${student.is_deacon ? 'نعم' : 'لا'}${deaconInfo}

أولياء الأمور:
─────────────────────
${guardianInfo || '  - لا يوجد'}

الملفات:
─────────────────────${fileInfo}`;

    const { toBishop, priestIds, supervisorIds, employeeIds } = req.body || {};
    const notificationRows: any[] = [];
    let sentCount = 0;

    const metadata = JSON.stringify({ studentId: student.id, mode: 'readonly' });
    const effectiveTenantId = student.tenant_id || tenantId;

    if (toBishop !== false && student.bishop_id) {
      notificationRows.push({
        id: uuidv4(), user_id: student.bishop_id, tenant_id: effectiveTenantId,
        title: `ملف الطالب: ${student.name}`,
        message: profileText,
        type: 'info', metadata, created_at: new Date()
      });
      sentCount++;
    }

    // Validate that all recipient IDs belong to this tenant
    const validTenantUserIds = new Set<string>();
    if (priestIds?.length || supervisorIds?.length || employeeIds?.length) {
      const allIds = [...(priestIds || []), ...(supervisorIds || []), ...(employeeIds || [])];
      const assignedUsers = await kdb('user_tenant_assignments')
        .where('tenant_id', effectiveTenantId)
        .whereIn('user_id', allIds)
        .select('user_id');
      assignedUsers.forEach((a: any) => validTenantUserIds.add(a.user_id));
    }

    const sendIds = (ids: string[] | undefined) => {
      if (!ids?.length) return;
      for (const pid of ids) {
        if (!validTenantUserIds.has(pid)) continue;
        notificationRows.push({
          id: uuidv4(), user_id: pid, tenant_id: effectiveTenantId,
          title: `ملف الطالب: ${student.name}`,
          message: profileText,
          type: 'info', metadata, created_at: new Date()
        });
        sentCount++;
      }
    };

    sendIds(priestIds);
    sendIds(supervisorIds);
    sendIds(employeeIds);

    if (notificationRows.length > 0) {
      await kdb('notifications').insert(notificationRows);
      const shareRows = notificationRows.map(n => ({
        id: uuidv4(), student_id: id,
        shared_by_user_id: req.user.id,
        shared_with_user_id: n.user_id,
        tenant_id: effectiveTenantId
      }));
      await kdb('profile_shares').insert(shareRows);
    }

    res.json({ success: true, message: `تم إرسال الملف لـ ${sentCount} مسؤول` });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Get students shared with the current user (for bishop/priest)
router.get("/shared-with-me", authenticate, async (req, res) => {
  const userId = req.user.id;
  try {
    const shares = await kdb('profile_shares as ps')
      .join('students as s', 'ps.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .select('s.id', 'u.name', 'r.room_number', 'ps.created_at')
      .where('ps.shared_with_user_id', userId)
      .orderBy('ps.created_at', 'desc');
    res.json({ success: true, data: shares });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Get full student profile for shared/readonly access
router.get("/:id/shared-profile", authenticate, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  try {
    const share = await kdb('profile_shares')
      .where({ student_id: id, shared_with_user_id: userId })
      .first();
    if (!share) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية الوصول لهذا الملف' });
    }

    const student = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .leftJoin('rooms as r', 's.room_id', 'r.id')
      .leftJoin('apartments as a', 'r.apartment_id', 'a.id')
      .select('s.*', 'u.name', 'u.email', 'u.daily_readings_enabled', 'r.room_number', 'a.name as apartment_name', 'a.building as apartment_building')
      .where('s.id', id)
      .first();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

    const guardians = await kdb('student_guardians as sg')
      .join('parents as p', 'sg.guardian_id', 'p.id')
      .join('users as u', 'p.user_id', 'u.id')
      .select('p.*', 'sg.relation_type', 'u.name', 'u.email')
      .where('sg.student_id', id);

    let files: any[] = [];
    try {
      const filesResult = await kdb.raw(`
        SELECT id, doc_type, file_path, file_name, upload_date FROM StudentDocuments WHERE student_id = ?
      `, [id]);
      files = filesResult.recordset || [];
    } catch (e) { console.error("Profile documents fetch 2 error:", e); }

    let phones: any[] = [];
    try {
      const phonesResult = await kdb.raw(
        `SELECT id, phone_type as phoneType, label, phone_number as phoneNumber FROM StudentPhones WHERE student_id = ?`, [id]
      );
      phones = phonesResult.recordset || [];
    } catch (e) { console.error("Profile phones fetch error:", e); }

    res.json({ success: true, data: { student: { ...student, phones }, guardians, files } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// Student Notes - for priest, supervisor, bishop, and admin (read-only)
router.get("/:id/notes", authenticate, async (req, res) => {
  const { id } = req.params;
  const tenantId = req.user.tenantId;
  const userId = req.user.id;
  const role = req.user.role;

  // Only priest, supervisor, bishop, or admin can view notes
  if (!['priest', 'supervisor', 'bishop', 'admin'].includes(role)) {
    return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
  }

  try {
    // التحقق من صلاحية الوصول للطالب بناءً على دور المستخدم
    let studentQuery = kdb('students as s')
      .leftJoin('tenants as t', 's.tenant_id', 't.id')
      .where('s.id', id)
      .select('s.tenant_id', 't.bishop_id');

    if (role === 'supervisor' || role === 'priest') {
      studentQuery = studentQuery.where('s.tenant_id', tenantId);
    } else if (role === 'bishop') {
      studentQuery = studentQuery.where('t.bishop_id', userId);
    }

    const hasAccess = await studentQuery.first();
    if (!hasAccess && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول لبيانات هذا الطالب' });
    }

    // استخدام Query Builder لضمان استرجاع البيانات بشكل صحيح عبر جميع الأنظمة
    const notes = await kdb('student_notes')
      .where({ student_id: id })
      .select('id', 'student_id', 'author_id', 'author_role', 'author_name', 'content', 'created_at', 'updated_at')
      .orderBy('created_at', 'desc');

    res.json({ success: true, data: notes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

router.post("/:id/notes", authenticate, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  const role = req.user?.role || 'unknown';
  const authorId = req.user?.id || 'unknown';

  // جلب الاسم من قاعدة البيانات مباشرة لضمان عدم استخدام الإيميل
  const authorUser = await kdb('users').where({ id: authorId }).select('name').first();
  const authorName = authorUser?.name || 'مشرف السكن';

  if (role !== 'priest' && role !== 'supervisor' && role !== 'bishop' && role !== 'admin') {
    return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: 'محتوى الملاحظة مطلوب' });
  }

  try {
    // جلب معرف السكن الخاص بالطالب لضمان الربط الصحيح حتى لو كان المستخدم أسقف (بمعرف سكن null في التوكن)
    const student = await kdb('students').where({ id }).select('tenant_id').first();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

    // عزل السكنات: لا يحق لأي مستخدم إضافة ملاحظات على طالب سكن لا ينتمي له
    if (!(await canAccessStudentTenant(req, student.tenant_id))) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    const id_gen = uuidv4();
    // استخدام Query Builder للإضافة يحل مشاكل التواريخ وأنواع البيانات
    await kdb('student_notes').insert({
      id: id_gen,
      student_id: id,
      tenant_id: student.tenant_id,
      author_id: authorId,
      author_role: role,
      author_name: authorName,
      content: content.trim(),
      created_at: kdb.fn.now(),
      updated_at: kdb.fn.now()
    });

    res.json({ success: true, message: 'تم إضافة الملاحظة', data: { id: id_gen } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

router.delete("/:id/notes/:noteId", authenticate, async (req, res) => {
  const { id, noteId } = req.params;
  const userId = req.user.id;
  const role = req.user.role;

  if (role !== 'priest' && role !== 'supervisor' && role !== 'bishop' && role !== 'admin') {
    return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
  }

  try {
    const student = await kdb('students').where({ id }).select('tenant_id').first();
    if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });

    if (!(await canAccessStudentTenant(req, student.tenant_id))) {
      return res.status(403).json({ success: false, message: 'غير مصرح بالوصول' });
    }

    const note = await kdb('student_notes')
      .where({ id: noteId, student_id: id })
      .first();
    if (!note) return res.status(404).json({ success: false, message: 'الملاحظة غير موجودة' });
    if (note.author_id !== userId) {
      return res.status(403).json({ success: false, message: 'لا يمكنك حذف ملاحظات الآخرين' });
    }

    await kdb('student_notes').where({ id: noteId }).del();
    res.json({ success: true, message: 'تم حذف الملاحظة' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// كارت الحساب المالي للطالب في البروفايل
// مسموح بالعرض لـ: مدير التطبيق، الأسقف، الكاهن، مشرف السكن، الطالب (نفسه)، ولي الأمر (ابنه) فقط.
router.get("/:id/finance", authenticate, async (req, res) => {
  const role = req.user.role;
  const isAdminBishop = role === 'admin' || role === 'bishop';
  const allowedStaff = ['admin', 'bishop', 'priest', 'supervisor'].includes(role);
  if (!allowedStaff && role !== 'student' && role !== 'parent') {
    return res.status(403).json({ success: false, message: "غير مصرح بعرض الحساب المالي" });
  }

  try {
    const student = await kdb('students').where({ id: req.params.id }).first();
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });

    if (role === 'student') {
      if (student.user_id !== req.user.id) return res.status(403).json({ success: false, message: "لا يمكنك عرض حساب طالب آخر" });
    } else if (role === 'parent') {
      const link = await kdb('student_guardians as sg')
        .join('parents as p', 'p.id', 'sg.guardian_id')
        .where('sg.student_id', student.id)
        .where('p.user_id', req.user.id)
        .first();
      if (!link) return res.status(403).json({ success: false, message: "لا يمكنك عرض حساب هذا الطالب" });
    } else if (role === 'bishop') {
      // الأسقف يرى فقط طلاب السكنات التي تديرها ولايته
      if (!student.tenant_id) return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكناتك" });
      const allowedIds = await computeUserTenantIds(req.user);
      if (!allowedIds.includes(student.tenant_id)) {
        return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكناتك" });
      }
    } else if (role === 'supervisor' || role === 'priest') {
      if (student.tenant_id !== req.user.tenantId) {
        return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكنك" });
      }
    }

    const isAdminScope = isAdminBishop;

    const account = await getStudentAccount(student.id, { visibility: isAdminScope ? 'all' : 'tenant' });
    if (!account) return res.status(500).json({ success: false, message: "تعذر حساب بيانات الغرفة" });

    res.json({
      success: true,
      data: {
        studentId: student.id,
        roomPrice: account.roomPrice,
        invoice: account.invoice,
        source: account.source,
        totalPaid: account.totalPaid,
        remaining: account.remaining,
        balance: account.balance,
        debtStatus: account.debtStatus,
        creditAmount: account.creditAmount,
        paymentPercent: account.paymentPercent,
        billingCycle: account.billingCycle,
        payments: account.payments,
        transactions: account.transactions,
      }
    });
  } catch (error: any) {
    console.error('[Student Finance Error]', error);
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

// تعديل سعر الغرفة من بروفايل الطالب — مشرف السكن فقط
// يحدّث سعر الغرفة المسجل في جدول rooms حسب دورة التحصيل، أو agreed_price لو الغرفة مش فاضية سعر.
router.patch("/:id/finance", authenticate, async (req, res) => {
  if (req.user.role !== 'supervisor') {
    return res.status(403).json({ success: false, message: "تعديل الحساب المالي مسموح لمشرف السكن فقط" });
  }

  try {
    const student = await kdb('students').where({ id: req.params.id }).first();
    if (!student) return res.status(404).json({ success: false, message: "الطالب غير موجود" });
    if (student.tenant_id !== req.user.tenantId) {
      return res.status(403).json({ success: false, message: "الطالب ليس ضمن سكنك" });
    }

    const value = Number(req.body?.value);
    if (Number.isNaN(value) || value < 0 || value > 999999999) {
      return res.status(400).json({ success: false, message: "سعر الغرفة غير صحيح" });
    }

    const cycle = student.billing_cycle || 'semester';
    const priceField = cycle === 'daily' ? 'price_daily' : cycle === 'monthly' ? 'price_monthly' : 'price_semester';
    let updatedRoom = false;
    let updatedAgreed = false;
    let oldPrice = Number(student.agreed_price || 0);

    if (student.room_id) {
      const room = await kdb('rooms').where({ id: student.room_id, tenant_id: student.tenant_id }).first();
      if (room) {
        oldPrice = Number(room[priceField] || 0);
        await kdb('rooms').where({ id: room.id }).update({ [priceField]: value, updated_at: kdb.fn.now() });
        updatedRoom = true;
      }
    }

    if (!updatedRoom) {
      await kdb('students').where({ id: student.id }).update({ agreed_price: value, updated_at: kdb.fn.now() });
      updatedAgreed = true;
    }

    // تسجيل تعديل سعر الغرفة — بالتاريخ والوقت الفعليين للتعديل في السيرفر
    if (value !== oldPrice) {
      await logFinanceEdit({
        tenantId: student.tenant_id ?? null,
        studentId: student.id,
        editType: 'room_price',
        direction: value > oldPrice ? 'increase' : 'decrease',
        delta: Math.abs(value - oldPrice),
        summary: `تعديل سعر الغرفة من ${formatMoney(oldPrice)} إلى ${formatMoney(value)}${updatedRoom ? ` (${cycle === 'daily' ? 'اليومية' : cycle === 'monthly' ? 'الشهرية' : 'الفصلية'})` : ''}`,
        createdBy: req.user?.id || null,
      });
    }

    const account = await getStudentAccount(student.id, { visibility: 'all' });
    const roomLabel = updatedRoom ? (cycle === 'daily' ? 'اليومية' : cycle === 'monthly' ? 'الشهرية' : 'الفصلية') : null;
    const message = `تم تعديل سعر الغرفة${roomLabel ? ` (${roomLabel})` : ''} إلى ${formatMoney(value)}.\nإجمالي المدفوع: ${formatMoney(account?.totalPaid || 0)}\nالمتبقي: ${formatMoney(account?.remaining || 0)}`;
    await notifyStudentFinance(student.id, message, `حساب الغرفة - تعديل السعر`);

    res.json({
      success: true,
      message: "تم تعديل سعر الغرفة بنجاح",
      data: { value, updatedRoom, updatedAgreed, account }
    });
  } catch (error: any) {
    console.error('[Student Finance Update Error]', error);
    res.status(500).json({ success: false, message: "حصل خطأ فني. لو سمحت كرر المحاولة." });
  }
});

export default router;
