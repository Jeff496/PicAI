// src/services/groupService.ts
// Service layer for groups, membership, and invite operations

import { randomBytes } from 'crypto';
import prisma from '../prisma/client.js';
import type { Group, GroupMembership } from '../generated/prisma/client.js';

// ========== PERMISSION HELPERS ==========

/**
 * Check if user is the group owner
 */
export const isOwner = (group: Group, userId: string): boolean => group.createdBy === userId;

/**
 * Check if membership has admin role
 */
export const isAdmin = (membership: GroupMembership | null): boolean =>
  membership?.role === 'admin';

/**
 * Check if user can manage members (owner or admin)
 */
export const canManageMembers = (
  group: Group,
  membership: GroupMembership | null,
  userId: string
): boolean => isOwner(group, userId) || isAdmin(membership);

// ========== TOKEN GENERATION ==========

/**
 * Generate secure invite token (64 hex characters)
 */
export const generateInviteToken = (): string => randomBytes(32).toString('hex');

// ========== GROUP OPERATIONS ==========

export const groupService = {
  /**
   * Create a new group
   * Automatically adds creator as admin member
   */
  async createGroup(userId: string, name: string, description?: string) {
    return prisma.$transaction(async (tx) => {
      // Create group
      const group = await tx.group.create({
        data: {
          name,
          description,
          createdBy: userId,
        },
      });

      // Add creator as admin member
      await tx.groupMembership.create({
        data: {
          groupId: group.id,
          userId,
          role: 'admin',
        },
      });

      return group;
    });
  },

  /**
   * Get all groups user is a member of
   */
  async getUserGroups(userId: string, limit: number, offset: number) {
    const [groups, total] = await Promise.all([
      prisma.group.findMany({
        where: {
          members: { some: { userId } },
        },
        include: {
          _count: { select: { members: true, photos: true } },
          creator: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.group.count({
        where: { members: { some: { userId } } },
      }),
    ]);

    return { groups, total };
  },

  /**
   * Get group by ID with membership info
   */
  async getGroupById(groupId: string, userId: string) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { members: true, photos: true } },
      },
    });

    if (!group) return null;

    // Check membership
    const membership = await prisma.groupMembership.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });

    return { group, membership, isOwner: group.createdBy === userId };
  },

  /**
   * Update group details (owner only)
   */
  async updateGroup(groupId: string, name?: string, description?: string) {
    return prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
    });
  },

  /**
   * Delete group (cascades to memberships, invites)
   * Photos remain but groupId set to null (SetNull behavior)
   */
  async deleteGroup(groupId: string) {
    return prisma.group.delete({
      where: { id: groupId },
    });
  },

  // ========== MEMBERSHIP OPERATIONS ==========

  /**
   * Get all members of a group
   */
  async getGroupMembers(groupId: string) {
    return prisma.groupMembership.findMany({
      where: { groupId },
      include: {
        user: { select: { id: true, name: true, email: true, profilePictureUrl: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
  },

  /**
   * Update member role (owner only)
   */
  async updateMemberRole(groupId: string, targetUserId: string, role: 'admin' | 'member') {
    return prisma.groupMembership.update({
      where: { groupId_userId: { groupId, userId: targetUserId } },
      data: { role },
    });
  },

  /**
   * Remove member from group
   */
  async removeMember(groupId: string, targetUserId: string) {
    return prisma.groupMembership.delete({
      where: { groupId_userId: { groupId, userId: targetUserId } },
    });
  },

  // ========== INVITE OPERATIONS ==========

  /**
   * Create invite link for group
   */
  async createInvite(groupId: string, creatorId: string, expiresInDays?: number, maxUses?: number) {
    const token = generateInviteToken();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    return prisma.groupInvite.create({
      data: {
        groupId,
        token,
        expiresAt,
        maxUses,
        createdBy: creatorId,
      },
    });
  },

  /**
   * Get all active invites for a group
   */
  async getGroupInvites(groupId: string) {
    return prisma.groupInvite.findMany({
      where: { groupId },
      include: {
        creator: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get invite by token (public)
   */
  async getInviteByToken(token: string) {
    return prisma.groupInvite.findUnique({
      where: { token },
      include: {
        group: { select: { id: true, name: true, description: true } },
        creator: { select: { id: true, name: true } },
      },
    });
  },

  /**
   * Join group via invite token
   * Validates expiration, max uses, and duplicate membership
   * FIXED: Race condition - all validation inside transaction
   */
  async joinViaInvite(token: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      // Get invite inside transaction for consistent read
      const invite = await tx.groupInvite.findUnique({
        where: { token },
        include: {
          group: { select: { id: true, name: true, description: true } },
          creator: { select: { id: true, name: true } },
        },
      });

      if (!invite) {
        throw new Error('INVITE_NOT_FOUND');
      }

      // Check expiration
      if (invite.expiresAt && invite.expiresAt < new Date()) {
        throw new Error('INVITE_EXPIRED');
      }

      // Check max uses
      if (invite.maxUses && invite.useCount >= invite.maxUses) {
        throw new Error('INVITE_MAX_USES_REACHED');
      }

      // Check if already a member
      const existingMembership = await tx.groupMembership.findUnique({
        where: { groupId_userId: { groupId: invite.groupId, userId } },
      });

      if (existingMembership) {
        throw new Error('ALREADY_MEMBER');
      }

      // Increment use count
      await tx.groupInvite.update({
        where: { id: invite.id },
        data: { useCount: { increment: 1 } },
      });

      // Create membership
      return tx.groupMembership.create({
        data: {
          groupId: invite.groupId,
          userId,
          role: 'member',
        },
      });
    });
  },

  /**
   * Revoke (delete) an invite
   */
  async revokeInvite(inviteId: string) {
    return prisma.groupInvite.delete({
      where: { id: inviteId },
    });
  },
};
