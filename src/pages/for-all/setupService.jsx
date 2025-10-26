import React, { useRef, useState } from 'react';
import house from '/static/3dHome.png';
import exp from '/static/3dExp.png';
import serv from '/static/3dService.webp';
import { useNavigate, useParams } from 'react-router-dom';

const SetupService = ({ useCase }) => {
  const [selected, setSelected] = useState([]); // store multiple selections
  const navigate = useNavigate();
  const { hostId } = useParams();

  const toggleSelection = (type) => {
    setSelected((prevSelected) =>
      prevSelected.includes(type)
        ? prevSelected.filter((item) => item !== type) // remove if already selected
        : [...prevSelected, type] // add if not selected
    );
  };

  const handleNext = () => {
    if (selected.length === 0) return alert("Please select at least one category!");
    if (useCase === "getStarted") {
      navigate(`../${selected.join(",")}`); // join selections with commas
    } else {
      navigate(`/host/${hostId}/getStarted/${selected.join(",")}`);
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
        <p>Select one or more types of services you want to offer.</p>
      </div>

      <div className="setupServiceHost-group">
        {/* Home */}
        <div
          className={`setupServiceCard ${selected.includes("room") ? "ServiceSelected" : ""}`}
          onClick={() => toggleSelection("room")}
        >
          <img src={house} alt="home" />
          <h2>Home</h2>
          <p>Host guests in your cozy home or private space.</p>
        </div>

        {/* Experience */}
        <div
          className={`setupServiceCard ${selected.includes("experience") ? "ServiceSelected" : ""}`}
          onClick={() => toggleSelection("experience")}
        >
          <img src={exp} alt="experience" />
          <h2>Experience</h2>
          <p>Offer unique experiences, tours, or local adventures.</p>
        </div>

        {/* Service */}
        <div
          className={`setupServiceCard ${selected.includes("service") ? "ServiceSelected" : ""}`}
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
