# Frontend CLAUDE.md - PicAI React Application

**Technology:** React 19.2.0 + TypeScript 5.9.3 + Vite 7.2.2 + TailwindCSS 4.1.17

Frontend-specific guidance for the PicAI React application.

**See main `CLAUDE.md` in project root for overall architecture and conventions.**

---

## Technology Stack

- **Framework:** React 19.2.0 with TypeScript 5.9.3
- **Build Tool:** Vite 7.2.2
- **Routing:** React Router 7.9.6
- **Styling:** TailwindCSS 4.1.17
- **State Management:** React Context + useReducer + React Query
- **Server State:** React Query 5.90.9
- **API Client:** Axios 1.13.2
- **Validation:** Zod 4.1.12
- **Icons:** Lucide React (recommended to install)
- **UI Components:** Build custom or use shadcn/ui

---

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx                 # Entry point
│   ├── App.tsx                  # Root component
│   ├── components/
│   │   ├── ui/                  # Reusable UI components
│   │   ├── auth/                # Login, Signup components
│   │   ├── photos/              # PhotoGrid, PhotoUploader, etc.
│   │   ├── albums/              # AlbumList, AlbumView, etc.
│   │   ├── groups/              # GroupList, GroupForm, etc.
│   │   └── layout/              # Header, Sidebar, Layout components
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Login.tsx
│   │   ├── Signup.tsx
│   │   ├── Albums.tsx
│   │   ├── Groups.tsx
│   │   └── NotFound.tsx
│   ├── context/
│   │   └── AuthContext.tsx      # Global auth state
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── usePhotos.ts
│   │   ├── useAlbums.ts
│   │   └── useGroups.ts
│   ├── services/
│   │   ├── api.ts               # Axios instance with interceptors
│   │   └── auth.service.ts
│   ├── types/
│   │   └── api.types.ts         # API response types
│   ├── utils/
│   │   ├── cn.ts                # Class name utility
│   │   └── format.ts            # Date/number formatting
│   └── index.css                # Global styles + Tailwind imports
├── public/
├── .env                          # DO NOT COMMIT
├── .env.example
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── index.html
└── CLAUDE.md                     # This file
```

---

## Code Conventions

### Component Naming
- **PascalCase** for components: `PhotoGrid.tsx`
- **camelCase** for hooks: `usePhotos.ts`
- **kebab-case** for utilities: `format-date.ts`

### Import Order
1. React imports
2. Third-party libraries
3. Components
4. Hooks
5. Services/Utils
6. Types
7. Styles

```typescript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import { PhotoGrid } from '@/components/photos/PhotoGrid';
import { usePhotos } from '@/hooks/usePhotos';
import { cn } from '@/utils/cn';

import type { Photo } from '@/types/api.types';
```

### TypeScript Conventions
- **Type vs Interface:** Use `type` for props, `interface` for API responses
- **Prefer `unknown` over `any`**
- Always type component props

```typescript
// ✅ Good
type PhotoCardProps = {
  photo: Photo;
  onDelete: (id: string) => void;
}

export function PhotoCard({ photo, onDelete }: PhotoCardProps) {
  return (
    <div className="photo-card">
      {/* ... */}
    </div>
  );
}

// ❌ Avoid
export function PhotoCard(props: any) {
  // ...
}
```

---

## Environment Variables

### CRITICAL: Use VITE_ Prefix

Vite only exposes env vars prefixed with `VITE_`:

```bash
# ✅ Correct - will be available in import.meta.env
VITE_API_URL=http://localhost:3001/api

# ❌ Wrong - will NOT be available
API_URL=http://localhost:3001/api
```

### Access in Code

```typescript
// ✅ Correct
const apiUrl = import.meta.env.VITE_API_URL;

// ❌ Wrong - process.env doesn't work in Vite
const apiUrl = process.env.VITE_API_URL;
```

### Environment Files

```bash
# .env - local development
VITE_API_URL=http://localhost:3001/api

# .env.example - commit to git
VITE_API_URL=http://localhost:3001/api
```

For production, set environment variables in **Azure Static Web Apps Configuration**.

---

## API Integration

### Axios Instance with Interceptors

```typescript
// src/services/api.ts
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
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
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### React Query Integration

```typescript
// src/hooks/usePhotos.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import type { Photo } from '@/types/api.types';

export function usePhotos() {
  const queryClient = useQueryClient();

  // Fetch photos
  const { data, isLoading, error } = useQuery({
    queryKey: ['photos'],
    queryFn: async () => {
      const { data } = await api.get<{ success: boolean; data: Photo[] }>('/photos');
      return data.data;
    },
  });

  // Upload photos
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/photos/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return data;
    },
    onSuccess: () => {
      // Refetch photos after upload
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  return { 
    photos: data ?? [], 
    isLoading, 
    error,
    uploadPhoto: uploadMutation.mutate,
    isUploading: uploadMutation.isPending
  };
}
```

### Type-Safe API Calls

```typescript
// src/types/api.types.ts
export interface Photo {
  id: string;
  filename: string;
  url: string;
  thumbnailUrl: string;
  uploadedAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code: string;
}

// Usage
const { data } = await api.get<ApiResponse<Photo[]>>('/photos');
const photos = data.data; // Typed as Photo[]
```

---

## Authentication Pattern

