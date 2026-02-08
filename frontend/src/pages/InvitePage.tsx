// src/pages/InvitePage.tsx
// Public invite acceptance page (works for both authenticated and unauthenticated users)

import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useInviteInfo, useJoinViaInvite } from '@/hooks/useGroups';
import { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

export function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const { data: inviteResponse, isLoading, error } = useInviteInfo(token || '');
  const joinMutation = useJoinViaInvite();

  const inviteInfo = inviteResponse?.data;

  const handleJoin = async () => {
    if (!token) return;
    setJoinError(null);

    try {
      const result = await joinMutation.mutateAsync(token);
      setJoined(true);
      // Navigate to group after brief delay so user sees success message
      setTimeout(() => {
        navigate(`/groups/${result.data.group.id}`);
      }, 1500);
    } catch (err) {
      const axiosError = err as AxiosError<ApiError>;
      const code = axiosError.response?.data?.code;

      if (code === 'ALREADY_MEMBER') {
        setJoinError('You are already a member of this group.');
      } else {
        setJoinError(axiosError.response?.data?.error || 'Failed to join group. Please try again.');
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Error state (invite not found, expired, etc.)
  if (error || !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md text-center">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Invite Not Found</h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">
            This invite link is invalid, expired, or has reached its maximum number of uses.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Successfully joined
  if (joined) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
        <div className="w-full max-w-md text-center">
          <svg
            className="mx-auto mb-4 h-16 w-16 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Joined "{inviteInfo.group.name}"
          </h2>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Redirecting to the group...</p>
        </div>
      </div>
    );
  }

  // Invite info display
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">PicAI</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            You've been invited to join a group
          </p>
        </div>

        {/* Invite card */}
        <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
          <div className="text-center">
            {/* Group icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
              <span className="text-2xl font-bold text-primary">
                {inviteInfo.group.name[0]?.toUpperCase() || '?'}
              </span>
            </div>

            <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
              {inviteInfo.group.name}
            </h2>
            {inviteInfo.group.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                {inviteInfo.group.description}
              </p>
            )}
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Invited by {inviteInfo.invitedBy.name}
              {inviteInfo.expiresAt && (
                <> &middot; Expires {new Date(inviteInfo.expiresAt).toLocaleDateString()}</>
              )}
            </p>
          </div>

          {joinError && (
            <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {joinError}
            </div>
          )}

          {isAuthenticated ? (
            /* Authenticated: show join button */
            <div className="mt-6">
              <button
                onClick={handleJoin}
                disabled={joinMutation.isPending}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joinMutation.isPending ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          ) : (
            /* Unauthenticated: show sign in / register links */
            <div className="mt-6 space-y-3">
              <Link
                to="/login"
                state={{ from: { pathname: `/invite/${token}` } }}
                className="block w-full rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-white hover:bg-primary-dark"
              >
                Sign in to Join
              </Link>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  state={{ from: { pathname: `/invite/${token}` } }}
                  className="font-medium text-primary hover:text-primary-dark"
                >
                  Sign up
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
