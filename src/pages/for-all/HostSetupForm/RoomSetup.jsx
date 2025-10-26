import React from "react";
import house from "/static/3dHome.png";
import exp from "/static/3dExp.png";
import serv from "/static/3dService.webp";
const RoomSetup = ({ generalData, handleChange }) => {
  return (
    <>
    <div className="form-title-group">
     <img src={house} alt="" />
      <h2 className="form-title">Room Details</h2>
    </div>

      <label className="form-label">
        Property Type:
        <select
          className="form-input"
          onChange={(e) => handleChange("propertyType", e.target.value)}
          required
          value={generalData.propertyType}
        >
          <option value="">Select</option>
          <option value="Apartment">Apartment</option>
          <option value="Condo">Condo</option>
          <option value="Villa">Villa</option>
          <option value="House">House</option>
          <option value="Studio">Studio</option>
          <option value="Townhouse">Townhouse</option>
        </select>
      </label>

      <label className="form-label">
        Number Bedrooms:
        <input
          className="form-input"
          type="number"
          min="0"
          onChange={(e) => handleChange("bedrooms", e.target.value)}
          value={generalData.bedrooms}
          required
        />
      </label>

      <label className="form-label">
        Number Beds:
        <input
          className="form-input"
          type="number"
          min="0"
          onChange={(e) => handleChange("beds", e.target.value)}
          value={generalData.beds}
          required
        />
      </label>

      <label className="form-label">
        Number Bathrooms:
        <input
          className="form-input"
          type="number"
          min="0"
          onChange={(e) => handleChange("bathrooms", e.target.value)}
          value={generalData.bathrooms}
          required
        />
      </label>

      <label className="form-label">
        Room Type:
        <select
          className="form-input"
          onChange={(e) => handleChange("roomType", e.target.value)}
          value={generalData.roomType}
          required
        >
          <option value="">Select</option>
          <option value="entire home">Entire Home</option>
          <option value="private room">Private Room</option>
          <option value="shared room">Shared Room</option>
        </select>
      </label>
    </>
  );
};

export default RoomSetup;
