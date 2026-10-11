import mssql from 'mssql';
import { poolPromise } from '../infrastructure/knex.ts';
import { kdb } from '../infrastructure/db';
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from '../api/notifications.routes';
import bcrypt from 'bcryptjs';
import { UPLOADS_BASE } from '../middleware/upload';
import { resolveAccountPassword, describeDefaultUserPasswordRejection } from '../config/default-password';
import { issueActivationInvite } from '../services/activation.service';

/**
 * خطأ تحقق من بيانات متوقع (خطأ مستخدم) — يُترجم إلى 400 مع الرسالة العربية
 * بدل ابتلاعها في رسالة عامة لا تساعد المستخدم على معرفة السبب الحقيقي.
 */
export class StudentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StudentValidationError';
    }
}

export const isStudentValidationError = (e: any): boolean =>
    e instanceof StudentValidationError ||
    (e?.name === 'StudentValidationError' && typeof e?.message === 'string');

export class StudentService {
    private parseBool(value: any): boolean {
        return value === 'true' || value === true;
    }

    /**
     * التحقق من صلاحية ربط طالب بغرفة قبل إتمام العملية:
     * الغرفة يجب أن توجد، وأن تخص نفس السكن، وأن تكون مرتبطة بشقة تخص نفس
     * السكن أيضاً (لمنع تسكين طالب في غرفة من سكن آخر عبر تسريب الـ id)،
     * وأن يتسع الغرف عدد الطلاب فيها.
     * يقبل knex أو knex transaction كـ runner.
     */
    async assertRoomAssignable(runner: any, roomId: string, tenantId: string, opts: { excludeStudentId?: string } = {}) {
        const room = await runner('rooms').where({ id: roomId }).first();
        if (!room) throw new StudentValidationError('الغرفة غير موجودة');
        if (String(room.tenant_id).toLowerCase() !== String(tenantId).toLowerCase()) {
            throw new StudentValidationError('الغرفة غير موجودة في سكنك');
        }
        if (room.apartment_id) {
            const apartment = await runner('apartments').where({ id: room.apartment_id }).first();
            if (!apartment || String(apartment.tenant_id).toLowerCase() !== String(tenantId).toLowerCase()) {
                throw new StudentValidationError('الغرفة مرتبطة بشقة لا تخص سكنك');
            }
        }
        const occupancy = Number(room.current_occupancy ?? 0);
        const capacity = Number(room.capacity ?? 0);
        if (capacity > 0 && occupancy >= capacity) {
            throw new StudentValidationError('الغرفة مكتملة ولا يوجد مكان شاغر فيها');
        }
        return room;
    }

    /**
     * تحريك عداد الإشغال للغرفة بشكل آمن داخل نفس الـ transaction،
     * مع منع النزول تحت الصفر.
     */
    async adjustRoomOccupancy(runner: any, roomId: string | null | undefined, delta: 1 | -1) {
        if (!roomId) return;
        if (delta === -1) {
            await runner.raw(
                `UPDATE rooms SET current_occupancy = CASE WHEN ISNULL(current_occupancy, 0) - 1 < 0 THEN 0 ELSE current_occupancy - 1 END WHERE id = ?`,
                [roomId],
            );
            return;
        }
        await runner('rooms').where({ id: roomId }).increment('current_occupancy', 1);
    }

