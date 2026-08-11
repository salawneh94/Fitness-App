import { useNavigate } from 'react-router-dom';

const inputCls =
  'w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-500';

export default function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col justify-center bg-[#0b0d14] text-white px-6 py-12">
      <div className="max-w-xs w-full mx-auto">
        <h1 className="text-2xl font-bold mb-1">Welcome</h1>
        <p className="text-white/60 text-sm mb-8">
          FitTrack runs entirely on this device — no account required. Continue to set up your profile.
        </p>

        <form
          className="space-y-3 mb-6"
          onSubmit={(e) => {
            e.preventDefault();
            navigate('/profile');
          }}
        >
          <input className={inputCls} placeholder="Name" autoComplete="name" />
          <input className={inputCls} placeholder="Email (optional)" type="email" autoComplete="email" />
          <button
            type="submit"
            className="w-full bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 rounded-full transition-colors mt-2"
          >
            Continue
          </button>
        </form>

        <button
          onClick={() => navigate('/profile')}
          className="w-full text-center text-sm text-white/50 hover:text-white/80"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
