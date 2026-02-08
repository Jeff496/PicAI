// src/hooks/useGroups.ts
// TanStack Query hooks for groups, membership, and invites

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsService, type GetGroupsParams } from '@/services/groups';
import type {
  CreateGroupRequest,
  UpdateGroupRequest,
  CreateInviteRequest,
  EmailInviteRequest,
} from '@/types/api';

// Query key factory
export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  list: (params?: GetGroupsParams) => [...groupKeys.lists(), params] as const,
  details: () => [...groupKeys.all, 'detail'] as const,
  detail: (id: string) => [...groupKeys.details(), id] as const,
  members: (id: string) => [...groupKeys.detail(id), 'members'] as const,
  invites: (id: string) => [...groupKeys.detail(id), 'invites'] as const,
  inviteInfo: (token: string) => ['invite', token] as const,
};

// ============================================
// Group CRUD Hooks
// ============================================

export function useGroups(params?: GetGroupsParams) {
  return useQuery({
    queryKey: groupKeys.list(params),
    queryFn: () => groupsService.getGroups(params),
    staleTime: 1000 * 60 * 2,
  });
}

export function useGroup(groupId: string) {
  return useQuery({
    queryKey: groupKeys.detail(groupId),
    queryFn: () => groupsService.getGroup(groupId),
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateGroupRequest) => groupsService.createGroup(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...body }: UpdateGroupRequest & { groupId: string }) =>
      groupsService.updateGroup(groupId, body),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsService.deleteGroup(groupId),
    onSuccess: (_, groupId) => {
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}

// ============================================
// Membership Hooks
// ============================================

export function useGroupMembers(groupId: string) {
  return useQuery({
    queryKey: groupKeys.members(groupId),
    queryFn: () => groupsService.getMembers(groupId),
    enabled: !!groupId,
    staleTime: 1000 * 60 * 2,
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      userId,
      role,
    }: {
      groupId: string;
      userId: string;
      role: 'admin' | 'member';
    }) => groupsService.updateMemberRole(groupId, userId, role),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupsService.removeMember(groupId, userId),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.members(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsService.leaveGroup(groupId),
    onSuccess: (_, groupId) => {
      queryClient.removeQueries({ queryKey: groupKeys.detail(groupId) });
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}

// ============================================
// Invite Hooks
// ============================================

export function useGroupInvites(groupId: string) {
  return useQuery({
    queryKey: groupKeys.invites(groupId),
    queryFn: () => groupsService.getInvites(groupId),
    enabled: !!groupId,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...body }: CreateInviteRequest & { groupId: string }) =>
      groupsService.createInvite(groupId, body),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.invites(groupId) });
    },
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, inviteId }: { groupId: string; inviteId: string }) =>
      groupsService.revokeInvite(groupId, inviteId),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.invites(groupId) });
    },
  });
}

export function useSendEmailInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, ...body }: EmailInviteRequest & { groupId: string }) =>
      groupsService.sendEmailInvite(groupId, body),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: groupKeys.invites(groupId) });
    },
  });
}

// ============================================
// Public Invite Hooks
// ============================================

export function useInviteInfo(token: string) {
  return useQuery({
    queryKey: groupKeys.inviteInfo(token),
    queryFn: () => groupsService.getInviteInfo(token),
    enabled: !!token,
    retry: false,
  });
}

export function useJoinViaInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => groupsService.joinViaInvite(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: groupKeys.lists() });
    },
  });
}
