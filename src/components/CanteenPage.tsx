import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { useApiQuery } from '../hooks/useApiQuery';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { effectivePrice } from '../utils/pricing';
import { ImageUploadField } from './common/ImageUploadField';
import {
  Store, Plus, Trash2, Pencil, ShoppingCart, Package, ArrowLeftRight,
  Receipt, AlertTriangle, UserCog, Loader2, Check, X, Minus, RotateCcw, Search,
} from 'lucide-react';

interface Category { id: string; name: string; sort_order: number; is_active: number | boolean; }
interface Product {
  id: string; name: string; category_id: string | null; unit: string | null; barcode: string | null;
  cost_price: number; sell_price: number; quantity_on_hand: number; min_quantity: number; is_active: number | boolean;
  image_url: string | null; discount_type: 'percent' | 'amount' | null; discount_value: number;
}
interface Movement {
  id: string; product_id: string; movement_type: string; quantity: number; unit_cost: number;
  note: string | null; created_at: string;
}
interface SaleItem { id: string; product_id: string; product_name: string; quantity: number; unit_price: number; line_total: number; }
interface Sale { id: string; sale_ref: string; total: number; status: string; sold_at: string; payment_method: string; items: SaleItem[]; customer_name?: string | null; customer_phone?: string | null; apartment_name?: string | null; room_name?: string | null; }
interface StudentOption { id: string; name: string; phone: string | null; room_name: string | null; apartment_name: string | null; }
interface Operator { id: string; user_id: string; name?: string; email?: string; }
interface AssignableUser { id: string; name: string; email: string; role: string; }

const flag = (v: unknown, fallback = true): boolean =>
  v === undefined || v === null ? fallback : v !== 0 && v !== '0' && v !== false && v !== 'false';

const MOVEMENT_LABELS: Record<string, string> = {
  purchase: 'توريد', sale: 'بيع', waste: 'تالف', adjustment: 'جرد', return: 'مرتجع',
};

type Tab = 'pos' | 'products' | 'stock' | 'sales' | 'low' | 'operators';

export function CanteenPage() {
  const { request } = useApi();
  const { hasPermission, user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  const queryClient = useQueryClient();

  const canManage = hasPermission(AppPermission.MANAGE_CANTEEN);
  const canManageOperators = hasPermission(AppPermission.MANAGE_CANTEEN_OPERATORS);
  const role = (user?.role || '').toLowerCase();
  const staffBypass = ['admin', 'supervisor', 'priest'].includes(role);

  const isOpQuery = useApiQuery<{ isOperator: boolean }>(['canteen-is-operator'], '/api/canteen/is-operator');
  const canOperate = canManage || staffBypass || !!isOpQuery.data?.isOperator;

  const [tab, setTab] = useState<Tab>('pos');

  const categoriesQuery = useApiQuery<{ data: Category[] }>(['canteen-categories'], '/api/canteen/categories');
  const productsQuery = useApiQuery<{ data: Product[] }>(['canteen-products'], '/api/canteen/products');
  const movementsQuery = useApiQuery<{ data: Movement[] }>(['canteen-movements'], '/api/canteen/stock/movements', {}, { enabled: canOperate });
  const salesQuery = useApiQuery<{ data: Sale[] }>(['canteen-sales'], '/api/canteen/sales', {}, { enabled: canOperate });
  const lowQuery = useApiQuery<{ data: Product[] }>(['canteen-low'], '/api/canteen/low-stock');
  const operatorsQuery = useApiQuery<{ data: Operator[] }>(['canteen-operators'], '/api/canteen/operators', {}, { enabled: canManageOperators });

  const categories = categoriesQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });

  if (!canOperate) {
    return <CatalogView products={products.filter(p => flag(p.is_active, true))} categories={categories} />;
  }

  const tabs: { id: Tab; label: string; icon: any; show: boolean }[] = [
    { id: 'pos', label: 'نقطة البيع', icon: ShoppingCart, show: true },
    { id: 'products', label: 'المنتجات', icon: Package, show: canManage },
    { id: 'stock', label: 'المخزون', icon: ArrowLeftRight, show: true },
    { id: 'sales', label: 'الفواتير والمرتجعات', icon: Receipt, show: true },
    { id: 'low', label: 'تنبيهات المخزون', icon: AlertTriangle, show: true },
    { id: 'operators', label: 'المسؤولون', icon: UserCog, show: canManageOperators },
  ];

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-vibrant-500 flex items-center justify-center text-white shadow-lg">
          <Store size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">الكانتين</h1>
          <p className="text-xs font-bold text-slate-400">نقطة بيع وإدارة مخزون</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.filter(t => t.show).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.id ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                : 'bg-white dark:bg-card-dark text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5 hover:bg-slate-50'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'pos' && <PosTab products={products} invalidate={invalidate} />}
      {tab === 'products' && canManage && <ProductsTab categories={categories} products={products} invalidate={invalidate} />}
      {tab === 'stock' && <StockTab products={products} movements={movementsQuery.data?.data ?? []} invalidate={invalidate} />}
      {tab === 'sales' && <SalesTab sales={salesQuery.data?.data ?? []} invalidate={invalidate} />}
      {tab === 'low' && <LowStockTab products={lowQuery.data?.data ?? []} />}
      {tab === 'operators' && canManageOperators && <OperatorsTab operators={operatorsQuery.data?.data ?? []} invalidate={invalidate} />}
    </div>
  );
}

