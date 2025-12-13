# Frontend CLAUDE.md - PicAI React Application

**Last Updated:** December 13, 2025
**Status:** Phase 4.7 Complete - Bulk Operations with SSE Progress Streaming

**Technology:** React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.2 + TailwindCSS 4.1.17 + Zustand 5.0.8 + Sonner 2.0.3

Frontend-specific guidance for the PicAI React application with November 2025 technology stack.

**See main `CLAUDE.md` in project root for overall architecture and conventions.**

---

## Technology Stack (November 2025)

- **Framework:** React 19.2.0 with TypeScript 5.9.3
- **Build Tool:** Vite 7.2.2 (Node.js 20.19+ or 22.12+ required)
- **Routing:** React Router DOM 7.9.6
- **Styling:** TailwindCSS 4.1.17 (CSS-first config, 3.5-5x faster)
- **State Management:** Zustand 5.0.8 with localStorage persistence
- **Server State:** TanStack Query 5.90.9 (React 19 compatible)
- **API Client:** Axios 1.13.2 (HTTP/2 experimental support)
- **Validation:** Zod 4.1.12 (14x faster, 57% smaller)
- **Notifications:** Sonner 2.0.3 (toast notifications for bulk operations)

---

## Critical Updates for November 2025

### 1. React 19 Compatibility Check
Before using React 19, run compatibility check:
```bash
~/PicAI/docs/check-react19-compatibility.sh
```

If incompatible packages found:
```bash
# Option 1: Stay on React 18
npm install react@18.3.1 react-dom@18.3.1

# Option 2: Replace incompatible packages
```

### 2. React 19 Breaking Changes

#### No forwardRef needed
```typescript
// Old (React 18)
const Input = forwardRef((props, ref) => {
  return <input ref={ref} {...props} />;
});

// New (React 19)
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}
```

#### Actions for async transitions
```typescript
import { useTransition } from 'react';

function UploadButton() {
  const [isPending, startTransition] = useTransition();
  
  const handleUpload = () => {
    startTransition(async () => {
      await uploadPhotos();
    });
  };

  return <button disabled={isPending}>Upload</button>;
}
```

#### use() API for promises
```typescript
import { use, Suspense } from 'react';

function PhotoList({ photosPromise }) {
  const photos = use(photosPromise); // Suspends until resolved
  return <div>{photos.map(p => <PhotoCard key={p.id} photo={p} />)}</div>;
}
```

### 3. TailwindCSS 4 Configuration

No more tailwind.config.js! Configure in CSS:

```css
/* src/index.css */
@import "tailwindcss";

@theme {
  --color-primary: oklch(59.1% 0.238 251.37);
  --color-secondary: oklch(69.7% 0.184 85.18);
  --radius-lg: 0.5rem;
  --font-sans: system-ui, -apple-system, sans-serif;
}

/* Container queries built-in */
@container (min-width: 768px) {
  .card {
    grid-template-columns: 1fr 2fr;
  }
}

/* New 3D transforms */
.photo-3d {
  @apply rotate-x-12 perspective-1000;
}
```

### 4. Vite 7 Requirements
```json
// package.json
{
  "engines": {
    "node": ">=20.19.0 || >=22.12.0"
  }
}
```

Browser targets upgraded:
- Chrome 107+ (was 87)
- Firefox 104+ (was 78)
- Safari 16+ (was 14)

---

## Project Structure (Actual Implementation)

