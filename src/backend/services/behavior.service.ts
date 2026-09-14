import mssql from 'mssql';
import { poolPromise } from '../infrastructure/knex.ts';
import { v4 as uuidv4 } from 'uuid';

export class BehaviorService {
    async addPoints(data: { studentId: string, amount: number, reason: string, category: string, createdBy: string }, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const id = uuidv4();
        await pool.request()
            .input('id', mssql.UniqueIdentifier, id)
            .input('tenant_id', mssql.UniqueIdentifier, tenantId)
            .input('student_id', mssql.UniqueIdentifier, data.studentId)
            .input('amount', mssql.Int, data.amount)
            .input('reason', mssql.NVarChar(mssql.MAX), data.reason)
            .input('category', mssql.NVarChar(50), data.category)
            .input('created_by', mssql.UniqueIdentifier, data.createdBy)
            .query(`INSERT INTO student_points (id, tenant_id, student_id, amount, reason, category, created_by) 
                    VALUES (@id, @tenant_id, @student_id, @amount, @reason, @category, @created_by)`);
        return { id };
    }

    async issueWarning(data: { studentId: string, reason: string, level: string, notifyParent: boolean, notifyPriest: boolean, createdBy: string, deductPoints?: number }, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const id = uuidv4();
        const transaction = new mssql.Transaction(pool);
        await transaction.begin();
        try {
            await transaction.request()
                .input('id', mssql.UniqueIdentifier, id)
                .input('tenant_id', mssql.UniqueIdentifier, tenantId)
                .input('student_id', mssql.UniqueIdentifier, data.studentId)
                .input('level', mssql.NVarChar(50), data.level)
                .input('reason', mssql.NVarChar(mssql.MAX), data.reason)
                .input('notify_parent', mssql.Bit, data.notifyParent)
                .input('notify_priest', mssql.Bit, data.notifyPriest)
                .input('created_by', mssql.UniqueIdentifier, data.createdBy)
                .query(`INSERT INTO student_warnings (id, tenant_id, student_id, level, reason, notify_parent, notify_priest, status, created_by) 
                        VALUES (@id, @tenant_id, @student_id, @level, @reason, @notify_parent, @notify_priest, 'active', @created_by)`);

            // خصم نقاط من رصيد الطالب عند إصدار الإنذار (يُسجّل بالسالب في حين لا يملك نقاص)
            if (data.deductPoints && data.deductPoints > 0) {
                await transaction.request()
                    .input('pid', mssql.UniqueIdentifier, uuidv4())
                    .input('tpid', mssql.UniqueIdentifier, tenantId)
                    .input('spid', mssql.UniqueIdentifier, data.studentId)
                    .input('amount', mssql.Int, -data.deductPoints)
                    .input('reason', mssql.NVarChar(mssql.MAX), `خصم نقاط بمناسبة إنذار: ${data.reason || ''}`)
                    .input('category', mssql.NVarChar(50), 'penalty')
                    .input('created_by', mssql.UniqueIdentifier, data.createdBy)
                    .query(`INSERT INTO student_points (id, tenant_id, student_id, amount, reason, category, created_by) 
                            VALUES (@pid, @tpid, @spid, @amount, @reason, @category, @created_by)`);
            }

            if (data.notifyPriest) {
                const reportId = uuidv4();
                await transaction.request()
                    .input('rid', mssql.UniqueIdentifier, reportId)
                    .input('tid', mssql.UniqueIdentifier, tenantId)
                    .input('title', mssql.NVarChar(255), `إنذار سلوكي: ${data.level}`)
                    .input('sid', mssql.UniqueIdentifier, data.studentId)
                    .input('description', mssql.NVarChar(mssql.MAX), data.reason)
                    .input('supervisor_id', mssql.UniqueIdentifier, data.createdBy)
                    .query(`INSERT INTO priest_reports (id, tenant_id, title, description, type, student_ids, status, supervisor_id) 
                            VALUES (@rid, @tid, @title, @description, 'warning', @sid, 'pending', @supervisor_id)`);
            }
            await transaction.commit();
            return { id };
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
    }

    async getBehaviorSummary(studentId: string, tenantIds: string[]) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        // Parameterized IN-list: never interpolate tenant IDs into SQL text.
        if (!tenantIds.length) return { totalPoints: 0, activeWarnings: 0 };
        const placeholders = tenantIds.map((_, i) => `@t${i}`).join(',');
        const req = pool.request()
            .input('sid', mssql.UniqueIdentifier, studentId);
        tenantIds.forEach((tid, i) => req.input(`t${i}`, mssql.UniqueIdentifier, tid));
        const points = await req.query(`
            SELECT ISNULL(SUM(sp.amount), 0) as total 
            FROM student_points sp 
            JOIN students s ON sp.student_id = s.id
            WHERE sp.student_id = @sid AND s.tenant_id IN (${placeholders})
        `);
        const warnings = await pool.request()
            .input('sid', mssql.UniqueIdentifier, studentId)
            .input('tenantIds', mssql.NVarChar(mssql.MAX), tenantIds.join(','))
            .query(`
                SELECT COUNT(*) as count 
                FROM student_warnings sw 
                JOIN students s ON sw.student_id = s.id
                JOIN STRING_SPLIT(@tenantIds, ',') t ON s.tenant_id = t.value
                WHERE sw.student_id = @sid AND sw.status = 'active'
            `);
        return { totalPoints: points.recordset[0].total || 0, activeWarnings: warnings.recordset[0].count || 0 };
    }

    async assignItemManager(studentId: string, itemId: string, itemType: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const id = uuidv4();
        await pool.request()
            .input('id', mssql.UniqueIdentifier, id)
            .input('user_id', mssql.UniqueIdentifier, studentId)
            .input('item_id', mssql.UniqueIdentifier, itemId)
            .input('item_type', mssql.NVarChar(50), itemType)
            .query(`INSERT INTO item_managers (id, user_id, item_id, item_type) VALUES (@id, @user_id, @item_id, @item_type)`);
        return { id };
    }

    /**
     * جلب كافة الأنشطة والمسابقات والفعاليات في السكن مع تحديد الصلاحية (Step 7.2)
     */
    async getUnifiedActivities(userId: string, tenantId: string) {
        const pool = await poolPromise;
        if (!pool) throw new Error("Database connection pool not found");
        const result = await pool.request()
            .input('userId', mssql.UniqueIdentifier, userId)
            .input('tenantId', mssql.UniqueIdentifier, tenantId)
            .query(`
                SELECT id, title, description, event_date as [date], 'event' as [type], 
                       CASE WHEN EXISTS(SELECT 1 FROM item_managers WHERE user_id = @userId AND item_id = e.id AND item_type = 'event') THEN 1 ELSE 0 END as canManage
                FROM events e WHERE tenant_id = @tenantId
                UNION ALL
                SELECT id, title, description, start_date as [date], 'competition' as [type], 
                       CASE WHEN EXISTS(SELECT 1 FROM item_managers WHERE user_id = @userId AND item_id = c.id AND item_type = 'competition') THEN 1 ELSE 0 END as canManage
                FROM competitions c WHERE tenant_id = @tenantId
            `);
        return result.recordset.map(row => ({
            ...row,
            canManage: row.canManage === 1
        }));
    }
}