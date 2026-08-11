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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100">
      <aside className="md:w-60 md:min-h-screen border-b md:border-b-0 md:border-r border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex md:flex-col">
        <div className="hidden md:flex items-center gap-2 px-5 py-5 border-b border-gray-200 dark:border-neutral-800">
          <div className="w-8 h-8 rounded-lg bg-linear-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold">F</div>
          <span className="font-semibold text-lg">FitTrack</span>
        </div>

        <nav className="flex md:flex-col flex-1 justify-around md:justify-start md:gap-1 md:p-3 w-full">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex md:flex-row flex-col items-center gap-0.5 md:gap-3 px-2 md:px-3 py-2.5 md:py-2.5 rounded-lg text-xs md:text-sm font-medium transition-colors flex-1 md:flex-none justify-center md:justify-start ${
                  isActive
                    ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
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
              `hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium mt-auto transition-colors ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800'
              }`
            }
          >
            <UserRound size={20} />
            <span>{profile?.name || 'Profile'}</span>
          </NavLink>
        </nav>
      </aside>

      <main className="flex-1 min-w-0 p-4 md:p-8 pb-20 md:pb-8 max-w-6xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  );
}
