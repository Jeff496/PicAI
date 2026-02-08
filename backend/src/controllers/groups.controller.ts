// src/controllers/groups.controller.ts
// Controllers for groups, membership, and invite operations

import type { Request, Response } from 'express';
import { groupService, isOwner, isAdmin, canManageMembers } from '../services/groupService.js';
import { emailService } from '../services/emailService.js';
import { env } from '../config/env.js';
import prisma from '../prisma/client.js';
import type { GetGroupsQuery } from '../schemas/groups.schema.js';

// ========== GROUP CRUD ==========

export const createGroup = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { name, description } = req.body;

  const group = await groupService.createGroup(userId, name, description);

  res.status(201).json({
    success: true,
    data: { group },
    message: 'Group created successfully',
  });
};

export const getGroups = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { limit, offset } = req.parsedQuery as GetGroupsQuery;

  const { groups, total } = await groupService.getUserGroups(userId, limit, offset);

  res.json({
    success: true,
    data: { groups },
    pagination: { total, limit, offset },
  });
};

export const getGroupById = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  const result = await groupService.getGroupById(id!, userId);

  if (!result) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  if (!result.membership) {
    res
      .status(403)
      .json({ success: false, error: 'Not a member of this group', code: 'NOT_GROUP_MEMBER' });
    return;
  }

  res.json({
    success: true,
    data: {
      group: result.group,
      membership: result.membership,
      isOwner: result.isOwner,
    },
  });
};

export const updateGroup = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { name, description } = req.body;

  const result = await groupService.getGroupById(id!, userId);

  if (!result?.group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  if (!isOwner(result.group, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner can update group', code: 'FORBIDDEN' });
    return;
  }

  const updated = await groupService.updateGroup(id!, name, description);

  res.json({
    success: true,
    data: { group: updated },
    message: 'Group updated successfully',
  });
};

export const deleteGroup = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  const result = await groupService.getGroupById(id!, userId);

  if (!result?.group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  if (!isOwner(result.group, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner can delete group', code: 'FORBIDDEN' });
    return;
  }

  await groupService.deleteGroup(id!);

  res.status(204).send();
};

// ========== MEMBERSHIP ==========

export const getGroupMembers = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  // Verify membership
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!membership) {
    res
      .status(403)
      .json({ success: false, error: 'Not a member of this group', code: 'NOT_GROUP_MEMBER' });
    return;
  }

  const members = await groupService.getGroupMembers(id!);
  const group = await prisma.group.findUnique({ where: { id: id! } });

  // Mark owner in response
  const membersWithRole = members.map((m) => ({
    ...m,
    isOwner: m.userId === group?.createdBy,
  }));

  res.json({
    success: true,
    data: { members: membersWithRole },
  });
};

export const updateMemberRole = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id, userId: targetUserId } = req.params;
  const { role } = req.body;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  // Only owner can change roles
  if (!isOwner(group, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner can change member roles', code: 'FORBIDDEN' });
    return;
  }

  // Cannot change owner's role
  if (targetUserId === group.createdBy) {
    res
      .status(400)
      .json({ success: false, error: 'Cannot change owner role', code: 'CANNOT_CHANGE_OWNER' });
    return;
  }

  const updated = await groupService.updateMemberRole(id!, targetUserId!, role);

  res.json({
    success: true,
    data: { membership: updated },
    message: `Member role updated to ${role}`,
  });
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id, userId: targetUserId } = req.params;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  const actorMembership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  const targetMembership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId: targetUserId! } },
  });

  if (!targetMembership) {
    res.status(404).json({ success: false, error: 'Member not found', code: 'MEMBER_NOT_FOUND' });
    return;
  }

  // Cannot remove owner
  if (targetUserId === group.createdBy) {
    res
      .status(400)
      .json({ success: false, error: 'Cannot remove group owner', code: 'CANNOT_REMOVE_OWNER' });
    return;
  }

  // Permission check: owner can remove anyone, admin can remove non-admins, user can remove self
  const isSelf = userId === targetUserId;
  const actorIsOwner = isOwner(group, userId);
  const actorIsAdmin = isAdmin(actorMembership);
  const targetIsAdmin = isAdmin(targetMembership);

  if (!isSelf && !actorIsOwner && !(actorIsAdmin && !targetIsAdmin)) {
    res
      .status(403)
      .json({ success: false, error: 'Not authorized to remove this member', code: 'FORBIDDEN' });
    return;
  }

  await groupService.removeMember(id!, targetUserId!);

  res.status(204).send();
};

export const leaveGroup = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  // Owner cannot leave (must delete or transfer ownership)
  if (isOwner(group, userId)) {
    res
      .status(400)
      .json({
        success: false,
        error: 'Owner cannot leave group. Delete the group instead.',
        code: 'OWNER_CANNOT_LEAVE',
      });
    return;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!membership) {
    res
      .status(400)
      .json({ success: false, error: 'Not a member of this group', code: 'NOT_GROUP_MEMBER' });
    return;
  }

  await groupService.removeMember(id!, userId);

  res.status(204).send();
};

// ========== INVITES ==========

