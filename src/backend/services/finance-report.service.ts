import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { kdb } from "../infrastructure/db";
import {
  getLedgerReport,
  getLedgerMovements,
  getLedgerPaymentTotalsByStudent,
  invoiceForStudent,
} from "./ledger.service";

interface FinanceFilters {
  tenantId?: string;
  type?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  isAdmin?: boolean;
}

interface ReportRow {
  id: string;
  type: string;
  category: string;
  amount: number;
  description: string | null;
  date: string;
  student_name: string | null;
}

export interface StudentAccountRow {
  student_id: string;
  student_name: string;
  room_number: string | null;
  totalInvoice: number;
  totalPaid: number;
  remaining: number;
}

export interface StudentAccountsResult {
  rows: StudentAccountRow[];
  totals: { invoice: number; paid: number; remaining: number };
}

/**
 * Every figure below is derived from the journal (see ledger.service read
 * helpers). `finances` is not read anywhere at runtime anymore — it is frozen
 * historical data kept only for import reconciliation.
 */
function ledgerScope(filters: FinanceFilters) {
  return {
    tenantId: filters.tenantId ?? null,
    isAdmin: filters.isAdmin,
    category: filters.category ?? null,
    startDate: filters.startDate ?? null,
    endDate: filters.endDate ?? null,
  };
}

export async function getFilteredFinances(filters: FinanceFilters): Promise<ReportRow[]> {
  const movementType =
    filters.type === 'revenue' || filters.type === 'expense' ? filters.type : null;
  const rows = await getLedgerMovements({ ...ledgerScope(filters), movementType });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    category: r.category,
    amount: r.amount,
    description: r.description,
    date: r.date || '',
    student_name: r.student_name,
  }));
}

export async function getReportSummary(filters: FinanceFilters) {
  const { type } = filters;
  const report = await getLedgerReport(ledgerScope(filters));

  let totals = report.totals;
  let byCategory = report.byCategory;
  if (type && type !== 'all') {
    byCategory = byCategory.filter((c) => c.type === type);
    totals = type === 'revenue'
      ? { ...totals, expense: 0, net: totals.income }
      : { ...totals, income: 0, net: -totals.expense };
  }

  return { totals, byCategory, byMonth: report.byMonth };
}

