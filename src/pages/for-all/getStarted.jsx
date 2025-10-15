import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom';
import getStartedICON from '/static/getStarted.gif'
const GetStarted = () => {
        const[isGuest, setIsGuest] = useState(false);
     const {createdAs} = useParams();
    
     const navigate = useNavigate();
     
     const HandleStarted = () => {
    if (createdAs === "host") {
      navigate('setupService')
    } else if (createdAs === "Guest") {
      alert("Starting as Guest");
    } else {
      navigate('/error');
    }
  };
  const HandleLater = () => {
     if(createdAs === "host"){
      navigate('/host');
    }else{
      alert("ACCOUNT NOT FOUND | OR ERROR")
    }
  }
     useEffect(()=>{
        if(createdAs !== "host" && createdAs !== "guest"){
            navigate('/error');
        }

        if(createdAs === "Guest"){
            navigate('/');
        }

     },[])
  return (
    <div className="getStartedHost">
      <div className="getStartedCard">
        <img src={getStartedICON} alt="Get Started" className="getStartedImage" />

        <div className="getStartedCard-groupText">
          <h1>
            Turn Your Business Idea <br /> Into Reality 🚀
          </h1>
          <p>
            Start setting up your hosting services and welcome your first guests.
          </p>

          <div className="getStartedButtons">
            <button className="btn-start" onClick={HandleStarted}>
              Start Now
            </button>
            <button className="btn-later" onClick={HandleLater}>
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GetStarted