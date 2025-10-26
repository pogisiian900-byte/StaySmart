import React from "react";
import house from "/static/3dHome.png";
import exp from "/static/3dExp.png";
import serv from "/static/3dService.webp";
const ExperienceSetup = ({ generalData, handleChange }) => {
  return (
    <>
    <div className="form-title-group">
    <img src={exp} alt="" />
      <h2 className="form-title">Experience Details</h2>
    </div>

      <label className="form-label">
        Category:
        <input
          className="form-input"
          type="text"
          value={generalData.category}
          onChange={(e) => handleChange("category", e.target.value)}
          placeholder="e.g. Art Class, Hiking Tour"
          required
        />
      </label>

      <label className="form-label">
        Duration (hours):
        <input
          className="form-input"
          type="number"
          min="1"
          value={generalData.duration}
          onChange={(e) => handleChange("duration", e.target.value)}
          required
        />
      </label>

      <label className="form-label">
        Group Size Limit:
        <input
          className="form-input"
          type="number"
          min="1"
          value={generalData.groupSizeLimit}
          onChange={(e) => handleChange("groupSizeLimit", e.target.value)}
          required
        />
      </label>

      <label className="form-label">
        Meeting Point:
        <input
          className="form-input"
          type="text"
          value={generalData.meetingPoint}
          onChange={(e) => handleChange("meetingPoint", e.target.value)}
          placeholder="e.g. Bulacan Plaza or any landmark"
          required
        />
      </label>
    </>
  );
};

export default ExperienceSetup;
