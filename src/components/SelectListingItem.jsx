import React, { useState, useEffect } from "react";
import { db, auth} from "../config/firebase";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore";

import nothing from "/static/no photo.webp";
import pin from "/static/selectionsIcon/map-pinned.png";
import price from "/static/selectionsIcon/philippine-peso.png";
import rating from "/static/selectionsIcon/star.png";
import bed from "/static/selectionsIcon/bed.png";
import bedroom from "/static/selectionsIcon/bed-double.png";
import bathrooms from "/static/selectionsIcon/bath.png";
import propertyType from "/static/selectionsIcon/map-pin-house.png";
import roomType from "/static/selectionsIcon/bedroom.png";
import group from "/static/selectionsIcon/users.png";
import clock from "/static/selectionsIcon/clock-fading.png";
import clock2 from "/static/selectionsIcon/clock.png";
import meeting from "/static/selectionsIcon/land-plot.png";
import category from "/static/selectionsIcon/sticker.png";
import { createOrGetConversation } from "../pages/for-all/messages/createOrGetConversation";
const SelectListingItem = () => {
  const { listingId } = useParams();
  const [selectedListing, setSelectedListing] = useState(null);
  const [hostOfListing, setHostofListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [guestCounts, setGuestCounts] = useState({
  adults: 1,
  children: 0,
  infants: 0,
  pets: 0,
});
  const [favourites, setFavourites] = useState([]); // ✅ stores user's favourite IDs
  const [favLoading, setFavLoading] = useState(false); // for button spinner
  const guestId = auth.currentUser?.uid;
 

    const handleMessageHost = async (hostId, guestId) => {
      const conversationId = await createOrGetConversation(hostId, guestId);
      console.log("id used:"+ conversationId)
      navigate(`/guest/${guestId}/chat/${conversationId}`);

    };

    useEffect(() => {
  const handleScroll = () => {
    const buttons = document.querySelector(".floating-buttons");
    if (buttons) {
      if (window.scrollY > 100) buttons.classList.add("stuck");
      else buttons.classList.remove("stuck");
    }
  };
  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, []);

  const today = new Date();
  const twoDaysLater = new Date();
  twoDaysLater.setDate(today.getDate() + 2);

  // Format dates as YYYY-MM-DD for <input type="date">
  const formatDate = (date) => date.toISOString().split("T")[0];
const [checkIn, setCheckIn] = useState(formatDate(today));
const [checkOut, setCheckOut] = useState(formatDate(twoDaysLater));

const handleCheckInChange = (e) => {
  const newCheckIn = new Date(e.target.value);
  setCheckIn(formatDate(newCheckIn));

  // Automatically adjust check-out if it's less than 2 days apart
  const minCheckoutDate = new Date(newCheckIn);
  minCheckoutDate.setDate(newCheckIn.getDate() + 2);

  if (new Date(checkOut) < minCheckoutDate) {
    setCheckOut(formatDate(minCheckoutDate));
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
        const data = docSnap.data();
        const serviceType = Array.isArray(data.serviceType)
          ? data.serviceType
          : [data.serviceType];

        setSelectedListing({ id: docSnap.id, ...data, serviceType });

        // ✅ Fetch host info using hostId
        if (data.hostId) {
          const hostRef = doc(db, "Users", data.hostId);
          const hostSnap = await getDoc(hostRef);

          if (hostSnap.exists()) {
            setHostofListing({ id: hostSnap.id, ...hostSnap.data() });
          } else {
            console.warn("No host found for this listing");
          }
        } else {
          console.warn("No hostId field found in listing");
        }
      } else {
        console.log("No such listing found!");
      }
    } catch (error) {
      console.error("Error fetching listing or host:", error);
    } finally {
      setLoading(false);
    }
  };
  

  fetchListing();
}, [listingId]);

