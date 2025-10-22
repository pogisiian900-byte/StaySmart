import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import house from "/static/3dHome.png";
import exp from "/static/3dExp.png";
import serv from "/static/3dService.webp";
import { db } from "../../../config/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

const HostSetupForm = () => {
  const { serviceType, hostId, draftId } = useParams();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const isEditingDraft = Boolean(draftId);

  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState(null);
  const [multiPhotos, setMultiPhotos] = useState([null, null, null, null]);
  const [showPhotoError, setShowPhotoError] = useState(false);

  const [generalData, setGeneralData] = useState({
    title: "",
    description: "",
    price: "",
    location: "",
    maxGuests: "",
    amenities: [],
    propertyType: "",
    bedrooms: 0,
    beds: 0,
    bathrooms: 0,
    roomType: "",
    category: "",
    duration: 0,
    groupSizeLimit: 0,
    meetingPoint: "",
    serviceCategory: "",
    serviceDuration: 0,
    availabilityHours: "",
    serviceArea: "",
    rating: 0,
    discount: 0
  });

  // ✅ Fetch draft if editing
  useEffect(() => {
    const fetchDraft = async () => {
      if (!isEditingDraft) return;

      try {
        const draftRef = doc(db, "Drafts", draftId);
        const snap = await getDoc(draftRef);

        if (snap.exists()) {
          const data = snap.data();
          setGeneralData(data.generalData || {});
          setPhoto(data.photos?.[0] || null);
          const extra = data.photos?.slice(1) || [];
          setMultiPhotos([...extra, null, null, null, null].slice(0, 4));
        }
      } catch (error) {
        console.error("Error fetching draft:", error);
      }
    };

    fetchDraft();
  }, [isEditingDraft, draftId]);

  // ✅ Cloudinary Upload
  const uploadImageToCloudinary = async (file) => {
    const uploadPreset = "listing_uploads";
    const cloudName = "ddckoojwo";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Upload failed");
    return data.secure_url;
  };

  // ✅ Single & Multiple Image Upload
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const url = await uploadImageToCloudinary(file);
        setPhoto(url);
      } catch (err) {
        console.error("Upload failed:", err);
      }
    }
  };

  const handleMultiFileChange = async (e, index) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const url = await uploadImageToCloudinary(file);
      const updated = [...multiPhotos];
      updated[index] = url;
      setMultiPhotos(updated);
    } catch (error) {
      console.error("Upload failed:", error);
    }
  };

  const handleRemovePhoto = (e) => {
    e.stopPropagation();
    setPhoto(null);
  };

  const handleRemoveMultiPhoto = (e, index) => {
    e.stopPropagation();
    const newPhotos = [...multiPhotos];
    newPhotos[index] = null;
    setMultiPhotos(newPhotos);
  };

  const handleChange = (field, value) => {
    setGeneralData((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ Step Navigation
  const nextStep = (e) => {
    e.preventDefault();
    if (!photo) {
      setShowPhotoError(true);
      return;
    }
    setShowPhotoError(false);

    const uploadedCount = multiPhotos.filter((p) => p !== null).length;
    if (uploadedCount < 4 && dialogRef.current) {
      const msg =
        uploadedCount === 0
          ? "You didn’t add any additional photos. Maybe later?"
          : `You added only ${uploadedCount} ${
              uploadedCount === 1 ? "photo" : "photos"
            }.`;
      dialogRef.current.querySelector("p").textContent = msg;
      dialogRef.current.showModal();
    } else {
      setStep((s) => s + 1);
    }
  };

  const prevStep = () => setStep((s) => s - 1);

  // ✅ Save or Update Draft
  const handleSaveDraft = async (e) => {
    e.preventDefault();
    try {
      const draftData = {
        hostId,
        serviceType,
        generalData,
        photos: photo
          ? [photo, ...multiPhotos.filter(Boolean)]
          : multiPhotos.filter(Boolean),
        createdAt: serverTimestamp(),
        isDraft: true,
      };
      console.log(draftData);
      if (isEditingDraft) {
        await updateDoc(doc(db, "Drafts", draftId), draftData);
        alert("Draft updated successfully!");
      } else {
        await addDoc(collection(db, "Drafts"), draftData);
        alert("Draft saved successfully!");
      }

      navigate(`/host/${hostId}`);
    } catch (error) {
      console.error("Error saving draft:", error);
      alert("Something went wrong while saving your draft.");
    }
  };

  // ✅ Submit Final Listing
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) {
      setShowPhotoError(true);
      return;
    }

    try {
      await addDoc(collection(db, "Listings"), {
        ...generalData,
        serviceType,
        hostId,
        photos: [photo, ...multiPhotos.filter(Boolean)],
        createdAt: serverTimestamp(),
      });

      alert("Listing saved successfully!");
      navigate(`/host/${hostId}`);
    } catch (error) {
      console.error("Error saving listing:", error);
      alert("Something went wrong while saving your listing.");
    }
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
                : serv
            }
            alt={serviceType}
            width="150px"
          />
        </div>

        {/* ---------- STEP 1 ---------- */}
        {step === 1 && (
          <form onSubmit={nextStep} className="formStep">
            <h2>Basic Information</h2>

            <label className="form-label">
              Title:
              <input
                className="form-input"
                type="text"
                value={generalData.title}
                onChange={(e) => handleChange("title", e.target.value)}
                required
              />
            </label>

            <label className="form-label">
              Description:
              <textarea
                className="form-input"
                value={generalData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                required
              />
            </label>

            <label className="form-label">
              Price (₱):
              <input
                className="form-input"
                type="number"
                value={generalData.price}
                onChange={(e) => handleChange("price", e.target.value)}
                required
              />
            </label>

            <label className="form-label">
              Location:
              <input
                className="form-input"
                type="text"
                value={generalData.location}
                onChange={(e) => handleChange("location", e.target.value)}
                required
              />
            </label>

            <label className="form-label">
              Maximum Guests:
              <input
                className="form-input"
                type="number"
                value={generalData.maxGuests}
                onChange={(e) => handleChange("maxGuests", e.target.value)}
                required
              />
            </label>

            <label className="form-label">
              What do you Offer:
              <input
                className="form-input"
                type="text"
                 placeholder={
                  serviceType === "room"
                    ? "Ex: TV, WiFi, Air Conditioner"
                    : serviceType === "service"
                    ? "Ex: Shampoo, Towels, Massage Table"
                    : serviceType === "experience"
                    ? "Ex: Camera, Snacks, Safety Gear"
                    : "Service not Stated"
                }
                onChange={(e) => {
                  const amenitiesArray = e.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter((item) => item.length > 0);
                  handleChange("amenities", amenitiesArray);
                }}
                
              />
            </label>

            {/* ✅ Front Photo Upload */}
            <label className="form-label">Choose Front Photo of your setup:</label>
            <div
              className="listing-photo"
              onClick={() => document.getElementById("photoInput").click()}
            >
              {photo ? (
                <>
                  <img src={photo} alt="Preview" />
                  <button
                    className="close-btn"
                    onClick={handleRemovePhoto}
                    type="button"
                  >
                    ✕
                  </button>
                </>
              ) : (
                <span className="placeholder">Click to upload</span>
              )}
            </div>
            {showPhotoError && !photo && (
              <p className="error-text">
               <svg xmlns="http://www.w3.org/2000/svg" height="23px" viewBox="0 -960 960 960" width="23px" fill="#ff0000ff"><path d="M479.79-288q15.21 0 25.71-10.29t10.5-25.5q0-15.21-10.29-25.71t-25.5-10.5q-15.21 0-25.71 10.29t-10.5 25.5q0 15.21 10.29 25.71t25.5 10.5ZM444-432h72v-240h-72v240Zm36.28 336Q401-96 331-126t-122.5-82.5Q156-261 126-330.96t-30-149.5Q96-560 126-629.5q30-69.5 82.5-122T330.96-834q69.96-30 149.5-30t149.04 30q69.5 30 122 82.5T834-629.28q30 69.73 30 149Q864-401 834-331t-82.5 122.5Q699-156 629.28-126q-69.73 30-149 30Zm-.28-72q130 0 221-91t91-221q0-130-91-221t-221-91q-130 0-221 91t-91 221q0 130 91 221t221 91Zm0-312Z"/></svg>
                Front photo is required.
              </p>
            )}
            <input
              id="photoInput"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              hidden
            />

            {/* ✅ Multi Photo Upload */}
            <label className="form-label">Upload up to 4 additional photos (optional):</label>
            <div className="photo-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="listing-photo"
                  onClick={() =>
                    document.getElementById(`multiPhoto${index}`).click()
                  }
                >
                  {multiPhotos[index] ? (
                    <>
                      <img src={multiPhotos[index]} alt={`Photo ${index + 1}`} />
                      <button
                        className="close-btn"
                        type="button"
                        onClick={(e) => handleRemoveMultiPhoto(e, index)}
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <span className="placeholder">Click to upload</span>
                  )}
                  <input
                    id={`multiPhoto${index}`}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => handleMultiFileChange(e, index)}
                  />
                </div>
              ))}
            </div>

            <div className="formButtons">
              <div className="leftButtons">
                <button className="saveDraftButton" type="button" onClick={handleSaveDraft}>
                 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
                  Save as Draft
                </button>
              </div>

              <div className="rightButtons">
                <button
                  className="form-btn"
                  onClick={() => navigate(`/host/${hostId}`)}
                  type="button"
                >
                  Back
                </button>
                <button className="form-btn primary" type="submit">
                  Next
                </button>
              </div>
            </div>

          </form>
        )}

        {/* ---------- STEP 2 ---------- */}
{step === 2 && (
  <div className="formStep">
    <button className="saveDraftButton" type="button" onClick={handleSaveDraft}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
                  Save as Draft
                </button>
    <form onSubmit={handleSubmit}>

      {/* ========== ROOM SETUP ========== */}
      {serviceType === "room" && (
        <>
          <h2 className="form-title">Room Details</h2>

      <label className="form-label">
          Property Type:
          <select
            className="form-input"
            onChange={(e) => handleChange("propertyType", e.target.value)}
            required
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
              required
            />
          </label>

          <label className="form-label">
            Room Type:
            <select
              className="form-input"
              onChange={(e) => handleChange("roomType", e.target.value)}
              required
            >
              <option value="">Select</option>
              <option value="entire home">Entire Home</option>
              <option value="private room">Private Room</option>
              <option value="shared room">Shared Room</option>
            </select>
          </label>
        </>
      )}

      {/* ========== EXPERIENCE SETUP ========== */}
      {serviceType === "experience" && (
        <>
          <h2 className="form-title">Experience Details</h2>

          <label className="form-label">
            Category:
            <input
              className="form-input"
              type="text"
              placeholder={
                    serviceType === "room"
                      ? "Ex: TV, WiFi, Air Conditioner"
                      : serviceType === "service"
                      ? "Ex: Shampoo, Towels, Massage Table"
                      : serviceType === "experience"
                      ? "Ex: Camera, Snacks, Safety Gear"
                      : "Ex: TV, WiFi, Air Conditioner"
                  }
              onChange={(e) => handleChange("category", e.target.value)}
              required
            />
          </label>

          <label className="form-label">
            Duration (hours):
            <input
              className="form-input"
              type="number"
              min="1"
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
              onChange={(e) => handleChange("groupSizeLimit", e.target.value)}
              required
            />
          </label>

          <label className="form-label">
            Meeting Point:
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Bulacan Plaza or any landmark"
              onChange={(e) => handleChange("meetingPoint", e.target.value)}
              required
            />
          </label>
        </>
      )}

      {/* ========== SERVICE SETUP ========== */}
      {serviceType === "service" && (
        <>
          <h2 className="form-title">Service Details</h2>

          <label className="form-label">
            Service Category:
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Cleaning, Car Wash, Haircut"
              onChange={(e) => handleChange("serviceCategory", e.target.value)}
              required
            />
          </label>

          <label className="form-label">
            Service Duration (hours):
            <input
              className="form-input"
              type="number"
              min="1"
              onChange={(e) => handleChange("serviceDuration", e.target.value)}
              required
            />
          </label>

          <label className="form-label">
            Availability Hours:
            <input
              className="form-input"
              type="text"
              placeholder="e.g. 9AM - 6PM"
              onChange={(e) => handleChange("availabilityHours", e.target.value)}
              required
            />
          </label>

          <label className="form-label">
            Service Area:
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Within Bulacan or Metro Area"
              onChange={(e) => handleChange("serviceArea", e.target.value)}
              required
            />
          </label>
        </>
      )}

      {/* BUTTONS */}
      <div className="formButtons">
        <button className="form-btn" onClick={prevStep} type="button">
          Back
        </button>
        <button className="form-btn primary" type="submit">
          Finish
        </button>
      </div>
    </form>
  </div>
)}

      </div>

      {/* Dialog */}
      <dialog ref={dialogRef} className="additional-photo-error">
        <p></p>
        <div className="group-button">
          <button
            type="button"
            onClick={() => {
              dialogRef.current.close();
              setStep((s) => s + 1);
            }}
          >
            Yeah, Maybe Later
          </button>
          <button
            type="button"
            onClick={() => {
              dialogRef.current.close();
            }}
          >
            No, Add them now
          </button>
        </div>
      </dialog>

      <dialog className="savingDraftDialog">
        <h1>Are you sure on saving</h1>
      </dialog>
    </div>
  );
};

export default HostSetupForm;
