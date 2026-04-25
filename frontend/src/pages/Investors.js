import { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { Plus, X, UserPlus, TrendingUp, History } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function Investors() {
  const [investors, setInvestors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    contribution_amount: '',
  });

  useEffect(() => {
    loadInvestors();
  }, []);

  const loadInvestors = async () => {
    try {
      const response = await api.getInvestors();
      setInvestors(response.data);
    } catch (error) {
      toast.error('Failed to load investors');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createInvestor({
        name: formData.name,
        phone: formData.phone,
        contribution_amount: parseFloat(formData.contribution_amount),
      });
      toast.success('Investor added successfully');
      setShowModal(false);
      setFormData({ name: '', phone: '', contribution_amount: '' });
      loadInvestors();
    } catch (error) {
      toast.error('Failed to add investor');
    }
  };

  const handleRemove = async (id) => {
    if (!window.confirm('Are you sure you want to remove this investor?')) return;
    try {
      await api.removeInvestor(id);
      toast.success('Investor removed successfully');
      loadInvestors();
    } catch (error) {
      toast.error('Failed to remove investor');
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
    <div className="p-6 md:p-10 space-y-8" data-testid="investors-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-semibold text-primary mb-2">Investors</h1>
          <p className="text-muted-foreground">Manage your CPD pool investors</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/investors/history"
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium shadow-sm hover:-translate-y-0.5 transition-all flex items-center gap-2"
            data-testid="view-history-button"
          >
            <History size={18} />
            View History
          </Link>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            data-testid="add-investor-button"
          >
            <Plus size={20} />
            Add Investor
          </button>
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
                  Returns
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Date Joined
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
              {investors.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-muted-foreground">
                    <UserPlus size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>No investors yet. Add your first investor to get started.</p>
                  </td>
                </tr>
              ) : (
                investors.map((investor) => (
                  <tr
                    key={investor.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`investor-row-${investor.id}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{investor.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-foreground">{investor.phone}</p>
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
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(investor.date_joined), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          investor.status === 'active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {investor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {investor.status === 'active' && (
                        <button
                          onClick={() => handleRemove(investor.id)}
                          className="text-red-600 hover:text-red-700 font-medium text-sm"
                          data-testid={`remove-investor-${investor.id}`}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Investor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" data-testid="add-investor-modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-semibold text-primary">Add New Investor</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600"
                data-testid="close-modal-button"
              >
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="investor-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="investor-phone-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Contribution Amount (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.contribution_amount}
                  onChange={(e) => setFormData({ ...formData, contribution_amount: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="investor-contribution-input"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                data-testid="submit-investor-button"
              >
                Add Investor
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
