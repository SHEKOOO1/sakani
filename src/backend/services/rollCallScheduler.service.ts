import { kdb } from "../infrastructure/db";
import { lockDateString } from "./absenceLock.service";
import { minutesOfDay } from "./absenceScheduler.service";
import { startRollCall, broadcastRollCallOpened } from "./rollCall.service";

/**
 * In-process scheduler for the automatic night roll-call (المناداة).
 *
 * Every minute it looks for dorms whose curfew time has just passed and, once
 * per dorm per day, ensures the night's roll-call sheet exists and pushes it to
 * every non-traveling resident (real-time event + web push). Idempotent: the
 * unique index on (tenant, lock_date) and the `published_at` stamp guarantee a
 * given night is created and pushed only once, even across restarts/overlaps.
 *
 * This is the human-confirmed replacement for the legacy GPS-only lock check,
 * so it is DELIBERATELY independent of ABSENCE_SCHEDULER_DISABLED. It can still
 * be paused on its own with ROLL_CALL_SCHEDULER_DISABLED=1.
 */

const TICK_MS = 60_000;
const SYSTEM_USER = "system:roll-call";

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
    if (lastRunDate.get(tenant.id) === today) continue;

    try {
      // Ensure the sheet exists (idempotent) and push it if it has not been sent.
      const result = await startRollCall({ tenantId: tenant.id, userId: SYSTEM_USER, now });
      if (result && !result.published_at) {
        await broadcastRollCallOpened({ tenantId: tenant.id, rollCall: result });
      }
      lastRunDate.set(tenant.id, today);
    } catch (e: any) {
      console.error("Roll-call scheduler tick failed for tenant", tenant.id, e?.message || e);
    }
  }
}

export function startRollCallScheduler(): void {
  if (process.env.NODE_ENV === "test") return;
  if (process.env.ROLL_CALL_SCHEDULER_DISABLED === "1") return;
  if (timer) return;
  timer = setInterval(() => { void tick(); }, TICK_MS);
  if (typeof timer.unref === "function") timer.unref();
  // First pass shortly after boot so a server started after curfew still publishes.
  setTimeout(() => { void tick(); }, 15_000).unref?.();
  console.log("Roll-call scheduler started (auto night roll-call every 60s)");
}

export function stopRollCallScheduler(): void {
  if (timer) { clearInterval(timer); timer = null; }
}
