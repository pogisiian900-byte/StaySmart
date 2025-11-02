import React, { useState, useRef } from 'react';
import hostIcon from '/static/manager-icon.jpg';
import guestIcon from '/static/guest-icon.jpg';
import { useNavigate } from 'react-router-dom';
import '../../index.css';
import '../for-all/HostRegis.css';

const Part1 = ({ formData, onChange, onNext }) => {
  const [user, setUser] = useState('');
  const [userError, setUserError] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [profilePreview, setProfilePreview] = useState(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  // Cloudinary upload function
  const uploadImageToCloudinary = async (file) => {
    const uploadPreset = "listing_uploads";
    const cloudName = "ddckoojwo";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data.secure_url;
  };

  const handleProfilePictureChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingProfile(true);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload to Cloudinary
      const url = await uploadImageToCloudinary(file);
      onChange('profilePicture', url);
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      alert('Failed to upload profile picture. Please try again.');
    } finally {
      setUploadingProfile(false);
    }
  };

  const handleRemoveProfilePicture = () => {
    setProfilePreview(null);
    onChange('profilePicture', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
        <div className="part1-header">
          <h1>Create Your Account</h1>
          <p className="part1-subtitle">Step 1 of 3: Personal Information</p>
        </div>

        {/* Profile Picture Section */}
        <div className="profile-picture-section">
          <div className="profile-picture-container">
            <div className="profile-picture-wrapper">
              {profilePreview || formData.profilePicture ? (
                <div className="profile-picture-preview">
                  <img 
                    src={profilePreview || formData.profilePicture} 
                    alt="Profile preview" 
                    className="profile-preview-img"
                  />
                  {!uploadingProfile && (
                    <button
                      type="button"
                      className="profile-remove-btn"
                      onClick={handleRemoveProfilePicture}
                      title="Remove photo"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {uploadingProfile && (
                    <div className="profile-upload-overlay">
                      <div className="profile-upload-spinner"></div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="profile-picture-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  <p>Add Photo</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureChange}
              className="profile-picture-input"
              id="profile-picture-input"
              disabled={uploadingProfile}
            />
            <label 
              htmlFor="profile-picture-input" 
              className="profile-picture-label"
            >
              {uploadingProfile ? 'Uploading...' : profilePreview || formData.profilePicture ? 'Change Photo' : 'Choose Photo'}
            </label>
            <p className="profile-picture-hint">JPG, PNG or WEBP. Max 5MB</p>
          </div>
        </div>

        <div className="part1-container">
          {/* LEFT: Personal Information */}
          <div className="part1-personal">
            <h3 className="section-title">Personal Information</h3>
            
            <div className="regis-field-div">
              <label>First Name</label>
              <input
                type="text"
                placeholder="Enter your first name"
                value={formData.firstName}
                onChange={(e) => onChange('firstName', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label>Last Name</label>
              <input
                type="text"
                placeholder="Enter your last name"
                value={formData.lastName}
                onChange={(e) => onChange('lastName', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label>Middle Name</label>
              <input
                type="text"
                placeholder="Enter your middle name"
                value={formData.middleName}
                onChange={(e) => onChange('middleName', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label htmlFor="phone">Phone Number</label>
              <input
                id="phone"
                type="tel"
                placeholder="09XXXXXXXXX"
                pattern="[0-9]{4}[0-9]{3}[0-9]{4}"
                value={formData.phoneNumber}
                onChange={(e) => onChange('phoneNumber', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label htmlFor="birthday">Birthday</label>
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
            <h3 className="section-title">Account Details</h3>

            <div className="regis-field-div">
              <label>Email Address</label>
              <input
                type="email"
                placeholder="example@gmail.com"
                value={formData.emailAddress}
                onChange={(e) => onChange('emailAddress', e.target.value)}
                required
              />
            </div>

            <div className="regis-field-div">
              <label>Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => onChange('password', e.target.value)}
                  minLength={6}
                  required
                  className="password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {formData.password.length > 0 && formData.password.length < 6 && (
                <p className="field-error">Password must be at least 6 characters</p>
              )}
            </div>

            <div className="regis-field-div">
              <label>Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="password-input"
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {confirmPassword && confirmPassword !== formData.password && (
                <p className="field-error">Passwords do not match</p>
              )}
            </div>

            {/* Select user type */}
            <div className="userSelection">
              <label className="user-selection-label">I want to:</label>

              <div
                className={`userSelection-buttons ${userError ? 'error' : ''}`}
              >
                <button
                  type="button"
                  className={`select-btn ${user === 'guest' ? 'active' : ''}`}
                  onClick={() => handleSelect('guest')}
                >
                  <img src={guestIcon} alt="guest icon" />
                  <div className="select-btn-content">
                    <p>Continue as Guest</p>
                    <span>Book stays and experiences</span>
                  </div>
                </button>

                <button
                  type="button"
                  className={`select-btn ${user === 'host' ? 'active' : ''}`}
                  onClick={() => handleSelect('host')}
                >
                  <img src={hostIcon} alt="host icon" />
                  <div className="select-btn-content">
                    <p>Continue as Host</p>
                    <span>List your space or services</span>
                  </div>
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
          <button type="button" onClick={handleReturn} className="btn-secondary">
            Already have an Account?
          </button>
          <button type="submit" className="btn-primary">
            Continue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Part1;