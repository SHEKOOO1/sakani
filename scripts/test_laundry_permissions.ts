/**
 * اختبار شامل لصلاحيات المغسلة عبر الأدوار المخصصة
 * يقوم هذا السكريبت بـ:
 * 1. التحقق من وجود جداول المغسلة
 * 2. فحص الأدوار المخصصة والصلاحيات المخزنة
 * 3. التحقق من تعيين الدور للموظف
 * 4. اختبار checkUserPermission مباشرة
 * 5. محاكاة طلبات API
 *
 * التشغيل: npx tsx test_laundry_permissions.ts
 */

import { kdb, checkUserPermission, hasPermission } from "./src/backend/infrastructure/db";
import { AppPermission } from "./src/types/permissions";

async function main() {
  console.log("=".repeat(80));
  console.log("🔍 اختبار صلاحيات المغسلة الشامل");
  console.log("=".repeat(80));

  // 1. فحص جداول المغسلة في قاعدة البيانات
  console.log("\n📋 1. فحص جداول المغسلة:");
  const tables = ['laundry_settings', 'laundry_machines', 'laundry_sessions', 'laundry_operators', 'laundry_queue'];
  for (const table of tables) {
    try {
      const exists = await kdb.schema.hasTable(table);
      console.log(`   ${exists ? '✅' : '❌'} ${table}: ${exists ? 'موجود' : 'مفقود!'}`);
      if (exists) {
        const count = await kdb(table).count('* as count').first();
        console.log(`      عدد السجلات: ${(count as any)?.count || 0}`);
      }
    } catch (e: any) {
      console.log(`   ❌ ${table}: خطأ - ${e.message}`);
    }
  }

  // 2. فحص الأدوار المخصصة
  console.log("\n📋 2. فحص الأدوار المخصصة:");
  try {
    const roles = await kdb('tenant_custom_roles').select('*');
    if (roles.length === 0) {
      console.log('   ⚠️ لا توجد أدوار مخصصة في قاعدة البيانات');
    }
    for (const role of roles) {
      let perms: string[] = [];
      try { perms = JSON.parse(role.permissions); } catch { perms = []; }
      console.log(`   📌 الدور: "${role.name}" (${role.id?.substring(0, 8)}...)`);
      console.log(`      المنشئ: ${role.created_by || 'غير محدد'}`);
      console.log(`      عدد الصلاحيات: ${perms.length}`);
      console.log(`      الصلاحيات: ${perms.join(', ')}`);
      console.log(`      لديه MANAGE_LAUNDRY: ${perms.includes('MANAGE_LAUNDRY') ? '✅' : '❌'}`);
      console.log(`      لديه JOIN_LAUNDRY: ${perms.includes('JOIN_LAUNDRY') ? '✅' : '❌'}`);
    }
  } catch (e: any) {
    console.log(`   ❌ خطأ: ${e.message}`);
  }

  // 3. فحص المستخدمين من فئة employee مع دور مخصص
  console.log("\n📋 3. فحص الموظفين المرتبطين بأدوار مخصصة:");
  try {
    const employees = await kdb('users')
      .select('id', 'name', 'email', 'role', 'custom_role_id', 'custom_permissions')
      .whereNotNull('custom_role_id');
    
    if (employees.length === 0) {
      console.log('   ⚠️ لا يوجد موظفين مرتبطين بأدوار مخصصة');
    }
    for (const emp of employees) {
      console.log(`   👤 الموظف: "${emp.name}" (${emp.email})`);
      console.log(`      الدور الأساسي: ${emp.role}`);
      console.log(`      custom_role_id: ${emp.custom_role_id || '❌ غير محدد'}`);
      console.log(`      custom_permissions: ${emp.custom_permissions || 'غير محدد'}`);

      // 4. اختبار checkUserPermission مباشرة
      console.log(`\n📋 4. اختبار checkUserPermission للموظف "${emp.name}":`);
      const laundryPerms: AppPermission[] = [
        AppPermission.MANAGE_LAUNDRY,
        AppPermission.JOIN_LAUNDRY,
        AppPermission.VIEW_LAUNDRY_QUEUE,
        AppPermission.MANAGE_LAUNDRY_OPERATORS,
        AppPermission.START_LAUNDRY_SESSION,
        AppPermission.CLOSE_LAUNDRY_SESSION,
      ];
      for (const perm of laundryPerms) {
        try {
          const result = await checkUserPermission(emp.id, perm);
          console.log(`   ${result ? '✅' : '❌'} ${perm}: ${result ? 'مسموح' : 'مرفوض'}`);
        } catch (e: any) {
          console.log(`   ⚠️ ${perm}: خطأ - ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    console.log(`   ❌ خطأ: ${e.message}`);
  }

  // 5. اختبار hasPermission للأدوار الأساسية (للتأكد من الـ fallback)
  console.log("\n📋 5. فحص صلاحيات الأدوار الأساسية (fallback):");
  const rolesToCheck = ['employee', 'supervisor', 'admin'];
  for (const role of rolesToCheck) {
    const result = await hasPermission(role, 'MANAGE_LAUNDRY');
    console.log(`   ${result ? '✅' : '❌'} ${role} -> MANAGE_LAUNDRY: ${result}`);
  }

  // 6. التحقق من أن السبب غير متعلق بفرق الحالة (case sensitivity)
  console.log("\n📋 6. التحقق من حالة الأحرف (case sensitivity):");
  try {
    const sampleRoles = await kdb('tenant_custom_roles').limit(1);
    if (sampleRoles.length > 0) {
      const rawPerms = sampleRoles[0].permissions;
      console.log(`   محتوى permissions الخام: ${rawPerms?.substring(0, 100)}...`);
      console.log(`   يحتوي على 'MANAGE_LAUNDRY': ${rawPerms?.includes('MANAGE_LAUNDRY') ? '✅' : '❌'}`);
      console.log(`   يحتوي على 'manage_laundry': ${rawPerms?.toLowerCase().includes('manage_laundry') ? '⚠️ (بحروف صغيرة)' : '❌'}`);
    }
  } catch (e: any) {
    console.log(`   ❌ خطأ: ${e.message}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("✅ انتهى الاختبار");
  console.log("=".repeat(80));

  // الخروج من العملية
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ فشل الاختبار:', e);
  process.exit(1);
});