```
frontend/
├── src/
│   ├── main.tsx                 # React + React Query entry point
│   ├── App.tsx                  # Root component with routing
│   ├── index.css                # TailwindCSS 4 configuration
│   ├── stores/
│   │   └── authStore.ts         # Zustand auth state with persistence
│   ├── services/
│   │   ├── api.ts               # Axios instance with JWT interceptors
│   │   ├── auth.ts              # Auth API (login, register, refresh)
│   │   ├── photos.ts            # Photo API (upload, list, delete, AI methods)
│   │   └── faces.ts             # Face detection & people management API
│   ├── hooks/
│   │   ├── usePhotos.ts         # TanStack Query hooks + AI mutation hooks
│   │   ├── useFaces.ts          # Face detection & people management hooks
│   │   └── useBulkProgress.ts   # SSE-based bulk operation progress tracking
│   ├── utils/
│   │   └── toast.ts             # Toast utilities for bulk operation feedback
│   ├── types/
│   │   └── api.ts               # TypeScript interfaces (Photo, Face, Person, BoundingBox)
│   ├── pages/
│   │   ├── LoginPage.tsx        # Login form
│   │   ├── RegisterPage.tsx     # Registration form
│   │   ├── PhotosPage.tsx       # Main gallery page with TagFilter
│   │   ├── PeoplePage.tsx       # People browser page
│   │   └── PersonPhotosPage.tsx # Photos of specific person
│   └── components/
│       ├── layout/
│       │   └── ProtectedRoute.tsx  # Auth route guard
│       ├── photos/
│       │   ├── index.ts         # Barrel export
│       │   ├── PhotoCard.tsx    # Individual photo card
│       │   ├── PhotoGrid.tsx    # Responsive photo grid
│       │   ├── UploadForm.tsx   # Drag-and-drop upload
│       │   ├── PhotoViewer.tsx  # Full-screen modal with TagManagement
│       │   ├── TagFilter.tsx    # Tag search/filter input
│       │   ├── TagManagement.tsx # Add/remove tags, re-analyze button
│       │   ├── BulkActionBar.tsx # Selection mode + bulk operations toolbar
│       │   └── BulkProgressModal.tsx # Real-time SSE progress modal
│       ├── faces/
│       │   ├── index.ts         # Barrel export
│       │   ├── FaceOverlay.tsx  # SVG face bounding boxes on images
│       │   ├── FaceTagPopup.tsx # Popup for tagging/naming faces
│       │   └── DetectFacesButton.tsx # Manual face detection trigger
│       └── people/
│           ├── index.ts         # Barrel export
│           ├── PersonCard.tsx   # Individual person card
│           └── PersonGrid.tsx   # Responsive people grid
├── public/
├── .env                          # DO NOT COMMIT
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
└── CLAUDE.md                     # This file
```

**Note:** Uses Zustand for auth state (not Context API as originally planned). See `/.claude/context/frontend/` for detailed documentation.

---

## API Integration with Backend (jose JWT)

### Axios Instance with JWT

```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests (backend uses jose for verification)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid (jose will reject it)
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Authentication Service

```typescript
// src/services/auth.service.ts
import api from './api';
import type { User } from '@/types/api.types';

interface LoginResponse {
  success: boolean;
  data: {
    user: User;
    token: string; // JWT generated by jose on backend
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    
    // Store JWT token (generated by jose)
    if (data.success && data.data.token) {
      localStorage.setItem('token', data.data.token);
    }
    
    return data;
  },

  async register(email: string, password: string, name: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/register', {
      email,
      password,
      name,
    });
    
    if (data.success && data.data.token) {
      localStorage.setItem('token', data.data.token);
    }
    
    return data;
  },

  logout(): void {
    localStorage.removeItem('token');
    window.location.href = '/login';
  },

  async getMe(): Promise<User> {
    const { data } = await api.get<{ success: boolean; data: User }>('/auth/me');
    return data.data;
  },
};
```

---

## TanStack Query 5.90.9 Integration

### Query Client Setup

```typescript
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
```

### Using with React 19 Suspense

```typescript
// src/hooks/usePhotos.ts
import { useSuspenseQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { Photo } from '@/types/api.types';

export function usePhotos() {
  // useSuspenseQuery for React 19 - data is never undefined!
  const { data } = useSuspenseQuery({
    queryKey: ['photos'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Photo[] }>('/photos');
      return data.data;
    },
  });

  return { photos: data }; // data is Photo[], not Photo[] | undefined
}

