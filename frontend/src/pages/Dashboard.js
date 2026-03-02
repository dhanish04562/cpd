import { useState, useEffect } from 'react';
import { api } from '../api';
import { Wallet, TrendingUp, Users, Building2, Clock, DollarSign, AlertCircle, Bell } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { format, differenceInDays } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, transactionsRes] = await Promise.all([
        api.getDashboardStats(),
        api.getTransactions(),
      ]);
      setStats(statsRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSettlementReminders = () => {
    const pending = transactions.filter(t => t.settlement_status === 'pending');
    const overdue = pending.filter(t => differenceInDays(new Date(t.settlement_due_date), new Date()) < 0);
    const dueSoon = pending.filter(t => {
      const days = differenceInDays(new Date(t.settlement_due_date), new Date());
      return days >= 0 && days <= 7;
    });
    
    return { overdue, dueSoon, all: pending };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { overdue, dueSoon } = getSettlementReminders();
  const recentTransactions = transactions.slice(0, 5);

  const poolData = [
    { name: 'Deployed Capital', value: stats?.pool?.deployed_capital || 0, color: '#D97706' },
    { name: 'Available Funds', value: stats?.pool?.available_funds || 0, color: '#059669' },
  ];

  const statCards = [
    {
      title: 'Total Pool Amount',
      value: `₹${(stats?.pool?.total_amount || 0).toLocaleString('en-IN')}`,
      icon: Wallet,
      color: 'bg-emerald-500',
      testId: 'total-pool-amount'
    },
    {
      title: 'Deployed Capital',
      value: `₹${(stats?.pool?.deployed_capital || 0).toLocaleString('en-IN')}`,
      icon: TrendingUp,
      color: 'bg-amber-500',
      testId: 'deployed-capital'
    },
    {
      title: 'Available Funds',
      value: `₹${(stats?.pool?.available_funds || 0).toLocaleString('en-IN')}`,
      icon: DollarSign,
      color: 'bg-blue-500',
      testId: 'available-funds'
    },
    {
      title: 'Active Investors',
      value: stats?.total_investors || 0,
      icon: Users,
      color: 'bg-purple-500',
      testId: 'active-investors'
    },
    {
      title: 'Total Sellers',
      value: stats?.total_sellers || 0,
      icon: Building2,
      color: 'bg-pink-500',
      testId: 'total-sellers'
    },
    {
      title: 'Pending Settlements',
      value: stats?.pending_settlements || 0,
      icon: Clock,
      color: 'bg-red-500',
      testId: 'pending-settlements'
    },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8" data-testid="dashboard-page">
      <div>
        <h1 className="text-4xl font-heading font-semibold text-primary mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of CPD Division performance</p>
      </div>

      {/* Settlement Reminders */}
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg" data-testid="overdue-reminders">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0 mt-0.5" size={24} />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 mb-2">
                    Overdue Settlements ({overdue.length})
                  </h3>
                  <div className="space-y-2">
                    {overdue.map(txn => {
                      const daysOverdue = Math.abs(differenceInDays(new Date(txn.settlement_due_date), new Date()));
                      return (
                        <div key={txn.id} className="bg-white p-3 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-red-900">{txn.seller_name}</p>
                            <p className="text-sm text-red-700">
                              Invoice: {txn.invoice_number} • Amount: ₹{txn.amount_paid.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-red-600 font-semibold">{daysOverdue} days overdue</p>
                            <p className="text-xs text-red-500">Due: {format(new Date(txn.settlement_due_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => navigate('/transactions')}
                    className="mt-3 text-red-600 hover:text-red-700 font-medium text-sm"
                  >
                    View all transactions →
                  </button>
                </div>
              </div>
            </div>
          )}

          {dueSoon.length > 0 && (
            <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg" data-testid="due-soon-reminders">
              <div className="flex items-start gap-3">
                <Bell className="text-orange-600 flex-shrink-0 mt-0.5" size={24} />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-orange-900 mb-2">
                    Settlements Due Soon ({dueSoon.length})
                  </h3>
                  <div className="space-y-2">
                    {dueSoon.slice(0, 3).map(txn => {
                      const daysLeft = differenceInDays(new Date(txn.settlement_due_date), new Date());
                      return (
                        <div key={txn.id} className="bg-white p-3 rounded-lg flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-orange-900">{txn.seller_name}</p>
                            <p className="text-sm text-orange-700">
                              Invoice: {txn.invoice_number} • Amount: ₹{txn.amount_paid.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-orange-600 font-semibold">{daysLeft} days left</p>
                            <p className="text-xs text-orange-500">Due: {format(new Date(txn.settlement_due_date), 'MMM dd, yyyy')}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {dueSoon.length > 3 && (
                    <p className="mt-2 text-sm text-orange-700">
                      + {dueSoon.length - 3} more settlements due soon
                    </p>
                  )}
                  <button
                    onClick={() => navigate('/transactions')}
                    className="mt-3 text-orange-600 hover:text-orange-700 font-medium text-sm"
                  >
                    View all transactions →
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 hover:border-t-secondary transition-all duration-300 p-6"
              data-testid={stat.testId}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold mb-1">
                {stat.title}
              </p>
              <p className="text-3xl font-heading font-bold text-foreground">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pool Distribution Chart */}
        <div className="lg:col-span-5 bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 p-6">
          <h3 className="text-xl font-heading font-semibold mb-6 text-foreground">Pool Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={poolData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ₹${value.toLocaleString('en-IN')}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {poolData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₹${value.toLocaleString('en-IN')}`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Transactions */}
        <div className="lg:col-span-7 bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 p-6">
          <h3 className="text-xl font-heading font-semibold mb-6 text-foreground">Recent Transactions</h3>
          <div className="space-y-4">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                  data-testid={`transaction-${txn.id}`}
                >
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{txn.seller_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Invoice: {txn.invoice_number}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(txn.payment_date), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono font-semibold text-foreground">
                      ₹{txn.amount_paid.toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-green-600">
                      Discount: ₹{txn.discount_received.toLocaleString('en-IN')}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        txn.settlement_status === 'settled'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {txn.settlement_status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Returns Summary */}
      <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 p-6">
        <h3 className="text-xl font-heading font-semibold mb-4 text-foreground">Total Returns Generated</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg">
            <p className="text-sm text-emerald-700 font-semibold mb-2">Total Returns</p>
            <p className="text-3xl font-mono font-bold text-emerald-900">
              ₹{(stats?.total_returns_generated || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
            <p className="text-sm text-amber-700 font-semibold mb-2">Investor Share (70%)</p>
            <p className="text-3xl font-mono font-bold text-amber-900">
              ₹{((stats?.total_returns_generated || 0) * 0.70).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
            <p className="text-sm text-blue-700 font-semibold mb-2">Shop Share (30%)</p>
            <p className="text-3xl font-mono font-bold text-blue-900">
              ₹{((stats?.total_returns_generated || 0) * 0.30).toLocaleString('en-IN')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