export async function generateExcel(rows: ReportRow[], filters: FinanceFilters): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sakani Dormitory System';
  wb.created = new Date();

  const sheet = wb.addWorksheet('التقرير المالي');
  sheet.columns = [
    { header: 'البيان', key: 'description', width: 30 },
    { header: 'النوع', key: 'type', width: 12 },
    { header: 'التصنيف', key: 'category', width: 16 },
    { header: 'التاريخ', key: 'date', width: 14 },
    { header: 'المبلغ', key: 'amount', width: 14 },
    { header: 'مرتبط بـ', key: 'student_name', width: 20 },
  ];

  sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sheet.getRow(1).alignment = { horizontal: 'right', vertical: 'middle' };

  let totalIncome = 0;
  let totalExpense = 0;

  rows.forEach((r, i) => {
    const rowNum = i + 2;
    const row = sheet.getRow(rowNum);
    row.getCell('description').value = r.description || 'بدون وصف';
    row.getCell('type').value = r.type === 'revenue' ? 'وارد' : 'مصروف';
    row.getCell('category').value = r.category;
    row.getCell('date').value = new Date(r.date).toLocaleDateString('ar-EG');
    row.getCell('amount').value = r.amount;
    row.getCell('student_name').value = r.student_name || '';

    if (r.type === 'revenue') {
      totalIncome += r.amount;
      row.getCell('amount').font = { color: { argb: 'FF059669' }, bold: true };
    } else {
      totalExpense += r.amount;
      row.getCell('amount').font = { color: { argb: 'FFE11D48' }, bold: true };
    }

    row.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  const summaryRow = sheet.addRow({});
  summaryRow.getCell('description').value = 'الإجمالي';
  summaryRow.getCell('description').font = { bold: true, size: 13 };
  summaryRow.getCell('amount').value = `الوارد: ${totalIncome} | المصروف: ${totalExpense} | الصافي: ${totalIncome - totalExpense}`;
  summaryRow.getCell('amount').font = { bold: true, color: { argb: 'FF1E293B' } };

  const ws = wb.addWorksheet('ملخص');
  ws.columns = [
    { header: 'البيان', key: 'label', width: 20 },
    { header: 'القيمة', key: 'value', width: 20 },
  ];
  ws.addRow({ label: 'إجمالي الوارد', value: totalIncome });
  ws.addRow({ label: 'إجمالي المصروفات', value: totalExpense });
  ws.addRow({ label: 'صافي الرصيد', value: totalIncome - totalExpense });
  ws.addRow({ label: 'عدد المعاملات', value: rows.length });
  ws.addRow({ label: 'من تاريخ', value: filters.startDate || '---' });
  ws.addRow({ label: 'إلى تاريخ', value: filters.endDate || '---' });
  ws.getColumn(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generatePDF(rows: ReportRow[], filters: FinanceFilters): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('error', (err: Error) => reject(err));

      const fontPath = path.resolve(process.cwd(), 'public/fonts/arabtype.ttf');
      const fallbackFontPath = path.resolve(process.cwd(), 'public/fonts/arial.ttf');

      let fontRegistered = false;
      if (fs.existsSync(fontPath)) {
        try { doc.registerFont('Arabic', fontPath); fontRegistered = true; } catch (e: any) { console.error('Font register error:', e.message); }
      }
      if (!fontRegistered && fs.existsSync(fallbackFontPath)) {
        try { doc.registerFont('Arabic', fallbackFontPath); fontRegistered = true; } catch (e: any) { console.error('Fallback font error:', e.message); }
      }

      const FONT = fontRegistered ? 'Arabic' : 'Helvetica';

      doc.font(FONT).fontSize(22).fillColor('#1E293B').text('Sakani - التقرير المالي', { align: 'right' });
      doc.fontSize(10).fillColor('#64748B').text(`الفترة: ${filters.startDate || '---'} إلى ${filters.endDate || '---'}`, { align: 'right' });
      if (filters.type && filters.type !== 'all') {
        doc.text(`النوع: ${filters.type === 'revenue' ? 'وارد' : 'مصروف'}`, { align: 'right' });
      }
      if (filters.category) {
        doc.text(`التصنيف: ${filters.category}`, { align: 'right' });
      }
      doc.moveDown(2);

      const pageWidth = doc.page.width - 100;
      const colWidths = [pageWidth * 0.25, pageWidth * 0.12, pageWidth * 0.16, pageWidth * 0.14, pageWidth * 0.18, pageWidth * 0.15];
      const headers = ['البيان', 'النوع', 'التصنيف', 'التاريخ', 'المبلغ', 'طالب'];

      let y = doc.y;
      const drawTableHeader = () => {
        let x = doc.page.width - 50;
        doc.rect(50, y, pageWidth, 22).fill('#1E293B');
        doc.fillColor('#FFFFFF').fontSize(9);
        headers.forEach((h, i) => {
          x -= colWidths[i];
          doc.text(h, x + 4, y + 5, { width: colWidths[i] - 8, align: 'right' });
        });
        y += 22;
      };
      drawTableHeader();

      let totalIncome = 0;
      let totalExpense = 0;

      for (const r of rows) {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 50;
          drawTableHeader();
        }

        const bgColor = r.type === 'revenue' ? '#F0FDF4' : '#FFF1F2';
        doc.rect(50, y, pageWidth, 20).fill(bgColor);
        let x = doc.page.width - 50;
        const cells = [
          r.description?.substring(0, 30) || 'بدون وصف',
          r.type === 'revenue' ? 'وارد' : 'مصروف',
          r.category || '',
          new Date(r.date).toLocaleDateString('ar-EG'),
          `${r.type === 'revenue' ? '+' : '-'}${r.amount.toLocaleString()}$`,
          r.student_name?.substring(0, 15) || '',
        ];
        doc.fillColor(r.type === 'revenue' ? '#059669' : '#E11D48').fontSize(8);
        cells.forEach((c, i) => {
          x -= colWidths[i];
          doc.text(c, x + 4, y + 4, { width: colWidths[i] - 8, align: 'right' });
        });
        y += 20;
        if (r.type === 'revenue') totalIncome += r.amount;
        else totalExpense += r.amount;
      }

      doc.moveDown(2);
      doc.fontSize(11).fillColor('#059669').text(`إجمالي الوارد: ${totalIncome.toLocaleString()}$`, { align: 'right' });
      doc.fillColor('#E11D48').text(`إجمالي المصروفات: ${totalExpense.toLocaleString()}$`, { align: 'right' });
      doc.fontSize(12).fillColor('#1E293B').text(`صافي الرصيد: ${(totalIncome - totalExpense).toLocaleString()}$`, { align: 'right' });

      const timeout = setTimeout(() => reject(new Error('PDF generation timed out')), 30000);
      doc.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(buffers)); });
      doc.end();
    } catch (e: any) {
      reject(e);
    }
  });
}

