import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { authenticate, authorizePermission } from "./middleware";
import { AppPermission } from "../../types/permissions";
import * as ctrl from "../controllers/radio.controller";


const router = express.Router();

// ─── Radiojar API Proxy ───
router.get("/radiojar/now-playing", ctrl.getRadiojarNowPlaying);
router.get("/radiojar/station", ctrl.getRadiojarStation);
router.get("/radiojar/status", authenticate, ctrl.getRadiojarStatus);
router.post("/radiojar/resume", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.resumeRadiojar);

// ─── Current Track ───
router.get("/current-track", authenticate, ctrl.getCurrentTrack);
router.put("/current-track", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.putCurrentTrack);

// ─── Song History ───
router.get("/song-history", authenticate, authorizePermission(AppPermission.VIEW_RADIO), ctrl.getSongHistory);
router.post("/song-history/:songId/like", authenticate, ctrl.likeSong);

// ─── Videos ───
router.get("/videos", authenticate, ctrl.getVideos);
router.post("/videos", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.createVideo);
router.put("/videos/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.updateVideo);
router.delete("/videos/:videoId", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.deleteVideo);
router.get("/videos/live", authenticate, ctrl.getLiveVideos);
router.get("/videos/was-live", authenticate, ctrl.getWasLiveVideos);
router.post("/videos/:id/live", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.setVideoLive);
router.post("/videos/:id/unlive", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.unsetVideoLive);

// ─── Video Comments ───
router.get("/videos/:videoId/comments", authenticate, ctrl.getVideoComments);
router.post("/videos/:videoId/comments", authenticate, ctrl.createVideoComment);
router.delete("/videos/:videoId/comments/:commentId", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.deleteVideoComment);

// ─── Chat Messages ───
router.get("/chat/messages", authenticate, ctrl.getChatMessages);
router.post("/chat/messages", authenticate, ctrl.createChatMessage);
router.delete("/chat/messages/:msgId", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.deleteChatMessage);
router.post("/chat/users/:userId/ban", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.banUser);
router.post("/chat/users/:userId/mute", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.muteUser);
router.post("/chat/users/:userId/kick", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.kickUser);
router.post("/chat/users/:userId/unban", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.unbanUser);
router.get("/chat/banned-users", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.getBannedUsers);
router.get("/chat/banned-users/:userId/messages", authenticate, authorizePermission(AppPermission.MODERATE_RADIO_CHAT), ctrl.getBannedUserMessages);

// ─── Broadcasts ───
router.get("/broadcasts", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.getBroadcasts);
router.get("/broadcasts/public", ctrl.getPublicBroadcasts);
router.post("/broadcasts", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.createBroadcast);
router.put("/broadcasts/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.updateBroadcast);
router.delete("/broadcasts/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.deleteBroadcast);

// ─── Broadcast Reminders ───
router.get("/broadcasts/reminders", authenticate, ctrl.getUserReminders);
router.post("/broadcasts/:id/reminder", authenticate, ctrl.toggleReminder);
router.get("/broadcasts/reminders/check", authenticate, ctrl.checkReminders);

// ─── Live Subscriptions ───
router.get("/live/subscribe", authenticate, ctrl.getLiveSubscription);
router.post("/live/subscribe", authenticate, ctrl.toggleLiveSubscription);
router.get("/live/check", ctrl.checkLiveVideos);

// ─── Categories ───
router.get("/categories", authenticate, ctrl.getCategories);
router.post("/categories", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.createCategory);
router.put("/categories/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.updateCategory);
router.delete("/categories/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.deleteCategory);

// ─── Playlists ───
router.get("/playlists", authenticate, ctrl.getPlaylists);
router.post("/playlists", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.createPlaylist);
router.put("/playlists/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.updatePlaylist);
router.delete("/playlists/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.deletePlaylist);

// ─── Playlist Items ───
router.get("/playlists/:playlistId/items", authenticate, ctrl.getPlaylistItems);
router.post("/playlists/:playlistId/items", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.addPlaylistItem);
router.post("/playlists/:playlistId/items/bulk", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.bulkAddPlaylistItems);
router.put("/playlists/:playlistId/items/:itemId", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.updatePlaylistItem);
router.delete("/playlists/:playlistId/items/:itemId", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.deletePlaylistItem);
router.post("/playlists/:playlistId/reorder", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_PLAYLISTS), ctrl.reorderPlaylistItems);

// ─── Staff ───
router.get("/staff", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.getStaff);
router.get("/staff/search", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.searchStaff);
router.post("/staff", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.addStaffMember);
router.put("/staff/:id", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.updateStaffMember);
router.delete("/staff/:memberId", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), ctrl.removeStaffMember);

// ─── Image Upload ───
const uploadDir = path.join(process.cwd(), "uploads", "radio");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `cover-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error("غير مسموح بهذا النوع من الملفات"));
  },
});

const handleUpload = (fieldName: string) => (req: express.Request, res: express.Response) => {
  upload.single(fieldName)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.code === "LIMIT_FILE_SIZE" ? "الملف كبير جداً (الحد الأقصى 5MB)" : "خطأ في رفع الملف" });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    if (!req.file) return res.status(400).json({ success: false, message: "الرجاء اختيار صورة" });
    // Validate magic bytes
    const ext = path.extname(req.file.originalname).toLowerCase();
    const header = fs.readFileSync(req.file.path).subarray(0, 16).toString('latin1');
    const isValid = header.startsWith('ÿØÿ') || header.startsWith('\u0089PNG') || header.startsWith('GIF8') || header.startsWith('RIFF');
    if (!isValid) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ success: false, message: "الملف تالف أو غير صالح (نوع الملف لا يتطابق مع المحتوى)" });
    }
    res.json({ success: true, data: { url: `/uploads/radio/${req.file.filename}` } });
  });
};

router.post("/upload-image", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), handleUpload("image"));
router.post("/upload-cover", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_BROADCAST), handleUpload("image"));

// ─── YouTube Integration ───
router.get("/fetch-video-info", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.fetchVideoInfo);
router.get("/fetch-playlist", authenticate, authorizePermission(AppPermission.MANAGE_RADIO_VIDEO_LIBRARY), ctrl.fetchPlaylist);

// ─── Statistics ───
router.get("/stats", authenticate, authorizePermission(AppPermission.VIEW_RADIO_ANALYTICS), ctrl.getRadioStats);
router.get("/stats/broadcasts", authenticate, authorizePermission(AppPermission.VIEW_RADIO_ANALYTICS), ctrl.getBroadcastStats);
router.get("/stats/chat", authenticate, authorizePermission(AppPermission.VIEW_RADIO_ANALYTICS), ctrl.getChatStats);

export default router;