useEffect(() => {
    const fetchFavourites = async () => {
      if (!guestId) return;
      try {
        const userRef = doc(db, "Users", guestId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setFavourites(userSnap.data().favourites || []);
        }
      } catch (error) {
        console.error("Error loading favourites:", error);
      }
    };

    fetchFavourites();
  }, [guestId]);

  // ✅ toggleFavourite (your function integrated)
  const toggleFavourite = async (listingId, e) => {
    e.stopPropagation();

    if (!guestId) {
      alert("Please log in to add favourites");
      return;
    }

    setFavLoading(true);

    try {
      const userRef = doc(db, "Users", guestId);
      const isFavourite = favourites.includes(listingId);

      if (isFavourite) {
        await updateDoc(userRef, {
          favourites: arrayRemove(listingId),
        });
        setFavourites((prev) => prev.filter((id) => id !== listingId));
      } else {
        await updateDoc(userRef, {
          favourites: arrayUnion(listingId),
        });
        setFavourites((prev) => [...prev, listingId]);
      }
    } catch (error) {
      console.error("Error updating favourites:", error);
      alert("Failed to update favourites. Please try again.");
    } finally {
      setFavLoading(false);
    }
  };

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
      <div className="rightBookingGroup">

      <button className="shareListing-view">
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
          className="lucide lucide-share2-icon"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </svg>
        Share
      </button>
      
      
      </div >

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

  const InfoBlock = ({ label, value, src }) => (
    <p className="infoBlockText">
      {src && <img src={src} alt="" width={"35px"} />}
      <strong>{label}:</strong> {value || "N/A"}
    </p>
  );

  const { serviceType } = selectedListing;

  const totalGuests = guestCounts.adults + guestCounts.children;
const maxGuests = selectedListing.maxGuests || 1; // default to 1 if not set

const canAddMoreGuests = totalGuests < maxGuests;

