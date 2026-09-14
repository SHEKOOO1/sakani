import { v4 as uuidv4 } from "uuid";
import { kdb } from "../infrastructure/db";

interface Targeting {
  tenants?: string[];
  roles?: string[];
  bishops?: string[];
  priests?: string[];
  supervisors?: string[];
  employees?: string[];
  students?: string[];
  colleges?: string[];
  majors?: string[];
  governorates?: string[];
  churches?: string[];
  guardian_types?: string[];
  sibling_genders?: string[];
  parent_gender?: 'father' | 'mother' | null;
  // Graduate targeting
  graduates_only?: boolean;
  graduate_parents_only?: boolean;
  selected_student_parents?: boolean;
  // Exclude flags: ظ„ظˆ ظ…ظپط¹ظ„ â†’ ظٹط³طھط«ظ†ظٹ ظƒظ„ ط§ظ„ظپط¦ط© (ط­طھظ‰ ظ„ظˆ ظپط§ط¶ظٹط©)
  exclude_tenants?: boolean;
  exclude_colleges?: boolean;
  exclude_governorates?: boolean;
  exclude_churches?: boolean;
  exclude_bishops?: boolean;
  exclude_priests?: boolean;
  exclude_supervisors?: boolean;
  exclude_employees?: boolean;
  exclude_students?: boolean;
  exclude_parents?: boolean;
}

const ROLE_POWER: Record<string, number> = {
  admin: 5,
  bishop: 4,
  priest: 3,
  supervisor: 2,
  assistant_supervisor: 1,
  employee: 1,
  student: 0,
  parent: 0,
};

function passesScopeIsolation(user: any, broadcastSenderRole: string, broadcastTargeting: Targeting, senderTenantId?: string): boolean {
  const viewerRole = user.role;
  const viewerTenantId = user.tenantId;
  const viewerPower = ROLE_POWER[viewerRole] ?? 0;
  const senderPower = ROLE_POWER[broadcastSenderRole] ?? 0;

  // 1. ظ…ظ…ظ†ظˆط¹ ظ†ظ‡ط§ط¦ظٹط§ظ‹: ط§ظ„ظ…ط´ط§ظ‡ط¯ ط£ط¹ظ„ظ‰ ظ…ظ† ط§ظ„ظ…ط±ط³ظ„ ظپظٹ ط§ظ„طھط³ظ„ط³ظ„ ط§ظ„ظ‡ط±ظ…ظٹ
  if (viewerPower > senderPower) return false;

  // 2. ظ„ظˆ ط§ظ„ظ…ط±ط³ظ„ ظ‡ظˆ ط§ظ„ظ…ط¯ظٹط± â†’ ظٹط¸ظ‡ط± ظ„ظ„ظƒظ„ (ظˆطµظ„ظ†ط§ ظ‡ظ†ط§ ظٹط¹ظ†ظٹ ط§ظ„ظ…ط´ط§ظ‡ط¯ ظ…ط´ ط£ط¹ظ„ظ‰ ظ…ظ†ظ‡)
  if (broadcastSenderRole === 'admin') return true;

  // 3. ط§ظ„ط£ط³ظ‚ظپ: ظٹط¸ظ‡ط± ظ„ظƒظ„ ط§ظ„ظ„ظٹ طھط­طھظ‡ (ط£ظ‚ظ„ ظ…ظ†ظ‡ ظپظٹ ط§ظ„ظ‡ط±ظ…) ظ„ظƒظ† ظ…ط´ ظ„ظ„ظ…ط¯ظٹط± (ط§طھظ…ظ†ط¹ ظپظٹ 1)
  if (broadcastSenderRole === 'bishop') {
    const targetTenants = broadcastTargeting.tenants || [];
    if (targetTenants.length > 0) return targetTenants.includes(viewerTenantId);
    return true;
  }

  // 4. ط§ظ„ظ…ط´ط±ظپ ظˆط§ظ„ظƒط§ظ‡ظ†: ظپظ‚ط· ظ„ظ†ظپط³ ط§ظ„ط³ظƒظ†
  if (broadcastSenderRole === 'supervisor' || broadcastSenderRole === 'priest') {
    const targetTenants = broadcastTargeting.tenants || [];
    if (targetTenants.length > 0) return targetTenants.includes(viewerTenantId);
    return senderTenantId != null && viewerTenantId === senderTenantId;
  }

  return true;
}

