import React, { useState, useEffect, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  User, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Note {
  id: string;
  content: string;
  author_id: string;
  author_name: string;
  author_role: string;
  created_at: string;
}

interface StudentNotesSectionProps {
  studentId: string;
}

export const StudentNotesSection: React.FC<StudentNotesSectionProps> = ({ studentId }) => {
  const { request } = useApi();
  const { user } = useAuth();
  const { showSnackbar, confirm } = useSnackbar();
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await request(`/api/students/${studentId}/notes`);
      if (res.success) {
        setNotes(res.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
    } finally {
      setLoading(false);
    }
  }, [request, studentId]);

  useEffect(() => {
    if (studentId) fetchNotes();
  }, [studentId, fetchNotes]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSaving(true);
    try {
      const res = await request(`/api/students/${studentId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: newNote.trim() })
      });

      if (res.success) {
        setNewNote('');
        showSnackbar('تم إضافة الملاحظة بنجاح', 'success');
        fetchNotes();
      }
    } catch (err: any) {
      showSnackbar(err.message || 'فشل إضافة الملاحظة', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!await confirm({ message: 'هل أنت متأكد من حذف هذه الملاحظة؟', type: 'danger' })) return;

    try {
      const res = await request(`/api/students/${studentId}/notes/${noteId}`, {
        method: 'DELETE'
      });

      if (res.success) {
        showSnackbar('تم حذف الملاحظة', 'success');
        setNotes(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (err: any) {
      showSnackbar(err.message || 'فشل حذف الملاحظة', 'error');
    }
  };

  if (loading && notes.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
      <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
        <MessageSquare className="text-blue-500" size={24} />
        ملاحظات الإشراف والآباء الكهنة
      </h3>

      {/* Add New Note */}
      {['priest', 'supervisor', 'assistant_supervisor', 'bishop', 'admin'].includes(user?.role?.toLowerCase() || '') && (
        <form onSubmit={handleAddNote} className="relative">
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="اكتب ملاحظة جديدة عن الطالب..."
            className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[2rem] outline-none focus:ring-4 focus:ring-blue-500/10 min-h-[120px] font-bold text-sm resize-none"
            disabled={saving}
          />
          <button
            type="submit"
            disabled={saving || !newNote.trim()}
            className="absolute left-4 bottom-4 p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
          >
            {saving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send size={20} />}
          </button>
        </form>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        <AnimatePresence initial={false}>
          {notes.map((note) => (
            <motion.div
              key={note.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 group relative"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 shadow-sm">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-black text-slate-800 text-sm">{note.author_name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      {note.author_role === 'priest' ? 'الأب الكاهن' : 
                       note.author_role === 'bishop' ? 'نيافة الأسقف' : 
                       note.author_role === 'admin' ? 'مدير النظام' : 
                       'مشرف السكن'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Clock size={12} />
                    {note.created_at ? new Date(note.created_at).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : 'جاري التسجيل...'}
                  </span>
                  
                  {user?.id === note.author_id && (
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              
              <p className="text-sm font-bold text-slate-600 leading-relaxed pr-1">
                {note.content}
              </p>
            </motion.div>
          ))}
        </AnimatePresence>

        {notes.length === 0 && !loading && (
          <div className="py-12 text-center border-2 border-dashed border-slate-50 rounded-[2.5rem]">
            <AlertCircle size={32} className="mx-auto text-slate-100 mb-2" />
            <p className="text-sm text-slate-300 font-bold">لا توجد ملاحظات مسجلة لهذا الطالب</p>
          </div>
        )}
      </div>
    </div>
  );
};