export const createInvite = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { expiresInDays, maxUses } = req.body;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!canManageMembers(group, membership, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner or admin can create invites', code: 'FORBIDDEN' });
    return;
  }

  const invite = await groupService.createInvite(id!, userId, expiresInDays, maxUses);

  res.status(201).json({
    success: true,
    data: { invite },
    message: 'Invite created successfully',
  });
};

export const getGroupInvites = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!canManageMembers(group, membership, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner or admin can view invites', code: 'FORBIDDEN' });
    return;
  }

  const invites = await groupService.getGroupInvites(id!);

  res.json({
    success: true,
    data: { invites },
  });
};

export const revokeInvite = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id, inviteId } = req.params;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!canManageMembers(group, membership, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner or admin can revoke invites', code: 'FORBIDDEN' });
    return;
  }

  const invite = await prisma.groupInvite.findUnique({ where: { id: inviteId! } });

  if (!invite || invite.groupId !== id) {
    res.status(404).json({ success: false, error: 'Invite not found', code: 'INVITE_NOT_FOUND' });
    return;
  }

  await groupService.revokeInvite(inviteId!);

  res.status(204).send();
};

// Public endpoint - no auth required
export const getInviteInfo = async (req: Request, res: Response): Promise<void> => {
  const { token } = req.params;

  const invite = await groupService.getInviteByToken(token!);

  if (!invite) {
    res
      .status(404)
      .json({ success: false, error: 'Invite not found or expired', code: 'INVITE_NOT_FOUND' });
    return;
  }

  // Check expiration
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    res.status(410).json({ success: false, error: 'Invite has expired', code: 'INVITE_EXPIRED' });
    return;
  }

  // Check max uses
  if (invite.maxUses && invite.useCount >= invite.maxUses) {
    res
      .status(410)
      .json({
        success: false,
        error: 'Invite has reached maximum uses',
        code: 'INVITE_MAX_USES_REACHED',
      });
    return;
  }

  res.json({
    success: true,
    data: {
      group: invite.group,
      invitedBy: invite.creator,
      expiresAt: invite.expiresAt,
    },
  });
};

export const joinViaInvite = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { token } = req.params;

  try {
    const membership = await groupService.joinViaInvite(token!, userId);

    const group = await prisma.group.findUnique({
      where: { id: membership.groupId },
      select: { id: true, name: true },
    });

    res.status(201).json({
      success: true,
      data: { group, membership },
      message: `Successfully joined ${group?.name}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    const errorMap: Record<string, { status: number; error: string }> = {
      INVITE_NOT_FOUND: { status: 404, error: 'Invite not found' },
      INVITE_EXPIRED: { status: 410, error: 'Invite has expired' },
      INVITE_MAX_USES_REACHED: { status: 410, error: 'Invite has reached maximum uses' },
      ALREADY_MEMBER: { status: 400, error: 'You are already a member of this group' },
    };

    const response = errorMap[message] || { status: 500, error: 'Failed to join group' };
    res.status(response.status).json({ success: false, error: response.error, code: message });
  }
};

// ========== EMAIL INVITES ==========

export const sendEmailInvite = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { email, expiresInDays } = req.body;

  const group = await prisma.group.findUnique({ where: { id: id! } });

  if (!group) {
    res.status(404).json({ success: false, error: 'Group not found', code: 'NOT_FOUND' });
    return;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!canManageMembers(group, membership, userId)) {
    res
      .status(403)
      .json({ success: false, error: 'Only owner or admin can send invites', code: 'FORBIDDEN' });
    return;
  }

  const inviter = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });

  // Create invite
  const invite = await groupService.createInvite(id!, userId, expiresInDays);

  // Build invite link
  const inviteLink = `${env.FRONTEND_URL}/invite/${invite.token}`;

  // Send email
  const emailSent = await emailService.sendGroupInvite({
    to: email,
    groupName: group.name,
    inviterName: inviter?.name || 'Someone',
    inviteLink,
    expiresAt: invite.expiresAt || undefined,
  });

  res.status(201).json({
    success: true,
    data: { invite, emailSent },
    message: emailSent
      ? 'Invite email sent successfully'
      : 'Invite created but email could not be sent',
  });
};

// ========== GROUP PHOTOS ==========

export const getGroupPhotos = async (req: Request, res: Response): Promise<void> => {
  const userId = req.user!.id;
  const { id } = req.params;
  const { limit = 50, offset = 0 } = (req.parsedQuery || {}) as { limit?: number; offset?: number };

  // Verify membership
  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId: id!, userId } },
  });

  if (!membership) {
    res
      .status(403)
      .json({ success: false, error: 'Not a member of this group', code: 'NOT_GROUP_MEMBER' });
    return;
  }

  const [photos, total] = await Promise.all([
    prisma.photo.findMany({
      where: { groupId: id! },
      include: {
        user: { select: { id: true, name: true } },
        aiTags: true,
      },
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.photo.count({ where: { groupId: id! } }),
  ]);

  res.json({
    success: true,
    data: { photos },
    pagination: { total, limit, offset },
  });
};
