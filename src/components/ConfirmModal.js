// src/components/ConfirmModal.js
import React, { useState, useEffect } from "react";


// Inside ConfirmModal.js
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  const [cancellationReason, setCancellationReason] = useState('');
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-medium text-gray-900">{title || 'Confirm Action'}</h3>
        </div>
        
        <div className="px-6 py-4">
          <p className="text-gray-700 mb-4">{message || 'Are you sure you want to proceed?'}</p>
          
          {/* Add a reason input field */}
          <div className="mt-4">
            <label htmlFor="cancellationReason" className="block text-sm font-medium text-gray-700">
              Reason for cancellation (optional)
            </label>
            <textarea
              id="cancellationReason"
              rows="3"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter reason for cancellation..."
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            ></textarea>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm(cancellationReason);
              onClose();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;