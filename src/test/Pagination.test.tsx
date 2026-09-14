// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Pagination } from '../components/Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} total={5} onPageChange={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders page numbers correctly', () => {
    render(
      <Pagination page={1} totalPages={5} total={25} onPageChange={() => {}} />
    );
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText(/إجمالي 25 نتيجة/)).toBeTruthy();
  });

  it('calls onPageChange when clicking a page button', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} totalPages={5} total={25} onPageChange={onPageChange} />
    );
    fireEvent.click(screen.getByText('3'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables previous button on first page', () => {
    render(
      <Pagination page={1} totalPages={5} total={25} onPageChange={() => {}} />
    );
    const prevButton = document.querySelector('button[disabled]');
    expect(prevButton).toBeTruthy();
  });

  it('disables next button on last page', () => {
    render(
      <Pagination page={5} totalPages={5} total={25} onPageChange={() => {}} />
    );
    const buttons = document.querySelectorAll('button');
    const lastButton = buttons[buttons.length - 1];
    expect(lastButton.hasAttribute('disabled')).toBe(true);
  });

  it('shows ellipsis for many pages', () => {
    render(
      <Pagination page={5} totalPages={10} total={50} onPageChange={() => {}} />
    );
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onPageChange from prev/next buttons', () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={3} totalPages={5} total={25} onPageChange={onPageChange} />
    );
    const buttons = document.querySelectorAll('button');
    fireEvent.click(buttons[0]); // prev
    expect(onPageChange).toHaveBeenCalledWith(2);
    fireEvent.click(buttons[buttons.length - 1]); // next
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('renders total text in Arabic correctly', () => {
    render(
      <Pagination page={2} totalPages={3} total={15} onPageChange={() => {}} />
    );
    expect(screen.getByText(/صفحة 2 من 3/)).toBeTruthy();
  });

  it('shows single page without ellipsis for 2 pages', () => {
    render(
      <Pagination page={1} totalPages={2} total={10} onPageChange={() => {}} />
    );
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('...')).toBeNull();
  });

  it('handles totalPages=0 gracefully', () => {
    const { container } = render(
      <Pagination page={1} totalPages={0} total={0} onPageChange={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('calls onPageChange when totalPages=1 does nothing', () => {
    const onPageChange = vi.fn();
    const { container } = render(
      <Pagination page={1} totalPages={1} total={5} onPageChange={onPageChange} />
    );
    expect(container.innerHTML).toBe('');
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('shows ellipsis on both sides when page is in middle', () => {
    render(
      <Pagination page={5} totalPages={10} total={50} onPageChange={() => {}} />
    );
    const ellipses = screen.getAllByText('...');
    expect(ellipses.length).toBe(2);
  });
});
