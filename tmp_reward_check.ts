import { kdb } from './src/backend/infrastructure/knex.ts';
(async () => {
  try {
    for (const t of ['rewards_definitions', 'student_rewards', 'badges', 'student_badges']) {
      const cols = await kdb('information_schema.columns as c')
        .select('c.column_name', 'c.data_type')
        .where({ table_name: t })
        .orderBy('c.ordinal_position');
      console.log('TABLE ' + t + ': ' + cols.map(c => c.column_name).join(', '));
    }
    const rc = await kdb('rewards_definitions').count('* as n').first();
    const sr = await kdb('student_rewards').count('* as n').first();
    const bg = await kdb('badges').count('* as n').first();
    console.log('ROWS rewards_definitions=' + rc.n + ' student_rewards=' + sr.n + ' badges=' + bg.n);
  } catch (e) {
    console.error('FATAL ' + String((e as any)?.message || e));
  } finally {
    await kdb.destroy();
  }
})();