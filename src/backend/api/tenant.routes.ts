import express from "express";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { kdb } from "../infrastructure/db.ts";
import { invalidateUserPermissionCache } from "../infrastructure/cache";
import { authenticate, authorize, authorizePermission, computeUserTenantIds } from "./middleware.ts";
import { AppPermission, UserRole } from "../../types/permissions";
import { validate } from "../validation/middleware";
import { createTenantSchema, updateTenantSchema } from "../validation/schemas";
import { resolveAccountPassword, describeDefaultUserPasswordRejection } from "../config/default-password.ts";

const router = express.Router();

const canAccessTenant = async (req: import("express").Request, tenantId: string) => {
  if (req.user.role === UserRole.Admin) return true;
  if (req.user.role === UserRole.Bishop) {
    const byBishop = await kdb('tenants').where({ id: tenantId, bishop_id: req.user.id }).first();
    if (byBishop) return true;
    const byAssignment = await kdb('user_tenant_assignments').where({ tenant_id: tenantId, user_id: req.user.id }).first();
    return !!byAssignment;
  }
  return req.user.tenantId === tenantId;
};

// إدارة السكن (تعديل / استيراد / تصدير) مسموحة فقط لمدير التطبيق أو الأسقف المالك/المسند للسكن
const canManageTenant = async (req: import("express").Request, tenantId: string): Promise<boolean> => {
  if (req.user.role === UserRole.Admin) return true;
  if (req.user.role !== UserRole.Bishop) return false;
  const byBishop = await kdb('tenants').where({ id: tenantId, bishop_id: req.user.id }).first();
  if (byBishop) return true;
  const byAssignment = await kdb('user_tenant_assignments').where({ tenant_id: tenantId, user_id: req.user.id }).first();
  return !!byAssignment;
};