function CatalogView({ products, categories }: { products: Product[]; categories: Category[] }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<string>('all');

  const isDiscounted = (p: Product) =>
    !!p.discount_type && effectivePrice(p.sell_price, p.discount_type, p.discount_value) < Number(p.sell_price);
  const activeCategories = categories.filter(c => flag(c.is_active, true));
  const hasOffers = products.some(isDiscounted);
  const term = q.trim().toLowerCase();

  const shown = products.filter(p => {
    if (filter === 'offers') { if (!isDiscounted(p)) return false; }
    else if (filter !== 'all' && p.category_id !== filter) return false;
    if (term && !p.name.toLowerCase().includes(term)) return false;
    return true;
  });

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-500 to-vibrant-500 flex items-center justify-center text-white shadow-lg"><Store size={22} /></div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">الكانتين</h1>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن منتج..."
          className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 text-sm font-bold" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-100 dark:border-white/5'}`}>الكل</button>
        {hasOffers && (
          <button onClick={() => setFilter('offers')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === 'offers' ? 'bg-rose-500 text-white' : 'bg-white dark:bg-card-dark text-rose-500 border border-rose-100 dark:border-rose-500/20'}`}>العروض</button>
        )}
        {activeCategories.map(c => (
          <button key={c.id} onClick={() => setFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === c.id ? 'bg-slate-900 text-white' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-100 dark:border-white/5'}`}>{c.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {shown.map(p => {
          const eff = effectivePrice(p.sell_price, p.discount_type, p.discount_value);
          const discounted = eff < Number(p.sell_price);
          return (
            <div key={p.id} className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-1/2 mx-auto aspect-square object-contain rounded-xl mb-2 bg-slate-50 dark:bg-white/5" />}
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-slate-900 dark:text-white">{p.name}</h3>
                {discounted && <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-600 shrink-0">خصم</span>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  {discounted && <span className="text-xs font-bold text-slate-400 line-through">{Number(p.sell_price).toLocaleString()}</span>}
                  <span className="font-black text-primary-600">{eff.toLocaleString()} ج.م</span>
                </span>
                <span className="text-xs font-bold text-slate-400">{p.quantity_on_hand > 0 ? 'متوفر' : 'غير متوفر'}</span>
              </div>
            </div>
          );
        })}
        {shown.length === 0 && <div className="col-span-full p-10 text-center text-sm font-bold text-slate-400">لا توجد منتجات</div>}
      </div>
    </div>
  );
}

function PosTab(props: { products: Product[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError } = useSnackbar();
  const available = props.products.filter(p => flag(p.is_active, true));
  const [cart, setCart] = useState<Record<string, number>>({});
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [studentId, setStudentId] = useState('');
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);

  const studentsQuery = useApiQuery<{ data: StudentOption[] }>(['canteen-students'], '/api/canteen/students');
  const students = studentsQuery.data?.data ?? [];
  const selectedStudent = students.find(s => s.id === studentId);

  const term = q.trim().toLowerCase();
  const shownProducts = term ? available.filter(p => p.name.toLowerCase().includes(term)) : available;

  const lines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ product: available.find(p => p.id === id), qty })).filter(l => l.product && l.qty > 0),
    [cart, available],
  );
  const total = lines.reduce((s, l) => s + effectivePrice(l.product!.sell_price, l.product!.discount_type, l.product!.discount_value) * l.qty, 0);

  const add = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id: string) => setCart(c => { const n = { ...c }; if ((n[id] || 0) <= 1) delete n[id]; else n[id]--; return n; });

  const submit = async () => {
    if (lines.length === 0) { showError('السلة فارغة'); return; }
    setBusy(true);
    try {
      const res = await request('/api/canteen/sales', {
        method: 'POST',
        body: JSON.stringify({
          sale_ref: `POS-${Date.now()}`,
          items: lines.map(l => ({ product_id: l.product!.id, quantity: l.qty })),
          payment_method: paymentMethod,
          student_id: studentId || undefined,
        }),
      });
      setCart({}); setStudentId('');
      showSuccess(`تم تسجيل البيع — الإجمالي ${Number(res?.data?.total || total).toLocaleString()} ج.م`);
      props.invalidate('canteen-products'); props.invalidate('canteen-sales'); props.invalidate('canteen-movements'); props.invalidate('canteen-low');
    } catch (e: any) { showError(e.message || 'تعذر تسجيل البيع'); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث عن منتج..."
            className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 text-sm font-bold" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {shownProducts.map(p => {
            const eff = effectivePrice(p.sell_price, p.discount_type, p.discount_value);
            return (
            <button key={p.id} onClick={() => add(p.id)} disabled={Number(p.quantity_on_hand) <= 0}
              className="text-right bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 hover:border-primary-300 transition-all disabled:opacity-50">
              {p.image_url && <img src={p.image_url} alt={p.name} className="w-1/2 mx-auto aspect-square object-contain rounded-xl mb-2 bg-slate-50 dark:bg-white/5" />}
              <h3 className="font-black text-slate-900 dark:text-white truncate">{p.name}</h3>
              <div className="mt-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  {eff < Number(p.sell_price) && <span className="text-[11px] font-bold text-slate-400 line-through">{Number(p.sell_price).toLocaleString()}</span>}
                  <span className="font-black text-primary-600">{eff.toLocaleString()} ج.م</span>
                </span>
                <span className={`text-[11px] font-bold ${Number(p.quantity_on_hand) <= Number(p.min_quantity) ? 'text-rose-500' : 'text-slate-400'}`}>متبقٍ {p.quantity_on_hand}</span>
              </div>
            </button>
            );
          })}
          {shownProducts.length === 0 && <div className="col-span-full p-10 text-center text-sm font-bold text-slate-400">لا توجد منتجات مفعّلة</div>}
        </div>
      </div>
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 sticky top-2 space-y-3">
          <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white"><ShoppingCart size={18} /> الفاتورة</div>
          {lines.length === 0 && <p className="text-xs text-slate-400 font-bold py-4 text-center">لم تُضف منتجات بعد</p>}
          <div className="space-y-2">
            {lines.map(l => (
              <div key={l.product!.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{l.product!.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={() => dec(l.product!.id)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center"><Minus size={12} /></button>
                  <span className="font-black w-5 text-center">{l.qty}</span>
                  <button onClick={() => add(l.product!.id)} className="w-6 h-6 rounded-lg bg-primary-500 text-white flex items-center justify-center"><Plus size={12} /></button>
                </div>
              </div>
            ))}
          </div>
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
            <option value="cash">نقدي</option>
            <option value="card">بطاقة</option>
            <option value="wallet">محفظة</option>
          </select>
          <select value={studentId} onChange={e => setStudentId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
            <option value="">اختر الطالب (اختياري)</option>
            {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.room_name ? ` — غرفة ${s.room_name}` : ''}{s.apartment_name ? ` / ${s.apartment_name}` : ''}</option>)}
          </select>
          {selectedStudent && (
            <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
              {selectedStudent.phone && <div>تليفون: {selectedStudent.phone}</div>}
              {(selectedStudent.apartment_name || selectedStudent.room_name) && <div>الشقة: {selectedStudent.apartment_name || '—'}{selectedStudent.room_name ? ` — غرفة ${selectedStudent.room_name}` : ''}</div>}
            </div>
          )}
          <div className="flex items-center justify-between font-black text-slate-900 dark:text-white">
            <span>الإجمالي</span><span>{total.toLocaleString()} ج.م</span>
          </div>
          <button onClick={submit} disabled={busy || lines.length === 0} className="w-full py-3 rounded-xl bg-primary-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} تسجيل البيع
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductsTab(props: { categories: Category[]; products: Product[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError, confirm } = useSnackbar();
  const [catName, setCatName] = useState('');
  const emptyProductForm = { name: '', category_id: '', unit: 'قطعة', barcode: '', cost_price: '', sell_price: '', quantity_on_hand: '', min_quantity: '', is_active: true, image_url: '', discount_type: '', discount_value: '' };
  const [form, setForm] = useState(emptyProductForm);
  const [edit, setEdit] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setForm(emptyProductForm); setEdit(null); };

  const addCategory = async () => {
    if (!catName.trim()) return;
    try { await request('/api/canteen/categories', { method: 'POST', body: JSON.stringify({ name: catName.trim() }) }); setCatName(''); props.invalidate('canteen-categories'); showSuccess('أُضيف التصنيف'); }
    catch (e: any) { showError(e.message); }
  };
  const delCategory = async (id: string) => {
    if (!await confirm({ message: 'حذف التصنيف؟', type: 'danger' })) return;
    try { await request(`/api/canteen/categories/${id}`, { method: 'DELETE' }); props.invalidate('canteen-categories'); props.invalidate('canteen-products'); }
    catch (e: any) { showError(e.message); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const body: any = {
        name: form.name, category_id: form.category_id || undefined, unit: form.unit || undefined,
        barcode: form.barcode || undefined, cost_price: Number(form.cost_price) || 0, sell_price: Number(form.sell_price) || 0,
        min_quantity: Number(form.min_quantity) || 0, is_active: form.is_active,
        image_url: form.image_url || undefined,
        discount_type: form.discount_type || null,
        discount_value: Number(form.discount_value) || 0,
      };
      if (edit) await request(`/api/canteen/products/${edit.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await request('/api/canteen/products', { method: 'POST', body: JSON.stringify({ ...body, quantity_on_hand: Number(form.quantity_on_hand) || 0 }) });
      props.invalidate('canteen-products');
      showSuccess(edit ? 'تم التحديث' : 'أُضيف المنتج');
      reset();
    } catch (e: any) { showError(e.message); }
    finally { setBusy(false); }
  };
  const del = async (id: string) => {
    if (!await confirm({ message: 'حذف المنتج؟', type: 'danger' })) return;
    try { await request(`/api/canteen/products/${id}`, { method: 'DELETE' }); props.invalidate('canteen-products'); }
    catch (e: any) { showError(e.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-3">
        <h3 className="font-black text-slate-900 dark:text-white">التصنيفات</h3>
        <div className="flex gap-2">
          <input value={catName} onChange={e => setCatName(e.target.value)} placeholder="اسم التصنيف" className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
          <button onClick={addCategory} className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-bold"><Plus size={16} /></button>
        </div>
        <div className="space-y-1.5">
          {props.categories.map(c => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{c.name}</span>
              <button onClick={() => delCategory(c.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg p-1"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-3">
        <h3 className="font-black text-slate-900 dark:text-white">{edit ? 'تعديل منتج' : 'إضافة منتج'}</h3>
        <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="اسم المنتج" className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
        <div className="grid grid-cols-2 gap-2">
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
            <option value="">بدون تصنيف</option>
            {props.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="الوحدة" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
          <input value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} type="number" placeholder="سعر التكلفة" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
          <input value={form.sell_price} onChange={e => setForm({ ...form, sell_price: e.target.value })} type="number" placeholder="سعر البيع" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
          {!edit && <input value={form.quantity_on_hand} onChange={e => setForm({ ...form, quantity_on_hand: e.target.value })} type="number" placeholder="الكمية الافتتاحية" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />}
          <input value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })} type="number" placeholder="حد التنبيه" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
          <select value={form.discount_type} onChange={e => setForm({ ...form, discount_type: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
            <option value="">بدون خصم</option>
            <option value="percent">خصم نسبة %</option>
            <option value="amount">خصم مبلغ</option>
          </select>
          <input value={form.discount_value} onChange={e => setForm({ ...form, discount_value: e.target.value })} type="number" disabled={!form.discount_type} placeholder="قيمة الخصم" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold disabled:opacity-50" />
        </div>
        <ImageUploadField value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> مفعّل
        </label>
        <div className="flex gap-2">
          <button onClick={save} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-black disabled:opacity-50">{edit ? 'حفظ' : 'إضافة'}</button>
          {edit && <button onClick={reset} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">إلغاء</button>}
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {props.products.map(p => (
            <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{p.name} — {Number(p.sell_price).toLocaleString()} ج.م{p.discount_type ? ` (خصم ${p.discount_type === 'percent' ? `${p.discount_value}%` : p.discount_value})` : ''} ({p.quantity_on_hand})</span>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEdit(p); setForm({ name: p.name, category_id: p.category_id || '', unit: p.unit || '', barcode: p.barcode || '', cost_price: String(p.cost_price), sell_price: String(p.sell_price), quantity_on_hand: '', min_quantity: String(p.min_quantity), is_active: flag(p.is_active, true), image_url: p.image_url || '', discount_type: p.discount_type || '', discount_value: p.discount_value ? String(p.discount_value) : '' }); }} className="text-primary-600 hover:bg-primary-50 rounded-lg p-1"><Pencil size={14} /></button>
                <button onClick={() => del(p.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StockTab(props: { products: Product[]; movements: Movement[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError } = useSnackbar();
  const [mode, setMode] = useState<'purchase' | 'waste' | 'adjustment'>('purchase');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!productId || !quantity) { showError('اختر المنتج والكمية'); return; }
    setBusy(true);
    try {
      const url = `/api/canteen/stock/${mode}`;
      const body = mode === 'purchase'
        ? { product_id: productId, quantity: Number(quantity), unit_cost: Number(unitCost) || 0, note: reason || undefined }
        : mode === 'waste'
          ? { product_id: productId, quantity: Number(quantity), reason: reason || undefined }
          : { product_id: productId, new_quantity: Number(quantity), reason: reason || undefined };
      await request(url, { method: 'POST', body: JSON.stringify(body) });
      showSuccess('تم تسجيل الحركة');
      setQuantity(''); setReason(''); setUnitCost('');
      props.invalidate('canteen-products'); props.invalidate('canteen-movements'); props.invalidate('canteen-low');
    } catch (e: any) { showError(e.message); }
    finally { setBusy(false); }
  };

  const nameOf = (id: string) => props.products.find(p => p.id === id)?.name || id;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-3">
        <h3 className="font-black text-slate-900 dark:text-white">حركة مخزون</h3>
        <div className="flex gap-2">
          {(['purchase', 'waste', 'adjustment'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-xl text-xs font-bold ${mode === m ? 'bg-primary-500 text-white' : 'bg-slate-50 dark:bg-white/5 text-slate-500'}`}>{MOVEMENT_LABELS[m] || m}</button>
          ))}
        </div>
        <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
          <option value="">اختر المنتج</option>
          {props.products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity_on_hand})</option>)}
        </select>
        <input value={quantity} onChange={e => setQuantity(e.target.value)} type="number" placeholder={mode === 'adjustment' ? 'الكمية الصحيحة بعد الجرد' : 'الكمية'} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
        {mode === 'purchase' && <input value={unitCost} onChange={e => setUnitCost(e.target.value)} type="number" placeholder="تكلفة الوحدة (اختياري)" className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />}
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="ملاحظة (اختياري)" className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
        <button onClick={submit} disabled={busy} className="w-full py-2.5 rounded-xl bg-primary-500 text-white text-sm font-black disabled:opacity-50">تسجيل</button>
      </div>
      <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-2 max-h-[28rem] overflow-y-auto">
        <h3 className="font-black text-slate-900 dark:text-white">آخر الحركات</h3>
        {props.movements.length === 0 && <p className="text-xs text-slate-400 font-bold text-center py-4">لا توجد حركات</p>}
        {props.movements.map(m => (
          <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 text-sm">
            <div>
              <p className="font-bold text-slate-700 dark:text-slate-200">{nameOf(m.product_id)}</p>
              <p className="text-[11px] text-slate-400">{new Date(m.created_at).toLocaleString('ar-EG')}{m.note ? ` • ${m.note}` : ''}</p>
            </div>
            <span className={`font-black ${Number(m.quantity) < 0 ? 'text-rose-500' : 'text-emerald-600'}`}>{MOVEMENT_LABELS[m.movement_type] || m.movement_type} {Number(m.quantity) > 0 ? '+' : ''}{m.quantity}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesTab(props: { sales: Sale[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError } = useSnackbar();
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submitReturn = async () => {
    if (!returnSale) return;
    const items = Object.entries(retQty).filter(([, q]) => q > 0).map(([product_id, qty]) => ({ product_id, quantity: qty }));
    if (items.length === 0) { showError('حدّد كميات الإرجاع'); return; }
    setBusy(true);
    try {
      await request('/api/canteen/returns', { method: 'POST', body: JSON.stringify({ sale_id: returnSale.id, items, reason: reason || undefined }) });
      showSuccess('تم تسجيل المرتجع');
      setReturnSale(null); setRetQty({}); setReason('');
      props.invalidate('canteen-sales'); props.invalidate('canteen-products'); props.invalidate('canteen-movements'); props.invalidate('canteen-low');
    } catch (e: any) { showError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      {props.sales.length === 0 && <div className="bg-white dark:bg-card-dark rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-sm font-bold text-slate-400">لا توجد فواتير</div>}
      {props.sales.map(s => (
        <div key={s.id} className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${s.status === 'returned' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{s.status === 'returned' ? 'مرتجعة' : 'مكتملة'}</span>
              <span className="text-xs font-bold text-slate-400">{s.sale_ref} • {new Date(s.sold_at).toLocaleString('ar-EG')}</span>
            </div>
            <span className="font-black text-slate-900 dark:text-white">{Number(s.total).toLocaleString()} ج.م</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
            {s.items?.map(it => <span key={it.id}>{it.product_name} × {it.quantity}</span>)}
          </div>
          {s.customer_name && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-slate-400">
              <span>المشتري: {s.customer_name}</span>
              {s.customer_phone && <span>تليفون: {s.customer_phone}</span>}
              {s.apartment_name && <span>الشقة: {s.apartment_name}</span>}
              {s.room_name && <span>غرفة: {s.room_name}</span>}
            </div>
          )}
          {s.status !== 'returned' && (
            <button onClick={() => { setReturnSale(s); setRetQty({}); setReason(''); }} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-white/5 text-xs font-bold text-slate-600 dark:text-slate-300">
              <RotateCcw size={13} /> مرتجع
            </button>
          )}
          {returnSale?.id === s.id && (
            <div className="mt-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 space-y-2">
              {s.items.map(it => (
                <div key={it.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-slate-600 dark:text-slate-300">{it.product_name} (المباع {it.quantity})</span>
                  <input type="number" min={0} max={it.quantity} value={retQty[it.product_id] ?? ''} onChange={e => setRetQty(q => ({ ...q, [it.product_id]: Number(e.target.value) }))} className="w-20 px-2 py-1 rounded-lg bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 text-sm font-bold" />
                </div>
              ))}
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="سبب الإرجاع (اختياري)" className="w-full px-3 py-2 rounded-xl bg-white dark:bg-card-dark border border-slate-100 dark:border-white/5 text-sm font-bold" />
              <div className="flex gap-2">
                <button onClick={submitReturn} disabled={busy} className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-bold disabled:opacity-50">تأكيد المرتجع</button>
                <button onClick={() => setReturnSale(null)} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">إلغاء</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LowStockTab({ products }: { products: Product[] }) {
  if (products.length === 0) return <div className="bg-white dark:bg-card-dark rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-sm font-bold text-slate-400">لا توجد تنبيهات — المخزون بحالة جيدة</div>;
  return (
    <div className="space-y-2">
      {products.map(p => (
        <div key={p.id} className="flex items-center justify-between bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-500" size={20} />
            <span className="font-black text-slate-800 dark:text-slate-100">{p.name}</span>
          </div>
          <span className="text-sm font-bold text-amber-700">المتوفر {p.quantity_on_hand} / الحد {p.min_quantity}</span>
        </div>
      ))}
    </div>
  );
}

function OperatorsTab(props: { operators: Operator[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError } = useSnackbar();
  const usersQuery = useApiQuery<{ data: AssignableUser[] }>(['canteen-assignable'], '/api/canteen/assignable-users');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  const assigned = new Set(props.operators.map(o => o.user_id));
  const candidates = (usersQuery.data?.data ?? []).filter(u => !assigned.has(u.id));

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try { await request('/api/canteen/operators', { method: 'POST', body: JSON.stringify({ userId: selected }) }); setSelected(''); props.invalidate('canteen-operators'); props.invalidate('canteen-assignable'); showSuccess('تم تعيين المسؤول'); }
    catch (e: any) { showError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (userId: string) => {
    try { await request(`/api/canteen/operators/${userId}`, { method: 'DELETE' }); props.invalidate('canteen-operators'); props.invalidate('canteen-assignable'); }
    catch (e: any) { showError(e.message); }
  };

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-4">
      <h3 className="font-black text-slate-900 dark:text-white">مسؤولو الكانتين</h3>
      <div className="flex gap-2">
        <select value={selected} onChange={e => setSelected(e.target.value)} className="flex-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
          <option value="">اختر مستخدمًا من سكان السكن</option>
          {candidates.map(u => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
        </select>
        <button onClick={add} disabled={busy || !selected} className="px-4 py-2 rounded-xl bg-primary-500 text-white text-sm font-bold disabled:opacity-50">تعيين</button>
      </div>
      <div className="space-y-1.5">
        {props.operators.length === 0 && <p className="text-xs text-slate-400 font-bold text-center py-4">لا يوجد مسؤولون بعد</p>}
        {props.operators.map(o => (
          <div key={o.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-white/5">
            <div>
              <p className="text-sm font-black text-slate-700 dark:text-slate-200">{o.name || o.user_id}</p>
              <p className="text-xs text-slate-400">{o.email}</p>
            </div>
            <button onClick={() => remove(o.user_id)} className="text-rose-500 hover:bg-rose-50 rounded-lg p-1.5"><X size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
