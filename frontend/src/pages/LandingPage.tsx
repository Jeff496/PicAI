import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useThemeStore, applyTheme } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

const features = [
  {
    num: '01',
    title: 'Intelligent Tagging',
    body: 'Every photo is analyzed by AI the moment it\u2019s uploaded. Objects, scenes, and text are recognized and made searchable instantly.',
  },
  {
    num: '02',
    title: 'Shared Collections',
    body: 'Create groups, invite family and friends, and build shared photo libraries together. Everyone contributes, everyone benefits.',
  },
  {
    num: '03',
    title: 'Private by Design',
    body: 'Your photos live on your own hardware. The AI reads pixels, not people \u2014 metadata only, never stored externally.',
  },
];

export function LandingPage() {
  const { theme, setTheme } = useThemeStore();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    applyTheme(next);
  };

  const ThemeIcon = theme === 'dark' ? Moon : Sun;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink dark:bg-[#111110] dark:text-[#e8e4de]">
      {/* ── Masthead ── */}
      <nav className="border-b-2 border-ink dark:border-[#e8e4de]">
        <div className="flex items-center justify-between px-6 py-4 sm:px-10">
          {/* Logo + subtitle */}
          <div>
            <span
              className="font-serif text-[26px] font-bold"
              style={{ letterSpacing: '-0.03em' }}
            >
              PicAI
            </span>
            <p
              className="font-sans text-[11px] font-normal uppercase text-whisper dark:text-[#8a8478]"
              style={{ letterSpacing: '0.12em' }}
            >
              A photo journal
            </p>
          </div>

          {/* Right: theme toggle + auth */}
          <div className="flex items-center gap-4 sm:gap-6">
            <button
              onClick={toggleTheme}
              className="p-1.5 text-subtle transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de]"
              aria-label="Toggle theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>

            {isAuthenticated ? (
              <Link
                to="/photos"
                className="bg-ink px-6 py-2.5 text-[13px] font-semibold text-paper transition-opacity hover:opacity-80 dark:bg-[#e8e4de] dark:text-[#111110]"
                style={{ letterSpacing: '0.02em' }}
              >
                Open gallery
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden text-[13px] font-medium text-muted transition-colors hover:text-ink dark:text-[#8a8478] dark:hover:text-[#e8e4de] sm:inline"
                  style={{ letterSpacing: '0.02em' }}
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="bg-ink px-6 py-2.5 text-[13px] font-semibold text-paper transition-opacity hover:opacity-80 dark:bg-[#e8e4de] dark:text-[#111110]"
                  style={{ letterSpacing: '0.02em' }}
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Thin secondary rule */}
      <div className="mx-6 border-b border-rule dark:border-[#2a2824] sm:mx-10" />

      {/* ── Hero ── */}
      <section className="mx-6 sm:mx-10">
        {/* Desktop: asymmetric two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left column — text */}
          <div className="py-12 pr-0 sm:py-16 lg:py-20 lg:pr-16">
            <h1
              className="font-serif text-[40px] font-normal sm:text-[48px] lg:text-[52px]"
              style={{ letterSpacing: '-0.02em', lineHeight: '1.08' }}
            >
              Every photo
              <br />
              finds its <em className="italic">place</em>
            </h1>

            {/* Decorative rule */}
            <div className="mt-6 w-16 border-b border-rule dark:border-[#2a2824]" />

            <p className="mt-6 max-w-[400px] text-[16px] font-light leading-[1.75] text-muted dark:text-[#8a8478]">
              Upload your photos and let AI organize them into meaningful
              collections. Share memories with the people who matter most.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="bg-ink px-9 py-3 text-[14px] font-semibold text-paper transition-opacity hover:opacity-80 dark:bg-[#e8e4de] dark:text-[#111110]"
                style={{ letterSpacing: '0.02em' }}
              >
                Start organizing
              </Link>
              <Link
                to="/login"
                className="border border-rule px-9 py-3 text-[14px] font-semibold text-muted transition-colors hover:border-ink hover:text-ink dark:border-[#2a2824] dark:text-[#8a8478] dark:hover:border-[#e8e4de] dark:hover:text-[#e8e4de]"
                style={{ letterSpacing: '0.02em' }}
              >
                Sign in
              </Link>
            </div>
          </div>

          {/* Right column — photo mosaic */}
          <div className="border-t border-rule pb-12 pt-8 dark:border-[#2a2824] lg:border-t-0 lg:border-l lg:py-8 lg:pl-8 lg:pb-8">
            <div className="flex flex-col gap-1.5">
              {/* Large hero photo */}
              <div className="relative h-[220px] overflow-hidden bg-[#d4cec4] sm:h-[280px] dark:bg-[#2a2824]">
                <img
                  src="https://picsum.photos/id/1015/800/600"
                  alt="River winding through mountains"
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              </div>
              {/* Two smaller photos */}
              <div className="grid grid-cols-2 gap-1.5">
                <div className="relative h-[140px] overflow-hidden bg-[#d4cec4] sm:h-[180px] dark:bg-[#2a2824]">
                  <img
                    src="https://picsum.photos/id/1018/600/400"
                    alt="Foggy forest landscape"
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
                <div className="relative h-[140px] overflow-hidden bg-[#d4cec4] sm:h-[180px] dark:bg-[#2a2824]">
                  <img
                    src="https://picsum.photos/id/1039/600/400"
                    alt="Bridge over autumn creek"
                    className="h-full w-full object-cover"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Rule before features */}
      <div className="mx-6 border-b border-rule dark:border-[#2a2824] sm:mx-10" />

      {/* ── Features — ruled columns ── */}
      <section className="mx-6 sm:mx-10">
        <div className="grid grid-cols-1 gap-10 py-14 sm:py-16 md:grid-cols-3 md:gap-0">
          {features.map((f, i) => (
            <div
              key={f.num}
              className={
                i > 0
                  ? 'border-t border-rule pt-10 dark:border-[#2a2824] md:border-t-0 md:border-l md:pl-10 md:pt-0'
                  : 'md:pr-10'
              }
            >
              {/* Number label */}
              <span
                className="font-sans text-[11px] font-medium uppercase text-whisper dark:text-[#8a8478]"
                style={{ letterSpacing: '0.1em' }}
              >
                {f.num}
              </span>

              {/* Title */}
              <h3
                className="mt-3 font-serif text-[22px] font-normal"
                style={{ letterSpacing: '-0.01em' }}
              >
                {f.title}
              </h3>

              {/* Body */}
              <p className="mt-3 text-[14px] font-light leading-[1.7] text-subtle dark:text-[#8a8478]">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Footer ── */}
      <footer className="border-t border-rule px-6 py-8 dark:border-[#2a2824] sm:px-10">
        <div className="flex items-center justify-between">
          <span
            className="font-serif text-[15px] font-normal text-subtle dark:text-[#8a8478]"
          >
            PicAI
          </span>
          <span
            className="text-[11px] font-normal uppercase text-whisper dark:text-[#8a8478]"
            style={{ letterSpacing: '0.1em' }}
          >
            Self-hosted photo management
          </span>
        </div>
      </footer>
    </div>
  );
}
