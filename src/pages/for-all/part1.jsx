import React, { useState } from 'react';
import hostIcon from '/static/manager-icon.jpg';
import guestIcon from '/static/guest-icon.jpg';
import { useNavigate } from 'react-router-dom';
const Part1 = ({ formData, onChange, onNext }) => {
  const [user, setUser] = useState('');
  const [userError, setUserError] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSelect = (role) => {
    setUser(role);
    setUserError(false);
    onChange('role', role);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!user) {
      setUserError(true);
      return;
    }

    if (formData.password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }

    if (e.target.checkValidity()) {
      onNext();
    } else {
      e.target.reportValidity();
    }
  };

  const handleReturn = () => {
    navigate('/');
  };

  return (
    <div className="part1">
      <form onSubmit={handleSubmit}>
        <h1>User Credentials (Part: 1 of 3)</h1>

        <div className="part1-container">
          {/* LEFT: Personal Information */}
          <div className="part1-personal">
            <div className="regis-field-div">
              <label>First Name:</label>
              <input
                type="text"
                placeholder=" "
                value={formData.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label>Last Name:</label>
              <input
                type="text"
                placeholder=" "
                value={formData.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label>Middle Name:</label>
              <input
                type="text"
                placeholder=" "
                value={formData.middleName}
                onChange={(e) => onChange('middleName', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label htmlFor="phone">Phone Number:</label>
              <input
                id="phone"
                type="tel"
                placeholder="ex. 09053250455"
                pattern="[0-9]{4}[0-9]{3}[0-9]{4}"
                value={formData.phoneNumber}
                onChange={(e) => onChange('phoneNumber', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label htmlFor="birthday">Birthday:</label>
              <input
                id="birthday"
                type="date"
                value={formData.birthday}
                onChange={(e) => onChange('birthday', e.target.value)}
                min="1900-01-01"
                max="2100-12-31"
                required
              />
            </div>
          </div>

          {/* RIGHT: Credentials */}
          <div className="part1-credentials">
            <div className="regis-field-div">
              <label>Email Address:</label>
              <input
                type="email"
                placeholder="ex. example@gmail.com"
                value={formData.emailAddress}
                onChange={(e) => onChange('emailAddress', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label>Password:</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder=""
                value={formData.password}
                onChange={(e) => onChange('password', e.target.value)}
                minLength={6}
                required
              />
              {formData.password.length > 0 &&
                formData.password.length < 6 && (
                  <p style={{ color: 'red', fontSize: '0.9em' }}>
                    Password must be at least 6 characters
                  </p>
                )}
            </div>

            <div className="regis-field-div">
              <label>Confirm Password:</label>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder=""
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {confirmPassword &&
                confirmPassword !== formData.password && (
                  <p style={{ color: 'red', fontSize: '0.9em' }}>
                    Passwords do not match
                  </p>
                )}
            </div>

            {/* 👁 Show Password Toggle */}
            <div className="showPass-div">
              <button
                className="showPass-regis"
                type="button"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? 
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-closed-icon lucide-eye-closed"><path d="m15 18-.722-3.25"/><path d="M2 8a10.645 10.645 0 0 0 20 0"/><path d="m20 15-1.726-2.05"/><path d="m4 15 1.726-2.05"/><path d="m9 18 .722-3.25"/></svg>
                : 
                <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-eye-icon lucide-eye"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                 }
              </button>
            </div>

            {/* Select user type */}
            <div className="userSelection">
              <p>Select how you want to use the platform:</p>

              <div
                className={`userSelection-buttons ${
                  userError ? 'error' : ''
                }`}
              >
                <button
                  type="button"
                  className={`select-btn ${user === 'guest' ? 'active' : ''}`}
                  onClick={() => handleSelect('guest')}
                >
                  <img src={guestIcon} alt="guest icon" />
                  <p>Continue as Guest</p>
                </button>

                <button
                  type="button"
                  className={`select-btn ${user === 'host' ? 'active' : ''}`}
                  onClick={() => handleSelect('host')}
                >
                  <img src={hostIcon} alt="host icon" />
                  <p>Continue as Host</p>
                </button>
              </div>

              {userError && (
                <p className="error-text">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ marginRight: '5px', verticalAlign: 'middle' }}
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" x2="12" y1="8" y2="12" />
                    <line x1="12" x2="12.01" y1="16" y2="16" />
                  </svg>
                  Please select a user type
                </p>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM BUTTONS */}
        <div className="regis-button-next">
          <button type="button" onClick={handleReturn}>
            Already have an Account
          </button>
          <button type="submit">Next</button>
        </div>
      </form>
    </div>
  );
};

export default Part1;
