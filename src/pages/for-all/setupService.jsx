import React, { useState } from 'react';
import house from '/static/3dHome.png';
import exp from '/static/3dExp.png';
import serv from '/static/3dService.webp';
import { useNavigate, useParams } from 'react-router-dom';

const SetupService = ({ useCase }) => {
  const [selected, setSelected] = useState(null); // store single selection only
  const navigate = useNavigate();
  const { hostId } = useParams();

  const toggleSelection = (type) => {
    // If clicking the same type, deselect it; otherwise select the new type
    setSelected((prevSelected) => prevSelected === type ? null : type);
  };

  const handleNext = () => {
    if (!selected) return alert("Please select a category!");
    if (useCase === "getStarted") {
      navigate(`/getStarted/${hostId}/setupService/${selected}`);
    } else {
      navigate(`/host/${hostId}/getStarted/${selected}`);
    }
  };

  const handleBack = () => {
    if (useCase === "getStarted") {
      navigate(-1); // just go back
    } else {
      navigate(`/host/${hostId}`);
    }
  };

  return (
    <div className="setupServiceHost">
      <div className="setupServiceHeader">
        <h1>What would you like to host?</h1>
        <p>Select one type of service you want to offer.</p>
      </div>

      <div className="setupServiceHost-group">
        {/* Home */}
        <div
          className={`setupServiceCard ${selected === "room" ? "ServiceSelected" : ""}`}
          onClick={() => toggleSelection("room")}
        >
          <img src={house} alt="home" />
          <h2>Home</h2>
          <p>Host guests in your cozy home or private space.</p>
        </div>

        {/* Experience */}
        <div
          className={`setupServiceCard ${selected === "experience" ? "ServiceSelected" : ""}`}
          onClick={() => toggleSelection("experience")}
        >
          <img src={exp} alt="experience" />
          <h2>Experience</h2>
          <p>Offer unique experiences, tours, or local adventures.</p>
        </div>

        {/* Service */}
        <div
          className={`setupServiceCard ${selected === "service" ? "ServiceSelected" : ""}`}
          onClick={() => toggleSelection("service")}
        >
          <img src={serv} alt="service" />
          <h2>Service</h2>
          <p>Provide services such as event hosting or workshops.</p>
        </div>
      </div>

      <div className="service-button-group">
        <button className="nextBtn" onClick={handleBack}>
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
