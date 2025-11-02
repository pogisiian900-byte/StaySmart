import React, { useState } from "react";
import provincesCities from "../../location/city_provinces.json";
import barangays from "../../location/barangay.json";
import '../for-all/HostRegis.css';

const Part2 = ({formData, onChange, onNext, onPrev}) => {
  const [selectedProvince, setSelectedProvince] = useState(formData.province || "");
  const [selectedCity, setSelectedCity] = useState(formData.city || "");
  const [selectedBarangay, setSelectedBarangay] = useState(formData.barangay || "");

  const provinces = [...new Set(provincesCities.map((item) => item.province))];

  const cities = provincesCities.filter(
    (item) => item.province === selectedProvince
  );

  const brgys = barangays.filter((b) => b.citymun === selectedCity);

  const handleSubmit = (e) => {
      e.preventDefault();

      if(e.target.checkValidity()){
        onNext();
      }else{
        e.target.reportValidity();
      }
  }

  return (
    <div className="part2">
      <div className="part1-header">
        <h1>Your Address</h1>
        <p className="part1-subtitle">Step 2 of 3: Location Details</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="part2-form-container">
          {/* Province */}
          <div className="regis-field-div">
            <label>Province</label>
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setSelectedCity("");
                setSelectedBarangay("");
                onChange("province", e.target.value);
              }}
              required
            >
              <option value="">-- Select Province --</option>
              {provinces.map((prov) => (
                <option key={prov} value={prov}>
                  {prov}
                </option>
              ))}
            </select>
          </div>

          {/* City */}
          <div className="regis-field-div">
            <label>City / Municipality</label>
            <select
              value={selectedCity}
              onChange={(e) => {
                setSelectedCity(e.target.value);
                setSelectedBarangay("");
                onChange("city", e.target.value);
              }}
              disabled={!selectedProvince}
              required
            >
              <option value="">-- Select City --</option>
              {cities.map((city) => (
                <option key={city.name} value={city.name}>
                  {city.name}
                </option>
              ))}
            </select>
            {!selectedProvince && (
              <p className="field-hint">Please select a province first</p>
            )}
          </div>

          {/* Barangay */}
          <div className="regis-field-div">
            <label>Barangay</label>
            <select
              value={selectedBarangay}
              onChange={(e) => {
                setSelectedBarangay(e.target.value);
                onChange("barangay", e.target.value);
              }}
              disabled={!selectedCity}
              required
            >
              <option value="">-- Select Barangay --</option>
              {brgys.map((brgy) => (
                <option key={brgy.code} value={brgy.name}>
                  {brgy.name}
                </option>
              ))}
            </select>
            {!selectedCity && (
              <p className="field-hint">Please select a city first</p>
            )}
          </div>

          {/* Street */}
          <div className="regis-field-div">
            <label>Street Address</label>
            <input 
              type="text" 
              placeholder="Enter your street name, building, unit number, etc."
              value={formData.street}
              onChange={(e) => onChange("street", e.target.value)}
              required
            />
          </div>

          {/* Zip Code */}
          <div className="regis-field-div">
            <label>Zip Code</label>
            <input 
              type="number" 
              placeholder="Enter zip code"
              value={formData.zipCode || ''}
              onChange={(e) => onChange("zipCode", parseInt(e.target.value) || 0)}
              required 
            />
          </div>
        </div>

        <div className="regis-button-next">
          <button type='button' onClick={onPrev} className="btn-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Go Back
          </button>
          <button type='submit' className="btn-primary">
            Continue
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Part2;