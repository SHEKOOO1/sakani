// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

// ───────────────────────────────────────────────────────────────
// RoomsPage regressions:
//  - search is sent to the API (full data set), not applied to the
//    currently loaded page
//  - a new search resets pagination to page 1
//  - a slower/older response must not overwrite a newer one
// ───────────────────────────────────────────────────────────────

const { roomsCalls, request } = vi.hoisted(() => {
  const roomsCalls: { url: string; resolve: (v: any) => void }[] = [];
  const request = (url: string) => {
    if (url.startsWith('/api/apartments')) return Promise.resolve({ data: [] });
    return new Promise((resolve) => { roomsCalls.push({ url, resolve }); });
  };
  return { roomsCalls, request };
});

vi.mock('../hooks/useApi', () => ({
  useApi: () => ({ request }),
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

vi.mock('../contexts/SnackbarContext', () => ({
  useSnackbar: () => ({ showSnackbar: vi.fn() }),
}));

vi.mock('motion/react', () => ({
  motion: new Proxy({}, { get: () => ({ initial: _i, animate: _a, transition: _t, ...rest }: any) => <div {...rest} /> }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

vi.mock('../components/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
vi.mock('../components/rooms/RoomFormModal', () => ({ RoomFormModal: () => null }));

import { RoomsPage } from '../components/RoomsPage';

const room = (id: string, number: string) => ({ id, room_number: number, apartment_id: 'a1', capacity: 2, current_occupancy: 0 });

const flush = () => act(async () => { await Promise.resolve(); });

beforeEach(() => {
  roomsCalls.length = 0;
});

describe('RoomsPage', () => {
  it('sends the search term + page 1 to the API and shows server results', async () => {
    render(<RoomsPage />);
    await flush();
    roomsCalls[0].resolve({ data: [room('r1', 'R1')], total: 45, totalPages: 3 });
    await flush();

    // Move off page 1, then search.
    fireEvent.click(screen.getByText('2'));
    await flush();

    fireEvent.change(screen.getByPlaceholderText('البحث برقم الغرفة...'), { target: { value: 'A' } });
    await act(async () => { await new Promise((r) => setTimeout(r, 500)); });

    const searched = roomsCalls.filter((c) => c.url.includes('search=A'));
    expect(searched.length).toBeGreaterThan(0);
    // Pagination was reset to the first page for the new search.
    expect(searched[searched.length - 1].url).toContain('page=1');

    // The server result is rendered (no local page-only filtering).
    searched[searched.length - 1].resolve({ data: [room('r9', 'R9-SEARCHED')], total: 1, totalPages: 1 });
    await flush();
    expect(screen.getByText('غرفة R9-SEARCHED')).toBeTruthy();
  });

  it('ignores a stale response that resolves after a newer request', async () => {
    render(<RoomsPage />);
    await flush();
    roomsCalls[0].resolve({ data: [room('r1', 'R1')], total: 45, totalPages: 3 });
    await flush();

    fireEvent.click(screen.getByText('2'));   // request A (older)
    await flush();
    fireEvent.click(screen.getByText('3'));   // request B (newer)
    await flush();

    // Newer request resolves first, then the older one arrives late.
    roomsCalls[2].resolve({ data: [room('r3', 'R3-NEW')], total: 45, totalPages: 3 });
    await flush();
    roomsCalls[1].resolve({ data: [room('r2', 'R2-STALE')], total: 45, totalPages: 3 });
    await flush();

    expect(screen.getByText('غرفة R3-NEW')).toBeTruthy();
    expect(screen.queryByText('غرفة R2-STALE')).toBeNull();
  });
});
