import React, { useState, useEffect } from "react";
import { db } from "../config/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import nothing from "/static/no photo.webp";

const SelectListingItem = () => {
  const { listingId } = useParams();
  const [selectedListing, setSelectedListing] = useState(null);
  const [withDiscount, setWithDiscount] = useState(true); // Set this up later
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
          setSelectedListing({ id: docSnap.id, ...docSnap.data() });
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

  if (loading) return <p>⏳ Loading listing details...</p>;
  if (!selectedListing) return <p>❌ Listing not found.</p>;

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
      <button className="shareListing-view">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-share2-icon lucide-share-2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" x2="15.42" y1="13.51" y2="17.49"/><line x1="15.41" x2="8.59" y1="6.51" y2="10.49"/></svg>
        Share
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
    <div className="view-listing-group">

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
            <InfoBlock
              label="Group Size Limit"
              value={selectedListing.groupSize}
            />
            <InfoBlock
              label="Meeting Point"
              value={selectedListing.meetingPoint}
              />
          </>
        )}

        {serviceType === "room" && (
          <>
            <InfoBlock label="🛏 Beds" value={selectedListing.beds} />
            <InfoBlock label="🛁 Bathrooms" value={selectedListing.bathrooms} />
            <InfoBlock
              label="🏠 Property Type"
              value={selectedListing.propertyType}
            />
            <InfoBlock label="Bedrooms" value={selectedListing.bedrooms} />
            <InfoBlock label="Room Type" value={selectedListing.roomType} />
          </>
        )}

        {serviceType === "service" && (
          <>
            <InfoBlock label="💼 Category" value={selectedListing.serviceCategory} />
            <InfoBlock label="🕒 Duration" value={`${selectedListing.serviceDuration} an Hour`} />
            <InfoBlock
              label="⏰ Availability Hours"
              value={selectedListing.availabilityHours}
              />
            <InfoBlock
              label="📍 Service Area"
              value={selectedListing.serviceArea}
            />
          </>
        )}
      </div>
   
        <div className="reservationBox">
          <div className="promo-div">
            {withDiscount ? (
              <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-gem-icon lucide-gem"><path d="M10.5 3 8 9l4 13 4-13-2.5-6"/><path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z"/><path d="M2 9h20"/></svg>
                <p> with {selectedListing.discount|| "No Data"} %</p>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#ff4848ff"><path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/></svg>
                <p>No Discount</p>
              </>
            )}
          </div>

          <div className="price-header">
            <h2><span className="price">{selectedListing.price} ₱</span> night</h2>
          </div>

          <div className="check-section">
            <div className="date-input">
              <label>Check-in</label>
              <input type="date" />
            </div>
            <div className="date-input">
              <label>Check-out</label>
              <input type="date" />
            </div>
          </div>

          <div className="guest-section">
            <label>Guests</label>
            <input type="number" min="1" placeholder="1 guest" />
          </div>

          <button className="reserve-btn">Reserve</button>
          <small className="no-charge">You won’t be charged yet</small>
        </div>

  </div>
    </div>

  );
};

export default SelectListingItem;