    /**
     * تسجيل طالب جديد مع كافة البيانات والملحقات في Transaction واحدة
     * تُنشئ حساب مستخدم للطالب، وإذا وُجدت بيانات ولي الأمر تُنشئ حسابه وتربطه
     */
    async registerStudent(data: any, files: any[], tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");

        const {
            name, email, password, username, studentIdNumber, birthDate, college, major, university,
            enrollmentYear, studentPhoto, address, roomId, idCardNumber, billingCycle, agreedPrice,
            governorate, village, churchName, confessionFatherName,
            phoneNumbers, is_servant, is_deacon, servant_services, deacon_rank,
            parentName, parentEmail, parentUsername, parentPassword, parentPhone, parentRelationType,
            doc_types, daily_readings_enabled
        } = data;

        // اسم المستخدم اختياري لكلٍّ من الطالب وولي الأمر: لو أُدخل فهو معرّف دخول
        // فريد عالمياً ويجعل الحساب فعّالاً فوراً (بدلاً من انتظار رابط التفعيل).
        const studentUsername = typeof username === 'string' ? username.trim() : '';
        const parentUsernameClean = typeof parentUsername === 'string' ? parentUsername.trim() : '';
        const usernamePattern = /^[\p{L}\p{N}._-]{3,50}$/u;
        if (studentUsername && !usernamePattern.test(studentUsername)) {
            throw new StudentValidationError('اسم مستخدم الطالب غير صالح (3-50 حرفاً/رقماً بلا مسافات)');
        }
        if (parentUsernameClean && !usernamePattern.test(parentUsernameClean)) {
            throw new StudentValidationError('اسم مستخدم ولي الأمر غير صالح (3-50 حرفاً/رقماً بلا مسافات)');
        }
        for (const candidate of [studentUsername, parentUsernameClean]) {
            if (candidate && await kdb('users').where({ username: candidate }).first()) {
                throw new StudentValidationError(`اسم المستخدم "${candidate}" مستخدم بالفعل`);
            }
        }

        let existingParentUserId: string | null = null;
        let existingParentId: string | null = null;
        if (parentEmail || parentUsernameClean) {
            const lookup = pool.request();
            const whereParts = [`u.role = 'parent'`, 'u.tenant_id = @tenant_id'];
            const identParts: string[] = [];
            if (parentEmail) { lookup.input('email', mssql.NVarChar(255), parentEmail); identParts.push('u.email = @email'); }
            if (parentUsernameClean) { lookup.input('username', mssql.NVarChar(100), parentUsernameClean); identParts.push('u.username = @username'); }
            whereParts.push('(' + identParts.join(' OR ') + ')');
            const existingResult = await lookup.input('tenant_id', mssql.NVarChar(128), tenantId)
                .query(`SELECT u.id as user_id, p.id as parent_id FROM users u LEFT JOIN parents p ON u.id = p.user_id WHERE ${whereParts.join(' AND ')}`);
            if (existingResult.recordset.length > 0) {
                existingParentUserId = existingResult.recordset[0].user_id;
                existingParentId = existingResult.recordset[0].parent_id;
            }
        }

        const transaction = new mssql.Transaction(pool);
        await transaction.begin();

        // حسابات تُنشأ مع هذا الطالب (الحساب نفسه + ولي أمر جديد) وتبقى بانتظار
        // التفعيل؛ يُرسل لها رابط البريد بعد نجاح الـ commit فقط.
        const pendingActivationUserIds: string[] = [];

        try {
            const studentId = uuidv4();

            // 0. Validate the room belongs to this housing before housing the student in it
            if (roomId) {
                await this.assertRoomAssignable(kdb, roomId, tenantId);
            }

            // 1. Create the user's account (the account itself + a new guardian) and keep them
            // pending activation; the email link is sent only after a successful commit.
            const studentUserId = uuidv4();
            const resolvedStudentPassword = resolveAccountPassword(password);
            if (!resolvedStudentPassword.ok) {
              throw new Error(describeDefaultUserPasswordRejection(resolvedStudentPassword.reason));
            }
            const hashedPassword = await bcrypt.hash(resolvedStudentPassword.password as string, 10);
            const requestedEnabled = true;
            await transaction.request()
                .input('id', mssql.NVarChar(128), studentUserId)
                .input('tenant_id', mssql.NVarChar(128), tenantId)
                .input('email', mssql.NVarChar(255), email || null)
                .input('username', mssql.NVarChar(100), studentUsername || null)
                .input('password', mssql.NVarChar(255), hashedPassword)
                .input('role', mssql.NVarChar(50), 'student')
                .input('name', mssql.NVarChar(255), name)
            .input('daily_readings_enabled', mssql.Bit, 1)
            .input('activated_at', mssql.DateTime2, studentUsername ? new Date() : null)
            .query(`INSERT INTO users (id, tenant_id, email, username, password, role, name, daily_readings_enabled, activated_at) 
                        VALUES (@id, @tenant_id, @email, @username, @password, @role, @name, @daily_readings_enabled, @activated_at)`);
            // الحساب المفعّل فوراً (له اسم مستخدم) لا يحتاج رابط بريد تفعيل.
            if (!studentUsername) pendingActivationUserIds.push(studentUserId);

            // 1. إدراج بيانات الطالب الأساسية
            await transaction.request()
                .input('id', mssql.NVarChar(128), studentId)
                .input('user_id', mssql.NVarChar(128), studentUserId)
                .input('tenant_id', mssql.NVarChar(128), tenantId)
                .input('name', mssql.NVarChar(255), name)
                .input('student_id_number', mssql.NVarChar(50), studentIdNumber)
                .input('university', mssql.NVarChar(200), university)
                .input('college', mssql.NVarChar(200), college)
                .input('major', mssql.NVarChar(200), major)
                .input('enrollment_year', mssql.Int, enrollmentYear)
                .input('birth_date', mssql.Date, birthDate)
                .input('id_card_number', mssql.NVarChar(50), idCardNumber)
                .input('address', mssql.NVarChar(mssql.MAX), address)
                .input('student_photo', mssql.NVarChar(mssql.MAX), studentPhoto)
                .input('room_id', mssql.NVarChar(128), roomId || null)
                .input('billing_cycle', mssql.NVarChar(50), billingCycle)
                .input('agreed_price', mssql.Decimal(10, 2), agreedPrice)
                .input('governorate', mssql.NVarChar(100), governorate)
                .input('village', mssql.NVarChar(100), village)
                .input('church_name', mssql.NVarChar(200), churchName)
                .input('confession_father_name', mssql.NVarChar(200), confessionFatherName)
                .input('is_servant', mssql.Bit, this.parseBool(is_servant))
                .input('servant_services', mssql.NVarChar(mssql.MAX), typeof servant_services === 'string' ? servant_services : JSON.stringify(servant_services))
                .input('is_deacon', mssql.Bit, this.parseBool(is_deacon))
                .input('deacon_rank', mssql.NVarChar(100), deacon_rank)
                .query(`INSERT INTO Students (id, user_id, tenant_id, name, student_id_number, university, college, major, 
                                            enrollment_year, birth_date, id_card_number, address, student_photo, room_id,
                                            billing_cycle, agreed_price, governorate, village, church_name, 
                                            confession_father_name, is_servant, servant_services, is_deacon, deacon_rank) 
                        VALUES (@id, @user_id, @tenant_id, @name, @student_id_number, @university, @college, @major, 
                                @enrollment_year, @birth_date, @id_card_number, @address, @student_photo, @room_id,
                                @billing_cycle, @agreed_price, @governorate, @village, @church_name, 
                                @confession_father_name, @is_servant, @servant_services, @is_deacon, @deacon_rank)`);

            // 1.b Track occupancy so the room cannot be over-filled or deleted while occupied
            if (roomId) {
                await transaction.request()
                    .input('room_id', mssql.NVarChar(128), roomId)
                    .query(`UPDATE rooms SET current_occupancy = ISNULL(current_occupancy, 0) + 1 WHERE id = @room_id`);
            }

            // 2. إدراج التليفونات
            if (phoneNumbers) {
                const parsedPhones = typeof phoneNumbers === 'string' ? JSON.parse(phoneNumbers) : phoneNumbers;
                for (const p of parsedPhones) {
                    await transaction.request()
                        .input('student_id', mssql.NVarChar(128), studentId)
                        .input('phone_type', mssql.NVarChar(50), p.phoneType)
                        .input('label', mssql.NVarChar(100), p.label)
                        .input('phone_number', mssql.NVarChar(20), p.phoneNumber)
                        .query(`INSERT INTO StudentPhones (student_id, phone_type, label, phone_number) 
                                VALUES (@student_id, @phone_type, @label, @phone_number)`);
                }
            }

            // 4. إنشاء / ربط ولي الأمر إذا تم تقديم بريد إلكتروني أو اسم مستخدم
            let parentUserId: string | null = null;
            if (parentEmail || parentUsernameClean) {
                if (existingParentUserId && existingParentId) {
                    // ——— ولي الأمر موجود بالفعل — فقط ربط —
                    parentUserId = existingParentUserId;
                    const relationType = parentRelationType || 'father';
                    await transaction.request()
                        .input('id', mssql.NVarChar(128), uuidv4())
                        .input('student_id', mssql.NVarChar(128), studentId)
                        .input('guardian_id', mssql.NVarChar(128), existingParentId)
                        .input('relation_type', mssql.NVarChar(50), relationType)
                        .query(`INSERT INTO student_guardians (id, student_id, guardian_id, relation_type) 
                                VALUES (@id, @student_id, @guardian_id, @relation_type)`);
                } else {
                    // ——— إنشاء ولي أمر جديد —
                    parentUserId = uuidv4();
                    const resolvedParentPassword = resolveAccountPassword(parentPassword);
                    if (!resolvedParentPassword.ok) {
                      throw new Error(describeDefaultUserPasswordRejection(resolvedParentPassword.reason));
                    }
                    const parentHashedPassword = await bcrypt.hash(resolvedParentPassword.password as string, 10);
                    const parentFullName = parentName || `ولي أمر ${name}`;

                    await transaction.request()
                        .input('id', mssql.NVarChar(128), parentUserId)
                        .input('tenant_id', mssql.NVarChar(128), tenantId)
                        .input('email', mssql.NVarChar(255), parentEmail || null)
                        .input('username', mssql.NVarChar(100), parentUsernameClean || null)
                        .input('password', mssql.NVarChar(255), parentHashedPassword)
                        .input('role', mssql.NVarChar(50), 'parent')
                        .input('name', mssql.NVarChar(255), parentFullName)
                        .input('activated_at', mssql.DateTime2, parentUsernameClean ? new Date() : null)
                        .query(`INSERT INTO users (id, tenant_id, email, username, password, role, name, activated_at) 
                                VALUES (@id, @tenant_id, @email, @username, @password, @role, @name, @activated_at)`);
                    if (!parentUsernameClean) pendingActivationUserIds.push(parentUserId);

                    const guardianId = uuidv4();
                    await transaction.request()
                        .input('id', mssql.NVarChar(128), guardianId)
                        .input('tenant_id', mssql.NVarChar(128), tenantId)
                        .input('user_id', mssql.NVarChar(128), parentUserId)
                        .input('phone', mssql.NVarChar(50), parentPhone || null)
                        .query(`INSERT INTO parents (id, tenant_id, user_id, phone) 
                                VALUES (@id, @tenant_id, @user_id, @phone)`);

                    const relationType = parentRelationType || 'father';
                    await transaction.request()
                        .input('id', mssql.NVarChar(128), uuidv4())
                        .input('student_id', mssql.NVarChar(128), studentId)
                        .input('guardian_id', mssql.NVarChar(128), guardianId)
                        .input('relation_type', mssql.NVarChar(50), relationType)
                        .query(`INSERT INTO student_guardians (id, student_id, guardian_id, relation_type) 
                                VALUES (@id, @student_id, @guardian_id, @relation_type)`);
                }
            }

            // 3. إدراج الوثائق
            if (files && files.length > 0) {
                const docTypes = data.doc_types ? (Array.isArray(data.doc_types) ? data.doc_types : [data.doc_types]) : [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    await transaction.request()
                        .input('student_id', mssql.NVarChar(128), studentId)
                        .input('doc_type', mssql.NVarChar(100), docTypes[i] || 'unknown')
                        .input('file_path', mssql.NVarChar(mssql.MAX), `${UPLOADS_BASE}/documents/${file.filename}`)
                        .input('file_name', mssql.NVarChar(255), file.originalname)
                        .query(`INSERT INTO StudentDocuments (student_id, doc_type, file_path, file_name) 
                                VALUES (@student_id, @doc_type, @file_path, @file_name)`);
                }
            }

            await transaction.commit();

            // إرسال روابط التفعيل بعد الـ commit — الفشل هنا لا يُسقط التسجيل
            // (fail-soft) ولا يُبطل ما كُتب بالفعل.
            let activationEmailSent = 0;
            for (const userId of pendingActivationUserIds) {
                const invite = await issueActivationInvite(userId);
                if (invite.emailed) activationEmailSent += 1;
                else console.warn('[StudentService] activation email not sent for user', userId, invite.reason || '');
            }

            return { studentId, activationEmailSent, pendingActivationCount: pendingActivationUserIds.length };
        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }
    }

