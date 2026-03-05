import { useState, useEffect } from 'react';
import { api } from '../api';
import { toast } from 'sonner';
import { Plus, X, CheckCircle, ArrowLeftRight, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [sellers, setSellers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    seller_id: '',
    amount_paid: '',
    invoice_number: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txnRes, sellersRes] = await Promise.all([
        api.getTransactions(),
        api.getSellers(),
      ]);
      setTransactions(txnRes.data);
      setSellers(sellersRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createTransaction({
        ...formData,
        amount_paid: parseFloat(formData.amount_paid),
      });
      toast.success('Transaction created successfully');
      setShowModal(false);
      setFormData({ seller_id: '', amount_paid: '', invoice_number: '', notes: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create transaction');
    }
  };

  const handleSettle = async (id) => {
    if (!window.confirm('Mark this transaction as settled?')) return;
    try {
      await api.settleTransaction(id);
      toast.success('Transaction settled successfully');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to settle transaction');
    }
  };

  const exportToExcel = () => {
    const exportData = transactions.map(txn => ({
      'Seller': txn.seller_name,
      'Invoice Number': txn.invoice_number,
      'Amount Paid (₹)': txn.amount_paid,
      'Discount Received (₹)': txn.discount_received,
      'Investor Share (₹)': txn.investor_share,
      'Shop Share (₹)': txn.shop_share,
      'Payment Date': format(new Date(txn.payment_date), 'MMM dd, yyyy'),
      'Due Date': format(new Date(txn.settlement_due_date), 'MMM dd, yyyy'),
      'Payment Terms': `${txn.payment_terms_days} days`,
      'Status': txn.settlement_status,
      'Settlement Date': txn.settlement_date ? format(new Date(txn.settlement_date), 'MMM dd, yyyy') : '-',
      'Notes': txn.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, 
      { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 30 }
    ];
    
    XLSX.writeFile(wb, `CPD_Transactions_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel file downloaded successfully');
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Add title
    doc.setFontSize(18);
    doc.text('Royal Readymades - CPD Transaction History', 14, 15);
    doc.setFontSize(10);
    doc.text(`Generated on: ${format(new Date(), 'MMM dd, yyyy')}`, 14, 22);
    
    // Prepare table data
    const tableData = transactions.map(txn => [
      txn.seller_name,
      txn.invoice_number,
      `₹${txn.amount_paid.toLocaleString('en-IN')}`,
      `₹${txn.discount_received.toLocaleString('en-IN')}`,
      `₹${txn.investor_share.toLocaleString('en-IN')}`,
      `₹${txn.shop_share.toLocaleString('en-IN')}`,
      format(new Date(txn.payment_date), 'MMM dd, yyyy'),
      format(new Date(txn.settlement_due_date), 'MMM dd, yyyy'),
      txn.settlement_status
    ]);
    
    autoTable(doc, {
      startY: 28,
      head: [['Seller', 'Invoice', 'Amount', 'Discount', 'Investor Share', 'Shop Share', 'Payment Date', 'Due Date', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [6, 78, 59], textColor: 255 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });
    
    doc.save(`CPD_Transactions_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF file downloaded successfully');
  };

  const getDaysUntilDue = (dueDate) => {
    return differenceInDays(new Date(dueDate), new Date());
  };

  const getStatusBadge = (txn) => {
    if (txn.settlement_status === 'settled') {
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">settled</span>;
    }
    
    const daysUntilDue = getDaysUntilDue(txn.settlement_due_date);
    
    if (daysUntilDue < 0) {
      return (
        <div className="flex flex-col gap-1">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
            overdue
          </span>
          <span className="text-xs text-red-600">{Math.abs(daysUntilDue)} days overdue</span>
        </div>
      );
    } else if (daysUntilDue <= 7) {
      return (
        <div className="flex flex-col gap-1">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
            due soon
          </span>
          <span className="text-xs text-orange-600">{daysUntilDue} days left</span>
        </div>
      );
    } else {
      return (
        <div className="flex flex-col gap-1">
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
            pending
          </span>
          <span className="text-xs text-muted-foreground">{daysUntilDue} days left</span>
        </div>
      );
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
    <div className="p-6 md:p-10 space-y-8" data-testid="transactions-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-heading font-semibold text-primary mb-2">Transactions</h1>
          <p className="text-muted-foreground">Track all CPD payments and settlements</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-medium shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
            data-testid="export-excel-button"
          >
            <FileSpreadsheet size={20} />
            Export Excel
          </button>
          <button
            onClick={exportToPDF}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-2"
            data-testid="export-pdf-button"
          >
            <FileText size={20} />
            Export PDF
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-lg font-medium shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all flex items-center gap-2"
            data-testid="create-transaction-button"
          >
            <Plus size={20} />
            New Transaction
          </button>
        </div>
      </div>

      <div className="bg-white shadow-sm rounded-xl border-t-4 border-t-primary/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Seller
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Invoice
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Amount Paid
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Discount
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Split (70:30)
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Payment Date
                </th>
                <th className="px-6 py-4 text-left text-xs uppercase tracking-wider text-slate-500 font-bold">
                  Due Date
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
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-12 text-center text-muted-foreground">
                    <ArrowLeftRight size={48} className="mx-auto mb-4 text-slate-300" />
                    <p>No transactions yet. Create your first transaction.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    data-testid={`transaction-row-${txn.id}`}
                  >
                    <td className="px-6 py-4">
                      <p className="font-semibold text-foreground">{txn.seller_name}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{txn.invoice_number}</td>
                    <td className="px-6 py-4">
                      <p className="font-mono font-semibold text-foreground">
                        ₹{txn.amount_paid.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-mono text-green-600 font-semibold">
                        ₹{txn.discount_received.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-xs text-muted-foreground">
                        Investor: <span className="font-mono font-semibold text-emerald-600">₹{txn.investor_share.toLocaleString('en-IN')}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Shop: <span className="font-mono font-semibold text-blue-600">₹{txn.shop_share.toLocaleString('en-IN')}</span>
                      </p>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {format(new Date(txn.payment_date), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(txn.settlement_due_date), 'MMM dd, yyyy')}
                      </p>
                      <p className="text-xs text-slate-500">({txn.payment_terms_days} days)</p>
                    </td>
                    <td className="px-6 py-4">
                      {getStatusBadge(txn)}
                    </td>
                    <td className="px-6 py-4">
                      {txn.settlement_status === 'pending' && (
                        <button
                          onClick={() => handleSettle(txn.id)}
                          className="text-green-600 hover:text-green-700 font-medium text-sm flex items-center gap-1"
                          data-testid={`settle-transaction-${txn.id}`}
                        >
                          <CheckCircle size={16} />
                          Settle
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

      {/* Create Transaction Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" data-testid="create-transaction-modal">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-semibold text-primary">New Transaction</h2>
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
                <label className="block text-sm font-medium text-slate-700 mb-2">Select Seller</label>
                <select
                  value={formData.seller_id}
                  onChange={(e) => setFormData({ ...formData, seller_id: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="transaction-seller-select"
                >
                  <option value="">Choose a seller</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name} ({seller.payment_terms_days} days, {seller.discount_percentage}% discount)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Amount Paid (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount_paid}
                  onChange={(e) => setFormData({ ...formData, amount_paid: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="transaction-amount-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Invoice Number</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  required
                  data-testid="transaction-invoice-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Notes (Optional)</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
                  rows="3"
                  data-testid="transaction-notes-input"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white py-3 rounded-lg font-medium shadow-lg shadow-primary/20 hover:-translate-y-0.5 transition-all"
                data-testid="submit-transaction-button"
              >
                Create Transaction
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
