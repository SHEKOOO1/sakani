// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmationModal } from '../components/ConfirmationModal';

describe('ConfirmationModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmationModal isOpen={false} onClose={() => {}} onConfirm={() => {}} title="Test" message="Message" />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and message when open', () => {
    render(
      <ConfirmationModal isOpen={true} onClose={() => {}} onConfirm={() => {}} title="حذف السجل" message="هل أنت متأكد؟" />
    );
    expect(screen.getByText('حذف السجل')).toBeTruthy();
    expect(screen.getByText('هل أنت متأكد؟')).toBeTruthy();
  });

  it('renders default confirm and cancel text', () => {
    render(
      <ConfirmationModal isOpen={true} onClose={() => {}} onConfirm={() => {}} title="Test" message="Message" />
    );
    expect(screen.getByText('تأكيد الحذف')).toBeTruthy();
    expect(screen.getByText('إلغاء')).toBeTruthy();
  });

  it('renders custom button text', () => {
    render(
      <ConfirmationModal isOpen={true} onClose={() => {}} onConfirm={() => {}} title="Test" message="Message" confirmText="نعم" cancelText="لا" />
    );
    expect(screen.getByText('نعم')).toBeTruthy();
    expect(screen.getByText('لا')).toBeTruthy();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmationModal isOpen={true} onClose={() => {}} onConfirm={onConfirm} title="Test" message="Message" />
    );
    fireEvent.click(screen.getByText('تأكيد الحذف'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel button clicked', () => {
    const onClose = vi.fn();
    render(
      <ConfirmationModal isOpen={true} onClose={onClose} onConfirm={() => {}} title="Test" message="Message" />
    );
    fireEvent.click(screen.getByText('إلغاء'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('applies danger styles by default', () => {
    render(
      <ConfirmationModal isOpen={true} onClose={() => {}} onConfirm={() => {}} title="Test" message="Message" />
    );
    const alertIcon = document.querySelector('.text-red-600');
    expect(alertIcon).toBeTruthy();
  });

  it('applies warning styles when type is warning', () => {
    render(
      <ConfirmationModal isOpen={true} onClose={() => {}} onConfirm={() => {}} title="Test" message="Message" type="warning" />
    );
    const alertIcon = document.querySelector('.text-amber-600');
    expect(alertIcon).toBeTruthy();
  });
});
