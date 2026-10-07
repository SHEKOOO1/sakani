// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AddStudentModal } from '../components/student/modals/AddStudentModal';

const defaultFormData = {
  name: '',
  email: '',
  password: '',
  studentIdNumber: '',
  birthDate: '',
  college: '',
  major: '',
  university: '',
  enrollmentYear: new Date().getFullYear(),
  studentPhoto: '',
  address: '',
  roomId: '',
  idCardNumber: '',
  billingCycle: 'monthly' as const,
  agreedPrice: 0,
  governorate: '',
  village: '',
  churchName: '',
  confessionFatherName: '',
  phoneNumbers: [],
  docTypes: {},
  isServant: false,
  isDeacon: false,
  servantServices: [],
  deaconRank: '',
  serviceTrainingCertificate: null,
};

describe('AddStudentModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AddStudentModal isOpen={false} onClose={() => {}} onSubmit={() => {}} formData={defaultFormData} setFormData={() => {}} rooms={[]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders the form when open', () => {
    render(
      <AddStudentModal isOpen={true} onClose={() => {}} onSubmit={() => {}} formData={defaultFormData} setFormData={() => {}} rooms={[]} />
    );
    expect(screen.getByText('تسجيل طالب جديد')).toBeTruthy();
    expect(screen.getByText('بيانات الحساب الأساسية')).toBeTruthy();
    expect(screen.getByPlaceholderText('الاسم الرباعي')).toBeTruthy();
  });

  it('renders phone number section with add button', () => {
    render(
      <AddStudentModal isOpen={true} onClose={() => {}} onSubmit={() => {}} formData={defaultFormData} setFormData={() => {}} rooms={[]} />
    );
    expect(screen.getByText('إضافة رقم')).toBeTruthy();
    expect(screen.getByText('لا توجد أرقام. اضغط "إضافة رقم".')).toBeTruthy();
  });

  it('renders room and billing select fields', () => {
    render(
      <AddStudentModal isOpen={true} onClose={() => {}} onSubmit={() => {}} formData={defaultFormData} setFormData={() => {}} rooms={[]} />
    );
    expect(screen.getByText('بانتظار التسكين')).toBeTruthy();
    expect(screen.getByText('يومي')).toBeTruthy();
    expect(screen.getByText('شهري')).toBeTruthy();
    expect(screen.getByText('للترم الدراسي')).toBeTruthy();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(
      <AddStudentModal isOpen={true} onClose={onClose} onSubmit={() => {}} formData={defaultFormData} setFormData={() => {}} rooms={[]} />
    );
    const closeButton = document.querySelector('button svg.lucide-x')?.closest('button');
    if (closeButton) fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onSubmit when form is submitted', () => {
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <AddStudentModal isOpen={true} onClose={() => {}} onSubmit={onSubmit} formData={defaultFormData} setFormData={() => {}} rooms={[]} />
    );
    const form = document.querySelector('form');
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
