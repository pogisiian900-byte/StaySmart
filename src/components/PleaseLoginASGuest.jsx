import React from 'react';
import { useNavigate } from 'react-router-dom';
import './PleaseLoginASGuest.css';

const PleaseLoginASGuest = ({ onClose }) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="dialog-overlay" onClick={onClose} />
      <div className="please-login-dialog">
        <svg
          className="dialog-icon"
          xmlns="http://www.w3.org/2000/svg"
          width="120"
          height="120"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#5271ff"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
          <line x1="6" y1="1" x2="6" y2="4"></line>
          <line x1="10" y1="1" x2="10" y2="4"></line>
          <line x1="14" y1="1" x2="14" y2="4"></line>
        </svg>
        <h2>Guest Account Required</h2>
        <p>Please log in or register as a guest to access this feature and explore our amazing listings!</p>
        <div className="login-buttons">
          <button
            className="login-btn secondary"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="login-btn primary"
            onClick={() => navigate('/login')}
          >
            Log In
          </button>
        </div>
      </div>
    </>
  );
};

export default PleaseLoginASGuest;
