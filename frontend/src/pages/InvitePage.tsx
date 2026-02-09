import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Camera, LinkIcon, CheckCircle } from 'lucide-react';
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

  // Loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    );
  }

  // Error (invite not found, expired)
  if (error || !inviteInfo) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="w-full max-w-md text-center">
          <LinkIcon className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Invite Not Found</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This invite link is invalid, expired, or has reached its maximum number of uses.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
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
      <div className="flex min-h-screen w-full items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Joined "{inviteInfo.group.name}"
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Redirecting to the group...
          </p>
        </div>
      </div>
    );
  }

  // Invite display
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2">
            <Camera className="h-6 w-6 text-accent" />
            <span className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
              PicAI
            </span>
          </Link>
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            You've been invited to join a group
          </p>
        </div>

        {/* Invite card */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/[0.02]">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
              <span className="text-xl font-bold text-accent">
                {inviteInfo.group.name[0]?.toUpperCase() || '?'}
              </span>
            </div>

            <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">
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
            <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {joinError}
            </div>
          )}

          {isAuthenticated ? (
            <div className="mt-6">
              <button
                onClick={handleJoin}
                disabled={joinMutation.isPending}
                className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {joinMutation.isPending ? 'Joining...' : 'Join Group'}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              <Link
                to="/login"
                state={{ from: { pathname: `/invite/${token}` } }}
                className="block w-full rounded-lg bg-accent px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Sign in to Join
              </Link>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  state={{ from: { pathname: `/invite/${token}` } }}
                  className="font-medium text-accent hover:text-accent-hover"
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