### Auth Context

```typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types/api.types';
import api from '@/services/api';

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(({ data }) => setUser(data.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    setUser(data.data.user);
    localStorage.setItem('token', data.data.token);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('token');
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        login, 
        logout, 
        isAuthenticated: !!user,
        isLoading 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### Protected Routes

```typescript
// src/components/auth/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

type ProtectedRouteProps = {
  children: React.ReactNode;
};

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Usage in App.tsx
<Route 
  path="/dashboard" 
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } 
/>
```

---

## Styling with TailwindCSS 4

### Using Utility Classes

```typescript
// ✅ Good - use Tailwind utilities
<div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow">
  <img src={photo.thumbnailUrl} className="w-24 h-24 object-cover rounded" />
  <div className="flex-1">
    <h3 className="text-lg font-semibold">{photo.filename}</h3>
  </div>
</div>

// ❌ Avoid - inline styles
<div style={{ display: 'flex', padding: '16px' }}>
```

### Conditional Classes with cn()

```typescript
// src/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
import { cn } from '@/utils/cn';

<button 
  className={cn(
    "px-4 py-2 rounded font-medium",
    isActive && "bg-blue-500 text-white",
    isDisabled && "opacity-50 cursor-not-allowed",
    className // Allow prop override
  )}
>
  {children}
</button>
```

### Responsive Design

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {/* Mobile: 1 column, Tablet: 2, Desktop: 3, Large: 4 */}
</div>
```

---

## Performance Optimization

### 1. Lazy Load Routes

```typescript
import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Albums = lazy(() => import('@/pages/Albums'));

function App() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/albums" element={<Albums />} />
      </Routes>
    </Suspense>
  );
}
```

### 2. Lazy Load Images

```typescript
<img 
  src={photo.url} 
  loading="lazy"
  alt={photo.filename}
  className="w-full h-auto"
/>
```

### 3. Memoize Expensive Computations

```typescript
import { useMemo } from 'react';

function PhotoList({ photos }: { photos: Photo[] }) {
  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => 
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  }, [photos]);

  return (
    <div>
      {sortedPhotos.map(photo => (
        <PhotoCard key={photo.id} photo={photo} />
      ))}
    </div>
  );
}
```

### 4. Virtual Scrolling for Large Lists

For 100+ photos, use virtual scrolling:

```bash
npm install @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

function PhotoGrid({ photos }: { photos: Photo[] }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: photos.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
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

## Form Handling

### With Zod Validation

```typescript
import { z } from 'zod';
import { useState } from 'react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

function LoginPage() {
  const [formData, setFormData] = useState<LoginForm>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginForm, string>>>({});
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const validated = loginSchema.parse(formData);
      await login(validated.email, validated.password);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Partial<Record<keyof LoginForm, string>> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof LoginForm] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className={cn("input", errors.email && "border-red-500")}
        />
        {errors.email && <p className="text-red-500 text-sm">{errors.email}</p>}
      </div>

      <div>
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className={cn("input", errors.password && "border-red-500")}
        />
        {errors.password && <p className="text-red-500 text-sm">{errors.password}</p>}
      </div>

      <button type="submit" className="btn btn-primary">
        Login
      </button>
    </form>
  );
}
```

---

## File Upload Component

```typescript
import { useState } from 'react';
import { usePhotos } from '@/hooks/usePhotos';

function PhotoUploader() {
  const [isDragging, setIsDragging] = useState(false);
  const { uploadPhoto, isUploading } = usePhotos();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));

    uploadPhoto(formData);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));

    uploadPhoto(formData);
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-8 text-center",
        isDragging && "border-blue-500 bg-blue-50",
        isUploading && "opacity-50 pointer-events-none"
      )}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/heic"
        onChange={handleFileInput}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="cursor-pointer">
        {isUploading ? (
          <p>Uploading...</p>
        ) : (
          <>
            <p className="text-lg font-semibold">Drop photos here</p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </>
        )}
      </label>
    </div>
  );
}
```

---

## Testing Patterns

```typescript
// tests/components/PhotoCard.test.tsx
import { render, screen } from '@testing-library/react';
import { PhotoCard } from '@/components/photos/PhotoCard';

test('renders photo card with title', () => {
  const photo = {
    id: '1',
    filename: 'test.jpg',
    url: '/test.jpg',
    thumbnailUrl: '/thumb.jpg',
    uploadedAt: new Date().toISOString(),
  };
  
  render(<PhotoCard photo={photo} onDelete={() => {}} />);
  
  expect(screen.getByText('test.jpg')).toBeInTheDocument();
  expect(screen.getByRole('img')).toHaveAttribute('src', '/thumb.jpg');
});
```

---

## Important Reminders

1. **Use `import.meta.env` not `process.env`** - Vite requirement
2. **Prefix env vars with VITE_** - or they won't be exposed
3. **Use React Query** for server state, Context for client state
4. **Type all API responses** with Zod schemas for runtime validation
5. **Lazy load routes and images** for better performance
6. **Use TailwindCSS utilities** - avoid inline styles
7. **Handle loading and error states** - always show user feedback
8. **Never commit .env files**
9. **Use cn()** for conditional class names
10. **Memoize expensive computations** with useMemo

---

**Ready to build the UI!** Follow the implementation phases and refer to backend API documentation.