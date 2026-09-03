import { useNavigate } from 'react-router-dom';

export default function SplashPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-between bg-[#0b0d14] text-white px-6 py-12 relative overflow-hidden">
      <div
        className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--brand-primary), transparent 70%)' }}
      />
      <div
        className="absolute -bottom-24 -right-24 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--brand-lime), transparent 70%)' }}
      />

      <div />

      <div className="relative flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-3xl bg-linear-to-br from-cyan-500 to-amber-400 flex items-center justify-center text-white font-bold text-3xl mb-6 shadow-lg shadow-cyan-600/30">
          F
        </div>
        <h1 className="text-3xl font-bold mb-2">FitTrack</h1>
        <p className="text-white/60 max-w-xs">Your personalized path to fitness — workouts, nutrition, and progress in one place.</p>
      </div>

      <button
        onClick={() => navigate('/login')}
        className="relative w-full max-w-xs bg-linear-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 active:scale-95 text-white font-semibold py-3.5 rounded-full transition-all"
      >
        Get Started
      </button>
    </div>
  );
}
