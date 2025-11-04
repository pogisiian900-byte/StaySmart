import React, { useState, useRef, useEffect } from 'react';
import { db, storage } from '../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import defaultAvatar from '/static/no-photo.png';
import './Profile.css';

// Import dialog polyfill for browsers that don't support the dialog element
import 'dialog-polyfill/dist/dialog-polyfill.css';
import dialogPolyfill from 'dialog-polyfill';

const ViewProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // Register dialog polyfill when component mounts
    if (dialogRef.current && !dialogRef.current.showModal) {
      dialogPolyfill.registerDialog(dialogRef.current);
    }

    const fetchUser = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'Users', userId));
        if (userDoc.exists()) {
          setUser(userDoc.data());
          setEditedUser(userDoc.data());
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId]);

const handleEditClick = () => {
  setIsEditing(true);
  console.log("Edit clicked");

  setTimeout(() => {
    if (dialogRef.current) {
      try {
        if (typeof dialogRef.current.showModal === 'function') {
          dialogRef.current.showModal();
        } else {
          dialogPolyfill.registerDialog(dialogRef.current);
          dialogRef.current.showModal();
        }
      } catch (err) {
        console.error('Error showing dialog:', err);
        dialogRef.current.style.display = 'block';
      }
    }
  }, 50);
};



  const handleCloseDialog = () => {
    setIsEditing(false);
    setEditedUser(user);
    dialogRef.current?.close();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedUser(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setIsLoading(true);
      const storageRef = ref(storage, `profilePictures/${userId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      setEditedUser(prev => ({
        ...prev,
        profilePicture: downloadURL
      }));
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsLoading(true);
      const userRef = doc(db, 'Users', userId);
      await updateDoc(userRef, editedUser);
      setUser(editedUser);
      handleCloseDialog();
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!user) return <div>Loading...</div>;

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div className="profile-image-container">
          <img
            src={user.profilePicture || defaultAvatar}
            alt={`${user.firstName}'s profile`}
            className="profile-image"
          />
        </div>
        <div className="profile-info">
          <h2>{`${user.firstName} ${user.lastName}`}</h2>
          <p>{user.emailAddress}</p>
          <button onClick={handleEditClick} className="edit-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit Profile
          </button>
        </div>
      </div>

      <dialog ref={dialogRef} className="edit-dialog">
        <div className="dialog-content">
          <h3>Edit Profile</h3>
          
          <div className="profile-image-edit">
            <img
              src={editedUser?.profilePicture || defaultAvatar}
              alt="Profile preview"
              className="profile-preview"
            />
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="change-photo-btn"
              disabled={isLoading}
            >
              Change Photo
            </button>
          </div>

          <div className="form-group">
            <label htmlFor="firstName">First Name</label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={editedUser?.firstName || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="lastName">Last Name</label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={editedUser?.lastName || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phoneNumber">Phone Number</label>
            <input
              type="tel"
              id="phoneNumber"
              name="phoneNumber"
              value={editedUser?.phoneNumber || ''}
              onChange={handleInputChange}
            />
          </div>

          <div className="dialog-actions">
            <button onClick={handleCloseDialog} className="cancel-btn" disabled={isLoading}>
              Cancel
            </button>
            <button onClick={handleSave} className="save-btn" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default ViewProfile;
