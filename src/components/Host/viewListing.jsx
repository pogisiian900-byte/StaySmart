import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import nothing from "/static/no photo.webp";
import Loading from "../../components/Loading";

const ViewListing = () => {
  const { hostId, listingId } = useParams();
  const [selectedListing, setSelectedListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [photo, setPhoto] = useState(null);
  const [showPhotoError, setShowPhotoError] = useState(false);
 const [multiPhotos, setMultiPhotos] = useState([null, null, null, null]);
// 🔹 New state & ref for confirmation
const confirmDialogRef = useRef(null);
const [updating, setUpdating] = useState(false);

  
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
  // 🔹 Dialog Refs
  const editDialogRef = useRef(null);
  const discountDialogRef = useRef(null);

  // 🔹 Handlers for dialog open/close
  const handleEdit = () => editDialogRef.current?.showModal();
  const handleDiscount = () => discountDialogRef.current?.showModal();
  const closeEditDialog = () => editDialogRef.current?.close();
  const closeDiscountDialog = () => discountDialogRef.current?.close();

  
const handleUpdate = async () => {
  confirmDialogRef.current?.showModal(); // Show confirmation first
};
  // If user confirms
const confirmUpdate = async () => {
  try {
    setUpdating(true);
    confirmDialogRef.current?.close();

    const updatedPhotos = [
      photo || selectedListing.photos?.[0] || nothing,
      ...multiPhotos.map((p, i) => p || selectedListing.photos?.[i + 1] || null),
    ].filter(Boolean);

    const docRef = doc(db, "Listings", listingId);
    await updateDoc(docRef, {
      ...generalData,
      photos: updatedPhotos,
      lastUpdated: new Date(),
    });

    alert("✅ Listing updated successfully!");
    closeEditDialog();
    navigate(`/host/${hostId}`)
  } catch (error) {
    console.error("Update failed:", error);
    alert("❌ Failed to update listing. Please try again.");
  } finally {
    setUpdating(false);
  }
};
  useEffect(() => {
  const fetchListing = async () => {
    try {
      if (!listingId) {
        console.warn("No listingId found in route params");
        return;
      }

      const docRef = doc(db, "Listings", listingId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const listingData = { id: docSnap.id, ...docSnap.data() };
        setSelectedListing(listingData);
        setGeneralData({
          title: listingData.title || "",
          description: listingData.description || "",
          price: listingData.price || "",
          location: listingData.location || "",
          maxGuests: listingData.maxGuests || "",
          amenities: listingData.amenities || [],
          propertyType: listingData.propertyType || "",
          bedrooms: listingData.bedrooms || 0,
          beds: listingData.beds || 0,
          bathrooms: listingData.bathrooms || 0,
          roomType: listingData.roomType || "",
          category: listingData.category || "",
          duration: listingData.duration || 0,
          groupSizeLimit: listingData.groupSizeLimit || 0,
          meetingPoint: listingData.meetingPoint || "",
          serviceCategory: listingData.serviceCategory || "",
          serviceDuration: listingData.serviceDuration || 0,
          availabilityHours: listingData.availabilityHours || "",
          serviceArea: listingData.serviceArea || "",
          rating: listingData.rating || 0,
          discount: listingData.discount || 0
        });
      } else {
        console.log("No such listing found!");
      }
    } catch (error) {
      console.error("Error fetching listing:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchListing();
}, [listingId]);


  if (loading) return <Loading fullScreen message="Loading listing details..." />;
  if (!selectedListing)
    return <Loading fullScreen message="Listing not found. It may have been removed." />;

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

  const ListingHeader = () => (
    <div className="listing-header">
      <button className="backButton-view" onClick={() => navigate(-1)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m12 19-7-7 7-7" />
          <path d="M19 12H5" />
        </svg>
      </button>

      <button className="editButton-view" onClick={handleEdit}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
        </svg>
      </button>
    </div>
  );

  const ImageGroup = ({ photos = [] }) => {
    const mainPhoto = photos[0] || nothing;
    const subPhotos = photos.slice(1, 5);

    return (
      <div className="image-group-container">
        <div className="main-image">
          <img
            src={mainPhoto}
            alt="Main Listing"
            width="100%"
            onError={(e) => (e.target.src = nothing)}
          />
        </div>

        <div className="sub-images-grid">
          {subPhotos.map((photo, index) => (
            <img
              key={index}
              src={photo || nothing}
              alt={`Listing ${index + 1}`}
              onError={(e) => (e.target.src = nothing)}
            />
          ))}
          {Array.from({ length: 4 - subPhotos.length }).map((_, i) => (
            <img key={`empty-${i}`} src={nothing} alt="Empty slot" />
          ))}
        </div>
      </div>
    );
  };

  const InfoBlock = ({ label, value }) => (
    <p>
      <strong>{label}:</strong> {value || "N/A"}
    </p>
  );

  const { serviceType } = selectedListing;

  return (
    <div className="view-listing">
      <ListingHeader />
      <ImageGroup photos={selectedListing.photos} />

      <div className="view-listing-content">
        <h2>{selectedListing.title}</h2>
        <p>{selectedListing.description}</p>
        <InfoBlock label="📍 Location" value={selectedListing.location} />
        <InfoBlock label="💰 Price" value={`₱${selectedListing.price}`} />
        <InfoBlock label="⭐ Rating" value={selectedListing.rating} />
        <hr />

        {serviceType === "experience" && (
          <>
            <InfoBlock label="👥 Max Guests" value={selectedListing.maxGuests} />
            <InfoBlock label="Category" value={selectedListing.category} />
            <InfoBlock label="Duration" value={selectedListing.duration} />
            <InfoBlock label="Group Size Limit" value={selectedListing.groupSize} />
            <InfoBlock label="Meeting Point" value={selectedListing.meetingPoint} />
          </>
        )}

        {serviceType === "room" && (
          <>
            <InfoBlock label="🛏 Beds" value={selectedListing.beds} />
            <InfoBlock label="🛁 Bathrooms" value={selectedListing.bathrooms} />
            <InfoBlock label="🏠 Property Type" value={selectedListing.propertyType} />
            <InfoBlock label="Bedrooms" value={selectedListing.bedrooms} />
            <InfoBlock label="Room Type" value={selectedListing.roomType} />
          </>
        )}

        {serviceType === "service" && (
          <>
            <InfoBlock label="💼 Category" value={selectedListing.serviceCategory} />
            <InfoBlock label="🕒 Duration" value={selectedListing.serviceDuration+" hours"}  />
            <InfoBlock label="⏰ Availability Hours" value={selectedListing.availabilityHours} />
            <InfoBlock label="📍 Service Area" value={selectedListing.serviceArea} />
          </>
        )}
      </div>
    {selectedListing.discount ? (
      <div className="discount-card">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-badge-percent-icon lucide-badge-percent"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m15 9-6 6"/><path d="M9 9h.01"/><path d="M15 15h.01"/></svg>
        <p>Discount: {selectedListing.discount}%</p> 
            <button className="changeDiscountButton">Change</button>
      </div>
      
    ) : (
      <div className="discount-card">
      <button className="addDiscount" onClick={handleDiscount}>
        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-badge-dollar-sign-icon lucide-badge-dollar-sign"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>
        Add Discount</button>
      </div>
    )}
    {/* 🔹 EDIT LISTING DIALOG */}
     {/* 🔹 EDIT LISTING DIALOG */}
<dialog ref={editDialogRef} className="editListing-dialog">
  {/* ❌ Close Button */}
  <span className="closeButton" onClick={closeEditDialog}>
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="lucide lucide-x">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  </span>

  <h3>Edit Listing</h3>
<div className="editListing-div">
  
  {/* 🧾 BASIC INFO */}
  <div className="basic-listing-info">
    <label className="form-label">
      Title:
      <input
        className="form-input"
        type="text"
        value={generalData.title}
        onChange={(e) => handleChange("title", e.target.value)}
      />
    </label>

    <label className="form-label">
      Description:
      <textarea
        className="form-input"
        value={generalData.description}
        onChange={(e) => handleChange("description", e.target.value)}
      />
    </label>

    <label className="form-label">
      Price (₱):
      <input
        className="form-input"
        type="number"
        value={generalData.price}
        onChange={(e) => handleChange("price", e.target.value)}
      />
    </label>

    <label className="form-label">
      Location:
      <input
        className="form-input"
        type="text"
        value={generalData.location}
        onChange={(e) => handleChange("location", e.target.value)}
      />
    </label>

    <label className="form-label">
      Maximum Guests:
      <input
        className="form-input"
        type="number"
        value={generalData.maxGuests}
        onChange={(e) => handleChange("maxGuests", e.target.value)}
      />
    </label>

    <label className="form-label">
      What do you offer:
      <input
        className="form-input"
        type="text"
        value={generalData.amenities.join(", ")}
        placeholder={
          serviceType === "room"
          ? "Ex: TV, WiFi, Air Conditioner"
          : serviceType === "service"
          ? "Ex: Shampoo, Towels, Massage Table"
          : "Ex: Camera, Snacks, Safety Gear"
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

    {/* 🖼 Front Photo */}
    <label className="form-label">Front Photo:</label>
    <div
      className="listing-photo"
      onClick={() => document.getElementById("photoInput").click()}
    >
      {photo || selectedListing.photos?.[0] ? (
        <>
          <img src={photo || selectedListing.photos?.[0]} alt="Preview" />
          <button className="close-btn" onClick={handleRemovePhoto} type="button">
            ✕
          </button>
        </>
      ) : (
        <span className="placeholder">Click to upload</span>
      )}
    </div>
    <input
      id="photoInput"
      type="file"
      accept="image/*"
      onChange={handleFileChange}
      hidden
    />

    {/* 🖼 Additional Photos */}
    <label className="form-label">Additional Photos:</label>
    <div className="photo-grid-edit">
      {Array.from({ length: 4 }).map((_, index) => {
        const existingPhoto = selectedListing.photos?.[index + 1];
        return (
          <div
            key={index}
            className="listing-photo"
            onClick={() => document.getElementById(`multiPhoto${index}`).click()}
          >
            {multiPhotos[index] || existingPhoto ? (
              <>
                <img
                  src={multiPhotos[index] || existingPhoto}
                  alt={`Photo ${index + 1}`}
                  />
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
        );
      })}
    </div>
  </div>

  <div className="otherInfoDiv">

  {/* 💡 LISTING TYPE SECTIONS */}
  {serviceType === "room" && (
    <div>

      <label className="form-label">
        Property Type:
        <select
          className="form-input"
          value={generalData.propertyType}
          onChange={(e) => handleChange("propertyType", e.target.value)}
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
        Bedrooms:
        <input
          className="form-input"
          type="number"
          min="0"
          value={generalData.bedrooms}
          onChange={(e) => handleChange("bedrooms", e.target.value)}
        />
      </label>

      <label className="form-label">
        Beds:
        <input
          className="form-input"
          type="number"
          min="0"
          value={generalData.beds}
          onChange={(e) => handleChange("beds", e.target.value)}
        />
      </label>

      <label className="form-label">
        Bathrooms:
        <input
          className="form-input"
          type="number"
          min="0"
          value={generalData.bathrooms}
          onChange={(e) => handleChange("bathrooms", e.target.value)}
        />
      </label>

      <label className="form-label">
        Room Type:
        <select
          className="form-input"
          value={generalData.roomType}
          onChange={(e) => handleChange("roomType", e.target.value)}
        >
          <option value="">Select</option>
          <option value="entire home">Entire Home</option>
          <option value="private room">Private Room</option>
          <option value="shared room">Shared Room</option>
        </select>
      </label>
    </div>
  )}

  {serviceType === "experience" && (
    <div>

      <label className="form-label">
        Category:
        <input
          className="form-input"
          type="text"
          value={generalData.category}
          onChange={(e) => handleChange("category", e.target.value)}
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
        />
      </label>

      <label className="form-label">
        Meeting Point:
        <input
          className="form-input"
          type="text"
          value={generalData.meetingPoint}
          onChange={(e) => handleChange("meetingPoint", e.target.value)}
          />
      </label>
    </div>
  )}

  {serviceType === "service" && (
    <div>

      <label className="form-label">
        Service Category:
        <input
          className="form-input"
          type="text"
          value={generalData.serviceCategory}
          onChange={(e) => handleChange("serviceCategory", e.target.value)}
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
          />
      </label>

      <label className="form-label">
        Availability Hours:
        <input
          className="form-input"
          type="text"
          value={generalData.availabilityHours}
          onChange={(e) => handleChange("availabilityHours", e.target.value)}
          />
      </label>

      <label className="form-label">
        Service Area:
        <input
          className="form-input"
          type="text"
          value={generalData.serviceArea}
          onChange={(e) => handleChange("serviceArea", e.target.value)}
          />
      </label>
    </div>
  )}
  </div>
</div>

  {/* ✅ Confirm Changes Button */}
 <button
  className="confirm-btn"
  type="button"
  onClick={handleUpdate}
  disabled={updating}
>
  {updating ? "Updating..." : "Confirm Changes"}
</button>

</dialog>

{/* 🔹 CONFIRM UPDATE DIALOG */}
<dialog ref={confirmDialogRef} className="confirmUpdate-dialog">
  <h3>Confirm Update</h3>
  <p>Are you sure you want to update this listing?</p>
  <div className="confirm-buttons">
    <button onClick={confirmUpdate} className="yes-btn">Yes</button>
    <button onClick={() => confirmDialogRef.current?.close()} className="no-btn">No</button>
  </div>
</dialog>




      {/* 🔹 ADD DISCOUNT DIALOG */}
      <dialog ref={discountDialogRef} className="addDiscount-dialog">
        <h3>Add Discount {listingId} </h3>
            
        <button onClick={closeDiscountDialog}>Close</button>
      </dialog>
    </div>
  );
};

export default ViewListing;
