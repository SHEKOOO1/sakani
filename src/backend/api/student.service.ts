import mssql from 'mssql';
import { poolPromise } from '../infrastructure/knex.ts';
import { v4 as uuidv4 } from 'uuid';
import { createNotification } from '../api/notifications.routes';
import bcrypt from 'bcryptjs';
import { UPLOADS_BASE } from '../middleware/upload';

export class StudentService {
    private parseBool(value: any): boolean {
        return value === 'true' || value === true;
    }

    /**
     * طھط³ط¬ظٹظ„ ط·ط§ظ„ط¨ ط¬ط¯ظٹط¯ ظ…ط¹ ظƒط§ظپط© ط§ظ„ط¨ظٹط§ظ†ط§طھ ظˆط§ظ„ظ…ظ„ط­ظ‚ط§طھ ظپظٹ Transaction ظˆط§ط­ط¯ط©
     * طھظڈظ†ط´ط¦ ط­ط³ط§ط¨ ظ…ط³طھط®ط¯ظ… ظ„ظ„ط·ط§ظ„ط¨طŒ ظˆط¥ط°ط§ ظˆظڈط¬ط¯طھ ط¨ظٹط§ظ†ط§طھ ظˆظ„ظٹ ط§ظ„ط£ظ…ط± طھظڈظ†ط´ط¦ ط­ط³ط§ط¨ظ‡ ظˆطھط±ط¨ط·ظ‡
     */
    async registerStudent(data: any, files: any[], tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");

        const {
            name, email, password, studentIdNumber, birthDate, college, major, university,
            enrollmentYear, studentPhoto, address, roomId, idCardNumber, billingCycle, agreedPrice,
            governorate, village, churchName, confessionFatherName,
            phoneNumbers, is_servant, is_deacon, servant_services, deacon_rank,
            parentName, parentEmail, parentPassword, parentPhone, parentRelationType,
            doc_types, daily_readings_enabled
        } = data;

        let existingParentUserId: string | null = null;
        let existingParentId: string | null = null;
        if (parentEmail) {
            const existingResult = await pool.request()
                .input('email', mssql.NVarChar(255), parentEmail)
                .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                .query(`SELECT u.id as user_id, p.id as parent_id FROM users u LEFT JOIN parents p ON u.id = p.user_id WHERE u.email = @email AND u.role = 'parent' AND u.tenant_id = @tenant_id`);
            if (existingResult.recordset.length > 0) {
                existingParentUserId = existingResult.recordset[0].user_id;
                existingParentId = existingResult.recordset[0].parent_id;
            }
        }

        const transaction = new mssql.Transaction(pool);
        await transaction.begin();

        try {
            const studentId = uuidv4();

            // 0. ط¥ظ†ط´ط§ط، ط­ط³ط§ط¨ ظ…ط³طھط®ط¯ظ… ظ„ظ„ط·ط§ظ„ط¨
            const studentUserId = uuidv4();
            const defaultPw = process.env.DEFAULT_USER_PASSWORD;
            if (!defaultPw || defaultPw.length < 8) {
              throw new Error('DEFAULT_USER_PASSWORD must be set in .env (min 8 chars)');
            }
            const hashedPassword = await bcrypt.hash(password || defaultPw, 10);
            const requestedEnabled = true;
            await transaction.request()
                .input('id', mssql.UniqueIdentifier, studentUserId)
                .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                .input('email', mssql.NVarChar(255), email)
                .input('password', mssql.NVarChar(255), hashedPassword)
                .input('role', mssql.NVarChar(50), 'student')
                .input('name', mssql.NVarChar(255), name)
            .input('daily_readings_enabled', mssql.Bit, 1)
            .query(`INSERT INTO users (id, tenant_id, email, password, role, name, daily_readings_enabled) 
                        VALUES (@id, @tenant_id, @email, @password, @role, @name, @daily_readings_enabled)`);

            // 1. ط¥ط¯ط±ط§ط¬ ط¨ظٹط§ظ†ط§طھ ط§ظ„ط·ط§ظ„ط¨ ط§ظ„ط£ط³ط§ط³ظٹط©
            await transaction.request()
                .input('id', mssql.UniqueIdentifier, studentId)
                .input('user_id', mssql.UniqueIdentifier, studentUserId)
                .input('tenant_id', mssql.UniqueIdentifier, tenantId)
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
                .input('room_id', mssql.UniqueIdentifier, roomId || null)
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

            // 2. ط¥ط¯ط±ط§ط¬ ط§ظ„طھظ„ظٹظپظˆظ†ط§طھ
            if (phoneNumbers) {
                const parsedPhones = typeof phoneNumbers === 'string' ? JSON.parse(phoneNumbers) : phoneNumbers;
                for (const p of parsedPhones) {
                    await transaction.request()
                        .input('student_id', mssql.UniqueIdentifier, studentId)
                        .input('phone_type', mssql.NVarChar(50), p.phoneType)
                        .input('label', mssql.NVarChar(100), p.label)
                        .input('phone_number', mssql.NVarChar(20), p.phoneNumber)
                        .query(`INSERT INTO StudentPhones (student_id, phone_type, label, phone_number) 
                                VALUES (@student_id, @phone_type, @label, @phone_number)`);
                }
            }

            // 4. ط¥ظ†ط´ط§ط، / ط±ط¨ط· ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ط¥ط°ط§ طھظ… طھظ‚ط¯ظٹظ… ط¨ط±ظٹط¯ ط¥ظ„ظƒطھط±ظˆظ†ظٹ
            let parentUserId: string | null = null;
            if (parentEmail) {
                if (existingParentUserId && existingParentId) {
                    // â€”â€”â€” ظˆظ„ظٹ ط§ظ„ط£ظ…ط± ظ…ظˆط¬ظˆط¯ ط¨ط§ظ„ظپط¹ظ„ â€” ظپظ‚ط· ط±ط¨ط· â€”
                    parentUserId = existingParentUserId;
                    const relationType = parentRelationType || 'father';
                    await transaction.request()
                        .input('id', mssql.UniqueIdentifier, uuidv4())
                        .input('student_id', mssql.UniqueIdentifier, studentId)
                        .input('guardian_id', mssql.UniqueIdentifier, existingParentId)
                        .input('relation_type', mssql.NVarChar(50), relationType)
                        .query(`INSERT INTO student_guardians (id, student_id, guardian_id, relation_type) 
                                VALUES (@id, @student_id, @guardian_id, @relation_type)`);
                } else {
                    // â€”â€”â€” ط¥ظ†ط´ط§ط، ظˆظ„ظٹ ط£ظ…ط± ط¬ط¯ظٹط¯ â€”
                    parentUserId = uuidv4();
                    const parentPw2 = process.env.DEFAULT_USER_PASSWORD;
                    if (!parentPw2 || parentPw2.length < 8) {
                      throw new Error('DEFAULT_USER_PASSWORD must be set in .env (min 8 chars)');
                    }
                    const parentHashedPassword = await bcrypt.hash(parentPassword || parentPw2, 10);
                    const parentFullName = parentName || `ظˆظ„ظٹ ط£ظ…ط± ${name}`;

                    await transaction.request()
                        .input('id', mssql.UniqueIdentifier, parentUserId)
                        .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                        .input('email', mssql.NVarChar(255), parentEmail)
                        .input('password', mssql.NVarChar(255), parentHashedPassword)
                        .input('role', mssql.NVarChar(50), 'parent')
                        .input('name', mssql.NVarChar(255), parentFullName)
                        .query(`INSERT INTO users (id, tenant_id, email, password, role, name) 
                                VALUES (@id, @tenant_id, @email, @password, @role, @name)`);

                    const guardianId = uuidv4();
                    await transaction.request()
                        .input('id', mssql.UniqueIdentifier, guardianId)
                        .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                        .input('user_id', mssql.UniqueIdentifier, parentUserId)
                        .input('phone', mssql.NVarChar(50), parentPhone || null)
                        .query(`INSERT INTO parents (id, tenant_id, user_id, phone) 
                                VALUES (@id, @tenant_id, @user_id, @phone)`);

                    const relationType = parentRelationType || 'father';
                    await transaction.request()
                        .input('id', mssql.UniqueIdentifier, uuidv4())
                        .input('student_id', mssql.UniqueIdentifier, studentId)
                        .input('guardian_id', mssql.UniqueIdentifier, guardianId)
                        .input('relation_type', mssql.NVarChar(50), relationType)
                        .query(`INSERT INTO student_guardians (id, student_id, guardian_id, relation_type) 
                                VALUES (@id, @student_id, @guardian_id, @relation_type)`);
                }
            }

            // 3. ط¥ط¯ط±ط§ط¬ ط§ظ„ظˆط«ط§ط¦ظ‚
            if (files && files.length > 0) {
                const docTypes = data.doc_types ? (Array.isArray(data.doc_types) ? data.doc_types : [data.doc_types]) : [];
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    await transaction.request()
                        .input('student_id', mssql.UniqueIdentifier, studentId)
                        .input('doc_type', mssql.NVarChar(100), docTypes[i] || 'unknown')
                        .input('file_path', mssql.NVarChar(mssql.MAX), `${UPLOADS_BASE}/documents/${file.filename}`)
                        .input('file_name', mssql.NVarChar(255), file.originalname)
                        .query(`INSERT INTO StudentDocuments (student_id, doc_type, file_path, file_name) 
                                VALUES (@student_id, @doc_type, @file_path, @file_name)`);
                }
            }

            await transaction.commit();
            return { studentId };
        } catch (error) {
            if (transaction) await transaction.rollback();
            throw error;
        }
    }

    async updateStudentRoom(id: string, roomId: string, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        // منع ربط الطالب بغرفة من سكن آخر (عزل البيانات بين السكنات)
        const roomRes = await pool.request()
            .input('room_id', mssql.UniqueIdentifier, roomId)
            .input('tenant_id', mssql.UniqueIdentifier, tenantId)
            .query(`SELECT id FROM Rooms WHERE id = @room_id AND tenant_id = @tenant_id`);
        if (!(roomRes.recordset || []).length) {
            throw new Error("الغرفة غير موجودة في سكنك");
        }
        await pool.request()
            .input('id', mssql.UniqueIdentifier, id)
            .input('room_id', mssql.UniqueIdentifier, roomId)
            .input('tenant_id', mssql.UniqueIdentifier, tenantId)
            .query(`UPDATE Students SET room_id = @room_id WHERE id = @id AND tenant_id = @tenant_id`);
    }

    async getStudentsByTenant(tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const result = await pool.request()
            .input('tenant_id', mssql.UniqueIdentifier, tenantId)
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
            .input('id', mssql.UniqueIdentifier, id)
            .input('tenant_id', mssql.UniqueIdentifier, tenantId)
            .query(`SELECT s.*, r.room_number FROM Students s LEFT JOIN Rooms r ON s.room_id = r.id WHERE s.id = @id AND s.tenant_id = @tenant_id`);

        const student = studentResult.recordset[0];
        if (!student) return null;

        const phones = await pool.request()
            .input('student_id', mssql.UniqueIdentifier, id)
            .query(`SELECT id, phone_type as phoneType, label, phone_number as phoneNumber FROM StudentPhones WHERE student_id = @student_id`);

        const documents = await pool.request()
            .input('student_id', mssql.UniqueIdentifier, id)
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
            .input('id', mssql.UniqueIdentifier, id)
            .input('tenant_id', mssql.UniqueIdentifier, tenantId)
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
                .input('id', mssql.UniqueIdentifier, studentId)
                .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                .query(`SELECT * FROM Students WHERE id = @id AND tenant_id = @tenant_id`);
            
            if (!student.recordset[0]) throw new Error("Student not found or not in your tenant.");

            // Move student to archive
            await transaction.request()
                .input('id', mssql.UniqueIdentifier, uuidv4())
                .input('student_id', mssql.UniqueIdentifier, studentId)
                .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                .input('student_name', mssql.NVarChar(255), student.recordset[0].name)
                .input('data_snapshot', mssql.NVarChar(mssql.MAX), JSON.stringify(student.recordset[0])) // Save full student data
                .input('exit_reason', mssql.NVarChar(100), archiveData.reason)
                .input('notes', mssql.NVarChar(mssql.MAX), archiveData.notes)
                .query(`INSERT INTO student_archive (id, student_id, tenant_id, student_name, data_snapshot, exit_reason, notes) VALUES (@id, @student_id, @tenant_id, @student_name, @data_snapshot, @exit_reason, @notes)`);

            // Update student status to archived or delete based on policy
            await transaction.request().input('id', mssql.UniqueIdentifier, studentId).query(`UPDATE Students SET status = 'archived', room_id = NULL WHERE id = @id`);
            await transaction.commit();
            return true;
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }
}
