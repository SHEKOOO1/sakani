-- verify-ledger.sql — reconciliation for the double-entry ledger (دفتر الأستاذ).
--
-- Run it against the application database, e.g.
--   sqlcmd -S localhost,1433 -U <user> -P <password> -d <db> -f 65001 -i ops/verify-ledger.sql -W -s " | "
-- (-f 65001 keeps the Arabic penalty prefix below readable as UTF-8.)
--
-- Every row must report violations = 0 and ok = 1. A non-zero row means the
-- ledger no longer mirrors `finances` or is internally inconsistent: stop and
-- investigate before writing anything else, the ledger is the source of truth
-- for every report as of Phase 4.
--
-- Kept in sync with scripts/backfill-ledger.ts --verify-only, which runs the
-- same rules from the app's own connection config.

SET NOCOUNT ON;

;WITH checks AS (
  -- 1. Every balanced pair: sum(debit) = sum(credit) per entry.
  SELECT 'ledger balanced' AS check_name,
         (SELECT COUNT(*)
            FROM (SELECT e.id
                    FROM journal_entries e
                    JOIN journal_lines l ON l.entry_id = e.id
                   GROUP BY e.id
                  HAVING SUM(l.debit) <> SUM(l.credit)) x) AS violations

  UNION ALL

  -- 2. The header amount equals the sum of its lines (both sides).
  SELECT 'entry amount == line total',
         (SELECT COUNT(*)
            FROM (SELECT e.id
                    FROM journal_entries e
                    JOIN journal_lines l ON l.entry_id = e.id
                   GROUP BY e.id, e.amount
                  HAVING SUM(l.debit) <> e.amount OR SUM(l.credit) <> e.amount) x)

  UNION ALL

  -- 3. No line without an entry (FK journal_lines_entry enforces this; kept as
  --    a cheap tripwire if the constraint is ever dropped).
  SELECT 'no orphan lines',
         (SELECT COUNT(*) FROM journal_lines l
           WHERE NOT EXISTS (SELECT 1 FROM journal_entries e WHERE e.id = l.entry_id))

  UNION ALL

  -- 4. Each legacy finances row maps to exactly one entry. The filtered unique
  --    index UQ_journal_entries_finance_id (migration 044) already forbids two;
  --    this catches zero, i.e. a row the backfill has not imported yet.
  SELECT 'every legacy row linked once',
         (SELECT COUNT(*)
            FROM finances f
           WHERE (SELECT COUNT(*) FROM journal_entries e WHERE e.finance_id = f.id) <> 1)

  UNION ALL

  -- 5. entry_type agrees with the classification rule the backfill applied.
  SELECT 'entry_type matches rule',
         (SELECT COUNT(*)
            FROM (SELECT f.id
                    FROM finances f
                    JOIN journal_entries e ON e.finance_id = f.id
                   WHERE e.entry_type <>
                         CASE
                           WHEN ISNULL(f.is_reversal, 0) = 1 THEN 'reversal'
                           WHEN f.type = 'revenue' THEN 'payment'
                           WHEN f.attendance_id IS NOT NULL
                             OR LTRIM(RTRIM(ISNULL(f.reference, ''))) LIKE 'event-rule:%'
                             OR LTRIM(RTRIM(ISNULL(f.category, ''))) LIKE N'غرامة%'
                             THEN 'penalty'
                           ELSE 'expense'
                         END) x)

  UNION ALL

  -- 6. The imported amount is the amount that was recorded.
  SELECT 'legacy amount preserved',
         (SELECT COUNT(*)
            FROM finances f
            JOIN journal_entries e ON e.finance_id = f.id
           WHERE ABS(e.amount - f.amount) > 0.005)

  UNION ALL

  -- 7. Class totals: what the legacy table says vs what the ledger says.
  SELECT 'sum payments matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(amount), 0) FROM finances
                     WHERE ISNULL(is_reversal, 0) = 0 AND type = 'revenue')
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                     WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'payment')
                 ) > 0.005 THEN 1 ELSE 0 END)

  UNION ALL

  SELECT 'sum expenses matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(amount), 0) FROM finances
                     WHERE ISNULL(is_reversal, 0) = 0 AND type = 'expense'
                       AND NOT (attendance_id IS NOT NULL
                                OR LTRIM(RTRIM(ISNULL(reference, ''))) LIKE 'event-rule:%'
                                OR LTRIM(RTRIM(ISNULL(category, ''))) LIKE N'غرامة%'))
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                     WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'expense')
                 ) > 0.005 THEN 1 ELSE 0 END)

  UNION ALL

  SELECT 'sum penalties matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(amount), 0) FROM finances
                     WHERE ISNULL(is_reversal, 0) = 0 AND type = 'expense'
                       AND (attendance_id IS NOT NULL
                            OR LTRIM(RTRIM(ISNULL(reference, ''))) LIKE 'event-rule:%'
                            OR LTRIM(RTRIM(ISNULL(category, ''))) LIKE N'غرامة%'))
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                     WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'penalty')
                 ) > 0.005 THEN 1 ELSE 0 END)

  UNION ALL

  SELECT 'sum reversals matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(amount), 0) FROM finances WHERE ISNULL(is_reversal, 0) = 1)
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                     WHERE e.source = 'legacy' AND e.status = 'posted' AND e.entry_type = 'reversal')
                 ) > 0.005 THEN 1 ELSE 0 END)
)
SELECT check_name,
       violations,
       CASE WHEN violations = 0 THEN 1 ELSE 0 END AS ok
  FROM checks
 ORDER BY ok, check_name;

-- Context the operator usually wants alongside the checks.
SELECT (SELECT COUNT(*) FROM journal_entries)                    AS entries,
       (SELECT COUNT(*) FROM journal_lines)                      AS lines,
       (SELECT COUNT(*) FROM finances)                           AS legacy_finances,
       (SELECT COUNT(*) FROM journal_entries
         WHERE finance_id IS NOT NULL)                           AS legacy_imported,
       (SELECT COUNT(*) FROM journal_entries
         WHERE source = 'legacy' AND reverses_entry_id IS NULL
           AND entry_type = 'reversal')                          AS unlinked_reversals,
       CAST((SELECT ISNULL(SUM(l.debit), 0) FROM journal_lines l) AS DECIMAL(18,2)) AS total_debit,
       CAST((SELECT ISNULL(SUM(l.credit), 0) FROM journal_lines l) AS DECIMAL(18,2)) AS total_credit;