// Check if a user matches the targeting criteria
export async function userMatchesTargeting(user: any, targeting: Targeting): Promise<boolean> {
  if (!targeting || Object.keys(targeting).length === 0) return true;

  const results: boolean[] = [];

  // â”€â”€â”€ Exclude checks (ط¨طھط´طھط؛ظ„ ظ‚ط¨ظ„ ط§ظ„ظ€ Include) â”€â”€â”€
  // ط§ط³طھط«ظ†ط§ط، ط­ط³ط¨ ط§ظ„ط¯ظˆط±
  if (targeting.exclude_students && user.role === 'student') results.push(false);
  if (targeting.exclude_parents && user.role === 'parent') results.push(false);
  if (targeting.exclude_employees && user.role === 'employee') results.push(false);
  if (targeting.exclude_supervisors && user.role === 'supervisor') results.push(false);
  if (targeting.exclude_priests && user.role === 'priest') results.push(false);
  if (targeting.exclude_bishops && user.role === 'bishop') results.push(false);

  // ط§ط³طھط«ظ†ط§ط، ط­ط³ط¨ ط§ظ„ظ…ط³ظƒظ† (ظ„ظˆ tenants ظپط§ط¶ظٹ â†’ ط§ط³طھط«ظ†ط§ط، ظƒظ„ ط§ظ„ظ…ط³ط§ظƒظ†)
  if (targeting.exclude_tenants) {
    if (targeting.tenants?.length) {
      if (targeting.tenants.includes(user.tenantId)) results.push(false);
    } else {
      results.push(false);
    }
  }

  // â”€â”€â”€ Include checks â”€â”€â”€
  if (targeting.tenants && targeting.tenants.length > 0) {
    const matches = targeting.tenants.includes(user.tenantId);
    results.push(matches);
  }

  if (targeting.roles && targeting.roles.length > 0) {
    const matches = targeting.roles.includes(user.role);
    results.push(matches);
  }

  if (targeting.students && targeting.students.length > 0 && user.role === 'student') {
    const student = await kdb("students").where({ user_id: user.id }).select("id").first();
    const matches = student && targeting.students.includes(student.id);
    results.push(!!matches);
  }

  if (targeting.bishops && targeting.bishops.length > 0) {
    const tenant = await kdb("tenants").where({ id: user.tenantId }).select("bishop_id").first();
    const matches = tenant?.bishop_id && targeting.bishops.includes(tenant.bishop_id);
    results.push(!!matches);
  }

  if (targeting.priests && targeting.priests.length > 0) {
    const matches = targeting.priests.includes(user.id);
    results.push(matches);
  }

  if (targeting.supervisors && targeting.supervisors.length > 0) {
    const matches = targeting.supervisors.includes(user.id);
    results.push(matches);
  }

  if (targeting.employees && targeting.employees.length > 0) {
    const matches = targeting.employees.includes(user.id);
    results.push(matches);
  }

  if (user.role === 'student' && (
    (targeting.colleges && targeting.colleges.length > 0) ||
    (targeting.majors && targeting.majors.length > 0) ||
    (targeting.governorates && targeting.governorates.length > 0) ||
    (targeting.churches && targeting.churches.length > 0)
  )) {
    const student = await kdb("students").where({ user_id: user.id })
      .select("college", "major", "governorate", "church_name").first();

    if (student) {
      if (targeting.colleges && targeting.colleges.length > 0) {
        results.push(targeting.colleges.includes(student.college));
      }
      if (targeting.majors && targeting.majors.length > 0) {
        results.push(targeting.majors.includes(student.major));
      }
      if (targeting.governorates && targeting.governorates.length > 0) {
        results.push(targeting.governorates.includes(student.governorate));
      }
      if (targeting.churches && targeting.churches.length > 0) {
        results.push(targeting.churches.includes(student.church_name));
      }
    }
  }

  if (targeting.guardian_types && targeting.guardian_types.length > 0 && user.role === 'parent') {
    const types = targeting.guardian_types;
    const hasBrotherSister = types.includes('brother') || types.includes('sister');
    const siblingGenders = hasBrotherSister && targeting.sibling_genders?.length
      ? targeting.sibling_genders
      : null;

    // طھط¨ظ†ظٹ ط§ظ„ط§ط³طھط¹ظ„ط§ظ… ط§ظ„ط£ط³ط§ط³ظٹ: ظ†ط¬ظٹط¨ guardians ط§ظ„ظ…ط±طھط¨ط·ظٹظ† ط¨ط§ظ„ظ…ط³طھط®ط¯ظ…
    let query = kdb("student_guardians as sg")
      .join("parents as p", "sg.guardian_id", "p.id")
      .where({ "p.user_id": user.id })
      .whereIn("sg.relation_type", types);

    // ظ„ظˆ ظپظٹ ط·ظ„ط§ط¨ ظ…ط­ط¯ط¯ظٹظ†طŒ ظ„ط§ط²ظ… ط§ظ„ظˆطµظٹ ظٹظƒظˆظ† ظ…ط±طھط¨ط· ط¨ظٹظ‡ظ… ظپظ‚ط· (ظپظ„طھط± ط°ظƒظٹ)
    if (targeting.students?.length) {
      query = query.whereIn("sg.student_id", targeting.students);
    }

    // ظ„ظˆ ظپظٹ ط£ط®/ط£ط®طھ ظ…ط¹ طھط­ط¯ظٹط¯ ط§ظ„ط¬ظ†ط³ â†’ ظ†ط±ط¨ط· ط¬ط¯ظˆظ„ ط§ظ„ط·ظ„ط§ط¨ ظ„ظپط­طµ gender
    if (siblingGenders) {
      query = query
        .join("students as s", "sg.student_id", "s.id")
        .whereIn("s.gender", siblingGenders);
    }

    const hasRelation = await query.clone().first();
    results.push(!!hasRelation);
  }

  // backward compat: parent_gender ط§ظ„ظ‚ط¯ظٹظ…
  if (targeting.parent_gender && user.role === 'parent') {
    const hasRelation = await kdb("student_guardians as sg")
      .join("parents as p", "sg.guardian_id", "p.id")
      .where({ "p.user_id": user.id, "sg.relation_type": targeting.parent_gender })
      .first();
    results.push(!!hasRelation);
  }

  // Students flagged as graduates only (is_graduate = 1)
  if (targeting.graduates_only && user.role === 'student') {
    const student = await kdb("students").where({ user_id: user.id }).select("is_graduate").first();
    results.push(!!(student && student.is_graduate));
  }

  // Parents of graduate students only
  if (targeting.graduate_parents_only && user.role === 'parent') {
    let gq = kdb("student_guardians as sg")
      .join("parents as p", "sg.guardian_id", "p.id")
      .join("students as s", "sg.student_id", "s.id")
      .where({ "p.user_id": user.id, "s.is_graduate": 1 });
    if (targeting.tenants?.length) {
      gq = gq.whereIn("s.tenant_id", targeting.tenants);
    }
    const hasRelation = await gq.clone().first();
    results.push(!!hasRelation);
  }

  // Parents of the selected students
  if (targeting.selected_student_parents && targeting.students?.length && user.role === 'parent') {
    let gq = kdb("student_guardians as sg")
      .join("parents as p", "sg.guardian_id", "p.id")
      .join("students as s", "sg.student_id", "s.id")
      .where({ "p.user_id": user.id })
      .whereIn("sg.student_id", targeting.students);
    if (targeting.tenants?.length) {
      gq = gq.whereIn("s.tenant_id", targeting.tenants);
    }
    const hasRelation = await gq.clone().first();
    results.push(!!hasRelation);
  }

  if (results.length === 0) return true;

  return results.every(r => r === true);
}