    async updateStudentRoom(id: string, roomId: string | null, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");

        const studentRes = await pool.request()
            .input('id', mssql.NVarChar(128), id)
            .input('tenant_id', mssql.NVarChar(128), tenantId)
            .query(`SELECT id, room_id FROM Students WHERE id = @id AND tenant_id = @tenant_id`);
        const student = (studentRes.recordset || [])[0];
        if (!student) throw new Error("الطالب غير موجود في سكنك");

        const oldRoomId: string | null = student.room_id ?? null;
        const newRoomId: string | null = roomId || null;

        if (oldRoomId === newRoomId) return;

        // Validate the target room belongs to this housing (and its apartment) before moving
        const runner: any = (table: string) => kdb(table);
        if (newRoomId) {
            await this.assertRoomAssignable(runner, newRoomId, tenantId);
        }

        await kdb.transaction(async trx => {
            await this.adjustRoomOccupancy(trx, oldRoomId, -1);
            await this.adjustRoomOccupancy(trx, newRoomId, 1);
            await trx('students').where({ id, tenant_id: tenantId }).update({ room_id: newRoomId });
        });
    }

    async getStudentsByTenant(tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const result = await pool.request()
            .input('tenant_id', mssql.NVarChar(128), tenantId)
            .query(`SELECT s.*, r.room_number,
                           (SELECT TOP 1 phone_number FROM StudentPhones WHERE student_id = s.id) as phone
                    FROM Students s
                    LEFT JOIN Rooms r ON s.room_id = r.id
                    WHERE s.tenant_id = @tenant_id`);
        return result?.recordset || [];
    }

