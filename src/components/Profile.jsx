import React, { useEffect, useState } from 'react'
import me from '/static/me.png'
import bgBlue from '/static/Bluebg.png'
import bgGreen from '/static/greenBg.jpg'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from "firebase/firestore";
import { db } from ".././config/firebase";
const Profile = () => {
const { hostId, guestId } = useParams();
const [user, setUser] = useState(null);
const navigate = useNavigate();


useEffect(() => {
  
  const fetchUserData = async () => {
    try {
      const userId = hostId || guestId;
      const docRef = doc(db, "Users", userId);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        console.log("User data:", snapshot.data());
         setUser(snapshot.data()); 
      } else {
        console.log("No such user found!");
      }
    } catch (err) {
      console.error("Error fetching user:", err);
    }
  };

  fetchUserData();
}, [hostId, guestId]);


const handleBack = ()=>{
  if(user?.role == "host"){
    navigate("/host/"+hostId);
  }else{
    navigate("/guest/"+guestId);
  }
}
  return (
    <div className="profile-page">
      
      {/* Back Button */}
      <button className='profile-backButton' onClick={handleBack}>
        <svg xmlns="http://www.w3.org/2000/svg" height="35px" viewBox="0 -960 960 960" width="35px" fill="#ffffffff">
          <path d="m287-446.67 240 240L480-160 160-480l320-320 47 46.67-240 240h513v66.66H287Z"/>
        </svg>
      </button>

      {/* Profile Header */}
      <div className="infoCard-profile-div">
         <img src={user?.role == "host"? bgGreen:bgBlue} alt="Cover" className="background-profile" />

        

        <div className="edit-btn-container">
          <button className="edit-btn">Edit</button>
        </div>

        <div className="infoCard-profile">
          <img src={me} alt="Profile" />
          <p className="profile-name">{user?.firstName||""} {user?.middleName||""} {user?.lastName||"  "}</p>
          <p className="profile-role">{user?.role||"NO Role!!"}</p>
        </div>
      </div>

      <div className="infoCard-about-div">
        <div className="profile-other">
          <p>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house-icon lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>Address: {user?.barangay||"None"} {user?.city||"None"} {user?.province||"None"}</p>
          <p>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail-icon lucide-mail"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
            Email: {user?.emailAddress||"NO Role!!"}
            </p>
            <p>Password: </p>
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
         <div className="descriptionCard-profile">
          
         </div>
      </div>
    </div>
  )
}

export default Profile
