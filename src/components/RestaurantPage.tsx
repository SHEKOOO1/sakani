import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApi } from '../hooks/useApi';
import { useApiQuery } from '../hooks/useApiQuery';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import {
  UtensilsCrossed, Plus, Trash2, Pencil, ShoppingCart, ClipboardList,
  Settings2, UserCog, Loader2, Check, X, Minus,
} from 'lucide-react';

interface Category { id: string; name: string; sort_order: number; is_active: number | boolean; }
interface Item { id: string; name: string; category_id: string | null; description: string | null; price: number; is_available: number | boolean; is_included_meal: number | boolean; sort_order: number; }
interface OrderItem { id: string; item_name: string; unit_price: number; quantity: number; line_total: number; is_included_meal: number | boolean; }
interface Order { id: string; status: string; total: number; item_count: number; meal_slot: string | null; notes: string | null; created_at: string; ordered_by: string; student_id: string | null; items: OrderItem[]; }
interface Operator { id: string; user_id: string; name?: string; email?: string; role?: string; }
interface AssignableUser { id: string; name: string; email: string; role: string; }

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار', confirmed: 'مؤكد', preparing: 'قيد التحضير',
  ready: 'جاهز', served: 'تم التقديم', cancelled: 'ملغي',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700',
  preparing: 'bg-indigo-100 text-indigo-700', ready: 'bg-emerald-100 text-emerald-700',
  served: 'bg-slate-100 text-slate-600', cancelled: 'bg-rose-100 text-rose-700',
};

const flag = (v: unknown, fallback = true): boolean =>
  v === undefined || v === null ? fallback : v !== 0 && v !== '0' && v !== false && v !== 'false';

type Tab = 'menu' | 'orders' | 'manage' | 'operators';

export function RestaurantPage() {
  const { request } = useApi();
  const { hasPermission, user } = useAuth();
  const { showSuccess, showError, confirm } = useSnackbar();
  const queryClient = useQueryClient();

  const canOrder = hasPermission(AppPermission.ORDER_RESTAURANT);
  const canManage = hasPermission(AppPermission.MANAGE_RESTAURANT);
  const canManageOperators = hasPermission(AppPermission.MANAGE_RESTAURANT_OPERATORS);

  const [tab, setTab] = useState<Tab>('menu');

  const categoriesQuery = useApiQuery<{ data: Category[] }>(['restaurant-categories'], '/api/restaurant/categories');
  const itemsQuery = useApiQuery<{ data: Item[] }>(['restaurant-items'], '/api/restaurant/items');
  const ordersQuery = useApiQuery<{ data: Order[] }>(['restaurant-orders'], '/api/restaurant/orders', {}, { refetchInterval: 20000 });
  const operatorsQuery = useApiQuery<{ data: Operator[] }>(['restaurant-operators'], '/api/restaurant/operators', {}, { enabled: canManageOperators });

  const categories = categoriesQuery.data?.data ?? [];
  const items = itemsQuery.data?.data ?? [];
  const orders = ordersQuery.data?.data ?? [];

  const [cart, setCart] = useState<Record<string, number>>({});
  const [mealSlot, setMealSlot] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: [key] });

  const activeCategories = useMemo(
    () => categories.filter(c => flag(c.is_active, true)).sort((a, b) => a.sort_order - b.sort_order),
    [categories],
  );
  const availableItems = useMemo(
    () => items.filter(i => flag(i.is_available, true)),
    [items],
  );
  const cartLines = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ item: items.find(i => i.id === id), qty })).filter(l => l.item && l.qty > 0),
    [cart, items],
  );
  const cartTotal = cartLines.reduce((s, l) => s + (flag(l.item!.is_included_meal, false) ? 0 : Number(l.item!.price) * l.qty), 0);

  const addToCart = (id: string) => setCart(c => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const decFromCart = (id: string) => setCart(c => {
    const next = { ...c };
    if ((next[id] || 0) <= 1) delete next[id];
    else next[id] = next[id] - 1;
    return next;
  });

  const placeOrder = async () => {
    if (cartLines.length === 0) { showError('السلة فارغة'); return; }
    setBusy(true);
    try {
      await request('/api/restaurant/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cartLines.map(l => ({ item_id: l.item!.id, quantity: l.qty })),
          meal_slot: mealSlot || undefined,
          notes: notes || undefined,
        }),
      });
      setCart({}); setNotes('');
      showSuccess('تم إرسال الطلب بنجاح');
      invalidate('restaurant-orders');
    } catch (e: any) { showError(e.message || 'تعذر إرسال الطلب'); }
    finally { setBusy(false); }
  };

  const changeStatus = async (order: Order, action: string) => {
    setBusy(true);
    try {
      await request(`/api/restaurant/orders/${order.id}/status`, { method: 'POST', body: JSON.stringify({ action }) });
      showSuccess('تم تحديث حالة الطلب');
      invalidate('restaurant-orders');
    } catch (e: any) { showError(e.message || 'تعذر تحديث الطلب'); }
    finally { setBusy(false); }
  };

  const tabs: { id: Tab; label: string; icon: any; show: boolean }[] = [
    { id: 'menu', label: 'القائمة', icon: UtensilsCrossed, show: true },
    { id: 'orders', label: 'الطلبات', icon: ClipboardList, show: true },
    { id: 'manage', label: 'إدارة القائمة', icon: Settings2, show: canManage },
    { id: 'operators', label: 'المسؤولون', icon: UserCog, show: canManageOperators },
  ];

  const isStaff = ['admin', 'supervisor', 'priest', 'assistant_supervisor', 'employee', 'bishop'].includes((user?.role || '').toLowerCase());

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-vibrant-500 to-primary-500 flex items-center justify-center text-white shadow-lg">
          <UtensilsCrossed size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">المطعم</h1>
          <p className="text-xs font-bold text-slate-400">إدارة الوجبات والطلبات</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.filter(t => t.show).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              tab === t.id
                ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                : 'bg-white dark:bg-card-dark text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-white/5 hover:bg-slate-50'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'menu' && (
        <MenuTab
          categories={activeCategories}
          items={availableItems}
          cart={cart}
          cartLines={cartLines}
          cartTotal={cartTotal}
          canOrder={canOrder}
          mealSlot={mealSlot}
          notes={notes}
          busy={busy}
          onAdd={addToCart}
          onDec={decFromCart}
          onMealSlot={setMealSlot}
          onNotes={setNotes}
          onPlace={placeOrder}
        />
      )}

      {tab === 'orders' && (
        <OrdersTab
          orders={orders}
          loading={ordersQuery.isLoading}
          isStaff={isStaff}
          busy={busy}
          onChangeStatus={changeStatus}
        />
      )}

      {tab === 'manage' && canManage && (
        <ManageTab categories={categories} items={items} invalidate={invalidate} />
      )}

      {tab === 'operators' && canManageOperators && (
        <OperatorsTab operators={operatorsQuery.data?.data ?? []} invalidate={invalidate} />
      )}
    </div>
  );
}

