import React, { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import house from '/static/3dHome.png';
import exp from '/static/3dExp.png';
import serv from '/static/3dService.webp';
const HostSetupForm = () => {
  const { serviceType } = useParams();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    location: "",
    maxGuests: "",
    amenities: "",
    // type-specific will be added later
  });


  const navigate = useNavigate();
  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const nextStep = () => setStep((s) => s + 1);
  const prevStep = () => setStep((s) => s - 1);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submitted Data:", formData);
    alert("Listing Created Successfully!");
  };

  return (
    <div className="hostSetupForm">
      <div className="formContainer">
        <div className="formContainer-text">

        <img 
          src={
            serviceType === "room"
              ? house
              : serviceType === "experience"
              ? exp
              : serviceType === "service"
              ?serv
              :"None"
          } 
          alt={serviceType}
          width="150px"
        />

        <h1>
          {serviceType.charAt(0).toUpperCase() + serviceType.slice(1)} Setup
        </h1>
        </div>

        {/* ---------- STEP 1: Common Fields ---------- */}
        {step === 1 && (
          <div className="formStep">
            <h2>Basic Information</h2>
            <label>
              Title:
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange("title", e.target.value)}
              />
            </label>

            <label>
              Description:
              <textarea
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
              />
            </label>

            <label>
              Price (₱):
              <input
                type="number"
                value={formData.price}
                onChange={(e) => handleChange("price", e.target.value)}
              />
            </label>

            <label>
              Location:
              <input
                type="text"
                value={formData.location}
                onChange={(e) => handleChange("location", e.target.value)}
              />
            </label>

            <label>
              Maximum Guests:
              <input
                type="number"
                value={formData.maxGuests}
                onChange={(e) => handleChange("maxGuests", e.target.value)}
              />
            </label>

            <label>
              Amenities (comma separated):
              <input
                type="text"
                value={formData.amenities}
                onChange={(e) => handleChange("amenities", e.target.value)}
              />
            </label>
            <div className="host-setup-group">

             <button onClick={()=> navigate("/getStarted/host/setupService")}>Back</button>
            <button onClick={nextStep}>Next</button>
            </div>
            
          </div>
        )}

        {/* ---------- STEP 2: Type-Specific Fields ---------- */}
        {step === 2 && (
          <div className="formStep">
            {serviceType === "room" && (
              <>
                <h2>Room Details</h2>
                <label>
                  Property Type:
                  <input
                    type="text"
                    onChange={(e) =>
                      handleChange("propertyType", e.target.value)
                    }
                  />
                </label>
                <label>
                  Bedrooms:
                  <input
                    type="number"
                    onChange={(e) => handleChange("bedrooms", e.target.value)}
                  />
                </label>
                <label>
                  Beds:
                  <input
                    type="number"
                    onChange={(e) => handleChange("beds", e.target.value)}
                  />
                </label>
                <label>
                  Bathrooms:
                  <input
                    type="number"
                    onChange={(e) => handleChange("bathrooms", e.target.value)}
                  />
                </label>
                <label>
                  Room Type:
                  <select
                    onChange={(e) => handleChange("roomType", e.target.value)}
                  >
                    <option value="">Select</option>
                    <option value="entire home">Entire Home</option>
                    <option value="private room">Private Room</option>
                    <option value="shared room">Shared Room</option>
                  </select>
                </label>

                <div className="room-rules">

                </div>
              </>
            )}

            {serviceType === "experience" && (
              <>
                <h2>Experience Details</h2>
                <label>
                  Category:
                  <input
                    type="text"
                    onChange={(e) => handleChange("category", e.target.value)}
                  />
                </label>
                <label>
                  Duration (hours):
                  <input
                    type="number"
                    onChange={(e) => handleChange("duration", e.target.value)}
                  />
                </label>
                <label>
                  Group Size Limit:
                  <input
                    type="number"
                    onChange={(e) =>
                      handleChange("groupSizeLimit", e.target.value)
                    }
                  />
                </label>
                <label>
                  Meeting Point:
                  <input
                    type="text"
                    onChange={(e) =>
                      handleChange("meetingPoint", e.target.value)
                    }
                  />
                </label>
              </>
            )}

            {serviceType === "service" && (
              <>
                <h2>Service Details</h2>
                <label>
                  Service Category:
                  <input
                    type="text"
                    onChange={(e) =>
                      handleChange("serviceCategory", e.target.value)
                    }
                  />
                </label>
                <label>
                  Service Duration (hours):
                  <input
                    type="number"
                    onChange={(e) =>
                      handleChange("serviceDuration", e.target.value)
                    }
                  />
                </label>
                <label>
                  Availability Hours:
                  <input
                    type="text"
                    placeholder="e.g. 9AM - 6PM"
                    onChange={(e) =>
                      handleChange("availabilityHours", e.target.value)
                    }
                  />
                </label>
                <label>
                  Service Area:
                  <input
                    type="text"
                    onChange={(e) => handleChange("serviceArea", e.target.value)}
                  />
                </label>
              </>
            )}

            <div className="formButtons">
              <button onClick={prevStep}>Back</button>
              <button onClick={handleSubmit}>Finish</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HostSetupForm;