// Get my scoped list of tenants (for targeting UI)
export async function getScopedTenants(user: any): Promise<any[]> {
  let query = kdb("tenants").select("id", "name");

  if (user.role === 'supervisor' || user.role === 'priest') {
    const tenantIds = user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("id", tenantIds);
  } else if (user.role === 'bishop') {
    query = query.where({ bishop_id: user.id });
  }

  return query.orderBy("name");
}

// Get scoped list of colleges (for targeting UI)
export async function getScopedColleges(user: any, selectedTenantIds?: string[]): Promise<string[]> {
  let query = kdb("students").distinct("college").whereNotNull("college").where("college", "!=", "");

  if (user.role === 'supervisor' || user.role === 'priest') {
    const tenantIds = user.role === 'supervisor'
      ? (user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []))
      : await getPriestTenantIds(user.id);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("tenant_id", ids);
  }

  if (selectedTenantIds?.length) {
    query = query.whereIn("tenant_id", selectedTenantIds);
  }

  const rows = await query;
  return rows.map((r: any) => r.college).filter(Boolean);
}

// Get scoped list of governorates
export async function getScopedGovernorates(user: any, selectedTenantIds?: string[]): Promise<string[]> {
  let query = kdb("students").distinct("governorate").whereNotNull("governorate").where("governorate", "!=", "");

  if (user.role === 'supervisor' || user.role === 'priest') {
    const tenantIds = user.role === 'supervisor'
      ? (user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []))
      : await getPriestTenantIds(user.id);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("tenant_id", ids);
  }

  if (selectedTenantIds?.length) {
    query = query.whereIn("tenant_id", selectedTenantIds);
  }

  const rows = await query;
  return rows.map((r: any) => r.governorate).filter(Boolean);
}

