import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import SplashPage from './pages/SplashPage';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import NutritionPage from './pages/NutritionPage';
import WorkoutsPage from './pages/WorkoutsPage';
import PlansPage from './pages/PlansPage';
import ProgressPage from './pages/ProgressPage';
import ProfilePage from './pages/ProfilePage';
import { useAppStore } from './store/useAppStore';

function RequireProfile({ children }: { children: React.ReactNode }) {
  const profile = useAppStore((s) => s.profile);
  if (!profile) return <Navigate to="/welcome" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default App;
