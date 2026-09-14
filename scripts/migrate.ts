import knex from 'knex';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const action = process.argv[2] || 'latest';

const db = knex({
  client: 'mssql',
  connection: {
    server: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'DormMaster',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    instanceName: process.env.DB_INSTANCE || undefined,
    options: {
        encrypt: false,
        trustServerCertificate: true,
        enableArithAbort: true,
        connectTimeout: 30000,
      } as any,
  },
  pool: { min: 1, max: 10 },
  migrations: {
    directory: path.resolve(process.cwd(), 'migrations'),
    extension: 'ts',
  },
});

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
        if (!name) { console.error('❌ Usage: migrate make <name>'); break; }
        const result = await db.migrate.make(name, {
          directory: path.resolve(process.cwd(), 'migrations'),
          extension: 'ts',
        });
        console.log(`✅ Created migration: ${result}`);
        break;
      default:
        console.error(`❌ Unknown action: ${action}. Use: latest, up, down, status, make`);
    }
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await db.destroy();
  }
}

run();
