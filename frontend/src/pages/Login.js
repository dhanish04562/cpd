import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { toast } from 'sonner';
import { LogIn } from 'lucide-react';

export default function Login({ setIsAuthenticated }) {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.login(credentials);
      localStorage.setItem('token', response.data.access_token);
      setIsAuthenticated(true);
      toast.success('Welcome to Royal Readymades CPD!');
      navigate('/');
    } catch (error) {
      toast.error('Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1725677356693-cdd8b255250a?crop=entropy&cs=srgb&fm=jpg&q=85')`,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/95 to-primary/80"></div>
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white/95 backdrop-blur-md shadow-2xl rounded-2xl p-8 border border-white/20">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-heading font-bold text-primary mb-2">Royal Readymades</h1>
            <p className="text-lg text-secondary font-semibold">CPD Division</p>
            <p className="text-sm text-muted-foreground mt-2">Cash Payment Division Management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
              <input
                type="text"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Enter username"
                required
                data-testid="username-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                placeholder="Enter password"
                required
                data-testid="password-input"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              data-testid="login-button"
            >
              <LogIn size={20} />
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 p-4 bg-amber-50 border border-secondary/20 rounded-lg">
            <p className="text-xs text-slate-600 text-center">
              Default: <span className="font-mono font-semibold">admin / admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
