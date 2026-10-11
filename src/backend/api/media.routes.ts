import express from "express";
import { authenticate } from "./middleware";
import { imageUpload, validateMagicBytes, UPLOADS_BASE } from "../middleware/upload";

const router = express.Router();

// رفع الصور يُتاح لأي مستخدم مصادق عليه: الصورة الشخصية وصور الوجبات/المنتجات.
// تُخزَّن في uploads/images وتُخدَم عبر /uploads/images (متاحة للأعضاء المصادقين).
router.use(authenticate);

router.post("/image", imageUpload.single("image"), validateMagicBytes, (req: any, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "لم يتم اختيار صورة" });
  }
  res.json({
    success: true,
    data: {
      url: `${UPLOADS_BASE}/images/${req.file.filename}`,
      original_name: req.file.originalname,
      size: req.file.size,
      mime_type: req.file.mimetype,
    },
  });
});

// معالج أخطاء خاص بالراوتر (حجم الملف/النوع/التحقق من المحتوى) يرجع JSON بدل HTML.
router.use((err: any, _req: any, res: any, _next: any) => {
  const message = err?.code === "LIMIT_FILE_SIZE"
    ? "حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)"
    : (err?.message || "فشل رفع الصورة");
  res.status(400).json({ success: false, message });
});

export default router;
