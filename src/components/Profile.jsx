import React from 'react'
import me from '/static/me.png'
import bg from '/static/bgprofile.jpg'

const Profile = () => {
  return (
    <div className="profile-page">
      
      {/* Back Button */}
      <button className='profile-backButton'>
        <svg xmlns="http://www.w3.org/2000/svg" height="35px" viewBox="0 -960 960 960" width="35px" fill="#000000">
          <path d="m287-446.67 240 240L480-160 160-480l320-320 47 46.67-240 240h513v66.66H287Z"/>
        </svg>
      </button>

      {/* Profile Header */}
      <div className="infoCard-profile-div">
        <img src={bg} alt="Cover" className="background-profile" />

        <div className="edit-btn-container">
          <button className="edit-btn">Edit</button>
        </div>

        <div className="infoCard-profile">
          <img src={me} alt="Profile" />
          <p className="profile-name">Ian Harold DR. Valderama</p>
          <p className="profile-role">Host</p>
        </div>
      </div>

      <div className="infoCard-about-div">
        <div className="profile-other">
          <p>📍 Niugan, Angat Bulacan</p>
          <p>📧 ian8harold@gmail.com</p>
          <p>📞 09053250455</p>
          <p>🗓️ Account Created: Oct 10, 2025</p>
        </div>

        <div className="descriptionCard-profile">
          <div className="profile-rating">
            <p>⭐ Overall Rating</p>
            <div className="stars">
              {[...Array(5)].map((_, i) => (
                <svg key={i} xmlns="http://www.w3.org/2000/svg" width="24" height="24" 
                  viewBox="0 0 24 24" fill="gold" stroke="currentColor" strokeWidth="1.5" 
                  strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star">
                  <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>
                </svg>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
