// src/components/groups/InviteLinkModal.tsx
// Modal for generating and copying group invite links

import { useState } from 'react';
import { useCreateInvite, useGroupInvites, useRevokeInvite } from '@/hooks/useGroups';

interface InviteLinkModalProps {
  isOpen: boolean;
  groupId: string;
  onClose: () => void;
}

export function InviteLinkModal({ isOpen, groupId, onClose }: InviteLinkModalProps) {
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(7);
  const [maxUses, setMaxUses] = useState<string>('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const createInviteMutation = useCreateInvite();
  const revokeInviteMutation = useRevokeInvite();
  const { data: invitesResponse } = useGroupInvites(groupId);

  const invites = invitesResponse?.data?.invites ?? [];

  if (!isOpen) return null;

  const handleGenerate = async () => {
    try {
      const result = await createInviteMutation.mutateAsync({
        groupId,
        expiresInDays,
        maxUses: maxUses ? parseInt(maxUses, 10) : undefined,
      });
      const token = result.data.invite.token;
      setGeneratedLink(`${window.location.origin}/invite/${token}`);
      setCopied(false);
    } catch (err) {
      console.error('Failed to create invite:', err);
    }
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input text
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInviteMutation.mutateAsync({ groupId, inviteId });
    } catch (err) {
      console.error('Failed to revoke invite:', err);
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setCopied(false);
    setMaxUses('');
    onClose();
  };

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return 'Never';
    const date = new Date(expiresAt);
    if (date < new Date()) return 'Expired';
    return date.toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Invite Link</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Generate a link to invite people to this group.
        </p>

        {/* Settings */}
        <div className="mt-4 flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Expires
            </label>
            <select
              value={expiresInDays ?? 'never'}
              onChange={(e) =>
                setExpiresInDays(e.target.value === 'never' ? undefined : parseInt(e.target.value))
              }
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="1">1 day</option>
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="never">Never</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
              Max uses (optional)
            </label>
            <input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              min="1"
              max="100"
              placeholder="Unlimited"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={createInviteMutation.isPending}
          className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
        >
          {createInviteMutation.isPending ? 'Generating...' : 'Generate Link'}
        </button>

        {/* Generated link */}
        {generatedLink && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              readOnly
              value={generatedLink}
              className="flex-1 rounded border border-gray-300 bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}

        {/* Existing invites */}
        {invites.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Active Invites ({invites.length})
            </h4>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between rounded px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="text-gray-600 dark:text-gray-400">
                    <span>Expires: {formatExpiry(invite.expiresAt)}</span>
                    <span className="mx-1">&middot;</span>
                    <span>
                      Used: {invite.useCount}
                      {invite.maxUses ? `/${invite.maxUses}` : ''}
                    </span>
                    {invite.creator && (
                      <>
                        <span className="mx-1">&middot;</span>
                        <span>by {invite.creator.name}</span>
                      </>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevoke(invite.id)}
                    disabled={revokeInviteMutation.isPending}
                    className="shrink-0 text-red-500 hover:text-red-700 disabled:opacity-50"
                  >
                    Revoke
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Close button */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
