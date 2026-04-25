import { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { History, UserX, Phone, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function InvestorHistory() {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInactiveInvestors();
  }, []);

  const loadInactiveInvestors = async () => {
    try {
      const response = await api.getInactiveInvestors();
      setInvestors(response.data);
    } catch (error) {
      toast.error('Failed to load investor history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8" data-testid="investor-history-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-semibold text-primary mb-2 flex items-center gap-3">
            <History size={32} />
            Investor History
          </h1>
          <p className="text-muted-foreground">View past investors and their investment periods</p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Name
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Contact
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Contribution
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Total Returns
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Investment Period
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {investors.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-muted-foreground">
                    <UserX size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>No investor history available.</p>
                  </td>
                </tr>
              ) : (
                investors.map((investor) => (
                  <tr
                    key={investor.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`investor-history-row-${investor.id}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{investor.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Phone size={16} className="text-slate-400" />
                        <p className="text-sm text-foreground">{investor.phone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-foreground">
                        ₹{investor.contribution_amount.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-green-600">
                        ₹{investor.total_returns.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1 mb-1">
                          <Calendar size={14} />
                          <span>Joined: {format(new Date(investor.date_joined), 'MMM dd, yyyy')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar size={14} />
                          <span>Left: {format(new Date(investor.date_left), 'MMM dd, yyyy')}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                        Inactive
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}