    async getStudentProfile(id: string, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");

        const studentResult = await pool.request()
            .input('id', mssql.NVarChar(128), id)
            .input('tenant_id', mssql.NVarChar(128), tenantId)
            .query(`SELECT s.*, r.room_number FROM Students s LEFT JOIN Rooms r ON s.room_id = r.id WHERE s.id = @id AND s.tenant_id = @tenant_id`);

        const student = studentResult.recordset[0];
        if (!student) return null;

        const phones = await pool.request()
            .input('student_id', mssql.NVarChar(128), id)
            .query(`SELECT id, phone_type as phoneType, label, phone_number as phoneNumber FROM StudentPhones WHERE student_id = @student_id`);

        const documents = await pool.request()
            .input('student_id', mssql.NVarChar(128), id)
            .query(`SELECT id, doc_type, file_path, file_name, upload_date FROM StudentDocuments WHERE student_id = @student_id`);

        return {
            ...student,
            phones: phones.recordset,
            documents: documents.recordset
        };
    }

    async deleteStudent(id: string, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const result = await pool.request()
            .input('id', mssql.NVarChar(128), id)
            .input('tenant_id', mssql.NVarChar(128), tenantId)
            .query(`DELETE FROM Students WHERE id = @id AND tenant_id = @tenant_id`);
        return (result?.rowsAffected[0] || 0) > 0;
    }