// Get all tenants (Global Admin or Bishop-owned) — with aggregated stats
router.get("/", authenticate, authorize([UserRole.Admin, UserRole.Bishop]), async (req, res) => {
  try {
    let tenantIds: string[];
    if (req.user.role === UserRole.Admin) {
      const all = await kdb('tenants').select('id').orderBy('created_at', 'desc');
      tenantIds = all.map((t: any) => t.id);
    } else {
      const byBishop = await kdb('tenants').select('id').where({ bishop_id: req.user.id });
      const byAssignment = await kdb('user_tenant_assignments').select('tenant_id').where({ user_id: req.user.id });
      tenantIds = [...new Set([...byBishop.map((t: any) => t.id), ...byAssignment.map((t: any) => t.tenant_id)])];
    }

    if (tenantIds.length === 0) return res.json({ success: true, data: [] });

    const [tenants, apartmentCounts, roomStats, assignments] = await Promise.all([
      kdb('tenants').whereIn('id', tenantIds).orderBy('created_at', 'desc'),
      kdb('apartments').whereIn('tenant_id', tenantIds).select('tenant_id').count('* as count').groupBy('tenant_id'),
      kdb('rooms').whereIn('tenant_id', tenantIds)
        .select(
          'tenant_id',
          kdb.raw('COUNT(*) as count'),
          kdb.raw('COALESCE(SUM(capacity), 0) as total_capacity'),
          kdb.raw('COALESCE(SUM(current_occupancy), 0) as total_occupancy')
        ).groupBy('tenant_id'),
      kdb('user_tenant_assignments as uta')
        .join('users as u', 'uta.user_id', 'u.id')
        .whereIn('uta.tenant_id', tenantIds)
        .select('uta.tenant_id', 'u.id', 'u.role'),
    ]);

    const aptMap = Object.fromEntries(apartmentCounts.map((r: any) => [r.tenant_id, Number(r.count)]));
    const roomMap = Object.fromEntries(roomStats.map((r: any) => [r.tenant_id, r]));
    const assignMap: Record<string, { supervisor_ids: string[]; priest_ids: string[] }> = {};
    for (const a of assignments) {
      if (!assignMap[a.tenant_id]) assignMap[a.tenant_id] = { supervisor_ids: [], priest_ids: [] };
      if (a.role === 'supervisor') assignMap[a.tenant_id].supervisor_ids.push(a.id);
      if (a.role === 'priest') assignMap[a.tenant_id].priest_ids.push(a.id);
    }

    const data = tenants.map((t: any) => {
      const rm = roomMap[t.id] || {};
      return {
        ...t,
        apartment_count: aptMap[t.id] || 0,
        room_count: Number(rm.count) || 0,
        total_capacity: Number(rm.total_capacity) || 0,
        total_occupancy: Number(rm.total_occupancy) || 0,
        supervisor_ids: assignMap[t.id]?.supervisor_ids || [],
        priest_ids: assignMap[t.id]?.priest_ids || [],
      };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Create a Tenant (Global Admin or Bishop-own)
router.post("/", authenticate, authorize([UserRole.Admin, UserRole.Bishop]), validate(createTenantSchema), async (req, res) => {
  const { 
    name, location, location_lat, location_lng, location_radius,
    entry_lat, entry_lng, entry_radius,
    exit_lat, exit_lng, exit_radius,
    curfew_time, open_time,
    semester1_start, semester1_end, semester2_start, semester2_end,
    bishop_id,
    daily_readings_enabled,
    radio_514_enabled
  } = req.body;
  const id = uuidv4();

  const dataToInsert: any = {
        id, name, location: location || null, location_lat: location_lat ?? null, location_lng: location_lng ?? null, location_radius: location_radius ?? 50,
        entry_lat: entry_lat ?? null, entry_lng: entry_lng ?? null, entry_radius: entry_radius ?? 50,
        exit_lat: exit_lat ?? null, exit_lng: exit_lng ?? null, exit_radius: exit_radius ?? 50,
        curfew_time: curfew_time || null,
        open_time: open_time || null,
        semester1_start: semester1_start || null, semester1_end: semester1_end || null, semester2_start: semester2_start || null, semester2_end: semester2_end || null,
        bishop_id: req.user.role === UserRole.Bishop ? req.user.id : bishop_id || null,
        daily_readings_enabled: 1,
        radio_514_enabled: 1
  };

  // Only admin can set daily_readings/radio toggles on tenant creation
  if (req.user.role === 'admin') {
    if (daily_readings_enabled !== undefined) dataToInsert.daily_readings_enabled = daily_readings_enabled ? 1 : 0;
    if (radio_514_enabled !== undefined) dataToInsert.radio_514_enabled = radio_514_enabled ? 1 : 0;
  }

  try {
    await kdb('tenants').insert(dataToInsert);
    res.status(201).json({ success: true, data: { id, name, location, location_lat, location_lng, location_radius } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Get current tenant config (for Settings page)
router.get("/config", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "لا توجد بيانات سكن مرتبطة بحسابك" });
    }
    const tenant = await kdb('tenants').where({ id: tenantId }).first();
    if (!tenant) {
      return res.status(404).json({ success: false, message: "السكن غير موجود" });
    }
    res.json({
      success: true,
      data: {
        name: tenant.name,
        curfew_time: tenant.curfew_time || '',
        open_time: tenant.open_time || '',
        location_radius: tenant.location_radius || 50,
        is_active: !!tenant.is_active,
        location_lat: tenant.location_lat,
        location_lng: tenant.location_lng,
        entry_lat: tenant.entry_lat,
        entry_lng: tenant.entry_lng,
        entry_radius: tenant.entry_radius || 50,
        exit_lat: tenant.exit_lat,
        exit_lng: tenant.exit_lng,
        exit_radius: tenant.exit_radius || 50,
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ. لو سمحت كرر المحاولة." });
  }
});

// Update current tenant config (for Settings page)
router.put("/config", authenticate, authorizePermission(AppPermission.MANAGE_SETTINGS), async (req, res) => {
  try {
    const tenantId = req.user.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, message: "لا توجد بيانات سكن مرتبطة بحسابك" });
    }

    const {
      name, curfew_time, open_time, location_radius, is_active,
      location_lat, location_lng,
      entry_lat, entry_lng, entry_radius,
      exit_lat, exit_lng, exit_radius,
    } = req.body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (curfew_time !== undefined) updateData.curfew_time = curfew_time || null;
    if (open_time !== undefined) updateData.open_time = open_time || null;
    if (location_radius !== undefined) updateData.location_radius = location_radius;
    if (is_active !== undefined) updateData.is_active = is_active ? 1 : 0;
    if (location_lat !== undefined) updateData.location_lat = location_lat;
    if (location_lng !== undefined) updateData.location_lng = location_lng;
    if (entry_lat !== undefined) updateData.entry_lat = entry_lat;
    if (entry_lng !== undefined) updateData.entry_lng = entry_lng;
    if (entry_radius !== undefined) updateData.entry_radius = entry_radius;
    if (exit_lat !== undefined) updateData.exit_lat = exit_lat;
    if (exit_lng !== undefined) updateData.exit_lng = exit_lng;
    if (exit_radius !== undefined) updateData.exit_radius = exit_radius;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ success: false, message: "لا توجد بيانات للتحديث" });
    }

    await kdb('tenants').where({ id: tenantId }).update(updateData);
    res.json({ success: true, message: "تم حفظ الإعدادات بنجاح" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ. لو سمحت كرر المحاولة." });
  }
});

// Get single tenant details
router.get("/:id", authenticate, async (req, res) => {
  if (!await canAccessTenant(req, req.params.id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    const tenant = await kdb('tenants').where({ id: req.params.id }).first();
    if (!tenant) return res.status(404).json({ success: false, message: "Tenant not found" });

    const users = await kdb('user_tenant_assignments as uta')
      .join('users as u', 'uta.user_id', 'u.id')
      .select('u.id', 'u.role')
      .where('uta.tenant_id', req.params.id);

    tenant.supervisor_ids = users.filter((u: any) => u.role === 'supervisor').map((u: any) => u.id);
    tenant.priest_ids = users.filter((u: any) => u.role === 'priest').map((u: any) => u.id);

    const [aptCount, roomStats] = await Promise.all([
      kdb('apartments').where({ tenant_id: req.params.id }).count('* as count').first(),
      kdb('rooms').where({ tenant_id: req.params.id })
        .select(
          kdb.raw('COUNT(*) as count'),
          kdb.raw('COALESCE(SUM(capacity), 0) as total_capacity'),
          kdb.raw('COALESCE(SUM(current_occupancy), 0) as total_occupancy')
        ).first()
    ]);
    tenant.apartment_count = Number((aptCount as any)?.count || 0);
    tenant.room_count = Number((roomStats as any)?.count || 0);
    tenant.total_capacity = Number((roomStats as any)?.total_capacity || 0);
    tenant.total_occupancy = Number((roomStats as any)?.total_occupancy || 0);

    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Update Tenant (Name/Location/Supervisor/Priest/Coords)
router.put("/:id", authenticate, authorize([UserRole.Admin, UserRole.Bishop]), validate(updateTenantSchema), async (req, res) => {
  if (!await canManageTenant(req, req.params.id)) {
    return res.status(403).json({ success: false, message: "Forbidden: You don't have permission to modify this tenant" });
  }

  const { id } = req.params;
  const { 
    name, location, supervisor_ids, priest_ids, bishop_id, is_active, 
    location_lat, location_lng, location_radius,
    entry_lat, entry_lng, entry_radius,
    exit_lat, exit_lng, exit_radius,
    curfew_time, open_time,
    semester1_start, semester1_end, semester2_start, semester2_end,
    daily_readings_enabled,
    radio_514_enabled
  } = req.body;
  
  if (!supervisor_ids || supervisor_ids.length === 0) {
      return res.status(400).json({ success: false, message: "يجب اختيار مشرف واحد على الأقل" });
  }

  try {
    // تحقق من أن الأسماء المعينة هم بالفعل مشرفون وكهنة (حماية من رفع صلاحيات حسابات عشوائية)
    if (supervisor_ids?.length) {
      const matched = await kdb('users').whereIn('id', supervisor_ids).whereIn('role', [UserRole.Supervisor, UserRole.AssistantSupervisor]).select('id');
      if (matched.length !== new Set(supervisor_ids).size) {
        return res.status(400).json({ success: false, message: "يجب اختيار المشرفين من حسابات بمسمى مشرف/مساعد مشرف فقط" });
      }
    }
    if (priest_ids?.length) {
      const usernameIds = priest_ids.filter((u: string) => u);
      const matched = await kdb('users').whereIn('id', usernameIds).whereIn('role', [UserRole.Priest]).select('id');
      if (matched.length !== new Set(usernameIds).size) {
        return res.status(400).json({ success: false, message: "يجب اختيار الكهنة من حسابات بمسمى كاهن فقط" });
      }
    }

    // منع الأسقف من ضم موظفين/كهنة يتبعون سكناً لا يديره (منع عبور السكنات)
    if (req.user.role === UserRole.Bishop) {
      const staffUserIds = [...new Set([
        ...(supervisor_ids || []),
        ...(priest_ids || []).filter((u: string) => u),
      ])];
      if (staffUserIds.length > 0) {
        const allowedIds = await computeUserTenantIds(req.user);
        const selectedRows = await kdb('users').whereIn('id', staffUserIds).select('id', 'tenant_id');
        for (const row of selectedRows) {
          if (row.tenant_id && row.tenant_id !== id && !allowedIds.includes(row.tenant_id)) {
            return res.status(403).json({ success: false, message: "أحد الأسماء المختارة يتبع سكناً لا تملك إدارته" });
          }
        }
      }
    }

    await kdb.transaction(async trx => {
        await trx('tenants')
          .where({ id })
          .update({
            name,
            location: location ?? undefined,
            bishop_id: req.user.role === 'admin' ? (bishop_id || null) : req.user.id,
            is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1, 
            location_lat: location_lat ?? null, 
            location_lng: location_lng ?? null,
            location_radius: location_radius ?? 50,
            entry_lat: entry_lat ?? null,
            entry_lng: entry_lng ?? null,
            entry_radius: entry_radius ?? 50,
            exit_lat: exit_lat ?? null,
            exit_lng: exit_lng ?? null,
            exit_radius: exit_radius ?? 50,
            curfew_time: curfew_time || null,
            open_time: open_time || null,
            semester1_start: semester1_start || null,
            semester1_end: semester1_end || null,
            semester2_start: semester2_start || null,
            semester2_end: semester2_end || null
          });

        await trx('user_tenant_assignments').where({ tenant_id: id }).del();
        
        const allUserIds = new Set([...(supervisor_ids || []), ...(priest_ids || [])]);
        
        for (const userId of allUserIds) {
            await trx('user_tenant_assignments').insert({ tenant_id: id, user_id: userId });
        }

        // Only admin can change daily_readings/radio toggles on tenant + cascade to all users
        if (req.user.role === 'admin') {
          const tenantUpdate: any = {};
          if (daily_readings_enabled !== undefined) {
            const value = daily_readings_enabled ? 1 : 0;
            tenantUpdate.daily_readings_enabled = value;
            await trx('users').where({ tenant_id: id }).update({ daily_readings_enabled: value });
          }
          if (radio_514_enabled !== undefined) {
            const value = radio_514_enabled ? 1 : 0;
            tenantUpdate.radio_514_enabled = value;
            await trx('users').where({ tenant_id: id }).update({ radio_514_enabled: value });
          }
          if (Object.keys(tenantUpdate).length > 0) {
            await trx('tenants').where({ id }).update(tenantUpdate);
          }
        }
    });

    // مسح كاش الصلاحيات/السكنات للأسماء المعاد تعيينها فورًا
    const affectedUsers = [...new Set([
      ...(supervisor_ids || []),
      ...(priest_ids || []).filter((u: string) => u),
    ])];
    for (const userId of affectedUsers) invalidateUserPermissionCache(userId);

    res.json({ success: true, message: "Tenant updated successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Toggle tenant services (daily readings / radio) — bypasses full-tenant validation
router.patch("/:id/toggle-services", authenticate, authorizePermission(AppPermission.MANAGE_GLOBAL_TENANTS), async (req, res) => {
  const { id } = req.params;
  const { daily_readings_enabled, radio_514_enabled } = req.body;
  try {
    if (!await canAccessTenant(req, id)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    const tenantUpdate: any = {};
    if (daily_readings_enabled !== undefined) {
      const value = daily_readings_enabled ? 1 : 0;
      tenantUpdate.daily_readings_enabled = value;
      await kdb('users').where({ tenant_id: id }).update({ daily_readings_enabled: value });
    }
    if (radio_514_enabled !== undefined) {
      const value = radio_514_enabled ? 1 : 0;
      tenantUpdate.radio_514_enabled = value;
      await kdb('users').where({ tenant_id: id }).update({ radio_514_enabled: value });
    }
    if (Object.keys(tenantUpdate).length > 0) {
      await kdb('tenants').where({ id }).update(tenantUpdate);

      // Cascade to parents of students in this tenant
      const parentUsers = await kdb('student_guardians as sg')
        .join('parents as p', 'sg.guardian_id', 'p.id')
        .join('users as u_parent', 'p.user_id', 'u_parent.id')
        .join('students as s', 'sg.student_id', 's.id')
        .where('s.tenant_id', id)
        .select('u_parent.id as parent_user_id')
        .distinct();
      if (parentUsers.length > 0) {
        const parentIds = parentUsers.map((p: any) => p.parent_user_id);
        if (daily_readings_enabled !== undefined) {
          await kdb('users').whereIn('id', parentIds).update({ daily_readings_enabled: daily_readings_enabled ? 1 : 0 });
        }
        if (radio_514_enabled !== undefined) {
          await kdb('users').whereIn('id', parentIds).update({ radio_514_enabled: radio_514_enabled ? 1 : 0 });
        }
      }
    }
    res.json({ success: true, message: 'تم تحديث الخدمات للسكن وأولياء الأمور' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'حدث خطأ' });
  }
});

// Get impact (counts) for a Tenant
router.get("/:id/impact", authenticate, authorize([UserRole.Admin]), async (req, res) => {
  const { id } = req.params;
  try {
    const studentRows = await kdb('students').where({ tenant_id: id }).select('id');
    const studentIds = studentRows.map((r: any) => r.id);
    const hasStudents = studentIds.length > 0;
    const impact = {
      students: (await kdb('students').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      rooms: (await kdb('rooms').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      apartments: (await kdb('apartments').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      finances: (await kdb('finances').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      attendance: hasStudents ? (await kdb('attendance').whereIn('student_id', studentIds).count('* as count').first())?.count || 0 : 0,
      behavior: hasStudents ? (await kdb('student_points').whereIn('student_id', studentIds).count('* as count').first())?.count || 0 : 0,
      events: (await kdb('events').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      competitions: (await kdb('competitions').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      maintenance: (await kdb('maintenance_requests').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      notifications: (await kdb('notifications').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      broadcasts: (await kdb('broadcasts as b').join('users as u', 'b.sender_id', 'u.id').where('u.tenant_id', id).count('* as count').first())?.count || 0,
      inventory: (await kdb('inventory').where({ tenant_id: id }).count('* as count').first())?.count || 0,
      users: (await kdb('users').where({ tenant_id: id }).count('* as count').first())?.count || 0,
    };
    res.json({ success: true, data: impact });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "حصل خطأ. لو سمحت كرر المحاولة." });
  }
});

// Force Delete a Tenant (Global Admin Only)
router.delete("/:id/force", authenticate, authorize([UserRole.Admin]), async (req, res) => {
  const { id } = req.params;
  try {
    await kdb.transaction(async trx => {
      const studentRows = await trx('students').where({ tenant_id: id }).select('id');
      const studentIds = studentRows.map((s: any) => s.id);

      if (studentIds.length > 0) {
        await trx('student_points').whereIn('student_id', studentIds).del();
        await trx('student_warnings').whereIn('student_id', studentIds).del();
        await trx('student_delays').whereIn('student_id', studentIds).del();
        await trx('student_guardians').whereIn('student_id', studentIds).del();
        await trx('student_badges').whereIn('student_id', studentIds).del();
        await trx('student_rewards').whereIn('student_id', studentIds).del();
        await trx('student_notes').whereIn('student_id', studentIds).del();
        await trx('attendance').whereIn('student_id', studentIds).del();
      }

      await trx('students').where({ tenant_id: id }).del();
      await trx('rooms').where({ tenant_id: id }).del();
      await trx('apartments').where({ tenant_id: id }).del();
      await trx('finances').where({ tenant_id: id }).del();

      // Events cascade
      const eventRows = await trx('events').where({ tenant_id: id }).select('id');
      const eventIds = eventRows.map((e: any) => e.id);
      if (eventIds.length > 0) {
        await trx('event_attendance_detailed').whereIn('event_id', eventIds).del();
        await trx('event_attendance').whereIn('event_id', eventIds).del();
        await trx('event_scores').whereIn('event_id', eventIds).del();
        await trx('event_criteria').whereIn('event_id', eventIds).del();
        await trx('event_sessions').whereIn('event_id', eventIds).del();
        await trx('event_registrations').whereIn('event_id', eventIds).del();
        await trx('event_subscriptions').whereIn('event_id', eventIds).del();
        await trx('event_payments').whereIn('event_id', eventIds).del();
        await trx('event_responsible').whereIn('event_id', eventIds).del();
      }
      await trx('events').where({ tenant_id: id }).del();

      // Competitions cascade
      const compRows = await trx('competitions').where({ tenant_id: id }).select('id');
      const compIds = compRows.map((c: any) => c.id);
      if (compIds.length > 0) {
        // competition_team_members links to competitions via competition_teams.team_id
        const teamRows = await trx('competition_teams').whereIn('competition_id', compIds).select('id');
        const teamIds = teamRows.map((t: any) => t.id);
        if (teamIds.length > 0) {
          await trx('competition_team_members').whereIn('team_id', teamIds).del();
        }
        await trx('competition_participants').whereIn('competition_id', compIds).del();
        await trx('competition_teams').whereIn('competition_id', compIds).del();
      }
      await trx('competitions').where({ tenant_id: id }).del();

      await trx('maintenance_requests').where({ tenant_id: id }).del();
      await trx('notifications').where({ tenant_id: id }).del();
      await trx('inventory').where({ tenant_id: id }).del();
      await trx('laundry_queue').where({ tenant_id: id }).del();
      await trx('laundry_operators').where({ tenant_id: id }).del();
      await trx('laundry_settings').where({ tenant_id: id }).del();
      await trx('badges').where({ tenant_id: id }).del();
      await trx('rewards_definitions').where({ tenant_id: id }).del();
      await trx('profile_shares').where({ tenant_id: id }).del();
      await trx('payment_methods').where({ tenant_id: id }).del();

      // Broadcasts cascade — broadcasts themselves have no tenant_id column;
      // they belong to a tenant through the sender user's tenant_id.
      const bcRows = await trx('broadcasts as b').join('users as u', 'b.sender_id', 'u.id').where('u.tenant_id', id).select('b.id');
      const bcIds = bcRows.map((b: any) => b.id);
      if (bcIds.length > 0) {
        await trx('broadcast_reads').whereIn('broadcast_id', bcIds).del();
        await trx('broadcast_attachments').whereIn('broadcast_id', bcIds).del();
        await trx('broadcasts').whereIn('id', bcIds).del();
      }

      await trx('audit_logs').where({ tenant_id: id }).del();
      await trx('decisions_log').where({ tenant_id: id }).del();
      await trx('student_archive').where({ tenant_id: id }).del();
      await trx('tenant_custom_roles').where({ tenant_id: id }).del();
      await trx('user_tenant_assignments').where({ tenant_id: id }).del();

      // Detach users rather than delete accounts
      await trx('users').where({ tenant_id: id }).update({ tenant_id: null });
      await trx('parents').where({ tenant_id: id }).del();

      await trx('tenants').where({ id }).del();
    });
    res.json({ success: true, message: "Tenant and associated data deleted successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "لم يتم الحذف. قد يكون هناك بيانات مرتبطة لم يتم حذفها." });
  }
});

// Export Tenant Data
router.get("/:id/export", authenticate, authorize([UserRole.Admin, UserRole.Bishop]), async (req, res) => {
  const { id } = req.params;
  if (!await canManageTenant(req, id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    const data: any = {};
    data.apartments = await kdb('apartments').where({ tenant_id: id });
    data.rooms = await kdb('rooms').where({ tenant_id: id });
    
    data.students = await kdb('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .select('s.*', 'u.email', 'u.name', 'u.role')
      .where('s.tenant_id', id);

    data.inventory = await kdb('inventory').where({ tenant_id: id });
    data.rewards_definitions = await kdb('rewards_definitions').where({ tenant_id: id });
    data.competitions = await kdb('competitions').where({ tenant_id: id });

    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Import Tenant Data
router.post("/:id/import", authenticate, authorize([UserRole.Admin, UserRole.Bishop]), async (req, res) => {
  const { id } = req.params;
  if (!await canManageTenant(req, id)) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  const importData = req.body;
  const resolvedImportPassword = resolveAccountPassword(undefined);
  if (!resolvedImportPassword.ok) {
    return res.status(500).json({ success: false, message: describeDefaultUserPasswordRejection(resolvedImportPassword.reason) });
  }
  const defaultPassword = bcrypt.hashSync(resolvedImportPassword.password as string, 10);

  // الأدوار المسموح استيرادها عبر هذه النقطة — يُمنع إنشاء admin/bishop/employee من خلال الاستيراد
  const IMPORTABLE_ROLES = [UserRole.Student, UserRole.Parent, UserRole.Supervisor, UserRole.AssistantSupervisor, UserRole.Priest];

  try {
    await kdb.transaction(async trx => {
      // 1. Import Apartments
      if (importData.apartments && Array.isArray(importData.apartments)) {
        for (const apt of importData.apartments) {
          const aptId = apt.id || uuidv4();
          const exists = await trx('apartments').where({ id: aptId }).first();
          const aptData = { id: aptId, tenant_id: id, name: apt.name, building: apt.building || null, is_active: apt.is_active ?? 1 };
          
          if (exists) {
            await trx('apartments').where({ id: aptId }).update(aptData);
          } else {
            await trx('apartments').insert(aptData);
          }
        }
      }

      // 2. Import Rooms
      if (importData.rooms && Array.isArray(importData.rooms)) {
        for (const room of importData.rooms) {
          const roomId = room.id || uuidv4();
          const exists = await trx('rooms').where({ id: roomId }).first();
          const roomData = { id: roomId, tenant_id: id, apartment_id: room.apartment_id, room_number: room.room_number, capacity: room.capacity, current_occupancy: room.current_occupancy || 0 };
          
          if (exists) {
            await trx('rooms').where({ id: roomId }).update(roomData);
          } else {
            await trx('rooms').insert(roomData);
          }
        }
      }

      // 3. Import Students (and their Users)
      if (importData.students && Array.isArray(importData.students)) {
        for (const std of importData.students) {
          const requestedRole = (std.role || UserRole.Student).toLowerCase();
          if (!IMPORTABLE_ROLES.includes(requestedRole)) {
            throw new Error(`الدور "${std.role}" غير مسموح إنشاؤه عبر الاستيراد`);
          }

          let userId = std.user_id;
          
          // Check if user exists by email
          const existingUser = await trx('users').where({ email: std.email }).first();
          
          if (!existingUser) {
            userId = userId || uuidv4();
            await trx('users').insert({
                id: userId, tenant_id: id, email: std.email, password: defaultPassword, role: requestedRole, name: std.name
            });
          } else {
            userId = existingUser.id;
            const belongsToTenant = existingUser.tenant_id === id;
            const tenantless = !existingUser.tenant_id;
            // لا يجوز ربط حساب مسجل في سكن آخر إلاّ عبر مدير التطبيق مباشرة
            if (!belongsToTenant && !tenantless && req.user.role !== UserRole.Admin) {
              throw new Error(`لا يمكن ربط الحساب "${std.email}" لأنه مسجل في سكن آخر`);
            }
            // لا يجوز تغيير دور حساب قائم أبدًا عبر الاستيراد، وقد نلغي ربطة سكن خاطئة فقط
            if (tenantless || (req.user.role === UserRole.Admin && !belongsToTenant)) {
              await trx('users').where({ id: userId }).update({ tenant_id: id });
            }
            const assignmentExists = await trx('user_tenant_assignments').where({ user_id: userId, tenant_id: id }).first();
            if (!assignmentExists) {
              await trx('user_tenant_assignments').insert({ user_id: userId, tenant_id: id });
            }
          }

          const studentId = std.id || uuidv4();
          const studentExists = await trx('students').where({ id: studentId }).first();
          const studentData = { id: studentId, tenant_id: id, user_id: userId, room_id: std.room_id || null, student_id_number: std.student_id_number, phone: std.phone || null, status: std.status || 'active' };
          
          if (studentExists) {
            await trx('students').where({ id: studentId }).update(studentData);
          } else {
            await trx('students').insert(studentData);
          }
        }
      }

      // 4. Import Inventory
      if (importData.inventory && Array.isArray(importData.inventory)) {
        for (const item of importData.inventory) {
          const itemId = item.id || uuidv4();
          const exists = await trx('inventory').where({ id: itemId }).first();
          const itemData = { id: itemId, tenant_id: id, name: item.name, category: item.category || null, quantity: item.quantity || 0, unit: item.unit || null, min_quantity: item.min_quantity || 5 };
          
          if (exists) {
            await trx('inventory').where({ id: itemId }).update(itemData);
          } else {
            await trx('inventory').insert(itemData);
          }
        }
      }
    });

    res.json({ success: true, message: "Data imported successfully" });
  } catch (error: any) {
    res.status(400).json({ success: false, message: "��� �������. ���� �� �������� ����� ��� ����." });
  }
});

// Get available users by role for tenant assignment
router.get("/available-users/list", authenticate, authorize([UserRole.Admin, UserRole.Bishop]), async (req, res) => {
  const { roles } = req.query;
  const roleList = roles ? (roles as string).split(',') : ['supervisor', 'priest'];

  try {
    let users;
    if (req.user.role === UserRole.Admin) {
      users = await kdb('users')
        .select('id', 'name', 'email', 'role')
        .whereIn('role', roleList)
        .orderBy('name');
    } else {
      // Bishop: get users assigned to their tenants
      const byBishop = await kdb('tenants').select('id').where({ bishop_id: req.user.id });
      const byAssignment = await kdb('user_tenant_assignments').select('tenant_id').where({ user_id: req.user.id });
      const myTenantIds = [...new Set([...byBishop.map((t: any) => t.id), ...byAssignment.map((t: any) => t.tenant_id)])];
      if (myTenantIds.length === 0) {
        return res.json({ success: true, data: [] });
      }
      users = await kdb('user_tenant_assignments as uta')
        .join('users as u', 'uta.user_id', 'u.id')
        .select('u.id', 'u.name', 'u.email', 'u.role')
        .whereIn('uta.tenant_id', myTenantIds)
        .whereIn('u.role', roleList)
        .groupBy('u.id', 'u.name', 'u.email', 'u.role')
        .orderBy('u.name');
    }
    // Deduplicate by id
    const seen = new Set<string>();
    const deduped = users.filter((u: any) => {
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
    res.json({ success: true, data: deduped });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

// Get all bishops (for admin tenant creation)
router.get("/bishops/list", authenticate, authorize([UserRole.Admin]), async (req, res) => {
  try {
    const bishops = await kdb('users')
      .select('id', 'name', 'email')
      .where({ role: 'bishop' })
      .orderBy('name');
    res.json({ success: true, data: bishops });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
  }
});

export default router;
