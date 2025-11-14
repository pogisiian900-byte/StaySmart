import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "../../../config/firebase";
import {
  collection,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  deleteDoc
} from "firebase/firestore";
import RoomSetup from "./RoomSetup";
import ExperienceSetup from "./ExperienceSetup";
import ServiceSetup from "./ServiceSetup";

const HostSetupForm = () => {
  const { serviceType, hostId, draftId } = useParams();
  const navigate = useNavigate();
  const dialogRef = useRef(null);
  const successDialogRef = useRef(null);
  const isEditingDraft = Boolean(draftId);
  const [isDisabled, setIsDisabled] = useState(false);

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
    setIsDisabled(true);

    try {
      await addDoc(collection(db, "Listings"), {
        ...generalData,
        serviceType,
        hostId,
        photos: [photo, ...multiPhotos.filter(Boolean)],
        createdAt: serverTimestamp(),
      });

       if (isEditingDraft) {
      await deleteDoc(doc(db, "Drafts", draftId));
      console.log(`Draft ${draftId} deleted successfully`);
    }

      // Show success dialog
      if (successDialogRef.current) {
        try {
          if (typeof successDialogRef.current.showModal === 'function') {
            successDialogRef.current.showModal();
          } else {
            successDialogRef.current.style.display = 'block';
          }
        } catch (err) {
          console.error('Error showing success dialog:', err);
          successDialogRef.current.style.display = 'block';
        }
      }
    } catch (error) {
      console.error("Error saving listing:", error);
      alert("Something went wrong while saving your listing.");
      setIsDisabled(false);
    }
  };

  const handleCloseSuccessDialog = () => {
    if (successDialogRef.current) {
      successDialogRef.current.close();
    }
    navigate(`/host/${hostId}`);
  };
  return (
    <div className="hostSetupForm">
      <div className="formContainer">
        {/* Progress Indicator */}
        <div className="form-progress">
          <div className="progress-steps">
            <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>
              <div className="step-number">1</div>
              <div className="step-label">Basic Info</div>
            </div>
            <div className={`progress-line ${step >= 2 ? 'active' : ''}`}></div>
            <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>
              <div className="step-number">2</div>
              <div className="step-label">Details</div>
            </div>
          </div>
        </div>

        {/* ---------- STEP 1 ---------- */}
        {step === 1 && (
          <form onSubmit={nextStep} className="formStep">
            <div className="form-header">
              <h2 className="form-main-title">Basic Information</h2>
              <p className="form-subtitle">Let's start with the essential details about your listing</p>
            </div>

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
                    : "Any Amenities your mutiple service should have?"
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
            <div className="form-header">
              <h2 className="form-main-title">Listing Information</h2>
              <p className="form-subtitle">Add specific details about your {serviceType}</p>
            </div>

   <form onSubmit={handleSubmit}>
  {serviceType.includes("room") && (
    <RoomSetup generalData={generalData} handleChange={handleChange} />
  )}
  {serviceType.includes("experience") && (
    <ExperienceSetup generalData={generalData} handleChange={handleChange} />
  )}
  {serviceType.includes("service") && (
    <ServiceSetup generalData={generalData} handleChange={handleChange} />
  )}

  <div className="formButtons">
    <div className="form-button-group">

    <button className="saveDraftButton" type="button" onClick={handleSaveDraft}>
       <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-save-icon lucide-save"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>
         Save as Draft
        </button>
    <button className="form-btn" onClick={prevStep} type="button">
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-arrow-left-icon lucide-circle-arrow-left"><circle cx="12" cy="12" r="10"/><path d="m12 8-4 4 4 4"/><path d="M16 12H8"/></svg>
      Back
    </button>
    </div>
    <button className="form-btn primary" disabled={isDisabled} type="submit">
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-circle-check-icon lucide-circle-check"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
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

      {/* Success Dialog */}
      <dialog ref={successDialogRef} className="listing-success-dialog">
        <div className="success-dialog-content">
          <div className="success-icon">✓</div>
          <h2 className="success-title">Listing Saved Successfully!</h2>
          <p className="success-message">
            Your listing has been created and is now live. You can view it in your listings page.
          </p>
          <button 
            className="success-close-btn" 
            onClick={handleCloseSuccessDialog}
          >
            Go to My Listings
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
