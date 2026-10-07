import { useAuth } from '../contexts/AuthContext';
import { AdminProfile } from './profiles/AdminProfile';
import { BishopProfile } from './profiles/BishopProfile';
import { PriestProfile } from './profiles/PriestProfile';
import { SupervisorProfile } from './profiles/SupervisorProfile';
import { EmployeeProfile } from './profiles/EmployeeProfile';
import { ParentProfile } from './profiles/ParentProfile';
import { StudentProfile } from './profiles/StudentProfile';

export function ProfilePage() {
  const { user } = useAuth();
  const role = user?.role || '';

  switch (role) {
    case 'admin':
      return <AdminProfile />;
    case 'bishop':
      return <BishopProfile />;
    case 'priest':
      return <PriestProfile />;
    case 'supervisor':
    case 'assistant_supervisor':
      return <SupervisorProfile />;
    case 'employee':
      return <EmployeeProfile />;
    case 'parent':
      return <ParentProfile />;
    case 'student':
      return <StudentProfile />;
    default:
      return (
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-slate-400 font-bold">دور غير معروف</p>
        </div>
      );
  }
}
