import { Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { lazyWithRetry, prefetchWhenIdle } from './lib/lazyWithRetry';
import { useAppStore } from './store/useAppStore';

const loadOverview = () => import('./pages/OverviewPage');
const loadNutrition = () => import('./pages/NutritionPage');
const loadWorkouts = () => import('./pages/WorkoutsPage');
const loadPlans = () => import('./pages/PlansPage');
const loadProgress = () => import('./pages/ProgressPage');
const loadProfile = () => import('./pages/ProfilePage');

const SplashPage = lazyWithRetry(() => import('./pages/SplashPage'));
const LoginPage = lazyWithRetry(() => import('./pages/LoginPage'));
const OverviewPage = lazyWithRetry(loadOverview);
const NutritionPage = lazyWithRetry(loadNutrition);
const WorkoutsPage = lazyWithRetry(loadWorkouts);
const PlansPage = lazyWithRetry(loadPlans);
const ProgressPage = lazyWithRetry(loadProgress);
const ProfilePage = lazyWithRetry(loadProfile);

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (!profile) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  );
}

function App() {
  // Warm the remaining route chunks once the first page has settled, so tapping a tab doesn't
  // pay a download before it can render.
  useEffect(() => {
    prefetchWhenIdle([loadOverview, loadNutrition, loadWorkouts, loadPlans, loadProgress, loadProfile]);
  }, []);

  return (
    <ErrorBoundary>
    <HashRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/welcome" element={<SplashPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/profile" element={<ProfilePage />} />
            <Route
              path="/"
              element={
                <RequireProfile>
                  <OverviewPage />
                </RequireProfile>
              }
            />
            <Route
              path="/nutrition"
              element={
                <RequireProfile>
                  <NutritionPage />
                </RequireProfile>
              }
            />
            <Route
              path="/workouts"
              element={
                <RequireProfile>
                  <WorkoutsPage />
                </RequireProfile>
              }
            />
            <Route
              path="/plans"
              element={
                <RequireProfile>
                  <PlansPage />
                </RequireProfile>
              }
            />
            <Route
              path="/progress"
              element={
                <RequireProfile>
                  <ProgressPage />
                </RequireProfile>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
