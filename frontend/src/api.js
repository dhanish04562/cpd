import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const api = {
  // Auth
  login: (credentials) => axios.post(`${API}/auth/login`, credentials),

  // Dashboard
  getDashboardStats: () => axios.get(`${API}/dashboard/stats`, { headers: getAuthHeader() }),

  // Investors
  getInvestors: () => axios.get(`${API}/investors`, { headers: getAuthHeader() }),
  getInactiveInvestors: () => axios.get(`${API}/investors/inactive`, { headers: getAuthHeader() }),
  createInvestor: (data) => axios.post(`${API}/investors`, data, { headers: getAuthHeader() }),
  removeInvestor: (id) => axios.delete(`${API}/investors/${id}`, { headers: getAuthHeader() }),
  deleteInvestorPermanently: (id) => axios.delete(`${API}/investors/${id}/permanent`, { headers: getAuthHeader() }),

  // Sellers
  getSellers: () => axios.get(`${API}/sellers`, { headers: getAuthHeader() }),
  createSeller: (data) => axios.post(`${API}/sellers`, data, { headers: getAuthHeader() }),
  getSeller: (id) => axios.get(`${API}/sellers/${id}`, { headers: getAuthHeader() }),

  // Transactions
  getTransactions: () => axios.get(`${API}/transactions`, { headers: getAuthHeader() }),
  createTransaction: (data) => axios.post(`${API}/transactions`, data, { headers: getAuthHeader() }),
  settleTransaction: (transaction_id) => axios.post(`${API}/transactions/settle`, { transaction_id }, { headers: getAuthHeader() }),

  // Reports
  getInvestorReturns: () => axios.get(`${API}/reports/investor-returns`, { headers: getAuthHeader() }),

  // Audit Logs
  getAuditLogs: (params = {}) => axios.get(`${API}/audit-logs`, { headers: getAuthHeader(), params }),
  getInvestorAuditLogs: (investorId) => axios.get(`${API}/audit-logs/investor/${investorId}`, { headers: getAuthHeader() }),
};
