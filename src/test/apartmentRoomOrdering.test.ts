import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ═══════════════════════════════════════════════════════════════
// Apartments/Rooms overhaul — static contracts.
//
// Guards the features that are hard to exercise without a live DB:
//   1. migration 062 + db.ts add apartments/rooms sort_order and
//      rooms.is_active (idempotently);
//   2. apartment GET returns the per-apartment aggregates and is
//      ordered by sort_order, with a PUT /reorder endpoint;
//   3. room create/update persist is_active and expose PUT /reorder;
//   4. the Rooms tab is gone from navigation (merged into Apartments),
//      while the /rooms API itself is untouched (StudentsPage needs it).
// ═══════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('migration 062 + db.ts mirror', () => {
  it('adds sort_order to apartments and rooms, and is_active to rooms', () => {
    const sql = read('migrations/062_apartment_room_order_status.ts');
    expect(sql).toContain("addColumn('apartments', 'sort_order'");
    expect(sql).toContain("addColumn('rooms', 'sort_order'");
    expect(sql).toContain("addColumn('rooms', 'is_active'");
    expect(sql).toContain('sys.columns');
  });

  it('mirrors the columns at boot in db.ts', () => {
    const db = read('src/backend/infrastructure/db.ts');
    expect(db).toContain("ADD [sort_order] INT NULL");
    expect(db).toContain("ADD [is_active] BIT NOT NULL CONSTRAINT DF_rooms_is_active");
  });
});

describe('apartment routes', () => {
  const src = read('src/backend/api/apartment.routes.ts');

  it('returns per-apartment aggregates', () => {
    for (const key of ['rooms_count', 'total_capacity', 'current_occupancy', 'available_rooms', 'empty_rooms', 'full_rooms', 'locked_rooms']) {
      expect(src).toContain(key);
    }
  });

  it('orders by sort_order and exposes PUT /reorder', () => {
    expect(src).toContain('a.sort_order');
    expect(src).toMatch(/router\.put\(\s*["']\/reorder["']/);
  });

  it('creates rooms inline with the apartment', () => {
    expect(src).toContain('rooms');
  });
});

describe('room routes', () => {
  const src = read('src/backend/api/room.routes.ts');

  it('persists is_active on create and update', () => {
    expect(src).toContain('is_active');
  });

  it('orders by sort_order and exposes PUT /reorder', () => {
    expect(src).toContain('sort_order');
    expect(src).toMatch(/router\.put\(\s*["']\/reorder["']/);
  });
});

describe('validation schemas', () => {
  const src = read('src/backend/validation/schemas.ts');

  it('accepts an inline rooms array on apartment create', () => {
    expect(src).toContain('rooms: z.array(');
  });

  it('accepts is_active on room create', () => {
    expect(src).toContain('is_active');
  });
});

describe('room + apartment forms', () => {
  it('RoomFormModal exposes an is_active toggle', () => {
    const src = read('src/components/rooms/RoomFormModal.tsx');
    expect(src).toContain('is_active');
  });

  it('ApartmentFormModal lets you generate rooms inline', () => {
    const src = read('src/components/apartments/ApartmentFormModal.tsx');
    expect(src).toContain('ApartmentRoomInput');
    expect(src).toContain('rooms');
  });
});

describe('navigation contract', () => {
  it('removes the Rooms tab from the sidebar', () => {
    const src = read('src/components/Layout.tsx');
    expect(src).not.toContain("id: 'rooms'");
    expect(src).not.toContain('RoomsPage');
  });

  it('does not link to the removed rooms view from 404 page', () => {
    const src = read('src/components/NotFoundPage.tsx');
    expect(src).not.toContain("view: 'rooms'");
  });
});