// Get scoped list of churches
export async function getScopedChurches(user: any, selectedTenantIds?: string[]): Promise<string[]> {
  let query = kdb("students").distinct("church_name").whereNotNull("church_name").where("church_name", "!=", "");

  if (user.role === 'supervisor' || user.role === 'priest') {
    const tenantIds = user.role === 'supervisor'
      ? (user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []))
      : await getPriestTenantIds(user.id);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("tenant_id", ids);
  }

  if (selectedTenantIds?.length) {
    query = query.whereIn("tenant_id", selectedTenantIds);
  }

  const rows = await query;
  return rows.map((r: any) => r.church_name).filter(Boolean);
}

async function getPriestTenantIds(priestUserId: string): Promise<string[]> {
  const assignments = await kdb("user_tenant_assignments")
    .where({ user_id: priestUserId })
    .select("tenant_id");
  return assignments.map((a: any) => a.tenant_id);
}

// Get scoped students (for targeting UI search)
export async function getScopedStudents(user: any, search: string, selectedTenantIds?: string[]): Promise<any[]> {
  let query = kdb("students as s")
    .join("users as u", "s.user_id", "u.id")
    .select("s.id", "s.user_id", "u.name", "s.college", "s.governorate", "s.tenant_id", "s.is_graduate")
    .where("u.name", "like", `%${search}%`)
    .limit(20);

  if (user.role === 'supervisor' || user.role === 'priest') {
    const tenantIds = user.role === 'supervisor'
      ? (user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []))
      : await getPriestTenantIds(user.id);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("s.tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("s.tenant_id", ids);
  }

  // Apply additional tenant filter from selected tenants in UI
  if (selectedTenantIds?.length) {
    query = query.whereIn("s.tenant_id", selectedTenantIds);
  }

  return query;
}

