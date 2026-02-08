// src/services/groups.ts
// Groups, membership, and invite API service

import api from './api';
import type {
  GroupsResponse,
  GroupDetailResponse,
  GroupResponse,
  GroupMembersResponse,
  GroupInvitesResponse,
  InviteResponse,
  InviteInfoResponse,
  JoinGroupResponse,
  EmailInviteResponse,
  CreateGroupRequest,
  UpdateGroupRequest,
  CreateInviteRequest,
  EmailInviteRequest,
} from '@/types/api';

export interface GetGroupsParams {
  limit?: number;
  offset?: number;
}

export const groupsService = {
  // ============================================
  // Group CRUD
  // ============================================

  async getGroups(params?: GetGroupsParams): Promise<GroupsResponse> {
    const { data } = await api.get<GroupsResponse>('/groups', {
      params: { limit: params?.limit ?? 50, offset: params?.offset ?? 0 },
    });
    return data;
  },

  async getGroup(groupId: string): Promise<GroupDetailResponse> {
    const { data } = await api.get<GroupDetailResponse>(`/groups/${groupId}`);
    return data;
  },

  async createGroup(body: CreateGroupRequest): Promise<GroupResponse> {
    const { data } = await api.post<GroupResponse>('/groups', body);
    return data;
  },

  async updateGroup(groupId: string, body: UpdateGroupRequest): Promise<GroupResponse> {
    const { data } = await api.put<GroupResponse>(`/groups/${groupId}`, body);
    return data;
  },

  async deleteGroup(groupId: string): Promise<void> {
    await api.delete(`/groups/${groupId}`);
  },

  // ============================================
  // Membership
  // ============================================

  async getMembers(groupId: string): Promise<GroupMembersResponse> {
    const { data } = await api.get<GroupMembersResponse>(`/groups/${groupId}/members`);
    return data;
  },

  async updateMemberRole(groupId: string, userId: string, role: 'admin' | 'member'): Promise<void> {
    await api.put(`/groups/${groupId}/members/${userId}`, { role });
  },

  async removeMember(groupId: string, userId: string): Promise<void> {
    await api.delete(`/groups/${groupId}/members/${userId}`);
  },

  async leaveGroup(groupId: string): Promise<void> {
    await api.delete(`/groups/${groupId}/leave`);
  },

  // ============================================
  // Invites
  // ============================================

  async createInvite(groupId: string, body?: CreateInviteRequest): Promise<InviteResponse> {
    const { data } = await api.post<InviteResponse>(`/groups/${groupId}/invites`, body ?? {});
    return data;
  },

  async getInvites(groupId: string): Promise<GroupInvitesResponse> {
    const { data } = await api.get<GroupInvitesResponse>(`/groups/${groupId}/invites`);
    return data;
  },

  async revokeInvite(groupId: string, inviteId: string): Promise<void> {
    await api.delete(`/groups/${groupId}/invites/${inviteId}`);
  },

  async sendEmailInvite(groupId: string, body: EmailInviteRequest): Promise<EmailInviteResponse> {
    const { data } = await api.post<EmailInviteResponse>(`/groups/${groupId}/invite-email`, body);
    return data;
  },

  // ============================================
  // Public Invite (GET is public, POST requires auth)
  // ============================================

  async getInviteInfo(token: string): Promise<InviteInfoResponse> {
    const { data } = await api.get<InviteInfoResponse>(`/invites/${token}`);
    return data;
  },

  async joinViaInvite(token: string): Promise<JoinGroupResponse> {
    const { data } = await api.post<JoinGroupResponse>(`/invites/${token}/join`);
    return data;
  },
};