// تقرير حسابات الطلاب المجمّع — كل طالب في خانه واحدة بإجمالي مدفوعاته مهما تعددت الدفعات
export async function getStudentAccounts(filters: FinanceFilters): Promise<StudentAccountsResult> {
  const { tenantId, isAdmin } = filters;

  const studentsQuery = kdb('students as s')
    .leftJoin('users as u', 's.user_id', 'u.id')
    .leftJoin('rooms as r', 's.room_id', 'r.id')
    .select(
      's.id',
      'u.name as student_name',
      'r.room_number',
      's.agreed_price',
      's.billing_cycle',
      'r.price_daily',
      'r.price_monthly',
      'r.price_semester',
    )
    .orderBy('u.name');
  if (!isAdmin && tenantId) studentsQuery.where('s.tenant_id', tenantId);

  // The invoice is the same figure the student profile uses (room price wins,
  // agreed_price is the fallback) and `paid` is posted ledger payments only —
  // so this report and StudentProfile can no longer disagree.
  const [students, paidRows] = await Promise.all([
    studentsQuery,
    getLedgerPaymentTotalsByStudent(ledgerScope(filters)),
  ]);
  const paidMap = new Map<string, number>();
  for (const r of paidRows) paidMap.set(r.student_id, Number(r.paid || 0));

  let invoice = 0, paid = 0, remaining = 0;
  const rows: StudentAccountRow[] = students.map((s: any) => {
    const totalInvoice = invoiceForStudent(s).invoice;
    const totalPaid = paidMap.get(s.id) || 0;
    const rem = totalInvoice - totalPaid;
    invoice += totalInvoice;
    paid += totalPaid;
    remaining += rem;
    return {
      student_id: s.id,
      student_name: s.student_name || 'غير محدد',
      room_number: s.room_number || null,
      totalInvoice,
      totalPaid,
      remaining: rem,
    };
  });

  return { rows, totals: { invoice, paid, remaining } };
}

