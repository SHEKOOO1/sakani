import { Request, Response } from 'express';
import { StudentService } from './student.service';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import path from 'path';
import fs from 'fs';

const studentService = new StudentService();

export const StudentController = {
    register: async (req: Request, res: Response) => {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });
            const result = await studentService.registerStudent(req.body, (req as any).files, tenantId);
            res.json({ success: true, message: 'تم تسجيل الطالب بنجاح في المنظومة', data: result });
        } catch (error: any) {
            console.error('Registration Error:', error);
            res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
        }
    },

    list: async (req: Request, res: Response) => {
        try {
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });
            const students = await studentService.getStudentsByTenant(tenantId);
            res.json({ success: true, data: students });
        } catch (error: any) {
            res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
        }
    },

    getProfile: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });
            const student = await studentService.getStudentProfile(id, tenantId);
            if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود' });
            res.json({ success: true, data: student });
        } catch (error: any) {
            res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
        }
    },

    updateRoom: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { roomId } = req.body;
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });
            await studentService.updateStudentRoom(id, roomId, tenantId);
            res.json({ success: true, message: 'تم تحديث بيانات التسكين' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
        }
    },

    delete: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });
            const deleted = await studentService.deleteStudent(id, tenantId);
            if (!deleted) return res.status(404).json({ success: false, message: 'تعذر العثور على الطالب لحذفه' });
            res.json({ success: true, message: 'تم حذف سجل الطالب وكافة مرفقاته بنجاح' });
        } catch (error: any) {
            res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
        }
    },

    archive: async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const { reason, notes } = req.body;
            const tenantId = req.user?.tenantId;
            if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });
            await studentService.archiveStudent(id, { reason, notes }, tenantId);
            res.json({ success: true, message: 'تم أرشفة الطالب بنجاح' });
        } catch (error: any) {
            console.error('Archive Student Error:', error);
            res.status(500).json({ success: false, message: "حدث خطأ. لم نتمكن من تحميل البيانات." });
        }
    },

    exportPdf: async (req: Request, res: Response) => {
        const { id } = req.params;
        const tenantId = req.user?.tenantId;
        if (!tenantId) return res.status(400).json({ success: false, message: 'معرف السكن مطلوب' });

        try {
            const student = await studentService.getStudentProfile(id, tenantId);
            if (!student) return res.status(404).json({ success: false, message: 'الطالب غير موجود لتصدير البيانات' });

            const pdfDoc = await PDFDocument.create();
            const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const arabicFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

            let page = pdfDoc.addPage();
            page.drawText('تقرير بيانات الطالب المستخرجة من DormMaster', { x: 50, y: 750, font, size: 20, color: rgb(0, 0.4, 0.7) });
            page.drawText(`الاسم: ${student.name}`, { x: 50, y: 700, font: arabicFont, size: 12 });
            page.drawText(`الجامعة: ${student.university} - ${student.college}`, { x: 50, y: 680, font: arabicFont, size: 12 });
            page.drawText(`الكنيسة: ${student.church_name}`, { x: 50, y: 660, font: arabicFont, size: 12 });
            
            // دمج الهواتف
            if (student.phones?.length > 0) {
                let yOffset = 600;
                page.drawText('ارقام التواصل:', { x: 50, y: 620, font, size: 14 });
                for (const p of student.phones) {
                    page.drawText(`- ${p.label}: ${p.phoneNumber}`, { x: 70, y: yOffset, font: arabicFont, size: 10 });
                    yOffset -= 20;
                }
            }

            // دمج الوثائق
            for (const doc of student.documents) {
                const filePath = path.join(process.cwd(), doc.file_path);
                if (fs.existsSync(filePath) && path.extname(filePath).toLowerCase() === '.pdf') {
                    const embeddedPdf = await PDFDocument.load(fs.readFileSync(filePath));
                    const copiedPages = await pdfDoc.copyPages(embeddedPdf, embeddedPdf.getPageIndices());
                    copiedPages.forEach((p) => pdfDoc.addPage(p));
                }
            }

            const pdfBytes = await pdfDoc.save();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="student_${id}.pdf"`);
            res.send(Buffer.from(pdfBytes));
        } catch (error: any) {
            console.error('PDF Export Error:', error);
            res.status(500).json({ success: false, message: "��� ��� ���. �� ���� ��� ��������." });
        }
    }
};
