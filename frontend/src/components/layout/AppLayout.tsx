import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Sun, Moon, LogOut } from 'lucide-react';
import { authService } from '@/services/auth';
import { useThemeStore, applyTheme } from '@/stores/themeStore';

const navItems = [
  { path: '/photos', label: 'Photos' },
  { path: '/people', label: 'People' },
  { path: '/groups', label: 'Groups' },
];

interface AppLayoutProps {
  children: React.ReactNode;
  /** Extra elements rendered on the right side of the header (upload btn, select btn, etc.) */
  actions?: React.ReactNode;
}

export function AppLayout({ children, actions }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  const handleLogout = async () => {
    await authService.logout();
    navigate('/');
  };

  const ThemeIcon = theme === 'dark' ? Moon : Sun;

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-200/80 bg-white/80 backdrop-blur-sm dark:border-white/5 dark:bg-gray-950/80">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6">
          {/* Left: logo + nav */}
          <div className="flex items-center gap-6">
            <Link to="/photos" className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-accent" />
              <span className="text-base font-semibold tracking-tight">PicAI</span>
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white'
                        : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: page actions + theme + logout */}
          <div className="flex items-center gap-2">
            {actions}
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex border-t border-gray-100 sm:hidden dark:border-white/5">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
                  active
                    ? 'text-accent'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Page content */}
      <main className="flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}