const handleAddGuest = (key) => {
  if (!canAddMoreGuests && (key === "adults" || key === "children")) {
    alert(`Maximum of ${maxGuests} guests reached.`);
    return;
  }

  setGuestCounts((prev) => ({
    ...prev,
    [key]: prev[key] + 1,
  }));
};

  return (
    <div className="view-listing">
      <div class="floating-buttons">

      <button className="backButton-view-mobile" onClick={() => navigate(-1)}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="30"
          height="30"
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
      <button className="shareListing-view-mobile">
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
          className="lucide lucide-share2-icon"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
          <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
        </svg>
        Share
      </button>
      </div>
      <ListingHeader />
      <ImageGroup photos={selectedListing.photos} />
    <div className="hostProfile">
  {hostOfListing ? (
    <>
        <div className="hostProfile-group">
      <img
        src={hostOfListing.profilePicture || nothing}
        alt={hostOfListing.firstName || "Host"}
        width="80"
        height="80"
        style={{ borderRadius: "50%" }}
        onError={(e) => (e.target.src = nothing)}
      />
        <div className="hostProfile-text">

      <p><strong>Host:</strong> {hostOfListing.firstName || "Unnamed Host"}</p>
      <p><strong>Phone:</strong> {hostOfListing.phoneNumber || "N/A"}</p>
      <p><strong>Email:</strong> {hostOfListing.emailAddress || "N/A"}</p>
        </div>
      </div>
    
     <button
      className="messageHost"
      onClick={() => handleMessageHost(hostOfListing.id, guestId)}
     >

      <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-circle-question-mark-icon lucide-message-circle-question-mark"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
      </button>
    </>
  ) : (
    <p>Loading host info...</p>
  )}
</div>

      <div className="view-listing-group">
        <div className="view-listing-content">
        <button
          className={`favourite-btn ${favourites.includes(selectedListing.id) ? "active" : ""}`}
          onClick={(e) => toggleFavourite(selectedListing.id, e)}
          disabled={favLoading}
        >
          {favLoading
            ? "Loading.."
            : favourites.includes(selectedListing.id)
            ? (
              <div className="selected-addFav">
                
                <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="24" 
                            height="24" 
                            viewBox="0 0 24 24" 
                            fill="currentColor" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            >
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                          </svg>
                          <p> Added to Favourites</p>
                            </div>
            )
            :  
            <div className="selected-addFav">
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
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
                          </svg>
                        <p>Add to Favourites</p>
                            </div>
            }
        </button>

          <h2>{selectedListing.title}</h2>
          <p>{selectedListing.description}</p>
          <br />
          <div className="view-listing-initialText">
            <InfoBlock src={pin} label="Location" value={selectedListing.location} />
            <InfoBlock src={price} label="Price" value={`₱${selectedListing.price}`} />
            <InfoBlock src={group} label="Maximum Guest" value={selectedListing.maxGuests} />
            <InfoBlock src={rating} label="Rating" value={selectedListing.rating} />
          </div>
          <hr />

        {/* Display all applicable sections */}
            {serviceType.some((type) => type.toLowerCase().includes("room")) && (
              <>
                <h3>Room Details</h3>
                <InfoBlock src={bed} label="Beds" value={selectedListing.beds} />
                <InfoBlock src={bathrooms} label="Bathrooms" value={selectedListing.bathrooms} />
                <InfoBlock src={propertyType} label="Property Type" value={selectedListing.propertyType} />
                <InfoBlock src={bedroom} label="Bedrooms" value={selectedListing.bedrooms} />
                <InfoBlock src={roomType} label="Room Type" value={selectedListing.roomType} />
                <hr />
              </>
            )}

            {serviceType.some((type) => type.toLowerCase().includes("experience")) && (
              <>
                <h3>Experience Details</h3>
                <InfoBlock src={category} label="Category" value={selectedListing.category} />
                <InfoBlock src={clock} label="Duration" value={selectedListing.duration} />
                <InfoBlock src={group} label="Group Size Limit" value={selectedListing.groupSize} />
                <InfoBlock src={pin} label="Meeting Point" value={selectedListing.meetingPoint} />
                <hr />
              </>
            )}

            {serviceType.some((type) => type.toLowerCase().includes("service")) && (
              <>
                <h3>Service Details</h3>
                <InfoBlock src={category}  label="Category" value={selectedListing.serviceCategory} />
                <InfoBlock  src={clock2 } label="Duration" value={`${selectedListing.serviceDuration} an Hour`} />
                <InfoBlock  src={clock}label="Availability Hours" value={selectedListing.availabilityHours} />
                <InfoBlock  src={meeting} label="Service Area" value={selectedListing.serviceArea} />
                <hr />
              </>
            )}
        </div>
          
     
        {/* Reservation Box */}
        <div className="reservationBox">
          <div className="promo-div">
            {selectedListing.discount ? (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-gem-icon"
                >
                  <path d="M10.5 3 8 9l4 13 4-13-2.5-6" />
                  <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" />
                  <path d="M2 9h20" />
                </svg>
                <p> with {selectedListing.discount || "Discount"} %</p>
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  height="24px"
                  viewBox="0 -960 960 960"
                  width="24px"
                  fill="#393b92"
                >
                  <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z" />
                </svg>
                <p>No Discount</p>
              </>
            )}
          </div>

          <div className="price-header">
            <h2>
              <span className="price">{selectedListing.price} ₱</span>
            </h2>
          </div>

              <div className="check-section">
  <div className="date-input">
    <label>Check-in</label>
    <input
      type="date"
      value={checkIn}
      min={formatDate(today)} // Prevent past dates
      onChange={handleCheckInChange}
    />
  </div>
  <div className="date-input">
    <label>Check-out</label>
    <input
      type="date"
      value={checkOut}
      min={formatDate(new Date(new Date(checkIn).setDate(new Date(checkIn).getDate() + 2)))} // must be 2+ days later
      onChange={(e) => setCheckOut(e.target.value)}
    />
  </div>
</div>


    <div className="guest-section">
  <label>Guests</label>

  <div className="guest-dropdown">
    {[
      { label: "Adults", desc: "Ages 13 or above", key: "adults" },
      { label: "Children", desc: "Ages 2–12", key: "children" },
      { label: "Infants", desc: "Under 2", key: "infants" },
      { label: "Pets", desc: "Bringing a pet?", key: "pets" },
    ].map((guest) => (
      <div key={guest.key} className="guest-row">
        <div className="guest-info">
          <p className="guest-label">{guest.label}</p>
          <p className="guest-desc">{guest.desc}</p>
        </div>
        <div className="counter-controls">
          <button className="counter-button"
            onClick={() =>
              setGuestCounts((prev) => ({
                ...prev,
                [guest.key]: Math.max(0, prev[guest.key] - 1),
              }))
            }
            disabled={guestCounts[guest.key] === 0}
          >
            −
          </button>
          <span>{guestCounts[guest.key]}</span>
          <button
            onClick={() => handleAddGuest(guest.key)}
            disabled={
              (!canAddMoreGuests && (guest.key === "adults" || guest.key === "children"))
            }
          >
            +
          </button>
        </div>
      </div>
    ))}
  </div>

  {!canAddMoreGuests && (
    <p className="max-guest-warning">
      ⚠️ Maximum of {maxGuests} guests reached.
    </p>
  )}
</div>



                <button
          className="reserve-btn"
          onClick={() =>
            navigate(`/guest/${guestId}/listing/${listingId}/booking`, {
              state: {
                listing: selectedListing,
                checkIn,
                checkOut,
                guestCounts,
              },
            })
          }
        >
          Reserve
        </button>

          <small className="no-charge">You won’t be charged yet</small>
        </div>
      </div>
      <div className="commentSection">
        <p>rate here</p>
        <p>coMMENTS</p>
      </div>
    </div>
  );
};

export default SelectListingItem;
