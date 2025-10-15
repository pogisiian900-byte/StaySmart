import React, { useState } from 'react';
import house from '/static/3dHome.png';
import exp from '/static/3dExp.png';
import serv from '/static/3dService.webp';
import { useNavigate } from 'react-router-dom';
const SetupService = () => {
  const [selected, setSelected] = useState("home");
  
  const navigate = useNavigate();
  const handleNext = () => {
    if (!selected) return alert("Please select a category first!");
    alert(`You selected: ${selected}`);
    navigate(''+selected)
  };


  return (
    <div className="setupServiceHost">
      <div className="setupServiceHeader">
        <h1>What would you like to host?</h1>
        <p>Select the type of service you want to offer on your platform.</p>
      </div>

      <div className="setupServiceHost-group">
        {/* Home */}
        <div
          className={`setupServiceCard ${selected === "room" ? "ServiceSelected" : ""}`}
          onClick={() => setSelected("room")}
        >
          <img src={house} alt="home" />
          <h2>Home</h2>
          <p>Host guests in your cozy home or private space.</p>
        </div>

        {/* Experience */}
        <div
          className={`setupServiceCard ${selected === "experience" ? "ServiceSelected" : ""}`}
          onClick={() => setSelected("experience")}
        >
          <img src={exp} alt="experience" />
          <h2>Experience</h2>
          <p>Offer unique experiences, tours, or local adventures.</p>
        </div>

        {/* Service */}
        <div
          className={`setupServiceCard ${selected === "service" ? "ServiceSelected" : ""}`}
          onClick={() => setSelected("service")}
        >
          <img src={serv} alt="service" />
          <h2>Service</h2>
          <p>Provide services such as event hosting or workshops.</p>
        </div>
      </div>
      <div className="service-button-group">
        
      <button className="nextBtn" onClick={()=> navigate('/getStarted/host')}>
        Back
      </button>
      
      
      <button className="nextBtn" onClick={handleNext}>
        Next →
      </button>
      </div>
    </div>
  );
};

export default SetupService;
