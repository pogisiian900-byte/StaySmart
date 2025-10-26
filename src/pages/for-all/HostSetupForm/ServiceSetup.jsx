import React from "react";
import house from "/static/3dHome.png";
import exp from "/static/3dExp.png";
import serv from "/static/3dService.webp";
const ServiceSetup = ({ generalData, handleChange }) => {

  return (
    <>
    <div className="form-title-group">
    <img src={serv} alt="" />
      <h2 className="form-title">Service Details</h2>
    </div>

      <label className="form-label">
        Service Category:
        <input
          className="form-input"
          type="text"
          value={generalData.serviceCategory}
          onChange={(e) => handleChange("serviceCategory", e.target.value)}
          placeholder="e.g. Cleaning, Car Wash, Haircut"
          required
        />
      </label>

      <label className="form-label">
        Service Duration (hours):
        <input
          className="form-input"
          type="number"
          min="1"
          value={generalData.serviceDuration}
          onChange={(e) => handleChange("serviceDuration", e.target.value)}
          required
        />
      </label>

      <label className="form-label">
        Availability Hours:
        <input
          className="form-input"
          type="text"
          value={generalData.availabilityHours}
          onChange={(e) => handleChange("availabilityHours", e.target.value)}
          placeholder="e.g. 9AM - 6PM"
          required
        />
      </label>

      <label className="form-label">
        Service Area:
        <input
          className="form-input"
          type="text"
          value={generalData.serviceArea}
          onChange={(e) => handleChange("serviceArea", e.target.value)}
          placeholder="e.g. Within Bulacan or Metro Area"
          required
        />
      </label>
    </>
  );
};

export default ServiceSetup;