export async function generateStudentAccountsExcel(result: StudentAccountsResult, filters: FinanceFilters): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sakani Dormitory System';
  wb.created = new Date();

  const sheet = wb.addWorksheet('حسابات الطلاب');
  sheet.columns = [
    { header: 'الطالب', key: 'student_name', width: 30 },
    { header: 'الغرفة', key: 'room_number', width: 14 },
    { header: 'الفاتورة', key: 'totalInvoice', width: 14 },
    { header: 'المدفوع', key: 'totalPaid', width: 14 },
    { header: 'المتبقي', key: 'remaining', width: 14 },
  ];

  sheet.getRow(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  sheet.getRow(1).alignment = { horizontal: 'right', vertical: 'middle' };

  result.rows.forEach((r, i) => {
    const row = sheet.getRow(i + 2);
    row.getCell('student_name').value = r.student_name;
    row.getCell('room_number').value = r.room_number || '';
    row.getCell('totalInvoice').value = r.totalInvoice;
    row.getCell('totalPaid').value = r.totalPaid;
    row.getCell('remaining').value = r.remaining;
    row.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  const summaryRow = sheet.addRow({ student_name: 'الإجمالي' });
  summaryRow.getCell('student_name').font = { bold: true, size: 13 };
  summaryRow.getCell('totalInvoice').value = result.totals.invoice;
  summaryRow.getCell('totalPaid').value = result.totals.paid;
  summaryRow.getCell('remaining').value = result.totals.remaining;
  summaryRow.getCell('student_name').alignment = { horizontal: 'right' };

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generateStudentAccountsPDF(result: StudentAccountsResult, filters: FinanceFilters): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => buffers.push(chunk));
      doc.on('error', (err: Error) => reject(err));

      const fontPath = path.resolve(process.cwd(), 'public/fonts/arabtype.ttf');
      const fallbackFontPath = path.resolve(process.cwd(), 'public/fonts/arial.ttf');

      let fontRegistered = false;
      if (fs.existsSync(fontPath)) {
        try { doc.registerFont('Arabic', fontPath); fontRegistered = true; } catch (e: any) { console.error('Font register error:', e.message); }
      }
      if (!fontRegistered && fs.existsSync(fallbackFontPath)) {
        try { doc.registerFont('Arabic', fallbackFontPath); fontRegistered = true; } catch (e: any) { console.error('Fallback font error:', e.message); }
      }

      const FONT = fontRegistered ? 'Arabic' : 'Helvetica';

      doc.font(FONT).fontSize(22).fillColor('#1E293B').text('Sakani - تقرير حسابات الطلاب', { align: 'right' });
      doc.fontSize(10).fillColor('#64748B').text(`الفترة: ${filters.startDate || 'كامل الترم'} إلى ${filters.endDate || 'اليوم'}`, { align: 'right' });
      if (filters.category) doc.text(`التصنيف: ${filters.category}`, { align: 'right' });
      doc.moveDown(2);

      const pageWidth = doc.page.width - 100;
      const colWidths = [pageWidth * 0.32, pageWidth * 0.14, pageWidth * 0.18, pageWidth * 0.18, pageWidth * 0.18];
      const headers = ['الطالب', 'الغرفة', 'الفاتورة', 'المدفوع', 'المتبقي'];

      let y = doc.y;
      const drawTableHeader = () => {
        let x = doc.page.width - 50;
        doc.rect(50, y, pageWidth, 22).fill('#1E293B');
        doc.fillColor('#FFFFFF').fontSize(9);
        headers.forEach((h, i) => {
          x -= colWidths[i];
          doc.text(h, x + 4, y + 5, { width: colWidths[i] - 8, align: 'right' });
        });
        y += 22;
      };
      drawTableHeader();

      for (const r of result.rows) {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 50;
          drawTableHeader();
        }
        const bgColor = r.remaining > 0 ? '#FFF7ED' : '#F0FDF4';
        doc.rect(50, y, pageWidth, 20).fill(bgColor);
        let x = doc.page.width - 50;
        const cells = [
          r.student_name.substring(0, 30),
          r.room_number || '',
          `${r.totalInvoice.toLocaleString()}$`,
          `${r.totalPaid.toLocaleString()}$`,
          `${r.remaining.toLocaleString()}$`,
        ];
        doc.fillColor('#334155').fontSize(8);
        cells.forEach((c, i) => {
          x -= colWidths[i];
          doc.text(c, x + 4, y + 4, { width: colWidths[i] - 8, align: 'right' });
        });
        y += 20;
      }

      doc.moveDown(2);
      doc.fontSize(11).fillColor('#059669').text(`إجمالي المدفوع: ${result.totals.paid.toLocaleString()}$`, { align: 'right' });
      doc.fillColor('#334155').text(`إجمالي الفواتير: ${result.totals.invoice.toLocaleString()}$`, { align: 'right' });
      doc.fontSize(12).fillColor('#E11D48').text(`إجمالي المتبقي: ${result.totals.remaining.toLocaleString()}$`, { align: 'right' });

      const timeout = setTimeout(() => reject(new Error('PDF generation timed out')), 30000);
      doc.on('end', () => { clearTimeout(timeout); resolve(Buffer.concat(buffers)); });
      doc.end();
    } catch (e: any) {
      reject(e);
    }
  });
}
