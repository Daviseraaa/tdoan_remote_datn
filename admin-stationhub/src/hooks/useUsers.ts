import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as usersApi from '@/src/api/users';
import { queryKeys } from '@/src/lib/queryKeys';
import type { CreateUserDto, UpdateUserDto } from '@/src/types/api';

export function useUsersList(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.users(params),
    queryFn: () => usersApi.listUsers(params),
    staleTime: 30_000,
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] });

  const create = useMutation({
    mutationFn: (dto: CreateUserDto) => usersApi.createUser(dto),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateUserDto }) =>
      usersApi.updateUser(id, dto),
    onSuccess: invalidate,
  });

  const toggleActive = useMutation({
    mutationFn: (id: string) => usersApi.toggleUserActive(id),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: string) => usersApi.deleteUser(id),
    onSuccess: invalidate,
  });

  return { create, update, toggleActive, remove };
}
