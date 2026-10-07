import type { Knex } from 'knex';

/**
 * Double-entry ledger for the finance system (دفتر الأستاذ).
 *
 * Why this exists
 * ---------------
 * `finances` is a single-row-per-event table with no history: edits are UPDATE,
 * deletes are DELETE, and a penalty cancellation is written as `type='revenue'`
 * which then counts as a student PAYMENT in getStudentAccounts (inflating
 * totalPaid and shrinking remaining). The ledger fixes this by making every
 * movement an immutable, balanced pair of lines that can only be undone by an
 * explicit reversing entry.
 *
 * Chart of accounts
 * -----------------
 *   CASH            صندوق/نقدية                          (debit-normal asset)
 *   STUDENT_PAYMENT حساب الطالب — مديونية ودفعات الغرفة   (debit-normal asset)
 *   ROOM_REVENUE    إيراد الغرف                          (credit-normal revenue)
 *   PENALTY         إيراد الغرامات                       (credit-normal revenue)
 *   DISCOUNT        خصومات (contra-revenue)              (debit-normal)
 *   EXPENSE         مصروفات تشغيل السكن                  (debit-normal expense)
 *
 * Entry types and their balanced line pairs
 * -----------------------------------------
 *   invoice         DR STUDENT_PAYMENT  / CR ROOM_REVENUE
 *   payment         DR CASH             / CR STUDENT_PAYMENT
 *   expense         DR EXPENSE          / CR CASH
 *   penalty         DR STUDENT_PAYMENT  / CR PENALTY
 *   discount        DR DISCOUNT         / CR STUDENT_PAYMENT
 *   reversal        exact mirror of the entry being reversed
 *   adjustment      caller-specified pair (manual correction)
 *   seed            caller-specified pair (legacy import)
 *
 * Reported figures are derived from `entry_type`, NOT from raw account
 * balances, so penalties and discounts stay out of `remaining` exactly as
 * specified:  remaining = SUM(invoice) - SUM(payment).
 *
 * Balance guarantee
 * -----------------
 * Every entry is written through ledger.service.ts postEntry() inside a single
 * transaction, which refuses any pair whose debits != credits. SQL Server
 * cannot express a cross-row CHECK, so the guarantee is enforced at that single
 * write path plus ops/verify-ledger.sql reconciliation. Nothing else writes to
 * these tables.
 *
 * Idempotent: safe on fresh and drifted databases, safe to re-run. Each await
 * is its own SQL batch — SQL Server compiles a batch before running it, so a
 * statement referencing an object created earlier in the SAME batch fails with
 * "Invalid object name".
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF OBJECT_ID('journal_entries') IS NULL
    BEGIN
      CREATE TABLE [dbo].[journal_entries] (
        [id]                 NVARCHAR(128) NOT NULL PRIMARY KEY,
        [tenant_id]          NVARCHAR(128) NULL,
        [entry_date]         DATE NOT NULL
                               CONSTRAINT DF_journal_entries_entry_date DEFAULT (CONVERT(DATE, GETDATE())),
        [entry_type]         NVARCHAR(30) NOT NULL
                               CONSTRAINT CK_journal_entries_entry_type
                                 CHECK ([entry_type] IN ('invoice','payment','expense','penalty','discount','reversal','adjustment','seed')),
        [status]             NVARCHAR(20) NOT NULL
                               CONSTRAINT DF_journal_entries_status DEFAULT ('posted')
                               CONSTRAINT CK_journal_entries_status CHECK ([status] IN ('posted','reversed')),
        [amount]             DECIMAL(18,2) NOT NULL
                               CONSTRAINT CK_journal_entries_amount CHECK ([amount] > 0),
        [category]           NVARCHAR(100) NULL,
        [description]        NVARCHAR(500) NULL,
        [student_id]         NVARCHAR(128) NULL,
        [payment_method_id]  NVARCHAR(128) NULL,
        [finance_id]         NVARCHAR(128) NULL,
        [reverses_entry_id]  NVARCHAR(128) NULL,
        [reversed_by_entry_id] NVARCHAR(128) NULL,
        [source]             NVARCHAR(30) NOT NULL
                               CONSTRAINT DF_journal_entries_source DEFAULT ('api')
                               CONSTRAINT CK_journal_entries_source CHECK ([source] IN ('legacy','api','attendance','system')),
        [is_admin_only]      BIT NOT NULL
                               CONSTRAINT DF_journal_entries_is_admin_only DEFAULT (0),
        [version]            INT NOT NULL
                               CONSTRAINT DF_journal_entries_version DEFAULT (1),
        [created_by]         NVARCHAR(128) NULL,
        [created_at]         DATETIME2 NOT NULL
                               CONSTRAINT DF_journal_entries_created_at DEFAULT (GETDATE())
      );
    END
  `);

  // Self-referencing FKs for the reversal pair. Kept in their own batch: the
  // table must exist before SQL Server compiles a constraint over it.
  await knex.raw(`
    IF OBJECT_ID('journal_entries') IS NOT NULL
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_entries_reverses')
        ALTER TABLE [dbo].[journal_entries] WITH CHECK
          ADD CONSTRAINT [FK_journal_entries_reverses]
          FOREIGN KEY ([reverses_entry_id]) REFERENCES [dbo].[journal_entries]([id]);

      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_entries_reversed_by')
        ALTER TABLE [dbo].[journal_entries] WITH CHECK
          ADD CONSTRAINT [FK_journal_entries_reversed_by]
          FOREIGN KEY ([reversed_by_entry_id]) REFERENCES [dbo].[journal_entries]([id]);

      IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_journal_entries_tenant')
        ALTER TABLE [dbo].[journal_entries] WITH CHECK
          ADD CONSTRAINT [FK_journal_entries_tenant]
          FOREIGN KEY ([tenant_id]) REFERENCES [dbo].[tenants]([id]);
    END
  `);

  // NOTE: deliberately NO FK on journal_entries.student_id yet. The student
  // DELETE endpoint (students/crud.routes.ts:602) hard-deletes the row and
  // already leaves orphan `finances` behind; an FK here would turn that into an
  // opaque DB error. Phase 3 replaces hard delete with an archive-or-block flow
  // that refuses to drop a student holding ledger history, and the FK is added
  // by migration 044 at that point.

  await knex.raw(`
    IF OBJECT_ID('journal_lines') IS NULL
    BEGIN
      CREATE TABLE [dbo].[journal_lines] (
        [id]         NVARCHAR(128) NOT NULL PRIMARY KEY,
        [entry_id]   NVARCHAR(128) NOT NULL,
        [line_no]    INT NOT NULL,
        [account]    NVARCHAR(30) NOT NULL
                       CONSTRAINT CK_journal_lines_account
                         CHECK ([account] IN ('CASH','STUDENT_PAYMENT','ROOM_REVENUE','PENALTY','DISCOUNT','EXPENSE')),
        [debit]      DECIMAL(18,2) NOT NULL
                       CONSTRAINT DF_journal_lines_debit DEFAULT (0)
                       CONSTRAINT CK_journal_lines_debit CHECK ([debit] >= 0),
        [credit]     DECIMAL(18,2) NOT NULL
                       CONSTRAINT DF_journal_lines_credit DEFAULT (0)
                       CONSTRAINT CK_journal_lines_credit CHECK ([credit] >= 0),
        [student_id] NVARCHAR(128) NULL,
        [memo]       NVARCHAR(255) NULL,
        CONSTRAINT CK_journal_lines_one_side
          CHECK (([debit] > 0 AND [credit] = 0) OR ([credit] > 0 AND [debit] = 0)),
        CONSTRAINT UQ_journal_lines_entry_line
          UNIQUE ([entry_id], [line_no]),
        CONSTRAINT FK_journal_lines_entry
          FOREIGN KEY ([entry_id]) REFERENCES [dbo].[journal_entries]([id])
      );
    END
  `);

  // Read-path indexes. Every report filters on entry_type + status + date, and
  // per-student statements filter on student_id + entry_date.
  await createIndex(knex, 'IX_journal_entries_type_status_date', 'journal_entries', '[entry_type], [status], [entry_date]');
  await createIndex(knex, 'IX_journal_entries_student_date', 'journal_entries', '[student_id], [entry_date]');
  await createIndex(knex, 'IX_journal_entries_tenant_date', 'journal_entries', '[tenant_id], [entry_date]');
  await createIndex(knex, 'IX_journal_entries_finance', 'journal_entries', '[finance_id]');
  await createIndex(knex, 'IX_journal_lines_student_account', 'journal_lines', '[student_id], [account]');
  await createIndex(knex, 'IX_journal_lines_account', 'journal_lines', '[account]');

  // Legacy hardening — verified against live data before adding:
  //   finances.amount <= 0 rows ................ 0
  //   payment_methods duplicate tenant+name .... 0
  // Zod already enforces amount > 0 on create and update (validation/schemas.ts
  // :421, :432), so the CHECK merely closes the direct-SQL gap.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
                   WHERE name = 'CK_finances_amount_positive' AND parent_object_id = OBJECT_ID('finances'))
      ALTER TABLE [dbo].[finances] WITH CHECK
        ADD CONSTRAINT [CK_finances_amount_positive] CHECK ([amount] > 0);
  `);

  // Case-insensitivity comes from the column collation
  // (SQL_Latin1_General_CP1_CI_AS — verified live), so a plain unique index is
  // equivalent to the LOWER(name) form the app uses; SQL Server rejects an
  // expression in an index key outright ("Incorrect syntax near '('").
  // The WHERE keeps rows with a NULL tenant/name out of the uniqueness set.
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes
                   WHERE name = 'UQ_payment_methods_tenant_name' AND object_id = OBJECT_ID('payment_methods'))
      CREATE UNIQUE INDEX [UQ_payment_methods_tenant_name]
        ON [dbo].[payment_methods] ([tenant_id], [name])
        WHERE [tenant_id] IS NOT NULL AND [name] IS NOT NULL;
  `);

  // Hot filters on the legacy table that every finance/report query uses.
  await createIndex(knex, 'IX_finances_student_date', 'finances', '[student_id], [date]');
  await createIndex(knex, 'IX_finances_tenant_date', 'finances', '[tenant_id], [date]');
  await createIndex(knex, 'IX_finances_type_date', 'finances', '[type], [date]');

  console.log(
    'Ledger schema: journal_entries + journal_lines + 6 accounts, ' +
    'finances.amount CHECK, payment_methods unique (tenant,name), finance report indexes',
  );
}

async function createIndex(knex: Knex, index: string, table: string, columnsSql: string): Promise<void> {
  await knex.raw(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${index}' AND object_id = OBJECT_ID('${table}'))
      CREATE INDEX [${index}] ON [dbo].[${table}] (${columnsSql});
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`IF OBJECT_ID('journal_lines') IS NOT NULL DROP TABLE [dbo].[journal_lines];`);
  await knex.raw(`IF OBJECT_ID('journal_entries') IS NOT NULL DROP TABLE [dbo].[journal_entries];`);
  await knex.raw(`
    IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_finances_amount_positive')
      ALTER TABLE [dbo].[finances] DROP CONSTRAINT [CK_finances_amount_positive];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_payment_methods_tenant_name')
      DROP INDEX [UQ_payment_methods_tenant_name] ON [dbo].[payment_methods];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_finances_student_date')
      DROP INDEX [IX_finances_student_date] ON [dbo].[finances];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_finances_tenant_date')
      DROP INDEX [IX_finances_tenant_date] ON [dbo].[finances];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_finances_type_date')
      DROP INDEX [IX_finances_type_date] ON [dbo].[finances];
  `);
}