function MenuTab(props: {
  categories: Category[]; items: Item[]; cart: Record<string, number>;
  cartLines: { item?: Item; qty: number }[]; cartTotal: number; canOrder: boolean;
  mealSlot: string; notes: string; busy: boolean;
  onAdd: (id: string) => void; onDec: (id: string) => void;
  onMealSlot: (v: string) => void; onNotes: (v: string) => void; onPlace: () => void;
}) {
  const [filter, setFilter] = useState<string>('all');
  const shown = filter === 'all' ? props.items : props.items.filter(i => i.category_id === filter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-100 dark:border-white/5'}`}>الكل</button>
          {props.categories.map(c => (
            <button key={c.id} onClick={() => setFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filter === c.id ? 'bg-slate-900 text-white' : 'bg-white dark:bg-card-dark text-slate-500 border border-slate-100 dark:border-white/5'}`}>{c.name}</button>
          ))}
        </div>
        {shown.length === 0 && <Empty text="لا توجد وجبات متاحة حاليًا" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shown.map(item => (
            <div key={item.id} className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-black text-slate-900 dark:text-white">{item.name}</h3>
                {flag(item.is_included_meal, false) && <span className="text-[10px] font-black px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">ضمن الإقامة</span>}
              </div>
              {item.description && <p className="text-xs text-slate-400 font-medium">{item.description}</p>}
              <div className="mt-auto flex items-center justify-between">
                <span className="font-black text-primary-600">{flag(item.is_included_meal, false) ? 'مجانًا' : `${Number(item.price).toLocaleString()} ج.م`}</span>
                {props.canOrder && (
                  <button onClick={() => props.onAdd(item.id)} className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary-500 text-white text-xs font-bold hover:bg-primary-600">
                    <Plus size={14} /> إضافة
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {props.canOrder && (
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 sticky top-2 space-y-3">
            <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white">
              <ShoppingCart size={18} /> السلة
            </div>
            {props.cartLines.length === 0 && <p className="text-xs text-slate-400 font-bold py-4 text-center">لم تُضف أي وجبة بعد</p>}
            <div className="space-y-2">
              {props.cartLines.map(l => (
                <div key={l.item!.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-bold text-slate-700 dark:text-slate-200 truncate">{l.item!.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => props.onDec(l.item!.id)} className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-white/5 flex items-center justify-center"><Minus size={12} /></button>
                    <span className="font-black w-5 text-center">{l.qty}</span>
                    <button onClick={() => props.onAdd(l.item!.id)} className="w-6 h-6 rounded-lg bg-primary-500 text-white flex items-center justify-center"><Plus size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <select value={props.mealSlot} onChange={e => props.onMealSlot(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
              <option value="">بدون وجبة محددة</option>
              <option value="breakfast">إفطار</option>
              <option value="lunch">غداء</option>
              <option value="dinner">عشاء</option>
            </select>
            <textarea value={props.notes} onChange={e => props.onNotes(e.target.value)} placeholder="ملاحظات (اختياري)" rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold resize-none" />
            <div className="flex items-center justify-between font-black text-slate-900 dark:text-white">
              <span>الإجمالي</span>
              <span>{props.cartTotal.toLocaleString()} ج.م</span>
            </div>
            <button onClick={props.onPlace} disabled={props.busy || props.cartLines.length === 0} className="w-full py-3 rounded-xl bg-primary-500 text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {props.busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} إرسال الطلب
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab(props: {
  orders: Order[]; loading: boolean; isStaff: boolean; busy: boolean;
  onChangeStatus: (o: Order, action: string) => void;
}) {
  if (props.loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-primary-500" /></div>;
  if (props.orders.length === 0) return <Empty text="لا توجد طلبات" />;

  const nextActions = (status: string): { action: string; label: string }[] => {
    switch (status) {
      case 'pending': return [{ action: 'confirm', label: 'تأكيد' }, { action: 'cancel', label: 'إلغاء' }];
      case 'confirmed': return [{ action: 'preparing', label: 'بدء التحضير' }, { action: 'cancel', label: 'إلغاء' }];
      case 'preparing': return [{ action: 'ready', label: 'جاهز' }, { action: 'cancel', label: 'إلغاء' }];
      case 'ready': return [{ action: 'serve', label: 'تم التقديم' }];
      default: return [];
    }
  };

  return (
    <div className="space-y-3">
      {props.orders.map(o => (
        <div key={o.id} className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-black px-2.5 py-1 rounded-lg ${STATUS_COLORS[o.status] || 'bg-slate-100 text-slate-600'}`}>{STATUS_LABELS[o.status] || o.status}</span>
              <span className="text-xs font-bold text-slate-400">{new Date(o.created_at).toLocaleString('ar-EG')}</span>
              {o.meal_slot && <span className="text-xs font-bold text-slate-400">• {o.meal_slot}</span>}
            </div>
            <span className="font-black text-slate-900 dark:text-white">{Number(o.total).toLocaleString()} ج.م</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
            {o.items?.map(it => (
              <span key={it.id}>{it.item_name} × {it.quantity}{flag(it.is_included_meal, false) ? ' (ضمن الإقامة)' : ''}</span>
            ))}
          </div>
          {o.notes && <p className="mt-2 text-xs text-slate-400">ملاحظات: {o.notes}</p>}
          {props.isStaff && (
            <div className="mt-3 flex flex-wrap gap-2">
              {nextActions(o.status).map(a => (
                <button key={a.action} disabled={props.busy} onClick={() => props.onChangeStatus(o, a.action)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50 ${a.action === 'cancel' ? 'bg-rose-50 text-rose-600' : 'bg-primary-500 text-white'}`}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ManageTab(props: { categories: Category[]; items: Item[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError, confirm } = useSnackbar();
  const [catName, setCatName] = useState('');
  const [itemForm, setItemForm] = useState({ name: '', price: '', category_id: '', is_included_meal: false, description: '' });
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);

  const addCategory = async () => {
    if (!catName.trim()) return;
    try { await request('/api/restaurant/categories', { method: 'POST', body: JSON.stringify({ name: catName.trim() }) }); setCatName(''); props.invalidate('restaurant-categories'); showSuccess('أُضيف التصنيف'); }
    catch (e: any) { showError(e.message); }
  };
  const delCategory = async (id: string) => {
    if (!await confirm({ message: 'حذف التصنيف؟ ستبقى الوجبات بدون تصنيف.', type: 'danger' })) return;
    try { await request(`/api/restaurant/categories/${id}`, { method: 'DELETE' }); props.invalidate('restaurant-categories'); props.invalidate('restaurant-items'); }
    catch (e: any) { showError(e.message); }
  };
  const saveItem = async () => {
    setBusy(true);
    try {
      const body = {
        name: itemForm.name,
        price: Number(itemForm.price) || 0,
        category_id: itemForm.category_id || undefined,
        is_included_meal: itemForm.is_included_meal,
        description: itemForm.description || undefined,
        is_available: true,
      };
      if (editItem) await request(`/api/restaurant/items/${editItem.id}`, { method: 'PUT', body: JSON.stringify(body) });
      else await request('/api/restaurant/items', { method: 'POST', body: JSON.stringify(body) });
      setItemForm({ name: '', price: '', category_id: '', is_included_meal: false, description: '' });
      setEditItem(null);
      props.invalidate('restaurant-items');
      showSuccess(editItem ? 'تم التحديث' : 'أُضيفت الوجبة');
    } catch (e: any) { showError(e.message); }
    finally { setBusy(false); }
  };
  const delItem = async (id: string) => {
    if (!await confirm({ message: 'حذف الوجبة؟', type: 'danger' })) return;
    try { await request(`/api/restaurant/items/${id}`, { method: 'DELETE' }); props.invalidate('restaurant-items'); }
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
        <h3 className="font-black text-slate-900 dark:text-white">{editItem ? 'تعديل وجبة' : 'إضافة وجبة'}</h3>
        <input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} placeholder="اسم الوجبة" className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
        <div className="grid grid-cols-2 gap-2">
          <input value={itemForm.price} onChange={e => setItemForm({ ...itemForm, price: e.target.value })} placeholder="السعر" type="number" className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold" />
          <select value={itemForm.category_id} onChange={e => setItemForm({ ...itemForm, category_id: e.target.value })} className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold">
            <option value="">بدون تصنيف</option>
            {props.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <textarea value={itemForm.description} onChange={e => setItemForm({ ...itemForm, description: e.target.value })} placeholder="الوصف (اختياري)" rows={2} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-sm font-bold resize-none" />
        <label className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
          <input type="checkbox" checked={itemForm.is_included_meal} onChange={e => setItemForm({ ...itemForm, is_included_meal: e.target.checked })} className="rounded" />
          ضمن الإقامة (بدون رسوم)
        </label>
        <div className="flex gap-2">
          <button onClick={saveItem} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-black disabled:opacity-50">{editItem ? 'حفظ التعديل' : 'إضافة'}</button>
          {editItem && <button onClick={() => { setEditItem(null); setItemForm({ name: '', price: '', category_id: '', is_included_meal: false, description: '' }); }} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-sm font-bold">إلغاء</button>}
        </div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {props.items.map(i => (
            <div key={i.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-white/5 gap-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{i.name} — {Number(i.price).toLocaleString()} ج.م</span>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditItem(i); setItemForm({ name: i.name, price: String(i.price), category_id: i.category_id || '', is_included_meal: flag(i.is_included_meal, false), description: i.description || '' }); }} className="text-primary-600 hover:bg-primary-50 rounded-lg p-1"><Pencil size={14} /></button>
                <button onClick={() => delItem(i.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OperatorsTab(props: { operators: Operator[]; invalidate: (k: string) => void }) {
  const { request } = useApi();
  const { showSuccess, showError } = useSnackbar();
  const usersQuery = useApiQuery<{ data: AssignableUser[] }>(['restaurant-assignable'], '/api/restaurant/assignable-users');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);

  const assigned = new Set(props.operators.map(o => o.user_id));
  const candidates = (usersQuery.data?.data ?? []).filter(u => !assigned.has(u.id));

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await request('/api/restaurant/operators', { method: 'POST', body: JSON.stringify({ userId: selected }) });
      setSelected(''); props.invalidate('restaurant-operators'); props.invalidate('restaurant-assignable');
      showSuccess('تم تعيين المسؤول');
    } catch (e: any) { showError(e.message); }
    finally { setBusy(false); }
  };
  const remove = async (userId: string) => {
    try { await request(`/api/restaurant/operators/${userId}`, { method: 'DELETE' }); props.invalidate('restaurant-operators'); props.invalidate('restaurant-assignable'); }
    catch (e: any) { showError(e.message); }
  };

  return (
    <div className="bg-white dark:bg-card-dark rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-4">
      <h3 className="font-black text-slate-900 dark:text-white">مسؤولو المطعم</h3>
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

function Empty({ text }: { text: string }) {
  return <div className="bg-white dark:bg-card-dark rounded-2xl border border-dashed border-slate-200 dark:border-white/10 p-10 text-center text-sm font-bold text-slate-400">{text}</div>;
}