    async archiveStudent(studentId: string, archiveData: { reason: string, notes: string }, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const transaction = new mssql.Transaction(pool);
        await transaction.begin();
        try {
            const student = await transaction.request()
                .input('id', mssql.NVarChar(128), studentId)
                .input('tenant_id', mssql.NVarChar(128), tenantId)
                .query(`SELECT * FROM Students WHERE id = @id AND tenant_id = @tenant_id`);
            
            if (!student.recordset[0]) throw new Error("Student not found or not in your tenant.");

            // Move student to archive
            await transaction.request()
                .input('id', mssql.NVarChar(128), uuidv4())
                .input('student_id', mssql.NVarChar(128), studentId)
                .input('tenant_id', mssql.NVarChar(128), tenantId)
                .input('student_name', mssql.NVarChar(255), student.recordset[0].name)
                .input('data_snapshot', mssql.NVarChar(mssql.MAX), JSON.stringify(student.recordset[0])) // Save full student data
                .input('exit_reason', mssql.NVarChar(100), archiveData.reason)
                .input('notes', mssql.NVarChar(mssql.MAX), archiveData.notes)
                .query(`INSERT INTO student_archive (id, student_id, tenant_id, student_name, data_snapshot, exit_reason, notes) VALUES (@id, @student_id, @tenant_id, @student_name, @data_snapshot, @exit_reason, @notes)`);

            // Update student status to archived or delete based on policy
            await transaction.request().input('id', mssql.NVarChar(128), studentId).query(`UPDATE Students SET status = 'archived', room_id = NULL WHERE id = @id`);
            await transaction.commit();
            return true;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}