// Component using Suspense
function PhotoGrid() {
  const { photos } = usePhotos(); // Will suspend until loaded
  
  return (
    <div className="grid grid-cols-4 gap-4">
      {photos.map(photo => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}

// Parent with Suspense boundary
function PhotosPage() {
  return (
    <Suspense fallback={<PhotoSkeleton />}>
      <PhotoGrid />
    </Suspense>
  );
}
```

---

## React Router 7.9.5 Configuration

### Single Package Setup

```typescript
// src/main.tsx
import { createBrowserRouter, RouterProvider } from 'react-router'; // Single package!

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'login', element: <Login /> },
      { path: 'photos', element: <Photos /> },
      { path: 'albums/:id', element: <AlbumView /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}
```

### Data Loading with TypeScript

```typescript
// src/routes/photos.tsx
import { loader as photosLoader } from './photos.loader';

export async function loader() {
  const photos = await api.get('/photos');
  return photos.data;
}

// Type-safe access
function Photos() {
  const photos = useLoaderData() as Awaited<ReturnType<typeof photosLoader>>;
  return <PhotoGrid photos={photos} />;
}
```

---

## Forms with Zod 4 Validation

```typescript
// src/pages/Login.tsx
import { useState } from 'react';
import { z } from 'zod';
import { authService } from '@/services/auth.service';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const [formData, setFormData] = useState<LoginForm>({ 
    email: '', 
    password: '' 
  });
  const [errors, setErrors] = useState<z.ZodFormattedError<LoginForm> | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse(formData);
    
    if (!result.success) {
      setErrors(result.error.format());
      return;
    }
    
    try {
      // Backend will generate JWT with jose
      await authService.login(result.data.email, result.data.password);
      // Redirect handled by auth service
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={cn(
            "mt-1 block w-full rounded-md border-gray-300",
            errors?.email && "border-red-500"
          )}
        />
        {errors?.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email._errors[0]}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className={cn(
            "mt-1 block w-full rounded-md border-gray-300",
            errors?.password && "border-red-500"
          )}
        />
        {errors?.password && (
          <p className="mt-1 text-sm text-red-600">{errors.password._errors[0]}</p>
        )}
      </div>

      <button
        type="submit"
        className="w-full rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90"
      >
        Login
      </button>
    </form>
  );
}
```

---

## Package.json for November 2025

```json
{
  "name": "picai-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@tanstack/react-query": "^5.90.9",
    "react-router": "^7.9.5",
    "axios": "^1.13.2",
    "zod": "^4.1.12",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.460.0"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.1.0",
    "@tanstack/react-query-devtools": "^5.90.9",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.9.3",
    "vite": "^7.0.0",
    "eslint": "^9.39.1",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.4.24"
  },
  "engines": {
    "node": ">=20.19.0 || >=22.12.0"
  }
}
```

---

## Performance Optimization

### 1. React 19 Automatic Batching
```typescript
// React 19 batches these automatically
function handleClick() {
  setCount(c => c + 1);
  setFlag(f => !f);
  // Only one re-render!
}
```

### 2. Lazy Load with React.lazy
```typescript
import { lazy, Suspense } from 'react';

