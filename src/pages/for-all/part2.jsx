import React, { useState } from "react";
import provincesCities from "../../location/city_provinces.json";
import barangays from "../../location/barangay.json";

const Part2 = ({formData,onChange,onNext,onPrev}) => {
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState("");

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
      <h1>User Address (Part: 2 of 3)</h1>
      <form onSubmit ={handleSubmit}>
      <div className={`regis-field-div `}>
        {/* Province */}
        <label>Province</label>
        <select
          value={selectedProvince}
          onChange={(e) => {
            setSelectedProvince(e.target.value);
            setSelectedCity("");
            setSelectedBarangay("");
            onChange("province",e.target.value)
          }}
          required
        >
          <option value="" style={{textAlign:"center"}}>-- Select Province --</option>
          {provinces.map((prov) => (
            <option key={prov} value={prov}>
              {prov}
            </option>
          ))}
        </select>

        {/* City */}
        <label>City / Municipality</label>
        <select
          value={selectedCity}
          onChange={(e) => {
            setSelectedCity(e.target.value);
            setSelectedBarangay("");
            onChange("city",e.target.value)
          }}
          disabled={!selectedProvince}
          required
        >
          <option value=""  style={{textAlign:"center"}}>-- Select City --</option>
          {cities.map((city) => (
            <option key={city.name} value={city.name}>
              {city.name}
            </option>
          ))}
        </select>

        {/* Barangay */}
        <label>Barangay</label>
        <select
          value={selectedBarangay}
          onChange={(e) => {
            setSelectedBarangay(e.target.value)
            onChange("barangay",e.target.value)
          }}
          disabled={!selectedCity}
          required
        >
          <option value=""  style={{textAlign:"center"}}>-- Select Barangay --</option>
          {brgys.map((brgy) => (
            <option key={brgy.code} value={brgy.name}>
              {brgy.name}
            </option>
          ))}
        </select>

        {/* Street */}
        <label>Street</label>
        <input type="text" 
         value={formData.street}
        onChange={(e) => onChange("street",e.target.value)}
        required/>

        {/* Zip Code */}
        <label>Zip Code</label>
        <input type="number" 
         value={formData.zipCode}
        onChange={(e) => onChange("zipCode",e.target.value)}
        required />
      </div>

      <div className={`regis-button-next `}>
        <button type='button' onClick={onPrev}>Go back</button>
        <button type='submit'>Next</button>
      </div>
      </form>
    </div>
  );
};

export default Part2;