// Get scoped parents (for private message recipient search)
export async function getScopedParents(user: any, search: string): Promise<any[]> {
  let query = kdb("parents as p")
    .join("users as u", "p.user_id", "u.id")
    .select("p.id", "p.user_id", "u.name", "p.tenant_id")
    .where("u.name", "like", `%${search}%`)
    .limit(20);

  if (user.role === 'supervisor' || user.role === 'assistant_supervisor' || user.role === 'priest') {
    const tenantIds = user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("p.tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const ids = (await kdb("tenants").where({ bishop_id: user.id }).select("id")).map((t: any) => t.id);
    if (ids.length === 0) return [];
    query = query.whereIn("p.tenant_id", ids);
  }

  const rows = await query;
  const parents: any[] = [];
  for (const r of rows) {
    const children = await kdb("student_guardians as sg")
      .join("students as s", "sg.student_id", "s.id")
      .join("users as su", "s.user_id", "su.id")
      .where("sg.guardian_id", r.id)
      .select("su.name", "s.id as student_id", "s.is_graduate")
      .limit(5);
    parents.push({ ...r, children });
  }
  return parents;
}

// Get the tenant ids the sender can address (for private message recipient validation)
export async function getSenderTenantIds(user: any): Promise<string[]> {
  if (user.role === 'admin') {
    return (await kdb("tenants").select("id")).map((t: any) => t.id);
  }
  if (user.role === 'supervisor' || user.role === 'assistant_supervisor' || user.role === 'priest') {
    return user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []);
  }
  if (user.role === 'bishop') {
    return (await kdb("tenants").where({ bishop_id: user.id }).select("id")).map((t: any) => t.id);
  }
  return [];
}

// قص قائمة السكنات المستهدفة إلى نطاق المرسل (لا يجوز استهداف سكنات خارج النطاق)
export async function clampTargetingTenants(user: any, tenants: any[] | undefined | null): Promise<any[]> {
  if (!tenants || tenants.length === 0) return tenants || [];
  if (user.role === 'admin') return tenants;
  const allowed = await getSenderTenantIds(user);
  if (allowed.length === 0) return [];
  return tenants.filter((t: any) => allowed.includes(t));
}

// Get scoped bishops (for targeting UI)
export async function getScopedBishops(user: any, selectedTenantIds?: string[]): Promise<any[]> {
  if (user.role !== 'admin') return [];
  let query = kdb("users").select("id", "name").where({ role: "bishop" }).orderBy("name");
  if (selectedTenantIds?.length) {
    query = query.whereIn("id", function() {
      this.select("bishop_id").from("tenants").whereIn("id", selectedTenantIds!).whereNotNull("bishop_id");
    });
  }
  return query;
}

// Get scoped priests (for targeting UI)
export async function getScopedPriests(user: any, selectedTenantIds?: string[]): Promise<any[]> {
  let query = kdb("users").select("id", "name", "tenant_id").where({ role: "priest" });

  if (user.role === 'supervisor' || user.role === 'priest') {
    const tenantIds = user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("tenant_id", ids);
  }

  if (selectedTenantIds?.length) {
    query = query.whereIn("tenant_id", selectedTenantIds);
  }

  return query.orderBy("name");
}

// Get scoped supervisors (for targeting UI)
export async function getScopedSupervisors(user: any, selectedTenantIds?: string[]): Promise<any[]> {
  let query = kdb("users").select("id", "name", "tenant_id").where({ role: "supervisor" });

  if (user.role === 'supervisor') {
    const tenantIds = user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []);
    if (tenantIds.length === 0) return [];
    query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'priest') {
    const tenantIds = await getPriestTenantIds(user.id);
    if (tenantIds.length > 0) query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("tenant_id", ids);
  }

  if (selectedTenantIds?.length) {
    query = query.whereIn("tenant_id", selectedTenantIds);
  }

  return query.orderBy("name");
}

// Get scoped employees (for targeting UI)
export async function getScopedEmployees(user: any, selectedTenantIds?: string[]): Promise<any[]> {
  let query = kdb("users").select("id", "name", "tenant_id").where({ role: "employee" });

  if (user.role === 'supervisor' || user.role === 'priest') {
    let tenantIds: string[];
    if (user.role === 'supervisor') {
      tenantIds = user.tenantIds?.length ? user.tenantIds : (user.tenantId ? [user.tenantId] : []);
    } else {
      tenantIds = await getPriestTenantIds(user.id);
    }
    if (tenantIds.length === 0) return [];
    query = query.whereIn("tenant_id", tenantIds);
  } else if (user.role === 'bishop') {
    const tenantIds = await kdb("tenants").where({ bishop_id: user.id }).select("id");
    const ids = tenantIds.map((t: any) => t.id);
    if (ids.length > 0) query = query.whereIn("tenant_id", ids);
  }

  if (selectedTenantIds?.length) {
    query = query.whereIn("tenant_id", selectedTenantIds);
  }

  return query.orderBy("name");
}

