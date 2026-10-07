// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotFoundPage } from '../components/NotFoundPage';

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    render(<NotFoundPage onBack={() => {}} />);
    expect(screen.getByText('الصفحة غير موجودة')).toBeTruthy();
  });

  it('renders quick link buttons', () => {
    render(<NotFoundPage onBack={() => {}} />);
    expect(screen.getByText('لوحة التحكم')).toBeTruthy();
    expect(screen.getByText('الطلاب')).toBeTruthy();
    expect(screen.getByText('الغرف')).toBeTruthy();
  });

  it('calls onBack when clicking back button', () => {
    const onBack = vi.fn();
    render(<NotFoundPage onBack={onBack} />);
    fireEvent.click(screen.getByText('العودة للرئيسية'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders search input', () => {
    render(<NotFoundPage onBack={() => {}} />);
    const input = screen.getByPlaceholderText('ابحث عن صفحة...');
    expect(input).toBeTruthy();
  });

  it('renders all 6 quick link buttons', () => {
    render(<NotFoundPage onBack={() => {}} />);
    expect(screen.getByText('لوحة التحكم')).toBeTruthy();
    expect(screen.getByText('الطلاب')).toBeTruthy();
    expect(screen.getByText('الغرف')).toBeTruthy();
    expect(screen.getByText('المخازن')).toBeTruthy();
    expect(screen.getByText('الفعاليات')).toBeTruthy();
    expect(screen.getByText('الإعدادات')).toBeTruthy();
  });

  it('calls onBack when quick link is clicked', () => {
    const onBack = vi.fn();
    render(<NotFoundPage onBack={onBack} />);
    fireEvent.click(screen.getByText('لوحة التحكم'));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('calls onBack when search matches a valid link', () => {
    const onBack = vi.fn();
    render(<NotFoundPage onBack={onBack} />);
    const input = screen.getByPlaceholderText('ابحث عن صفحة...');
    fireEvent.change(input, { target: { value: 'الطلاب' } });
    fireEvent.submit(input.closest('form')!);
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('does not call onBack when search has no match', () => {
    const onBack = vi.fn();
    render(<NotFoundPage onBack={onBack} />);
    const input = screen.getByPlaceholderText('ابحث عن صفحة...');
    fireEvent.change(input, { target: { value: 'zzznonexistent' } });
    fireEvent.submit(input.closest('form')!);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('renders 404 heading text', () => {
    render(<NotFoundPage onBack={() => {}} />);
    expect(screen.getByText('404')).toBeTruthy();
  });
});
