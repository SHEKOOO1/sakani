import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useApi } from './useApi';

export function useStudentSearch(hasPermission: any) {
  const { request } = useApi();
  const [rooms, setRooms] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCriteria, setFilterCriteria] = useState({ room_number: '', status: 'active', enrollment_year: '', major: '', governorate: '', college: '', university: '', graduation_year: '', gender: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [sortField] = useState('name');
  const [sortOrder] = useState('asc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [fetchKey, setFetchKey] = useState(0);
  const [debouncedTerm, setDebouncedTerm] = useState('');

  const fetchRooms = useCallback(async () => {
    try {
      const resp = await request('/api/rooms');
      setRooms(resp.data);
    } catch (err) { console.error(err); }
  }, [request]);

  useEffect(() => {
    const canViewRooms = hasPermission;
    if (canViewRooms) fetchRooms();
  }, [fetchRooms, hasPermission]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setPage(1);
      setDebouncedTerm(searchTerm);
      setFetchKey(k => k + 1);
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, filterCriteria]);

  const { data, isLoading } = useQuery({
    queryKey: ['students', 'search', debouncedTerm, filterCriteria, sortField, sortOrder, page],
    queryFn: async () => {
      const query = new URLSearchParams({
        search: debouncedTerm, ...filterCriteria,
        sortField, sortOrder, page: String(page), limit: '20',
      }).toString();
      const response = await request(`/api/students?${query}`);
      setTotalPages(response.totalPages || 1);
      setTotal(response.total || 0);
      return response.data || [];
    },
    enabled: !!debouncedTerm || !!filterCriteria.status || page > 0,
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });

  return {
    students: data ?? [],
    setStudents: (v: any[]) => {},
    rooms, loading: isLoading, searchTerm, setSearchTerm,
    filterCriteria, setFilterCriteria, showFilters, setShowFilters,
    page, setPage, totalPages, total,
    fetchStudents: () => {},
    fetchRooms,
  };
}