// Get scoped guardian relation types (dynamic from DB)
export async function getScopedGuardianRelations(user: any, selectedTenantIds?: string[]): Promise<string[]> {
  let query = kdb("student_guardians")
    .distinct("relation_type")
    .whereNotNull("relation_type")
    .orderBy("relation_type");

  if (selectedTenantIds?.length) {
    query = query
      .join("students", "student_guardians.student_id", "students.id")
      .whereIn("students.tenant_id", selectedTenantIds);
  }

  const rows = await query;
  return rows.map((r: any) => r.relation_type).filter(Boolean);
}

// Estimate recipient count for a targeting config
export async function estimateRecipientCount(targeting: Targeting): Promise<number> {
  const hasExclude = targeting.exclude_students || targeting.exclude_parents || targeting.exclude_employees ||
    targeting.exclude_supervisors || targeting.exclude_priests || targeting.exclude_bishops;

  // ط§ظ„ط£ظˆظ„ظˆظٹط© 1: ظ„ظˆ ظپظٹ guardian_types â†’ ط¹ط¯ ط£ظˆظ„ظٹط§ط، ط§ظ„ط£ظ…ظˆط± ط§ظ„ظ…ط·ط§ط¨ظ‚ظٹظ†
  if (targeting.guardian_types?.length || targeting.parent_gender) {
    const types = targeting.guardian_types || (targeting.parent_gender ? [targeting.parent_gender] : []);
    const hasBrotherSister = types.includes('brother') || types.includes('sister');
    const siblingGenders = hasBrotherSister && targeting.sibling_genders?.length
      ? targeting.sibling_genders
      : null;

    let query = kdb("student_guardians as sg")
      .join("parents as p", "sg.guardian_id", "p.id")
      .whereIn("sg.relation_type", types);

    if (siblingGenders) {
      query = query
        .join("students as s", "sg.student_id", "s.id")
        .whereIn("s.gender", siblingGenders);
    }

    if (targeting.tenants?.length) {
      query = query.whereIn("p.tenant_id", targeting.tenants);
    }

    // ظ„ظˆ ظپظٹ exclude ظ„ظ€ students -> ظ†ط¶ظٹظپ ط´ط±ط· ط£ظ† ط§ظ„ظˆطµظٹ ظ„ظ‡ ط·ط§ظ„ط¨ ظ…ط®طھط§ط± (ط¥ط°ط§ ظƒط§ظ† students ظ…ط­ط¯ط¯)
    if (targeting.students?.length) {
      query = query.whereIn("sg.student_id", targeting.students);
    }

    const count = await query.clone().countDistinct("p.user_id as total").first();
    return Number(count?.total || 0);
  }

  // Graduate targeting: graduates + parents of graduates/parents of selected students
  const graduateTargeting = targeting.graduates_only || targeting.graduate_parents_only ||
    (targeting.selected_student_parents && targeting.students?.length);
  if (graduateTargeting) {
    let total = 0;

    // a) Number of graduate students targeted
    if (targeting.graduates_only) {
      let q = kdb("students as s").where("s.is_graduate", 1);
      if (targeting.tenants?.length) q = q.whereIn("s.tenant_id", targeting.tenants);
      const c = await q.clone().countDistinct("s.id as total").first();
      total += Number(c?.total || 0);
    }

    // b) Number of selected students themselves (when specific students are picked)
    if (targeting.students?.length && !targeting.graduates_only) {
      let q = kdb("students").whereIn("id", targeting.students);
      if (targeting.tenants?.length) q = q.whereIn("tenant_id", targeting.tenants);
      const c = await q.clone().countDistinct("id as total").first();
      total += Number(c?.total || 0);
    }

    // c) Parents of graduates / parents of selected students
    if (targeting.graduate_parents_only || (targeting.selected_student_parents && targeting.students?.length)) {
      let q = kdb("student_guardians as sg")
        .join("parents as p", "sg.guardian_id", "p.id")
        .join("students as s", "sg.student_id", "s.id");
      if (targeting.graduate_parents_only) {
        q = q.where("s.is_graduate", 1);
      }
      if (targeting.selected_student_parents && targeting.students?.length) {
        q = q.whereIn("sg.student_id", targeting.students);
      }
      if (targeting.tenants?.length) {
        q = q.whereIn("s.tenant_id", targeting.tenants);
      }
      const c = await q.clone().countDistinct("p.user_id as total").first();
      total += Number(c?.total || 0);
    }

    return total;
  }

  // ط§ظ„ط£ظˆظ„ظˆظٹط© 2: ظ„ظˆ ظپظٹ exclude flags ط¨ط³ â†’ ط¹ط¯ ط§ظ„ظƒظ„ ظ…ط§ ط¹ط¯ط§ ط§ظ„ظ…ط³طھط¨ط¹ط¯ظٹظ†
  if (hasExclude) {
    const excludedRoles: string[] = [];
    if (targeting.exclude_students) excludedRoles.push('student');
    if (targeting.exclude_parents) excludedRoles.push('parent');
    if (targeting.exclude_employees) excludedRoles.push('employee');
    if (targeting.exclude_supervisors) excludedRoles.push('supervisor');
    if (targeting.exclude_priests) excludedRoles.push('priest');
    if (targeting.exclude_bishops) excludedRoles.push('bishop');

    let query = kdb("users");
    if (excludedRoles.length > 0) {
      query = query.whereNotIn("role", excludedRoles);
    }
    if (targeting.tenants?.length) {
      query = query.whereIn("tenant_id", targeting.tenants);
    }
    const count = await query.clone().count("id as total").first();
    return Number(count?.total || 0);
  }

  // ط§ظ„ط£ظˆظ„ظˆظٹط© 3: ظ„ظˆ ظ…ط§ ظپظٹط´ ط£ظٹ targeting â†’ ط¹ط¯ ط§ظ„ط·ظ„ط§ط¨ ظپظ‚ط·
  if (!targeting || Object.keys(targeting).length === 0) {
    const count = await kdb("users").where({ role: "student" }).count("id as total").first();
    return Number(count?.total || 0);
  }

  // ط§ظ„ط£ظˆظ„ظˆظٹط© 4: ط¹ط¯ ط§ظ„ط·ظ„ط§ط¨ ط¨ظ†ط§ط،ظ‹ ط¹ظ„ظ‰ ط¨ط§ظ‚ظٹ ط§ظ„ظپظ„ط§طھط±
  let studentQuery = kdb("students as s")
    .join("users as u", "s.user_id", "u.id")
    .where("u.role", "student");

  if (targeting.tenants && targeting.tenants.length > 0) {
    studentQuery = studentQuery.whereIn("s.tenant_id", targeting.tenants);
  }
  if (targeting.colleges && targeting.colleges.length > 0) {
    studentQuery = studentQuery.whereIn("s.college", targeting.colleges);
  }
  if (targeting.majors && targeting.majors.length > 0) {
    studentQuery = studentQuery.whereIn("s.major", targeting.majors);
  }
  if (targeting.governorates && targeting.governorates.length > 0) {
    studentQuery = studentQuery.whereIn("s.governorate", targeting.governorates);
  }
  if (targeting.churches && targeting.churches.length > 0) {
    studentQuery = studentQuery.whereIn("s.church_name", targeting.churches);
  }
  if (targeting.students && targeting.students.length > 0) {
    studentQuery = studentQuery.whereIn("s.id", targeting.students);
  }
  if (targeting.bishops && targeting.bishops.length > 0) {
    studentQuery = studentQuery.whereIn("s.tenant_id", function() {
      this.select("id").from("tenants").whereIn("bishop_id", targeting.bishops!);
    });
  }
  if (targeting.priests && targeting.priests.length > 0) {
    studentQuery = studentQuery.whereIn("s.tenant_id", function() {
      this.select("tenant_id").from("users").whereIn("id", targeting.priests!).andWhere({ role: "priest" });
    });
  }
  if (targeting.supervisors && targeting.supervisors.length > 0) {
    studentQuery = studentQuery.whereIn("s.tenant_id", function() {
      this.select("tenant_id").from("users").whereIn("id", targeting.supervisors!).andWhere({ role: "supervisor" });
    });
  }
  if (targeting.employees && targeting.employees.length > 0) {
    studentQuery = studentQuery.whereIn("s.tenant_id", function() {
      this.select("tenant_id").from("users").whereIn("id", targeting.employees!).andWhere({ role: "employee" });
    });
  }

  const count = await studentQuery.clone().count("s.id as total").first();
  return Number(count?.total || 0);
}

