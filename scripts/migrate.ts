import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';
import config from '../knexfile';
import { assertProductionDbConfig, describeDbConfigRejection } from '../src/backend/config/db-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const action = process.argv[2] || 'latest';

// P0-4: reuse the shared connection config (single source of truth). Production
// uses TLS with certificate validation and NO `sa`/localhost fallback; it also
// fails closed on missing/weak credentials before any migration runs.
const envName = process.env.NODE_ENV === 'production' ? 'production' : 'development';
if (envName === 'production') {
  const dbConfigCheck = assertProductionDbConfig(process.env);
  if (!dbConfigCheck.ok) {
    console.error(
      `❌ Database configuration ${describeDbConfigRejection(dbConfigCheck)}. Refusing to run migrations in production.`,
    );
    process.exit(1);
  }
}

const db = knex((config as any)[envName]);

async function run() {
  try {
    switch (action) {
      case 'latest':
        const [batch, migrations] = await db.migrate.latest();
        console.log(`✅ Migrations up: batch ${batch}, ${migrations.length} file(s)`);
        migrations.forEach(m => console.log(`   ${m}`));
        break;
      case 'up':
        const upRes = await db.migrate.up();
        console.log(`✅ Migrated up:`, upRes);
        break;
      case 'down':
        const downRes = await db.migrate.down();
        console.log(`✅ Migrated down:`, downRes);
        break;
      case 'status':
        const status = await db.migrate.status();
        console.log(`📊 Migration status:`, status);
        break;
      case 'make':
        const name = process.argv[3];
        if (!name) { console.error('❌ Usage: migrate make <name>'); process.exitCode = 1; break; }
        const result = await db.migrate.make(name, {
          directory: path.resolve(process.cwd(), 'migrations'),
          extension: 'ts',
        });
        console.log(`✅ Created migration: ${result}`);
        break;
      default:
        console.error(`❌ Unknown action: ${action}. Use: latest, up, down, status, make`);
        process.exitCode = 1;
    }
  } catch (err) {
    // P1-DB-3: a failed migration must produce a non-zero exit code so CI and
    // operators can detect it instead of seeing a false success.
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

run();
