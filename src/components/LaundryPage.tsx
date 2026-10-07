import { useState, useEffect, useCallback } from 'react';
import { useMounted } from '../hooks/useMounted';
import { AnimatePresence } from 'motion/react';
import { useApi } from '../hooks/useApi';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';
import { AppPermission } from '../types/permissions';
import { AddMachineModal } from './laundry/AddMachineModal';
import { LaundryQueueTab } from './laundry/LaundryQueueTab';
import { LaundryHeader } from './laundry/LaundryHeader';
import { LaundryTabNav } from './laundry/LaundryTabNav';
import { LaundryMachinesTab } from './laundry/LaundryMachinesTab';
import { LaundryOperatorsTab } from './laundry/LaundryOperatorsTab';
import { LaundrySettingsTab } from './laundry/LaundrySettingsTab';
import { LaundrySidebar } from './laundry/LaundrySidebar';
import { RenameMachineModal } from './laundry/RenameMachineModal';
import { AddOperatorModal } from './laundry/AddOperatorModal';

export function LaundryPage() {
  const { request } = useApi();
  const { user, hasPermission } = useAuth();
  const { showSnackbar } = useSnackbar();
  
  const [activeTab, setActiveTab] = useState<'queue' | 'machines' | 'operators' | 'settings'>('queue');
  const [machines, setMachines] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [operators, setOperators] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  
  const [addMachineOpen, setAddMachineOpen] = useState(false);
  const [machineName, setMachineName] = useState('');
  const [addOperatorOpen, setAddOperatorOpen] = useState(false);
  const [addMachineSaving, setAddMachineSaving] = useState(false);
  const [addOperatorSaving, setAddOperatorSaving] = useState(false);
  const [renameMachineSaving, setRenameMachineSaving] = useState(false);
  const { showSuccess, showError, showConfirm } = useSnackbar();
  const [selectedOperatorUser, setSelectedOperatorUser] = useState('');
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [renameMachine, setRenameMachine] = useState<{ id: string; name: string } | null>(null);
  const mounted = useMounted();

  const isStudent = user?.role?.toLowerCase() === 'student';
  const isLaundryManager = hasPermission(AppPermission.MANAGE_LAUNDRY);
  const isOperatorManager = hasPermission(AppPermission.MANAGE_LAUNDRY_OPERATORS);
  const [isAssignedOperator, setIsAssignedOperator] = useState(false);

  // تحديد مكان المستخدم الحالي في الطابور
  const currentUserInQueue = queue.find((q: any) => q.student_id === user?.id || q.user_id === user?.id);
  const userPosition = currentUserInQueue ? queue.indexOf(currentUserInQueue) + 1 : null;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, qRes, sRes, settRes] = await Promise.all([
        request('/api/laundry/machines'),
        request('/api/laundry/queue'),
        request('/api/laundry/session/active'),
        request('/api/laundry/settings')
      ]);
      if (!mounted.current) return;
      setMachines(mRes.data || []);
      setQueue(qRes.data || []);
      setSession(sRes.data || null);
      setSettings(settRes.data || null);
      
      const opCheck = await request('/api/laundry/is-operator');
      if (mounted.current) setIsAssignedOperator(!!opCheck.isOperator);
      
      if (isOperatorManager) {
        const oRes = await request('/api/laundry/operators');
        if (mounted.current) setOperators(oRes.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [request, isOperatorManager]);

  useEffect(() => {

    fetchData();
    
  }, [fetchData]);

  useEffect(() => {
    if (addOperatorOpen && isOperatorManager && availableUsers.length === 0) {
      request('/api/users')
        .then((res: any) => {
          const filtered = (res.data || []).filter((u: any) => 
            ['supervisor', 'employee', 'assistant_supervisor'].includes(u.role) &&
            !operators.some((op: any) => op.user_id === u.id)
          );
          if (mounted.current) setAvailableUsers(filtered);
        })
        .catch(e => { console.error(e); showError('فشل تحميل قائمة المستخدمين'); });
    }
  }, [addOperatorOpen, isOperatorManager]);

  const handleUpdateSettings = async () => {
      try {
          await request('/api/laundry/settings', { method: 'POST', body: JSON.stringify(settings) });
          showSuccess("تم حفظ الإعدادات بنجاح");
          fetchData();
      } catch (err: any) {
          showError(err.message);
      }
  };


  const handleRemoveOperator = async (userId: string) => {
    try {
      await request(`/api/laundry/operators/${userId}`, { method: 'DELETE' });
      setOperators(operators.filter((op: any) => op.user_id !== userId));
      showSnackbar('تم حذف مسؤول المغسلة', 'success');
    } catch (err: any) {
      showSnackbar(err.message || 'فشل الحذف', 'error');
    }
  };

  const handleStartSession = async () => {
    try {
      await request('/api/laundry/session/start', { method: 'POST' });
      fetchData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleCloseSession = async () => {
    try {
      await request('/api/laundry/session/close', { method: 'POST' });
      fetchData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleJoinQueue = async () => {
    setJoining(true);
    try {
      // توحيد المسار مع الداش بورد لضمان التزامن
      await request('/api/laundry/queue/join', { method: 'POST', body: JSON.stringify({ room_id: user?.tenantId }) });
      await fetchData(); // تحديث القائمة فوراً
    } catch (err: any) {
      showError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleCallNext = async (queueId: string, machineId: string) => {
    try {
      await request('/api/laundry/queue/call', {
        method: 'POST',
        body: JSON.stringify({ queueId, machineId })
      });
      fetchData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleComplete = async (queueId: string) => {
    try {
      await request('/api/laundry/queue/complete', {
        method: 'POST',
        body: JSON.stringify({ queueId })
      });
      fetchData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleCancel = async (queueId: string) => {
    try {
      await request('/api/laundry/queue/cancel', {
        method: 'POST',
        body: JSON.stringify({ queueId })
      });
      fetchData();
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleAddMachine = async () => {
    if (!machineName.trim()) return showError('الرجاء إدخال اسم الغسالة');
    setAddMachineSaving(true);
    try {
      await request('/api/laundry/machines', { method: 'POST', body: JSON.stringify({ name: machineName }) });
      setMachineName('');
      setAddMachineOpen(false);
      fetchData();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setAddMachineSaving(false);
    }
  };

  const handleAddOperator = async () => {
    if (!selectedOperatorUser) return showError('الرجاء اختيار مستخدم');
    setAddOperatorSaving(true);
    try {
      await request('/api/laundry/operators', { method: 'POST', body: JSON.stringify({ userId: selectedOperatorUser }) });
      setSelectedOperatorUser('');
      setAddOperatorOpen(false);
      fetchData();
    } catch (err: any) {
      showError(err.message);
    } finally {
      setAddOperatorSaving(false);
    }
  };

  const handleRenameMachine = async () => {
    if (!renameMachine || !renameMachine.name.trim()) return;
    setRenameMachineSaving(true);
    try {
      await request('/api/laundry/machines', {
        method: 'POST',
        body: JSON.stringify({ id: renameMachine.id, name: renameMachine.name })
      });
      setRenameMachine(null);
      fetchData();
      showSuccess('تم تغيير اسم الغسالة بنجاح');
    } catch (err: any) {
      showError(err.message);
    } finally {
      setRenameMachineSaving(false);
    }
  };

  const handleReportFault = async (machineId: string) => {
    const confirmed = await showConfirm('هل أنت متأكد من الإبلاغ عن عطل في هذه الغسالة؟');
    if (!confirmed) return;
    try {
      await request(`/api/laundry/machines/${machineId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'broken' })
      });
      fetchData();
      showSuccess('تم الإبلاغ عن العطل بنجاح');
    } catch (err: any) {
      showError(err.message);
    }
  };

  const handleFixMachine = async (machineId: string) => {
    try {
      await request(`/api/laundry/machines/${machineId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'available' })
      });
      fetchData();
      showSuccess('تم إصلاح الغسالة بنجاح');
    } catch (err: any) {
      showError(err.message);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'waiting': return { label: 'منتظر', color: 'bg-amber-50 text-amber-600' };
      case 'called': return { label: 'تم الاستدعاء', color: 'bg-blue-50 text-blue-600' };
      case 'completed': return { label: 'تم الانتهاء', color: 'bg-emerald-50 text-emerald-600' };
      case 'cancelled': return { label: 'ملغي', color: 'bg-slate-50 text-slate-400' };
      default: return { label: status, color: 'bg-slate-50 text-slate-600' };
    }
  };

  const isUserOperator = session && session.operator_id === user?.id;
  const canOperate = isLaundryManager || isUserOperator;

  // تشغيل وإيقاف المغسلة: مشرف السكن أو المسؤول المعين عن المغسلة فقط
  const canControlLaundry = user?.role === 'supervisor'
    || isAssignedOperator
    || hasPermission(AppPermission.START_LAUNDRY_SESSION)
    || hasPermission(AppPermission.CLOSE_LAUNDRY_SESSION);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <LaundryHeader
        session={session}
        canOperate={canControlLaundry}
        onStartSession={handleStartSession}
        onCloseSession={handleCloseSession}
      />

      <LaundryTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isStudent={isStudent}
        isLaundryManager={isLaundryManager}
        isOperatorManager={isOperatorManager}
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-8 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'queue' && (
              <LaundryQueueTab
                canOperate={canOperate}
                queue={queue}
                hasPermission={hasPermission}
                joining={joining}
                onJoinQueue={handleJoinQueue}
                onCallNext={handleCallNext}
                onComplete={handleComplete}
                onCancel={handleCancel}
                getStatusLabel={getStatusLabel}
                showConfirm={showConfirm}
                machines={machines}
                session={session}
                currentUserInQueue={currentUserInQueue}
                userPosition={userPosition}
                userId={user?.id}
              />
            )}

            {activeTab === 'machines' && !isStudent && (
              <LaundryMachinesTab
                machines={machines}
                canOperate={canOperate}
                isLaundryManager={isLaundryManager}
                onRename={setRenameMachine}
                onReportFault={handleReportFault}
                onFixMachine={handleFixMachine}
                onAddMachine={() => setAddMachineOpen(true)}
              />
            )}

            {activeTab === 'operators' && (
              <LaundryOperatorsTab
                operators={operators}
                onRemoveOperator={handleRemoveOperator}
                onAddOperator={() => setAddOperatorOpen(true)}
              />
            )}

            {activeTab === 'settings' && (
              <LaundrySettingsTab
                settings={settings}
                loading={loading}
                onSettingsChange={setSettings}
                onUpdateSettings={handleUpdateSettings}
                onInitDefault={() => setSettings({ start_hour: '08:00', end_hour: '22:00', days: [0, 1, 2, 3, 4, 5, 6] })}
              />
            )}
          </AnimatePresence>
        </div>

        <LaundrySidebar queue={queue} />
      </div>

      <AddMachineModal
        isOpen={addMachineOpen}
        onClose={() => setAddMachineOpen(false)}
        machineName={machineName}
        onMachineNameChange={setMachineName}
        onSave={handleAddMachine}
        saving={addMachineSaving}
      />

      <RenameMachineModal
        isOpen={renameMachine !== null}
        onClose={() => setRenameMachine(null)}
        machineName={renameMachine?.name ?? ''}
        onMachineNameChange={(name) => setRenameMachine(prev => prev ? { ...prev, name } : null)}
        onSave={handleRenameMachine}
        saving={renameMachineSaving}
      />

      <AddOperatorModal
        isOpen={addOperatorOpen}
        onClose={() => setAddOperatorOpen(false)}
        users={availableUsers}
        selectedUserId={selectedOperatorUser}
        onUserChange={setSelectedOperatorUser}
        onSave={handleAddOperator}
        saving={addOperatorSaving}
      />
    </div>
  );
}
