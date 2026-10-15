import { kdb } from "../infrastructure/db";
import { runLockCheck, reEscalateUnacked, lockDateString } from "./absenceLock.service";

/**
 * In-process scheduler for the lock-time absence check.
 *
 * There is no external job runner in this deployment, so a single lightweight
 * interval drives the nightly check: every minute it looks for dorms whose
 * curfew time has just passed and runs the (idempotent) check once per dorm per
 * day, then re-escalates any case still unacknowledged. The unique index on the
 * cases table guarantees correctness even if this runs twice (restart, overlap).
 *
 * Disabled under NODE_ENV=test and when ABSENCE_SCHEDULER_DISABLED=1 so tests
 * and one-off scripts never write presence/case rows as a side effect.
 */

const TICK_MS = 60_000;

function minutesOfDay(hhmm: string): number | null {
  const [h, m] = String(hhmm).split(":");
  const hh = parseInt(h, 10);
  const mm = parseInt(m || "0", 10);
  if (!Number.isFinite(hh) || hh < 0 || hh > 23) return null;
  if (!Number.isFinite(mm) || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

let timer: ReturnType<typeof setInterval> | null = null;
const lastRunDate = new Map<string, string>();

async function tick(): Promise<void> {
  const now = new Date();
  const today = lockDateString(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let tenants: any[] = [];
  try {
    tenants = await kdb("tenants").whereNotNull("curfew_time").select("id", "curfew_time");
  } catch {
    return; // DB not ready yet — try again next tick
  }

  for (const tenant of tenants) {
    const lockMinutes = minutesOfDay(tenant.curfew_time);
    if (lockMinutes === null) continue;
    if (nowMinutes < lockMinutes) continue;

    try {
      if (lastRunDate.get(tenant.id) !== today) {
        await runLockCheck({ tenantId: tenant.id, lockDate: today, now });
        lastRunDate.set(tenant.id, today);
      } else {
        await reEscalateUnacked({ tenantId: tenant.id, now });
      }
    } catch (e: any) {
      console.error("Absence scheduler tick failed for tenant", tenant.id, e?.message || e);
    }
  }
}

export function startAbsenceScheduler(): void {
  if (process.env.NODE_ENV === "test" || process.env.ABSENCE_SCHEDULER_DISABLED === "1") return;
  if (timer) return;
  timer = setInterval(() => { void tick(); }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  // First pass shortly after boot so a server started after curfew still checks.
  setTimeout(() => { void tick(); }, 15_000).unref?.();
  console.log("Absence scheduler started (lock-time check every 60s)");
}

export function stopAbsenceScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
