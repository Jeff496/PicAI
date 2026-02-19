import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';
import { authService } from '@/services/auth';
import { useThemeStore, applyTheme } from '@/stores/themeStore';

const navItems = [
  { path: '/photos', label: 'Photos' },
  { path: '/people', label: 'People' },
  { path: '/groups', label: 'Groups' },
  { path: '/chat', label: 'Chat' },
];

interface AppLayoutProps {
  children: React.ReactNode;
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
    <div className="flex min-h-screen w-full flex-col bg-paper text-ink dark:bg-[#111110] dark:text-[#e8e4de]">
      {/* Masthead */}
      <header className="sticky top-0 z-10 border-b-2 border-ink bg-paper dark:border-[#e8e4de] dark:bg-[#111110]">
        <div className="flex items-center justify-between px-6 py-2.5 sm:px-10">
          {/* Left: logo + tabs */}
          <div className="flex items-center gap-8">
            <Link
              to="/photos"
              className="font-serif text-[26px] font-bold leading-none"
              style={{ letterSpacing: '-0.03em' }}
            >
              PicAI
            </Link>

            <nav className="hidden items-center gap-6 sm:flex">
              {navItems.map((item) => {
                const active = location.pathname.startsWith(item.path);
                return active ? (
                  <span
                    key={item.path}
                    className="border-b-2 border-ink pb-2 font-sans text-[12px] font-semibold uppercase text-ink dark:border-[#e8e4de] dark:text-[#e8e4de]"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    {item.label}
                  </span>
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    className="pb-2 font-sans text-[12px] font-normal uppercase text-subtle transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
                    style={{ letterSpacing: '0.06em' }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: page actions + theme + logout */}
          <div className="flex items-center gap-3">
            {actions}
            <button
              onClick={toggleTheme}
              className="p-1.5 text-subtle transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={handleLogout}
              className="p-1.5 text-subtle transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="flex border-t border-rule sm:hidden dark:border-[#2a2824]">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return active ? (
              <span
                key={item.path}
                className="flex-1 border-b-2 border-ink py-2 text-center font-sans text-[11px] font-semibold uppercase text-ink dark:border-[#e8e4de] dark:text-[#e8e4de]"
                style={{ letterSpacing: '0.06em' }}
              >
                {item.label}
              </span>
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className="flex-1 py-2 text-center font-sans text-[11px] font-normal uppercase text-subtle dark:text-[#8a8478]"
                style={{ letterSpacing: '0.06em' }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Thin secondary rule */}
      <div className="mx-6 border-b border-rule dark:border-[#2a2824] sm:mx-10" />

      {/* Page content */}
      <main className="flex-1 px-6 py-8 sm:px-10">{children}</main>
    </div>
  );
}
