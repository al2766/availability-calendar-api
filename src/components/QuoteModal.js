// src/components/QuoteModal.js
import React, { useState } from 'react';

const QuoteModal = ({ isOpen, onClose, onSendQuote, booking }) => {
  const [quoteAmount, setQuoteAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate input
    if (!quoteAmount || isNaN(parseFloat(quoteAmount)) || parseFloat(quoteAmount) <= 0) {
      setError('Please enter a valid quote amount');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    // Send the quote
    onSendQuote(parseFloat(quoteAmount).toFixed(2));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-opacity duration-300">
      <div 
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden transform transition-transform duration-300 ease-in-out"
        style={{ 
          animation: 'modal-appear 0.3s ease-out forwards'
        }}
      >
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">Send Quote</h3>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4">
            <p className="text-gray-700 mb-4">
              Send a quote to {booking?.customerName || 'the customer'} for the booking on {booking?.displayDate || 'the selected date'}.
            </p>
            
            <div className="mb-4">
              <label htmlFor="quoteAmount" className="block text-sm font-medium text-gray-700 mb-1">
                Quote Amount (£)
              </label>
              <div className="relative mt-1 rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">£</span>
                </div>
                <input
                  type="number"
                  name="quoteAmount"
                  id="quoteAmount"
                  className={`block w-full pl-7 pr-12 py-2 rounded-md border ${error ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(e.target.value)}
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">GBP</span>
                </div>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>
            
            <p className="text-sm text-gray-500 italic">
              An email with this quote will be sent to the customer for payment.
            </p>
          </div>
          
          <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex items-center"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : 'Send Quote'}
            </button>
          </div>
        </form>
      </div>
      
      <style jsx="true">{`
        @keyframes modal-appear {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default QuoteModal;