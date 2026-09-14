import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const MAGIC_BYTES: Record<string, (string | RegExp)[]> = {
  '.jpg': [/^ÿØÿ/],
  '.jpeg': [/^ÿØÿ/],
  '.png': [/^.PNG/],
  '.gif': [/^GIF8[79]a/],
  '.webp': [/^RIFF....WEBPVP8/],
  '.pdf': [/^%PDF/],
  '.doc': [/^ÐÐà/],
  '.docx': [/^PK../],
};

function checkMagicBytes(filePath: string, ext: string): boolean {
  try {
    const header = fs.readFileSync(filePath).subarray(0, 16);
    const patterns = MAGIC_BYTES[ext];
    if (!patterns) return true;
    return patterns.some(p => {
      if (typeof p === 'string') return header.toString('latin1').startsWith(p);
      return p.test(header.toString('latin1'));
    });
  } catch {
    return false;
  }
}

const storage = multer.diskStorage({
  destination: path.resolve(process.cwd(), 'uploads', 'documents'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error(`الملفات من نوع ${ext} غير مسموحة. الأنواع المسموحة: ${allowed.join(', ')}`));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Middleware to validate magic bytes after multer saves the file (single or multiple)
export function validateMagicBytes(req: any, _res: any, next: any) {
  const files: Express.Multer.File[] = [];
  if (req.file) files.push(req.file);
  if (Array.isArray(req.files)) files.push(...req.files);
  if (files.length === 0) return next();
  for (const file of files) {
    const ext = path.extname(file.originalname).toLowerCase();
    const valid = checkMagicBytes(file.path, ext);
    if (!valid) {
      try { fs.unlinkSync(file.path); } catch {}
      return next(new Error(`الملف تالف أو غير صالح (نوع الملف لا يتطابق مع المحتوى)`));
    }
  }
  next();
}

export const UPLOADS_BASE = '/uploads';
