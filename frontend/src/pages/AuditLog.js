import { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { ScrollText, UserPlus, UserMinus, ArrowLeftRight, CheckCircle, Filter, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

const EVENT_CONFIG = {
  investor_joined: {
    icon: UserPlus,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    textColor: 'text-emerald-700',
    label: 'Investor Joined',
  },
  investor_exited: {
    icon: UserMinus,
    color: 'bg-red-500',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    label: 'Investor Exited',
  },
  transaction_created: {
    icon: ArrowLeftRight,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    label: 'Transaction Created',
  },
  transaction_settled: {
    icon: CheckCircle,
    color: 'bg-amber-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    textColor: 'text-amber-700',
    label: 'Transaction Settled',
  },
};

function AuditLogCard({ log, isExpanded, onToggle }) {
  const config = EVENT_CONFIG[log.event_type] || {
    icon: ScrollText,
    color: 'bg-slate-500',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
    textColor: 'text-slate-700',
    label: log.event_type,
  };
  const Icon = config.icon;

  return (
    <div
      className={`border ${config.borderColor} rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md`}
      data-testid={`audit-log-${log.id}`}
    >
      <div
        className={`${config.bgColor} p-4 cursor-pointer`}
        onClick={onToggle}
      >
        <div className="flex items-start gap-4">
          <div className={`${config.color} p-2.5 rounded-lg flex-shrink-0`}>
            <Icon size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${config.textColor} ${config.bgColor} border ${config.borderColor}`}>
                  {config.label}
                </span>
                {log.entity_name && (
                  <span className="text-sm font-semibold text-foreground">{log.entity_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">
                  {format(new Date(log.timestamp), 'MMM dd, yyyy HH:mm')}
                </span>
                {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
              </div>
            </div>
            <p className="text-sm text-foreground/80 mt-1.5 leading-relaxed">{log.description}</p>
          </div>
        </div>
      </div>

      {isExpanded && log.details && Object.keys(log.details).length > 0 && (
        <div className="bg-white p-4 border-t border-slate-100">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-3">Event Details</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Object.entries(log.details).map(([key, value]) => {
              if (key === 'return_distribution') return null;
              const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
              const displayVal = typeof value === 'number'
                ? (key.includes('amount') || key.includes('share') || key.includes('return') || key.includes('pool') || key.includes('contribution') || key.includes('discount'))
                  ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                  : key.includes('proportion') ? `${value}%` : value
                : value || '-';
              return (
                <div key={key} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5 break-all">{String(displayVal)}</p>
                </div>
              );
            })}
          </div>
          {log.details.return_distribution && log.details.return_distribution.length > 0 && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Return Distribution</p>
              <div className="bg-slate-50 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="px-4 py-2 text-left text-xs font-bold text-slate-500">Investor</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">Share %</th>
                      <th className="px-4 py-2 text-right text-xs font-bold text-slate-500">Return Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.details.return_distribution.map((dist, idx) => (
                      <tr key={idx} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-2 font-medium">{dist.investor_name}</td>
                        <td className="px-4 py-2 text-right text-muted-foreground">{dist.proportion}%</td>
                        <td className="px-4 py-2 text-right font-mono font-semibold text-emerald-600">
                          ₹{dist.return_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-3 flex justify-end">
            <span className="text-xs text-muted-foreground">By: {log.performed_by}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filteredLogs = logs.filter((log) => {
  if (filter === "all") return true;
  return log.event_type === filter;
});
 
useEffect(() => {
  const loadLogs = async () => {
    try {
      const token = localStorage.getItem("token");

      const res = await fetch(
        `${process.env.REACT_APP_BACKEND_URL}/api/audit-logs`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error("Failed to fetch logs");
      }

      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Error fetching logs:", err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  loadLogs();
}, []);

  const filters = [
    { value: 'all', label: 'All Events' },
    { value: 'investor_joined', label: 'Investor Joined' },
    { value: 'investor_exited', label: 'Investor Exited' },
    { value: 'transaction_created', label: 'Transaction Created' },
    { value: 'transaction_settled', label: 'Transaction Settled' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8" data-testid="audit-log-page">
      <div>
        <h1 className="text-4xl font-heading font-semibold text-primary mb-2">Audit Log</h1>
        <p className="text-muted-foreground">Track all pool activity — investor movements, transactions, and settlements</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap" data-testid="audit-log-filters">
        <Filter size={18} className="text-muted-foreground" />
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() =>  setFilter(f.value) }
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === f.value
                ? 'bg-primary text-white shadow-md shadow-primary/20'
                : 'bg-white text-muted-foreground border border-slate-200 hover:bg-slate-50'
            }`}
            data-testid={`filter-${f.value}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', count: logs.length, color: 'text-slate-700', bg: 'bg-slate-100' },
          { label: 'Investor Events', count: logs.filter(l => l.entity_type === 'investor').length, color: 'text-emerald-700', bg: 'bg-emerald-100' },
          { label: 'Transactions', count: logs.filter(l => l.event_type === 'transaction_created').length, color: 'text-blue-700', bg: 'bg-blue-100' },
          { label: 'Settlements', count: logs.filter(l => l.event_type === 'transaction_settled').length, color: 'text-amber-700', bg: 'bg-amber-100' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl p-4`}>
            <p className={`text-xs font-semibold ${stat.color} uppercase tracking-wider`}>{stat.label}</p>
            <p className={`text-2xl font-heading font-bold ${stat.color} mt-1`}>{stat.count}</p>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-4" data-testid="audit-log-timeline">
        {logs.length === 0 ? (
          <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 p-12 text-center">
            <ScrollText size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-muted-foreground">No audit logs yet. Activities will appear here as they happen.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
  <AuditLogCard
    key={log.id}
    log={log}
    isExpanded={expandedId === log.id}
    onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
  />
))
        )}
      </div>
    </div>
  );
}
