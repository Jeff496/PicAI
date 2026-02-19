// src/lib/queryClient.ts
// Shared QueryClient instance - extracted so it can be imported
// by both main.tsx (provider) and auth.ts (cache clearing on logout)

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
