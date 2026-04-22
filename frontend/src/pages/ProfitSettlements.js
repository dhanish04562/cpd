import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { Plus, AlertCircle, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

export default function ProfitSettlements() {
  const [settlements, setSettlements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [calculateYear, setCalculateYear] = useState(new Date().getFullYear() - 1);
  const [processingId, setProcessingId] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settlementsRes, statsRes] = await Promise.all([
        api.getProfitSettlements({ status: filterStatus !== 'all' ? filterStatus : undefined }),
        api.getProfitSettlementStats()
      ]);
      setSettlements(settlementsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load profit settlements');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);
  const handleCalculateSettlements = async (e) => {
    e.preventDefault();
    try {
      const response = await api.calculateYearlySettlements(calculateYear);
      toast.success(response.data.message);
      setShowCalculateModal(false);
      loadData();
    } catch (error) {
      toast.error('Failed to calculate settlements');
    }
  };

  const handleExecutePayout = async (settlementId) => {
    if (!window.confirm('Are you sure you want to execute this payout?')) return;
    
    setProcessingId(settlementId);
    try {
      await api.executeProfitPayout(settlementId);
      toast.success('Payout executed successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to execute payout');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700';
      case 'eligible':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid':
        return <CheckCircle size={16} />;
      case 'eligible':
        return <AlertCircle size={16} />;
      case 'pending':
        return <Clock size={16} />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const filteredSettlements = filterStatus === 'all' 
    ? settlements 
    : settlements.filter(s => s.status === filterStatus);

  return (
    <div className="p-6 md:p-10 space-y-8" data-testid="profit-settlements-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-semibold text-primary mb-2">Profit Settlements</h1>
          <p className="text-muted-foreground">Manage yearly profit distributions with 90-day payout delay</p>
        </div>
        <button
          onClick={() => setShowCalculateModal(true)}
          className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
          data-testid="calculate-settlements-button"
        >
          <Plus size={20} />
          Calculate Year Settlements
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white shadow-sm rounded-xl border-l-4 border-l-yellow-500 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock size={20} className="text-yellow-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Pending</h3>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.pending_count}</p>
            <p className="text-xs text-muted-foreground mt-1">₹{stats.total_profit_pending.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white shadow-sm rounded-xl border-l-4 border-l-blue-500 p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle size={20} className="text-blue-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Eligible</h3>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.eligible_count}</p>
            <p className="text-xs text-muted-foreground mt-1">₹{stats.total_profit_eligible.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white shadow-sm rounded-xl border-l-4 border-l-green-500 p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle size={20} className="text-green-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Paid</h3>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.paid_count}</p>
            <p className="text-xs text-muted-foreground mt-1">₹{stats.total_profit_paid.toLocaleString('en-IN')}</p>
          </div>

          <div className="bg-white shadow-sm rounded-xl border-l-4 border-l-purple-500 p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign size={20} className="text-purple-500" />
              <h3 className="text-sm font-medium text-muted-foreground">Total</h3>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.total_settlements}</p>
            <p className="text-xs text-muted-foreground mt-1">
              ₹{(stats.total_profit_pending + stats.total_profit_eligible + stats.total_profit_paid).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        {['all', 'pending', 'eligible', 'paid'].map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              filterStatus === status
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Settlements Table */}
      <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Investor
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Year
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Profit Amount
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Calculated
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Payout Eligible
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredSettlements.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-muted-foreground">
                    <DollarSign size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>No profit settlements found. Calculate yearly settlements to get started.</p>
                  </td>
                </tr>
              ) : (
                filteredSettlements.map((settlement) => (
                  <tr
                    key={settlement.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`settlement-row-${settlement.id}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{settlement.investor_name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-foreground">{settlement.settlement_year}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono font-bold text-green-600">
                        ₹{settlement.profit_amount.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(settlement.calculation_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(settlement.payout_eligible_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${getStatusColor(settlement.status)}`}
                      >
                        {getStatusIcon(settlement.status)}
                        {settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {settlement.status === 'eligible' && (
                        <button
                          onClick={() => handleExecutePayout(settlement.id)}
                          disabled={processingId === settlement.id}
                          className="text-blue-600 hover:text-blue-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          data-testid={`payout-settlement-${settlement.id}`}
                        >
                          {processingId === settlement.id ? 'Processing...' : 'Execute Payout'}
                        </button>
                      )}
                      {settlement.status === 'paid' && (
                        <span className="text-green-600 text-sm">
                          Paid {format(new Date(settlement.payout_date), 'MMM dd, yyyy')}
                        </span>
                      )}
                      {settlement.status === 'pending' && (
                        <span className="text-yellow-600 text-sm">Waiting...</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Calculate Settlements Modal */}
      {showCalculateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" data-testid="calculate-modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-semibold text-primary">Calculate Year Settlements</h2>
              <button
                onClick={() => setShowCalculateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCalculateSettlements} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={new Date().getFullYear()}
                  value={calculateYear}
                  onChange={(e) => setCalculateYear(parseInt(e.target.value))}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="calculate-year-input"
                />
              </div>
              <p className="text-sm text-slate-600">
                This will calculate profit settlements for all active investors for the selected year with a 90-day payout delay.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCalculateModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90 text-white py-2 rounded-lg font-medium shadow-lg shadow-primary/20 transition-all"
                  data-testid="submit-calculate-button"
                >
                  Calculate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
