import fs from 'fs';
import path from 'path';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
const MAX_AGE_DAYS = 30;

function cleanDirectory(dir: string): { deleted: number; errors: number } {
  let deleted = 0;
  let errors = 0;
  const now = Date.now();

  if (!fs.existsSync(dir)) return { deleted, errors };

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        const sub = cleanDirectory(fullPath);
        deleted += sub.deleted;
        errors += sub.errors;
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
          console.log(`Removed empty directory: ${fullPath}`);
        }
      } else if (entry.isFile()) {
        const stats = fs.statSync(fullPath);
        const ageDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
        if (ageDays > MAX_AGE_DAYS) {
          fs.unlinkSync(fullPath);
          deleted++;
          console.log(`Deleted: ${fullPath} (${Math.round(ageDays)} days old)`);
        }
      }
    } catch (err) {
      errors++;
      console.error(`Error processing ${fullPath}:`, err);
    }
  }

  return { deleted, errors };
}

const result = cleanDirectory(UPLOADS_DIR);
console.log(`\nCleanup complete: ${result.deleted} files deleted, ${result.errors} errors`);
process.exit(0);