// Get active broadcasts for a specific user (ظ…ط¹ ط¹ط²ظ„ ط§ظ„ظ†ط·ط§ظ‚ ظˆط§ظ„ط±ط¤ظٹط©)
export async function getUserBroadcasts(user: any, displayType?: string) {
  const now = new Date().toISOString();

  let query = kdb("broadcasts as b")
    .join("users as u", "b.sender_id", "u.id")
    .select("b.*", "u.name as sender_name", "u.tenant_id as sender_tenant_id")
    .where("b.status", "active")
    .where(function() {
      this.whereNull("b.start_at").orWhere("b.start_at", "<=", now);
    })
    .where(function() {
      this.whereNull("b.end_at").orWhere("b.end_at", ">=", now);
    })
    .orderBy("b.priority", "desc")
    .orderBy("b.created_at", "desc")
    .limit(50);

  const broadcasts = await query;

  const matched: any[] = [];
  for (const b of broadcasts) {
    const targeting = typeof b.targeting === 'string' ? JSON.parse(b.targeting) : (b.targeting || {});

    // 1. ظپط­طµ ط¹ط²ظ„ ط§ظ„ظ†ط·ط§ظ‚: ط§ظ„ط±ط³ط§ط¦ظ„ طھطھط¯ظپظ‚ ظ„ظ„ط£ط³ظپظ„ ظپظ‚ط·
    const isPrivate = b.private_recipient_id != null;
    // private messages are visible only to the sender and the recipient (no hierarchy scoping)
    if (isPrivate) {
      if (b.private_recipient_id !== user.id && b.sender_id !== user.id) continue;
    } else if (!passesScopeIsolation(user, b.sender_role, targeting, b.sender_tenant_id)) {
      continue;
    }

    // 2. ظپط­طµ ط§ظ„ط±ط¤ظٹط© ط­ط³ط¨ ط§ظ„ظ‚ظ†ط§ط©
    if (displayType === 'news' && !b.visible_in_ticker) continue;
    if (displayType === 'messages' && !b.visible_in_messages) continue;

    // 3. ظپط­طµ ط´ط±ظˆط· ط§ظ„ط§ط³طھظ‡ط¯ط§ظپ (ط§ظ„ظ…ط±ط³ظ„ ظٹط´ظˆظپ ط±ط³ط§ظ„طھظ‡ ط¯ط§ظٹظ…ط§ظ‹ ط²ظٹ ط¨ط§ظ‚ظٹ ط§ظ„ظ†ط§ط³)
    if (b.sender_id === user.id || (isPrivate ? b.private_recipient_id === user.id : false) || await userMatchesTargeting(user, targeting)) {
      const attachments = await kdb("broadcast_attachments").where({ broadcast_id: b.id }).select("*");
      matched.push({ ...b, visible_in_ticker: b.visible_in_ticker ? 1 : 0, visible_in_messages: b.visible_in_messages ? 1 : 0, targeting, attachments });
    }
  }

  return matched;
}