const AlbumView = lazy(() => import('./pages/AlbumView'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/albums/:id" element={<AlbumView />} />
      </Routes>
    </Suspense>
  );
}
```

### 3. Virtual Scrolling for Large Lists
```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function PhotoGrid({ photos }: { photos: Photo[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: photos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-screen overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <PhotoCard photo={photos[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Testing Patterns

```typescript
// tests/components/PhotoCard.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PhotoCard } from '@/components/photos/PhotoCard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

test('renders photo card with title', () => {
  const photo = {
    id: '1',
    filename: 'test.jpg',
    url: '/test.jpg',
    thumbnailUrl: '/thumb.jpg',
    uploadedAt: new Date().toISOString(),
  };
  
  render(<PhotoCard photo={photo} onDelete={() => {}} />, { wrapper });
  
  expect(screen.getByText('test.jpg')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', '/thumb.jpg');
});
```

---

## Bulk Operations with SSE Progress (Phase 4.7)

### useBulkProgress Hook

```typescript
// src/hooks/useBulkProgress.ts
import { useState, useCallback, useRef } from 'react';

export type BulkOperationType = 'detect-faces' | 're-analyze';

export function useBulkProgress() {
  const [progress, setProgress] = useState<BulkProgressState>(initialState);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startOperation = useCallback(async (
    operation: BulkOperationType,
    photoIds: string[]
  ): Promise<Summary> => {
    // POST to SSE endpoint
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({ photoIds }),
      signal: abortControllerRef.current.signal,
    });

    // Parse SSE events from readable stream
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    // ... parse events, update progress state
  }, [accessToken, queryClient]);

  return { startOperation, progress, cancel, reset };
}
```

### BulkProgressModal Component

```typescript
// Shows real-time progress during bulk operations
<BulkProgressModal
  isOpen={showProgressModal}
  operation={currentOperation}
  progress={progress}
  onCancel={cancel}
  onClose={() => setShowProgressModal(false)}
/>
```

### Toast Notifications (Sonner)

```typescript
// src/utils/toast.ts
import { toast } from 'sonner';

export function showBulkOperationToast(operation: BulkOperation, summary: BulkSummary): void {
  if (failed === 0) {
    toast.success(`Successfully processed ${count} photos`);
  } else if (succeeded === 0) {
    toast.error(`Operation failed for all ${count} photos`);
  } else {
    toast.warning(`${succeeded} succeeded, ${failed} failed`);
  }
}
```

### Key Patterns

1. **Use fetch, not EventSource** - EventSource only supports GET
2. **Abort controller for cancellation** - Allow users to cancel mid-operation
3. **Invalidate queries on completion** - Refresh cached data after bulk ops
4. **Toast for completion summary** - Success/warning/error based on results

---

## Important Reminders

1. **Use Zustand for auth state** - Not Context API (already implemented)
2. **Use `import.meta.env` not `process.env`** - Vite requirement
3. **Prefix env vars with VITE_** - or they won't be exposed
4. **Backend uses jose for JWT** - tokens are compatible
5. **TanStack Query 5.90** - Use for server state (photos, etc.)
6. **React Router DOM 7** - Use react-router-dom (not react-router)
7. **TailwindCSS 4** - Configure in CSS with `@theme`, not JS
8. **Vite 7** - Requires Node.js 20.19+ or 22.12+
9. **Use @ path alias** - Configure in vite.config.ts
10. **Blob URLs for auth-protected images** - Use useThumbnail hook
11. **Face detection is manual** - User must click "Detect Faces" button (not automatic)
12. **AWS Rekognition integration** - Face bounding boxes, tagging, and people management via useFaces hooks
13. **Bulk operations use SSE** - useBulkProgress hook for real-time progress tracking
14. **Sonner for toasts** - Use showBulkOperationToast() for bulk operation feedback

---

## Additional Documentation

For detailed examples and patterns, see:
- `/.claude/context/frontend/file-structure.md` - Complete file layout
- `/.claude/context/frontend/component-examples.md` - Full code examples
- `/.claude/context/frontend/common-mistakes.md` - Pitfalls to avoid
- `/.claude/context/shared/conventions.md` - Shared coding standards

---

**Last Updated:** December 13, 2025
**Status:** Phase 4.7 Complete - Bulk Operations with SSE Progress Streaming
**Domain:** piclyai.net
**New in Phase 4.7:** Bulk operations toolbar (BulkActionBar), SSE progress modal (BulkProgressModal), useBulkProgress hook for real-time streaming, Sonner toast notifications for operation feedback, selection mode for photo grid