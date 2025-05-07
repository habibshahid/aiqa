// client/src/components/CreditTransactions.js
import React, { useState, useEffect } from 'react';
import { RefreshCw, ChevronLeft, ChevronRight, FileText, Plus, Minus } from 'lucide-react';

const CreditTransactions = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    pages: 0
  });
  
  const fetchTransactions = async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`api/credits/transactions?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.status}`);
      }
      
      const data = await response.json();
      setTransactions(data.transactions);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch transactions on component mount
  useEffect(() => {
    fetchTransactions();
  }, []);
  
  // Change page
  const handlePageChange = (newPage) => {
    fetchTransactions(newPage, pagination.limit);
  };
  
  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };
  
  if (loading && transactions.length === 0) {
    return (
      <div className="card">
        <div className="card-body text-center p-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-2 mb-0">Loading transaction history...</p>
        </div>
      </div>
    );
  }
  
  if (error && transactions.length === 0) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="alert alert-danger mb-0">
            <h5>Error loading transactions</h5>
            <p className="mb-2">{error}</p>
            <button className="btn btn-outline-danger btn-sm" onClick={() => fetchTransactions()}>
              <RefreshCw size={14} className="me-1" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="card">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="card-title mb-0">
          <FileText size={18} className="me-2" />
          Credit Transaction History
        </h5>
        <button 
          className="btn btn-outline-primary btn-sm"
          onClick={() => fetchTransactions(pagination.page, pagination.limit)}
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
              Loading...
            </>
          ) : (
            <>
              <RefreshCw size={14} className="me-1" />
              Refresh
            </>
          )}
        </button>
      </div>
      <div className="card-body">
        {transactions.length === 0 ? (
          <div className="text-center py-5">
            <p className="text-muted mb-0">No transaction history found</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Description</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(transaction => (
                  <tr key={transaction.id}>
                    <td>{formatDate(transaction.created_at)}</td>
                    <td>
                      {transaction.transaction_type === 'addition' ? (
                        <span className="badge bg-success">
                          <Plus size={14} className="me-1" />
                          Addition
                        </span>
                      ) : (
                        <span className="badge bg-danger">
                          <Minus size={14} className="me-1" />
                          Deduction
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={transaction.transaction_type === 'addition' ? 'text-success' : 'text-danger'}>
                        {transaction.transaction_type === 'addition' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </span>
                    </td>
                    <td>
                      {transaction.description || 
                        (transaction.evaluation_id ? 
                          <span>Evaluation: <a href={`/evaluation/${transaction.evaluation_id}`} target="_blank" rel="noopener noreferrer">{transaction.evaluation_id}</a></span> : 
                          'N/A'
                        )
                      }
                    </td>
                    <td>{formatCurrency(transaction.balance_after)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {pagination.pages > 1 && (
          <nav className="d-flex justify-content-between align-items-center mt-3">
            <span className="text-muted">
              Showing {transactions.length} of {pagination.total} transactions
            </span>
            <ul className="pagination mb-0">
              <li className={`page-item ${pagination.page === 1 ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft size={14} />
                </button>
              </li>
              
              {/* Show page numbers */}
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                // For simplicity, show at most 5 page numbers centered around current page
                let pageNum;
                if (pagination.pages <= 5) {
                  pageNum = i + 1;
                } else {
                  const startPage = Math.max(1, pagination.page - 2);
                  const endPage = Math.min(pagination.pages, startPage + 4);
                  pageNum = startPage + i;
                  
                  // Skip page numbers outside the range
                  if (pageNum > endPage) return null;
                }
                
                return (
                  <li key={pageNum} className={`page-item ${pagination.page === pageNum ? 'active' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => handlePageChange(pageNum)}
                    >
                      {pageNum}
                    </button>
                  </li>
                );
              })}
              
              <li className={`page-item ${pagination.page === pagination.pages ? 'disabled' : ''}`}>
                <button
                  className="page-link"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.pages}
                >
                  <ChevronRight size={14} />
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
};

export default CreditTransactions;