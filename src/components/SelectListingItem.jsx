import React, { useState, useEffect } from "react";
import { db, auth} from "../config/firebase";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, Timestamp } from "firebase/firestore";
import "../pages/guest/guest-viewListing.css";

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
import Loading from "./Loading";
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
  const [userRating, setUserRating] = useState(0); // User's current rating input (0-5)
  const [hoveredRating, setHoveredRating] = useState(0); // For hover effect
  const [comment, setComment] = useState(""); // User's comment
  const [ratingLoading, setRatingLoading] = useState(false); // Loading state for rating submission
  const [userRatings, setUserRatings] = useState([]); // All ratings for this listing
  const [showRatingForm, setShowRatingForm] = useState(false); // Toggle rating form
 

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

        // Ensure rating is a number (handle if it's stored as string or null)
        const ratingValue = typeof data.rating === 'number' ? data.rating : 
                          (data.rating ? parseFloat(data.rating) || 0 : 0);
        
        setSelectedListing({ 
          id: docSnap.id, 
          ...data, 
          serviceType,
          rating: ratingValue // Ensure rating is always a number
        });
        
        // Fetch ratings if they exist
        if (data.ratings && Array.isArray(data.ratings)) {
          setUserRatings(data.ratings);
          
          // Pre-populate user's existing rating if they have one
          if (guestId) {
            const userRatingData = data.ratings.find(r => r.userId === guestId);
            if (userRatingData) {
              setUserRating(Number(userRatingData.rating) || 0);
              setComment(userRatingData.comment || "");
            }
          }
        } else {
          setUserRatings([]);
        }

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

  // Update form when user logs in/out or when ratings change
  useEffect(() => {
    if (guestId && userRatings.length > 0) {
      const userRatingData = userRatings.find(r => r.userId === guestId);
      if (userRatingData) {
        setUserRating(userRatingData.rating);
        setComment(userRatingData.comment || "");
      } else {
        setUserRating(0);
        setComment("");
      }
    } else {
      setUserRating(0);
      setComment("");
    }
  }, [guestId, userRatings]);

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

  if (loading) return <Loading fullScreen message="Loading listing details..." />;
  if (!selectedListing) return <Loading fullScreen message="Listing not found." />;

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

      <button 
        className="shareListing-view"
        onClick={async () => {
          const shareUrl = `https://staysmartlisting.netlify.app/guest/${guestId}/view-listing/${listingId}`;
          const shareTitle = selectedListing?.title || 'Check out this listing';
          const shareText = `${selectedListing?.description?.slice(0, 100)}...` || 'Found this great place on StaySmart!';
          
          try {
            if (navigator.share) {
              await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
              });
            } else {
              // Fallback for browsers that don't support Web Share API
              await navigator.clipboard.writeText(shareUrl);
              alert('Link copied to clipboard! You can now share it anywhere.');
            }
          } catch (error) {
            console.error('Error sharing:', error);
            // Fallback to copy to clipboard
            try {
              await navigator.clipboard.writeText(shareUrl);
              alert('Link copied to clipboard! You can now share it anywhere.');
            } catch (err) {
              console.error('Error copying to clipboard:', err);
              alert('Could not share at this time. Please try again.');
            }
          }
        }}
      >
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

  // Star Rating Display Component
  const StarRatingDisplay = ({ rating = 0 }) => {
    // Ensure rating is always a number
    const numRating = typeof rating === 'number' ? rating : (parseFloat(rating) || 0);
    const clampedRating = Math.max(0, Math.min(5, numRating)); // Clamp between 0-5
    
    const fullStars = Math.floor(clampedRating);
    const hasHalfStar = clampedRating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    const gradientId = `half-star-${clampedRating}-${Math.random().toString(36).substr(2, 9)}`;

    return (
      <div className="star-rating-display">
        {[...Array(fullStars)].map((_, i) => (
          <svg
            key={`full-${i}`}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#FFD700"
            stroke="#FFD700"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
        {hasHalfStar && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill={`url(#${gradientId})`}
            stroke="#FFD700"
            strokeWidth="2"
          >
            <defs>
              <linearGradient id={gradientId}>
                <stop offset="50%" stopColor="#FFD700" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <svg
            key={`empty-${i}`}
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ddd"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
        <span className="rating-value">{clampedRating > 0 ? clampedRating.toFixed(1) : "No rating"}</span>
      </div>
    );
  };

  // Interactive Star Rating Input Component
  const StarRatingInput = () => {
    return (
      <div className="star-rating-input">
        <div className="stars-container">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="star-button"
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              onClick={() => setUserRating(star)}
              aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill={star <= (hoveredRating || userRating) ? "#FFD700" : "none"}
                stroke={star <= (hoveredRating || userRating) ? "#FFD700" : "#ddd"}
                strokeWidth="2"
                className="star-icon"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          ))}
        </div>
        {userRating > 0 && (
          <div className="rating-feedback">
            <span className="rating-text">You selected {userRating} star{userRating !== 1 ? 's' : ''}</span>
            <span className="rating-emoji">
              {userRating === 5 ? '😍' : userRating === 4 ? '😊' : userRating === 3 ? '🙂' : userRating === 2 ? '😐' : '😞'}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Submit rating function
  const handleSubmitRating = async () => {
    if (!guestId) {
      alert("Please log in to submit a rating");
      return;
    }

    if (userRating === 0) {
      alert("Please select a rating");
      return;
    }

    setRatingLoading(true);
    try {
      const listingRef = doc(db, "Listings", listingId);
      
      // Check if user has already rated this listing
      const existingRatingIndex = userRatings.findIndex(r => r.userId === guestId);
      
      const newRatingData = {
        userId: guestId,
        rating: userRating,
        comment: comment.trim() || "",
        timestamp: Timestamp.now(), // Use Timestamp.now() instead of serverTimestamp() for arrays
        userName: auth.currentUser?.displayName || auth.currentUser?.email || "Anonymous"
      };

      let updatedRatings;
      if (existingRatingIndex >= 0) {
        // Update existing rating
        updatedRatings = [...userRatings];
        updatedRatings[existingRatingIndex] = newRatingData;
      } else {
        // Add new rating
        updatedRatings = [...userRatings, newRatingData];
      }

      // Calculate average rating (ensure all ratings are numbers)
      const averageRating = updatedRatings.length > 0 
        ? Number((updatedRatings.reduce((sum, r) => sum + Number(r.rating || 0), 0) / updatedRatings.length).toFixed(1))
        : Number(selectedListing.rating || 0); // Preserve existing rating if no ratings

      // Update Firebase - rating must be a number
      await updateDoc(listingRef, {
        ratings: updatedRatings,
        rating: Number(averageRating) // Explicitly ensure it's a number
      });

      // Update local state
      setUserRatings(updatedRatings);
      setSelectedListing(prev => ({ ...prev, rating: Number(averageRating) }));
      setUserRating(0);
      setComment("");
      setHoveredRating(0);
      setShowRatingForm(false);

      alert("✅ Review submitted successfully!");
    } catch (error) {
      console.error("Error submitting rating:", error);
      alert("❌ Failed to submit rating. Please try again.");
    } finally {
      setRatingLoading(false);
    }
  };

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
      <button 
        className="shareListing-view-mobile"
        onClick={async () => {
          const shareUrl = `${window.location.origin}/guest/${guestId}/view-listing/${listingId}`;
          const shareTitle = selectedListing?.title || 'Check out this listing';
          const shareText = `${selectedListing?.description?.slice(0, 100)}...` || 'Found this great place on StaySmart!';
          
          try {
            if (navigator.share) {
              await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl
              });
            } else {
              // Fallback for browsers that don't support Web Share API
              await navigator.clipboard.writeText(shareUrl);
              alert('Link copied to clipboard! You can now share it anywhere.');
            }
          } catch (error) {
            console.error('Error sharing:', error);
            // Fallback to copy to clipboard
            try {
              await navigator.clipboard.writeText(shareUrl);
              alert('Link copied to clipboard! You can now share it anywhere.');
            } catch (err) {
              console.error('Error copying to clipboard:', err);
              alert('Could not share at this time. Please try again.');
            }
          }
        }}
      >
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
    <Loading message="Loading host info..." size="small" />
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
            <div className="infoBlockText">
              <img src={rating} alt="" width={"35px"} />
              <strong>Rating:</strong>
              <StarRatingDisplay rating={selectedListing.rating || 0} />
            </div>
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
          <span className="guest-desc">{guest.desc}</span>
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
        <div className="rating-section-header">
          <h3>Reviews & Ratings</h3>
          <div className="overall-rating-summary">
            <div className="overall-rating-value">
              {selectedListing.rating ? Number(selectedListing.rating).toFixed(1) : "0.0"}
            </div>
            <StarRatingDisplay rating={Number(selectedListing.rating) || 0} />
            <span className="total-reviews">({userRatings.length} {userRatings.length === 1 ? 'review' : 'reviews'})</span>
          </div>
        </div>

        {/* Rating Distribution List */}
        {userRatings.length > 0 && (
          <div className="rating-distribution">
            <h4>Rating Breakdown</h4>
            <div className="rating-distribution-list">
              {[5, 4, 3, 2, 1].map((starValue) => {
                const count = userRatings.filter(r => Number(r.rating) === starValue).length;
                const percentage = userRatings.length > 0 ? (count / userRatings.length) * 100 : 0;
                
                return (
                  <div key={starValue} className="rating-distribution-item">
                    <div className="rating-star-label">
                      <span className="star-number">{starValue}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="#FFD700" stroke="#FFD700" strokeWidth="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </div>
                    <div className="rating-bar-container">
                      <div 
                        className="rating-bar-fill" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="rating-count">
                      <span>{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Rating Input Form - Always show if logged in */}
        {guestId && (
          <div className="rating-form-container">
            {!showRatingForm ? (
              <button 
                className="show-rating-form-btn"
                onClick={() => setShowRatingForm(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {userRatings.find(r => r.userId === guestId) ? "Update Your Review" : "Write a Review"}
              </button>
            ) : (
              <div className="rating-form">
                <div className="rating-form-header">
                  <h4>{userRatings.find(r => r.userId === guestId) ? "Update Your Review" : "Write a Review"}</h4>
                  <button 
                    className="close-form-btn"
                    onClick={() => {
                      setShowRatingForm(false);
                      if (!userRatings.find(r => r.userId === guestId)) {
                        setUserRating(0);
                        setComment("");
                      }
                    }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
                
                <div className="rating-input-section">
                  <label className="rating-label">Your Rating *</label>
                  <StarRatingInput />
                </div>

                <div className="comment-input-section">
                  <label className="comment-label">Your Review</label>
                  <textarea
                    className="rating-comment-input"
                    placeholder="Share your experience with this listing. What did you like? What could be improved?"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows="5"
                    maxLength={500}
                  />
                  <div className="char-count">{comment.length}/500</div>
                </div>

                <button
                  className="submit-rating-btn"
                  onClick={handleSubmitRating}
                  disabled={ratingLoading || userRating === 0}
                >
                  {ratingLoading ? (
                    <>
                      <span className="spinner"></span>
                      Submitting...
                    </>
                  ) : (
                    userRatings.find(r => r.userId === guestId) ? "Update Review" : "Submit Review"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {!guestId && (
          <div className="login-prompt-card">
            <p>Please log in to write a review</p>
            <button className="login-btn" onClick={() => navigate("/login")}>
              Log In
            </button>
          </div>
        )}

        {/* Existing Ratings Display */}
        <div className="reviews-section">
          {userRatings.length > 0 ? (
            <>
              <h4 className="reviews-title">All Reviews</h4>
              <div className="reviews-list">
                {userRatings.map((ratingData, index) => {
                  const isCurrentUser = ratingData.userId === guestId;
                  return (
                    <div key={index} className={`review-item ${isCurrentUser ? 'your-review' : ''}`}>
                      <div className="review-header">
                        <div className="reviewer-info">
                          <div className="reviewer-avatar">
                            {(ratingData.userName || "A")[0].toUpperCase()}
                          </div>
                          <div className="reviewer-details">
                            <strong className="reviewer-name">
                              {ratingData.userName || "Anonymous"}
                              {isCurrentUser && <span className="your-badge">You</span>}
                            </strong>
                            <div className="review-rating">
                              <StarRatingDisplay rating={Number(ratingData.rating) || 0} />
                            </div>
                          </div>
                        </div>
                        {ratingData.timestamp && (
                          <span className="review-date">
                            {new Date(ratingData.timestamp?.seconds * 1000 || Date.now()).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                      {ratingData.comment ? (
                        <p className="review-comment">{ratingData.comment}</p>
                      ) : (
                        <p className="review-comment empty">No comment provided</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="no-reviews">
              <p>No reviews yet. Be the first to review this listing!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectListingItem;
