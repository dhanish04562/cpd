import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Building2, ArrowLeftRight, FileText, LogOut, ScrollText, PieChart } from 'lucide-react';
import { toast } from 'sonner';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Investors', icon: Users, path: '/investors' },
    { name: 'Sellers', icon: Building2, path: '/sellers' },
    { name: 'Transactions', icon: ArrowLeftRight, path: '/transactions' },
    { name: 'Reports', icon: FileText, path: '/reports' },
    { name: 'Profit Settlements', icon: PieChart, path: '/profit-settlements' },
    { name: 'Audit Log', icon: ScrollText, path: '/audit-log' },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <div className="w-64 bg-primary text-white flex flex-col shadow-xl relative">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
        }}></div>
        
        <div className="p-6 border-b border-white/10 relative z-10">
          <h1 className="text-2xl font-heading font-bold">Royal Readymades</h1>
          <p className="text-sm text-secondary mt-1">CPD Division</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 relative z-10">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-secondary text-white shadow-lg shadow-secondary/30'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                data-testid={`nav-${item.name.toLowerCase()}`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-white/10 relative z-10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all w-full"
            data-testid="logout-button"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
