import { Link } from 'react-router-dom';
import { Camera, Users, Sparkles, Shield, ArrowRight, Image, Tag, Sun, Moon } from 'lucide-react';
import { useThemeStore, applyTheme } from '@/stores/themeStore';
import { useAuthStore } from '@/stores/authStore';

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
    <div className="flex min-h-screen w-full flex-col bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Nav */}
      <nav className="border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-accent" />
            <span className="text-lg font-semibold tracking-tight">PicAI</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Toggle theme"
            >
              <ThemeIcon className="h-4 w-4" />
            </button>
            {isAuthenticated ? (
              <Link
                to="/photos"
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
              >
                Go to app
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero — gentle gradient allowed here */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-50/50 via-white to-white dark:from-indigo-950/20 dark:via-gray-950 dark:to-gray-950" />
        <div className="pointer-events-none absolute top-0 left-1/2 hidden -translate-x-1/2 dark:block">
          <div className="h-48 w-[500px] rounded-full bg-indigo-500/8 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-sm text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-gray-400">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            AI-powered photo organization
          </div>
          <h1 className="text-5xl leading-tight font-bold tracking-tight">
            Your photos, organized
            <br />
            <span className="text-gray-300 dark:text-gray-600">intelligently.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-gray-500 dark:text-gray-400">
            Upload your photos and let AI automatically tag, sort, and organize them. Share albums
            with groups. Find any photo in seconds.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-all hover:bg-accent-hover"
            >
              Start organizing
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/login"
              className="rounded-lg border border-gray-200 px-6 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-white/10 dark:text-gray-400 dark:hover:border-white/20 dark:hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      {/* Features — flat, no gradients */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-10 md:grid-cols-3">
            {[
              {
                icon: Tag,
                title: 'AI Auto-Tagging',
                desc: 'Azure Computer Vision analyzes every photo and generates searchable tags automatically.',
              },
              {
                icon: Users,
                title: 'Group Sharing',
                desc: 'Create groups, invite members, and build shared photo libraries together.',
              },
              {
                icon: Shield,
                title: 'Privacy First',
                desc: 'Your photos stay on your hardware. AI processes metadata only — never stores images.',
              },
            ].map((f) => (
              <div key={f.title}>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5">
                  <f.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                </div>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="mx-auto max-w-5xl border-t border-gray-100 dark:border-white/5" />

      {/* CTA */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-xl text-center">
          <Image className="mx-auto mb-6 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <h2 className="text-2xl font-bold">Ready to organize your photos?</h2>
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            Free to use. Self-hosted on your own hardware.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition-all hover:bg-accent-hover"
          >
            Get started free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-8 dark:border-white/5">
        <div className="flex items-center justify-between px-6 text-sm text-gray-400 dark:text-gray-600">
          <span>PicAI</span>
          <span>Self-hosted photo management</span>
        </div>
      </footer>
    </div>
  );
}
