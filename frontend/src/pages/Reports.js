import { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { TrendingUp, DollarSign, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function Reports() {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const response = await api.getInvestorReturns();
      setInvestors(response.data);
    } catch (error) {
      toast.error('Failed to load reports');
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

  const chartData = investors.map(inv => ({
    name: inv.name,
    contribution: inv.contribution_amount,
    returns: inv.total_returns,
  }));

  const totalContributions = investors.reduce((sum, inv) => sum + inv.contribution_amount, 0);
  const totalReturns = investors.reduce((sum, inv) => sum + inv.total_returns, 0);

  return (
    <div className="p-6 md:p-10 space-y-8" data-testid="reports-page">
      <div>
        <h1 className="text-4xl font-heading font-semibold text-primary mb-2">Reports & Analytics</h1>
        <p className="text-muted-foreground">Investor performance and returns analysis</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-emerald-500 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-emerald-500 p-3 rounded-lg">
              <DollarSign size={24} className="text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Total Contributions
              </p>
            </div>
          </div>
          <p className="text-3xl font-mono font-bold text-foreground">
            ₹{totalContributions.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-amber-500 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-amber-500 p-3 rounded-lg">
              <TrendingUp size={24} className="text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Total Returns Generated
              </p>
            </div>
          </div>
          <p className="text-3xl font-mono font-bold text-foreground">
            ₹{totalReturns.toLocaleString('en-IN')}
          </p>
        </div>

        <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-blue-500 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="bg-blue-500 p-3 rounded-lg">
              <PieChartIcon size={24} className="text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                Average ROI
              </p>
            </div>
          </div>
          <p className="text-3xl font-mono font-bold text-foreground">
            {totalContributions > 0 ? ((totalReturns / totalContributions) * 100).toFixed(2) : 0}%
          </p>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 p-6">
        <h3 className="text-xl font-heading font-semibold mb-6 text-foreground">
          Investor Performance Comparison
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" />
            <YAxis stroke="#64748b" />
            <Tooltip
              formatter={(value) => `₹${value.toLocaleString('en-IN')}`}
              contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
            <Legend />
            <Bar dataKey="contribution" fill="#064E3B" name="Contribution" radius={[8, 8, 0, 0]} />
            <Bar dataKey="returns" fill="#D97706" name="Returns" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 overflow-hidden">
        <div className="p-6">
          <h3 className="text-xl font-heading font-semibold mb-6 text-foreground">
            Detailed Investor Returns
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Investor Name
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Contribution
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Returns Earned
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  ROI %
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Total Value
                </th>
              </tr>
            </thead>
            <tbody>
              {investors.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-muted-foreground">
                    No investor data available yet
                  </td>
                </tr>
              ) : (
                investors.map((investor) => {
                  const roi = investor.contribution_amount > 0 
                    ? ((investor.total_returns / investor.contribution_amount) * 100).toFixed(2)
                    : 0;
                  const totalValue = investor.contribution_amount + investor.total_returns;
                  
                  return (
                    <tr
                      key={investor.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      data-testid={`investor-report-${investor.id}`}
                    >
                      <td className="px-6 py-4">
                        <p className="font-semibold text-foreground">{investor.name}</p>
                        <p className="text-xs text-muted-foreground">{investor.email}</p>
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
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold font-mono">
                          {roi}%
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-mono font-bold text-foreground">
                          ₹{totalValue.toLocaleString('en-IN')}
                        </p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
