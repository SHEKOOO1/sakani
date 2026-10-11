import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Regression guard: `PUT /profile` must be declared BEFORE `PUT /:id`, otherwise
// Express matches `/profile` against the `:id` route (id="profile") and profile
// saves (phone + photo) fail with "User not found".
describe('user.routes route ordering', () => {
  it('declares PUT /profile before PUT /:id', () => {
    const src = fs.readFileSync(path.resolve(process.cwd(), 'src/backend/api/user.routes.ts'), 'utf8');
    const profileIdx = src.indexOf('router.put("/profile"');
    const idIdx = src.indexOf('router.put("/:id"');
    expect(profileIdx).toBeGreaterThan(-1);
    expect(idIdx).toBeGreaterThan(-1);
    expect(profileIdx).toBeLessThan(idIdx);
  });
});
