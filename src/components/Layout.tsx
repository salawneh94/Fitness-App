import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Apple, Dumbbell, ListChecks, UserRound, TrendingUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/nutrition', label: 'Nutrition', icon: Apple, end: false },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell, end: false },
  { to: '/plans', label: 'Plan Ideas', icon: ListChecks, end: false },
  { to: '/progress', label: 'Progress', icon: TrendingUp, end: false },
];

export default function Layout() {
  const profile = useAppStore((s) => s.profile);

  // No profile yet means the onboarding wizard is rendering at /profile —
  // give it the full screen instead of surrounding it with nav to routes it can't reach.
  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100">
        <Outlet />
      </div>
    );
  }

  return (
    // The document itself never scrolls here (overflow-hidden + a fixed dvh height) — only
    // `main` does, internally. Real iOS Safari collapses/expands its toolbar in response to
    // the *document* scrolling, which desyncs position:fixed elements' visual position from
    // where they actually receive touches (they render fine, taps just land on nothing). By
    // keeping the document static and scrolling only the inner content pane, the toolbar never
    // moves during use, so the mobile bottom nav below stays reliably tappable on real devices.
    <div className="h-dvh flex flex-col md:flex-row overflow-hidden bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100">
      <aside className="hidden md:flex md:w-60 border-r border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-200 dark:border-neutral-800">
          <div className="w-8 h-8 rounded-xl bg-linear-to-br from-orange-500 to-lime-400 flex items-center justify-center text-white font-bold">F</div>
          <span className="font-semibold text-lg">FitTrack</span>
        </div>

        <nav className="flex flex-col flex-1 gap-1 p-3 w-full">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
                }`
              }
            >
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium mt-auto transition-colors ${
                isActive
                  ? 'bg-orange-600 text-white shadow-sm shadow-orange-600/30'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }`
            }
          >
            <UserRound size={20} />
            <span>{profile?.name || 'Profile'}</span>
          </NavLink>
        </nav>
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-4 md:p-8 pb-28 md:pb-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>

      {/* Mobile floating bottom nav. Bottom offset accounts for the iOS home-indicator
          safe area — without it, real touches near the bottom edge on iPhone get
          swallowed by the system swipe-up gesture instead of reaching this nav. */}
      <nav
        className="md:hidden fixed left-4 right-4 z-40"
        style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom, 0px) + 0.5rem))' }}
      >
        <div className="flex items-center justify-between gap-1 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-full px-2 py-2 shadow-lg shadow-gray-300/40 dark:shadow-black/40">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              aria-label={label}
              className={({ isActive }) =>
                `flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                  isActive
                    ? 'bg-orange-600 text-white'
                    : 'text-gray-400 dark:text-gray-500'
                }`
              }
            >
              <Icon size={20} />
            </NavLink>
          ))}
          <NavLink
            to="/profile"
            aria-label="Profile"
            className={({ isActive }) =>
              `flex items-center justify-center w-11 h-11 rounded-full transition-colors ${
                isActive
                  ? 'bg-orange-600 text-white'
                  : 'text-gray-400 dark:text-gray-500'
              }`
            }
          >
            <UserRound size={20} />
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
