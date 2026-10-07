// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RestoreStudentModal } from '../components/student/modals/RestoreStudentModal';

const mockRooms = [
  { id: '1', building: 'A', room_number: '101', current_occupancy: 2, capacity: 4 },
  { id: '2', building: 'B', room_number: '202', current_occupancy: 4, capacity: 4 },
  { id: '3', building: 'C', room_number: '303', current_occupancy: 1, capacity: 3 },
];

describe('RestoreStudentModal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <RestoreStudentModal isOpen={false} onClose={() => {}} onRestore={() => {}} loading={false} studentName="" roomId="" onRoomIdChange={() => {}} rooms={[]} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders title and student name when open', () => {
    render(
      <RestoreStudentModal isOpen={true} onClose={() => {}} onRestore={() => {}} loading={false} studentName="John Doe" roomId="" onRoomIdChange={() => {}} rooms={mockRooms} />
    );
    expect(screen.getByText('استعادة الطالب')).toBeTruthy();
    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('shows placeholder when no student name provided', () => {
    render(
      <RestoreStudentModal isOpen={true} onClose={() => {}} onRestore={() => {}} loading={false} studentName="" roomId="" onRoomIdChange={() => {}} rooms={mockRooms} />
    );
    expect(screen.getByText('طالب مؤرشف')).toBeTruthy();
  });

  it('only shows available rooms with occupancy < capacity', () => {
    render(
      <RestoreStudentModal isOpen={true} onClose={() => {}} onRestore={() => {}} loading={false} studentName="" roomId="" onRoomIdChange={() => {}} rooms={mockRooms} />
    );
    expect(screen.getByText(/عمارة A - غرفة 101/)).toBeTruthy();
    expect(screen.getByText(/عمارة C - غرفة 303/)).toBeTruthy();
    expect(screen.queryByText(/عمارة B - غرفة 202/)).toBeNull();
  });

  it('calls onRestore when restore button clicked', () => {
    const onRestore = vi.fn();
    render(
      <RestoreStudentModal isOpen={true} onClose={() => {}} onRestore={onRestore} loading={false} studentName="" roomId="" onRoomIdChange={() => {}} rooms={mockRooms} />
    );
    fireEvent.click(screen.getByText('تأكيد الاستعادة'));
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it('shows loading text when loading is true', () => {
    render(
      <RestoreStudentModal isOpen={true} onClose={() => {}} onRestore={() => {}} loading={true} studentName="" roomId="" onRoomIdChange={() => {}} rooms={mockRooms} />
    );
    expect(screen.getByText('جاري الاستعادة...')).toBeTruthy();
  });

  it('disables restore button when loading', () => {
    render(
      <RestoreStudentModal isOpen={true} onClose={() => {}} onRestore={() => {}} loading={true} studentName="" roomId="" onRoomIdChange={() => {}} rooms={mockRooms} />
    );
    const button = screen.getByText('جاري الاستعادة...').closest('button');
    expect(button?.disabled).toBe(true);
  });
});
