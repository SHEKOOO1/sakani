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

  -- 4. Every finances row is represented in the books, and never twice.
  --    Linked at least once: zero entries means a legacy row the backfill has
  --    not imported, or a write path that skipped postEntry. Applies to
  --    cancellation rows as well — attendance stamps the reversal entry with
  --    the cancellation row's id, which is also what stops a repair run from
  --    importing that cancellation a second time and refunding the money twice.
  --    Posted at most once: an edit reverses the previous entry before issuing
  --    its replacement, so two live entries on one row would double-count money.
  --    A reversed-only row is fine — that is a charge attendance has already
  --    cancelled, which the ledger settles by reversing the charge itself.
  --    (The link itself is constrained by UQ_journal_entries_legacy_finance,
  --    migration 045, for source = 'legacy'.)
  SELECT 'every row linked, never double-posted',
         (SELECT COUNT(*)
            FROM finances f
           WHERE ( (SELECT COUNT(*) FROM journal_entries e WHERE e.finance_id = f.id) < 1
                OR (SELECT COUNT(*) FROM journal_entries e
                     WHERE e.finance_id = f.id AND e.status = 'posted') > 1))

  UNION ALL

  -- 5. The live entry's type agrees with the classification rule the write
  --    paths apply. Posted entries only: a reversed one records what the row
  --    used to be, so its type is expected to differ from the row's current
  --    values after an edit.
  SELECT 'entry_type matches rule',
         (SELECT COUNT(*)
            FROM finances f
            JOIN journal_entries e ON e.finance_id = f.id AND e.status = 'posted'
           WHERE e.entry_type <>
                 CASE
                   WHEN ISNULL(f.is_reversal, 0) = 1 THEN 'reversal'
                   WHEN f.type = 'revenue' THEN 'payment'
                   WHEN f.attendance_id IS NOT NULL
                     OR LTRIM(RTRIM(ISNULL(f.reference, ''))) LIKE 'event-rule:%'
                     OR LTRIM(RTRIM(ISNULL(f.category, ''))) LIKE N'غرامة%'
                     THEN 'penalty'
                   ELSE 'expense'
                 END)

  UNION ALL

  -- 6. The live entry holds the amount the row currently records.
  SELECT 'legacy amount preserved',
         (SELECT COUNT(*)
            FROM finances f
            JOIN journal_entries e ON e.finance_id = f.id AND e.status = 'posted'
           WHERE ABS(e.amount - f.amount) > 0.005)

  UNION ALL

  -- 7. Class totals across the SAME population on both sides: a finances row
  --    paired with the live entry that stands for it.
  --
  --    Scoping matters. This is not a naive "sum the legacy table vs sum the
  --    books" comparison, because Phase 3 gives the two different vocabularies
  --    for the same event:
  --      - deleting a movement erases the legacy row but only reverses the
  --        entry, so the books would keep money the table no longer shows;
  --      - cancelling an attendance charge leaves both legacy rows while the
  --        ledger settles the pair with one reversal entry;
  --      - a reversal entry for an API edit or delete carries no finance_id at
  --        all, so counting every reversal would credit the books with movements
  --        that no longer have a legacy counterpart.
  --
  --    Restricting both sides to rows with a live linked entry makes the
  --    population identical, so any difference here is a real misclassification
  --    or a lost amount rather than a modelling artefact. Checks 4-6 catch the
  --    same faults row by row; these four exist to report them per class, which
  --    is what an operator triaging an imbalance actually wants to read.
  SELECT 'sum payments matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(f.amount), 0)
                      FROM finances f
                      JOIN journal_entries e ON e.finance_id = f.id AND e.status = 'posted'
                     WHERE ISNULL(f.is_reversal, 0) = 0 AND f.type = 'revenue')
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                      WHERE e.status = 'posted' AND e.finance_id IS NOT NULL
                        AND e.entry_type = 'payment')
                 ) > 0.005 THEN 1 ELSE 0 END)

  UNION ALL

  SELECT 'sum expenses matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(f.amount), 0)
                      FROM finances f
                      JOIN journal_entries e ON e.finance_id = f.id AND e.status = 'posted'
                     WHERE ISNULL(f.is_reversal, 0) = 0 AND f.type = 'expense'
                       AND NOT (f.attendance_id IS NOT NULL
                                OR LTRIM(RTRIM(ISNULL(f.reference, ''))) LIKE 'event-rule:%'
                                OR LTRIM(RTRIM(ISNULL(f.category, ''))) LIKE N'غرامة%'))
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                      WHERE e.status = 'posted' AND e.finance_id IS NOT NULL
                        AND e.entry_type = 'expense')
                 ) > 0.005 THEN 1 ELSE 0 END)

  UNION ALL

  SELECT 'sum penalties matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(f.amount), 0)
                      FROM finances f
                      JOIN journal_entries e ON e.finance_id = f.id AND e.status = 'posted'
                     WHERE ISNULL(f.is_reversal, 0) = 0 AND f.type = 'expense'
                       AND (f.attendance_id IS NOT NULL
                            OR LTRIM(RTRIM(ISNULL(f.reference, ''))) LIKE 'event-rule:%'
                            OR LTRIM(RTRIM(ISNULL(f.category, ''))) LIKE N'غرامة%'))
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                      WHERE e.status = 'posted' AND e.finance_id IS NOT NULL
                        AND e.entry_type = 'penalty')
                 ) > 0.005 THEN 1 ELSE 0 END)

  UNION ALL

  --    Both sides count only cancellation rows that carry a live entry: the
  --    backfill's own reversal entries, plus the ones attendance issues now
  --    that it stamps them with the cancellation row's id. A cancellation row
  --    not yet linked contributes nothing on either side and is caught by
  --    check 4 instead.
  SELECT 'sum reversals matches',
         (SELECT CASE WHEN ABS(
                   (SELECT ISNULL(SUM(f.amount), 0)
                      FROM finances f
                      JOIN journal_entries e ON e.finance_id = f.id AND e.status = 'posted'
                     WHERE ISNULL(f.is_reversal, 0) = 1)
                 - (SELECT ISNULL(SUM(e.amount), 0) FROM journal_entries e
                      WHERE e.status = 'posted' AND e.finance_id IS NOT NULL
                        AND e.entry_type = 'reversal')
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
         WHERE finance_id IS NOT NULL)                           AS linked_entries,
       (SELECT COUNT(*) FROM journal_entries
         WHERE status = 'posted')                                AS posted_entries,
       (SELECT COUNT(*) FROM journal_entries
         WHERE status = 'reversed')                              AS reversed_entries,
       (SELECT COUNT(*) FROM journal_entries
         WHERE source = 'legacy' AND reverses_entry_id IS NULL
           AND entry_type = 'reversal')                          AS unlinked_reversals,
       (SELECT COUNT(*) FROM finances f
         WHERE ISNULL(f.is_reversal, 0) = 0
           AND NOT EXISTS (SELECT 1 FROM journal_entries e
                            WHERE e.finance_id = f.id))          AS rows_never_imported,
       CAST((SELECT ISNULL(SUM(l.debit), 0) FROM journal_lines l) AS DECIMAL(18,2)) AS total_debit,
       CAST((SELECT ISNULL(SUM(l.credit), 0) FROM journal_lines l) AS DECIMAL(18,2)) AS total_credit;
