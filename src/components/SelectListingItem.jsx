import React, { useState, useEffect, useMemo } from "react";
import { db, auth } from "../config/firebase";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { createOrGetConversation } from "../pages/for-all/messages/createOrGetConversation";

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
import Loading from "./Loading";
import "../pages/guest/guest-viewListing.css";

const SelectListingItem = () => {
  const { listingId, guestId } = useParams();
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
  const [favourites, setFavourites] = useState([]);
  const [favLoading, setFavLoading] = useState(false);
  const currentUserId = auth.currentUser?.uid;
  const [userRating, setUserRating] = useState(0); // User's current rating input (0-5)
  const [hoveredRating, setHoveredRating] = useState(0); // For hover effect
  const [comment, setComment] = useState(""); // User's comment
  const [ratingLoading, setRatingLoading] = useState(false); // Loading state for rating submission
  const [userRatings, setUserRatings] = useState([]); // All ratings for this listing
  const [showRatingForm, setShowRatingForm] = useState(false); // Toggle rating form
  
  // Promo code states
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromoCode, setAppliedPromoCode] = useState(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoError, setPromoError] = useState("");

  // Image lightbox states
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageIndex, setImageIndex] = useState(0);

  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Reservations state for unavailable dates
  const [reservations, setReservations] = useState([]);
  const [reservationsLoading, setReservationsLoading] = useState(true);

  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const twoDaysLater = new Date();
  twoDaysLater.setDate(today.getDate() + 2);

  // Format dates as YYYY-MM-DD for <input type="date">
  const formatDate = (date) => date.toISOString().split("T")[0];
  
  // Dates start as null - user must select them
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");

  // Calculate unavailable dates from reservations
  const unavailableDates = useMemo(() => {
    const unavailable = new Set();
    const unavailableRanges = [];
    
    reservations.forEach((reservation) => {
      const status = (reservation.status || '').toLowerCase();
      // Only consider pending or confirmed reservations
      if (status !== 'pending' && status !== 'confirmed') return;
      
      if (!reservation.checkIn || !reservation.checkOut) return;
      
      const startDate = new Date(reservation.checkIn);
      const endDate = new Date(reservation.checkOut);
      
      // Normalize to midnight
      const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      
      // Add all dates in the range (check-in inclusive, check-out exclusive)
      const dayMs = 86400000;
      for (let t = start.getTime(); t < end.getTime(); t += dayMs) {
        const d = new Date(t);
        const dateKey = formatDate(d);
        unavailable.add(dateKey);
      }
      
      unavailableRanges.push({
        checkIn: start,
        checkOut: end,
        status: reservation.status
      });
    });
    
    return { dates: unavailable, ranges: unavailableRanges };
  }, [reservations]);

  // Check if selected dates conflict with unavailable dates
  const checkDateConflict = (checkInDate, checkOutDate) => {
    if (!checkInDate || !checkOutDate) return false;
    
    const start = new Date(checkInDate);
    const end = new Date(checkOutDate);
    const startNormalized = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const endNormalized = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    
    // Check if any date in the range is unavailable
    const dayMs = 86400000;
    for (let t = startNormalized.getTime(); t < endNormalized.getTime(); t += dayMs) {
      const d = new Date(t);
      const dateKey = formatDate(d);
      if (unavailableDates.dates.has(dateKey)) {
        return true;
      }
    }
    
    // Also check for overlaps with existing reservations
    return unavailableDates.ranges.some(range => {
      return startNormalized.getTime() < range.checkOut.getTime() && 
             endNormalized.getTime() > range.checkIn.getTime();
    });
  };

  const handleCheckInChange = (e) => {
    const newCheckIn = e.target.value;
    setCheckIn(newCheckIn);

    // Automatically adjust check-out if it's less than 2 days apart
    if (newCheckIn) {
      const checkInDate = new Date(newCheckIn);
      const minCheckoutDate = new Date(checkInDate);
      minCheckoutDate.setDate(checkInDate.getDate() + 2);

      if (!checkOut || new Date(checkOut) < minCheckoutDate) {
        setCheckOut(formatDate(minCheckoutDate));
      }
      
      // Check for conflicts
      if (checkOut && checkDateConflict(newCheckIn, checkOut)) {
        alert('Warning: The selected dates conflict with existing reservations. Please choose different dates.');
      }
    }
  };

  const handleCheckOutChange = (e) => {
    const newCheckOut = e.target.value;
    setCheckOut(newCheckOut);
    
    // Check for conflicts
    if (checkIn && checkDateConflict(checkIn, newCheckOut)) {
      alert('Warning: The selected dates conflict with existing reservations. Please choose different dates.');
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

          const ratingValue = typeof data.rating === 'number' ? data.rating : 
                            (data.rating ? parseFloat(data.rating) || 0 : 0);
          
          setSelectedListing({ 
            id: docSnap.id, 
            ...data, 
            serviceType,
            rating: ratingValue
          });
          
          // Fetch ratings if they exist
          if (data.ratings && Array.isArray(data.ratings)) {
            setUserRatings(data.ratings);
            
            // Pre-populate user's existing rating if they have one
            if (currentUserId) {
              const userRatingData = data.ratings.find(r => r.userId === currentUserId);
              if (userRatingData) {
                setUserRating(Number(userRatingData.rating) || 0);
                setComment(userRatingData.comment || "");
              }
            }
          } else {
            setUserRatings([]);
          }
          
          // Fetch host info using hostId
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

  // Fetch reservations for this listing to show unavailable dates
  useEffect(() => {
    const fetchReservations = async () => {
      if (!listingId) return;
      
      try {
        setReservationsLoading(true);
        const reservationsQuery = query(
          collection(db, 'Reservation'),
          where('listingId', '==', listingId)
        );
        
        const reservationsSnapshot = await getDocs(reservationsQuery);
        const reservationsList = reservationsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setReservations(reservationsList);
      } catch (error) {
        console.error('Error fetching reservations:', error);
      } finally {
        setReservationsLoading(false);
      }
    };

    fetchReservations();
  }, [listingId]);

  useEffect(() => {
    const fetchFavourites = async () => {
      if (!currentUserId) return;
      try {
        const userRef = doc(db, "Users", currentUserId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setFavourites(userSnap.data().favourites || []);
        }
      } catch (error) {
        console.error("Error loading favourites:", error);
      }
    };

    fetchFavourites();
  }, [currentUserId]);

  // Update form when user logs in/out or when ratings change
  useEffect(() => {
    if (currentUserId && userRatings.length > 0) {
      const userRatingData = userRatings.find(r => r.userId === currentUserId);
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
  }, [currentUserId, userRatings]);

  const toggleFavourite = async (listingId, e) => {
    e.stopPropagation();

    if (!currentUserId) {
      alert("Please log in to add favourites");
      return;
    }

    setFavLoading(true);

    try {
      const userRef = doc(db, "Users", currentUserId);
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

  const handleMessageHost = async (hostId, guestId) => {
    if (!guestId) {
      alert("Please log in to message the host");
      return;
    }
    const conversationId = await createOrGetConversation(hostId, guestId);
    navigate(`/guest/${guestId}/chat/${conversationId}`);
  };

  // Promo code functions
  const handleApplyPromoCode = () => {
    setPromoError("");
    
    if (!promoCode.trim()) {
      setPromoError("Please enter a promo code");
      return;
    }

    const enteredCode = promoCode.trim().toUpperCase();
    const listingPromoCode = selectedListing?.promoCode?.toUpperCase();

    if (!listingPromoCode) {
      setPromoError("This listing doesn't have a promo code");
      return;
    }

    if (enteredCode !== listingPromoCode) {
      setPromoError("Invalid promo code. Please try again.");
      return;
    }

    // Check if promo code is within valid date range
    const now = new Date();
    if (selectedListing.discountStartDate) {
      const startDate = selectedListing.discountStartDate?.toDate 
        ? selectedListing.discountStartDate.toDate() 
        : new Date(selectedListing.discountStartDate);
      if (now < startDate) {
        setPromoError("This promo code is not yet valid");
        return;
      }
    }

    if (selectedListing.discountEndDate) {
      const endDate = selectedListing.discountEndDate?.toDate 
        ? selectedListing.discountEndDate.toDate() 
        : new Date(selectedListing.discountEndDate);
      if (now > endDate) {
        setPromoError("This promo code has expired");
        return;
      }
    }

    // Apply promo code
    setAppliedPromoCode(enteredCode);
    setShowPromoModal(false);
    setPromoCode("");
    setPromoError("");
  };

  const handleRemovePromoCode = () => {
    setAppliedPromoCode(null);
    setPromoCode("");
    setPromoError("");
  };

  // Calculate discounted price
  const calculatePrice = () => {
    if (!selectedListing) return 0;
    const basePrice = Number(selectedListing.price) || 0;
    
    if (appliedPromoCode && selectedListing.discount) {
      const discount = Number(selectedListing.discount) || 0;
      return basePrice * (1 - discount / 100);
    }
    
    return basePrice;
  };

  const finalPrice = calculatePrice();
  const discountAmount = appliedPromoCode && selectedListing.discount 
    ? Number(selectedListing.price) - finalPrice 
    : 0;

  if (loading) return <Loading fullScreen message="Loading listing details..." />;
  if (!selectedListing) return <Loading fullScreen message="Listing not found." />;

  const { serviceType } = selectedListing;

  const totalGuests = guestCounts.adults + guestCounts.children;
  const maxGuests = selectedListing.maxGuests || 1;

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

  const InfoBlock = ({ label, value, src }) => (
    <p className="infoBlockText">
      {src && <img src={src} alt="" width={"35px"} />}
      <strong>{label}:</strong> {value || "N/A"}
    </p>
  );

  const StarRatingDisplay = ({ rating = 0 }) => {
    const numRating = typeof rating === 'number' ? rating : (parseFloat(rating) || 0);
    const clampedRating = Math.max(0, Math.min(5, numRating));
    
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
    if (!currentUserId) {
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
      const existingRatingIndex = userRatings.findIndex(r => r.userId === currentUserId);
      
      const newRatingData = {
        userId: currentUserId,
        rating: userRating,
        comment: comment.trim() || "",
        timestamp: Timestamp.now(),
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
        : Number(selectedListing.rating || 0);

      // Update Firebase - rating must be a number
      await updateDoc(listingRef, {
        ratings: updatedRatings,
        rating: Number(averageRating)
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

  const ImageGroup = ({ photos = [] }) => {
    const mainPhoto = photos[0] || nothing;
    const subPhotos = photos.slice(1, 5);
    const allPhotos = useMemo(() => 
      photos.filter(photo => photo && photo !== nothing), 
      [photos]
    );

    const handleImageClick = (photo, index) => {
      if (photo && photo !== nothing) {
        // Find the actual index in allPhotos array
        const actualIndex = allPhotos.findIndex(p => p === photo);
        setSelectedImage(photo);
        setImageIndex(actualIndex >= 0 ? actualIndex : 0);
      }
    };

    const closeLightbox = () => {
      setSelectedImage(null);
    };

    const nextImage = (e) => {
      e.stopPropagation();
      if (allPhotos.length > 0) {
        const nextIndex = (imageIndex + 1) % allPhotos.length;
        setImageIndex(nextIndex);
        setSelectedImage(allPhotos[nextIndex]);
      }
    };

    const prevImage = (e) => {
      e.stopPropagation();
      if (allPhotos.length > 0) {
        const prevIndex = (imageIndex - 1 + allPhotos.length) % allPhotos.length;
        setImageIndex(prevIndex);
        setSelectedImage(allPhotos[prevIndex]);
      }
    };

    useEffect(() => {
      if (!selectedImage) return;

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          closeLightbox();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (allPhotos.length > 0) {
            const nextIdx = (imageIndex + 1) % allPhotos.length;
            setImageIndex(nextIdx);
            setSelectedImage(allPhotos[nextIdx]);
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (allPhotos.length > 0) {
            const prevIdx = (imageIndex - 1 + allPhotos.length) % allPhotos.length;
            setImageIndex(prevIdx);
            setSelectedImage(allPhotos[prevIdx]);
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }, [selectedImage, imageIndex, allPhotos]);

    return (
      <>
        <div className="image-group-container">
          <div className="main-image" onClick={() => handleImageClick(mainPhoto, 0)}>
            <img
              src={mainPhoto}
              alt="Main Listing"
              width="100%"
              onError={(e) => (e.target.src = nothing)}
              style={{ cursor: mainPhoto !== nothing ? 'zoom-in' : 'default' }}
            />
          </div>

          <div className="sub-images-grid">
            {subPhotos.map((photo, index) => (
              <img
                key={index}
                src={photo || nothing}
                alt={`Listing ${index + 1}`}
                onError={(e) => (e.target.src = nothing)}
                onClick={() => handleImageClick(photo, index + 1)}
                style={{ cursor: photo && photo !== nothing ? 'zoom-in' : 'default' }}
              />
            ))}
            {Array.from({ length: 4 - subPhotos.length }).map((_, i) => (
              <img key={`empty-${i}`} src={nothing} alt="Empty slot" />
            ))}
          </div>
        </div>

        {selectedImage && (
          <div className="image-lightbox-overlay" onClick={closeLightbox}>
            <button className="lightbox-close" onClick={closeLightbox} aria-label="Close">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            {allPhotos.length > 1 && (
              <>
                <button className="lightbox-nav lightbox-prev" onClick={prevImage} aria-label="Previous image">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                </button>
                <button className="lightbox-nav lightbox-next" onClick={nextImage} aria-label="Next image">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                  </svg>
                </button>
              </>
            )}
            <div className="lightbox-image-container" onClick={(e) => e.stopPropagation()}>
              <img
                src={selectedImage}
                alt="Zoomed listing"
                className="lightbox-image"
                onError={(e) => (e.target.src = nothing)}
              />
              {allPhotos.length > 1 && (
                <div className="lightbox-counter">
                  {imageIndex + 1} / {allPhotos.length}
                </div>
              )}
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="view-listing">
      <div className="floating-buttons">
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
            const shareUrl = `${window.location.origin}/listing/${listingId}`;
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

      <div className="listing-header">
        
        <div className="rightBookingGroup">
          <button 
            className="shareListing-view"
            onClick={async () => {
              const shareUrl = `${window.location.origin}/listing/${listingId}`;
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
      </div>

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
              <div>
                <p className="hostProfile-text"><strong>Host:</strong> {hostOfListing.firstName || "Unnamed Host"}</p>
                <p className="hostProfile-text"><strong>Phone:</strong> {hostOfListing.phoneNumber || "N/A"}</p>
                <p className="hostProfile-text"><strong>Email:</strong> {hostOfListing.emailAddress || "N/A"}</p>
              </div>
            </div>
            <button
              className="messageHost"
              onClick={() => handleMessageHost(hostOfListing.id, guestId)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
                <path d="M12 17h.01"/>
              </svg>
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
              <InfoBlock src={category} label="Category" value={selectedListing.serviceCategory} />
              <InfoBlock src={clock2} label="Duration" value={`${selectedListing.serviceDuration} an Hour`} />
              <InfoBlock src={clock} label="Availability Hours" value={selectedListing.availabilityHours} />
              <InfoBlock src={meeting} label="Service Area" value={selectedListing.serviceArea} />
              <hr />
            </>
          )}
        </div>
          
        {/* Reservation Box */}
        <div className="reservationBox">
          {/* Promo div removed - discount percentage no longer displayed */}

          {/* Promo Code Section */}
          <div className="promo-section">
            {appliedPromoCode ? (
              <div style={{ 
                padding: "12px", 
                background: "#f0fdf4", 
                border: "2px solid #10b981", 
                borderRadius: "10px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, color: "#10b981" }}>
                    ✓ Promo Code Applied: {appliedPromoCode}
                  </p>
                  {selectedListing.discount && (
                    <p style={{ margin: "4px 0 0 0", fontSize: "0.9rem", color: "#666" }}>
                      Discount applied
                    </p>
                  )}
                </div>
                <button
                  onClick={handleRemovePromoCode}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    padding: "4px 8px",
                    fontSize: "0.9rem",
                    fontWeight: 600
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                className="promo-btn"
                onClick={() => setShowPromoModal(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M10.5 3 8 9l4 13 4-13-2.5-6" />
                  <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3z" />
                  <path d="M2 9h20" />
                </svg>
                Add Promo Code
              </button>
            )}
          </div>

          <div className="price-header">
            <h2>
              <span className="price">{selectedListing.price} ₱</span>
              {appliedPromoCode && discountAmount > 0 && (
                <p className="savings-text">You save ₱{discountAmount.toFixed(2)} with promo code!</p>
              )}
            </h2>
          </div>

          <div className="check-section">
            <div className="date-input">
              <label>Check-in</label>
              <input
                type="date"
                value={checkIn}
                min={formatDate(tomorrow)}
                onChange={handleCheckInChange}
              />
            </div>
            <div className="date-input">
              <label>Check-out</label>
              <input
                type="date"
                value={checkOut}
                min={checkIn ? formatDate(new Date(new Date(checkIn).setDate(new Date(checkIn).getDate() + 2))) : formatDate(twoDaysLater)}
                onChange={handleCheckOutChange}
              />
            </div>
          </div>

          {/* Calendar Toggle Button */}
          <div style={{ marginTop: '16px', marginBottom: showCalendar ? '0' : '0' }}>
            <button
              type="button"
              onClick={() => setShowCalendar(!showCalendar)}
              style={{
                width: '100%',
                padding: '12px 16px',
                background: showCalendar 
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                  : 'white',
                color: showCalendar ? 'white' : '#374151',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                position: 'relative',
                zIndex: 2
              }}
              onMouseEnter={(e) => {
                if (!showCalendar) {
                  e.target.style.borderColor = '#667eea'
                  e.target.style.background = '#f9fafb'
                }
              }}
              onMouseLeave={(e) => {
                if (!showCalendar) {
                  e.target.style.borderColor = '#e5e7eb'
                  e.target.style.background = 'white'
                }
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              {showCalendar ? 'Hide Calendar' : 'Show Availability Calendar'}
            </button>
          </div>

          {/* Calendar Component */}
          {showCalendar && (
            <div style={{
              marginTop: '20px',
              marginBottom: '20px',
              padding: '20px',
              background: 'white',
              borderRadius: '16px',
              border: '2px solid #e5e7eb',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
              position: 'relative',
              zIndex: 1
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '20px'
              }}>
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 0) {
                      setCalendarMonth(11);
                      setCalendarYear(calendarYear - 1);
                    } else {
                      setCalendarMonth(calendarMonth - 1);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: '#374151',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#e5e7eb'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f3f4f6'
                  }}
                >
                  ❮
                </button>
                <h3 style={{
                  margin: 0,
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: '#111827'
                }}>
                  {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (calendarMonth === 11) {
                      setCalendarMonth(0);
                      setCalendarYear(calendarYear + 1);
                    } else {
                      setCalendarMonth(calendarMonth + 1);
                    }
                  }}
                  style={{
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    color: '#374151',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = '#e5e7eb'
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = '#f3f4f6'
                  }}
                >
                  ❯
                </button>
              </div>

              {/* Calendar Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px',
                marginBottom: '12px'
              }}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} style={{
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: '#6b7280',
                    padding: '8px 0'
                  }}>
                    {day}
                  </div>
                ))}
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '8px'
              }}>
                {(() => {
                  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                  const days = [];
                  
                  // Empty cells for days before month starts
                  for (let i = 0; i < firstDay; i++) {
                    days.push(
                      <div key={`empty-${i}`} style={{ aspectRatio: '1', minHeight: '40px' }}></div>
                    );
                  }
                  
                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const dateStr = formatDate(new Date(calendarYear, calendarMonth, day));
                    const isUnavailable = unavailableDates.dates.has(dateStr);
                    const isPast = new Date(calendarYear, calendarMonth, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const isToday = day === today.getDate() && 
                                   calendarMonth === today.getMonth() && 
                                   calendarYear === today.getFullYear();
                    const isSelected = (checkIn && dateStr === checkIn) || (checkOut && dateStr === checkOut);
                    
                    // Find reservation for this date
                    const reservationForDate = unavailableDates.ranges.find(range => {
                      const rangeStart = formatDate(range.checkIn);
                      const rangeEnd = formatDate(new Date(range.checkOut.getTime() - 86400000)); // Check-out is exclusive
                      return dateStr >= rangeStart && dateStr <= rangeEnd;
                    });

                    days.push(
                      <div
                        key={day}
                        onClick={() => {
                          if (isPast || isUnavailable) return;
                          if (!checkIn || (checkIn && checkOut)) {
                            // Set check-in
                            setCheckIn(dateStr);
                            setCheckOut('');
                          } else if (checkIn && !checkOut) {
                            // Set check-out
                            const checkInDate = new Date(checkIn);
                            const selectedDate = new Date(calendarYear, calendarMonth, day);
                            if (selectedDate <= checkInDate) {
                              alert('Check-out date must be after check-in date');
                              return;
                            }
                            const minCheckout = new Date(checkInDate);
                            minCheckout.setDate(checkInDate.getDate() + 2);
                            if (selectedDate < minCheckout) {
                              alert('Minimum stay is 2 nights');
                              setCheckOut(formatDate(minCheckout));
                            } else {
                              setCheckOut(dateStr);
                            }
                          }
                        }}
                        style={{
                          aspectRatio: '1',
                          minHeight: '40px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '8px',
                          cursor: isPast || isUnavailable ? 'not-allowed' : 'pointer',
                          background: isUnavailable 
                            ? '#fee2e2' 
                            : isPast 
                            ? '#f3f4f6' 
                            : isSelected
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'white',
                          color: isUnavailable 
                            ? '#991b1b' 
                            : isPast 
                            ? '#9ca3af' 
                            : isSelected
                            ? 'white'
                            : '#111827',
                          border: isUnavailable 
                            ? '2px solid #f87171' 
                            : isPast 
                            ? '2px solid #d1d5db' 
                            : isSelected
                            ? '2px solid #667eea'
                            : '2px solid #e5e7eb',
                          fontWeight: isSelected ? 700 : isUnavailable ? 600 : 500,
                          fontSize: '0.9rem',
                          transition: 'all 0.2s ease',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          if (!isPast && !isUnavailable && !isSelected) {
                            e.target.style.background = '#f9fafb'
                            e.target.style.borderColor = '#667eea'
                            e.target.style.transform = 'scale(1.05)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isPast && !isUnavailable && !isSelected) {
                            e.target.style.background = 'white'
                            e.target.style.borderColor = '#e5e7eb'
                            e.target.style.transform = 'scale(1)'
                          }
                        }}
                      >
                        <span>{day}</span>
                        {isUnavailable && reservationForDate && (
                          <span style={{
                            fontSize: '0.65rem',
                            marginTop: '2px',
                            opacity: 0.8
                          }}>
                            {reservationForDate.status === 'confirmed' ? '✓' : '○'}
                          </span>
                        )}
                        {isToday && !isUnavailable && (
                          <span style={{
                            fontSize: '0.65rem',
                            marginTop: '2px',
                            color: '#667eea',
                            fontWeight: 700
                          }}>
                            Today
                          </span>
                        )}
                      </div>
                    );
                  }
                  
                  return days;
                })()}
              </div>

              {/* Legend */}
              <div style={{
                marginTop: '20px',
                padding: '12px',
                background: '#f9fafb',
                borderRadius: '8px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                fontSize: '0.875rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: 'white',
                    border: '2px solid #e5e7eb',
                    borderRadius: '4px'
                  }}></div>
                  <span>Available</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#fee2e2',
                    border: '2px solid #f87171',
                    borderRadius: '4px'
                  }}></div>
                  <span>Booked</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: '2px solid #667eea',
                    borderRadius: '4px'
                  }}></div>
                  <span>Selected</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    background: '#f3f4f6',
                    border: '2px solid #d1d5db',
                    borderRadius: '4px'
                  }}></div>
                  <span>Past</span>
                </div>
              </div>
            </div>
          )}

          {/* Unavailable Dates Display */}
          {unavailableDates.ranges.length > 0 && (
            <div style={{
              marginTop: showCalendar ? '20px' : '16px',
              padding: '12px 16px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              fontSize: '0.9rem',
              position: 'relative',
              zIndex: 1
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                marginBottom: '8px',
                fontWeight: 600,
                color: '#991b1b'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Unavailable Dates</span>
              </div>
              <div style={{ color: '#7f1d1d', lineHeight: '1.6' }}>
                {unavailableDates.ranges.map((range, idx) => {
                  const checkInStr = range.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const checkOutStr = range.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <div key={idx} style={{ marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500 }}>{checkInStr} - {checkOutStr}</span>
                      <span style={{ marginLeft: '8px', fontSize: '0.85rem', color: '#991b1b' }}>
                        ({range.status})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="guest-section" style={{
            marginTop: showCalendar ? '20px' : '0',
            position: 'relative',
            zIndex: 1
          }}>
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
            onClick={() => {
              if (!checkIn || !checkOut) {
                alert("Please select check-in and check-out dates");
                return;
              }
              // Include dates in URL so they persist after page refresh
              const bookingUrl = `/guest/${guestId}/listing/${listingId}/booking?checkIn=${checkIn}&checkOut=${checkOut}`;
              
              // Create listing object with applied promo code and discounted price
              const listingWithPromo = {
                ...selectedListing,
                appliedPromoCode: appliedPromoCode || null,
                finalPrice: appliedPromoCode ? finalPrice : selectedListing.price,
                originalPrice: selectedListing.price
              };
              
              navigate(bookingUrl, {
                state: {
                  listing: listingWithPromo,
                  checkIn,
                  checkOut,
                  guestCounts,
                },
              });
            }}
          >
            Reserve
          </button>

          <small className="no-charge">You won't be charged yet</small>
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
        {currentUserId && (
          <div className="rating-form-container">
            {!showRatingForm ? (
              <button 
                className="show-rating-form-btn"
                onClick={() => setShowRatingForm(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                {userRatings.find(r => r.userId === currentUserId) ? "Update Your Review" : "Write a Review"}
              </button>
            ) : (
              <div className="rating-form">
                <div className="rating-form-header">
                  <h4>{userRatings.find(r => r.userId === currentUserId) ? "Update Your Review" : "Write a Review"}</h4>
                  <button 
                    className="close-form-btn"
                    onClick={() => {
                      setShowRatingForm(false);
                      if (!userRatings.find(r => r.userId === currentUserId)) {
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
                    userRatings.find(r => r.userId === currentUserId) ? "Update Review" : "Submit Review"
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {!currentUserId && (
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
                  const isCurrentUser = ratingData.userId === currentUserId;
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

      {/* Promo Code Modal */}
      {showPromoModal && (
        <div className="promo-modal-overlay" onClick={() => {
          setShowPromoModal(false);
          setPromoCode("");
          setPromoError("");
        }}>
          <div className="promo-modal-content" onClick={(e) => e.stopPropagation()}>
            <button
              className="promo-modal-close"
              onClick={() => {
                setShowPromoModal(false);
                setPromoCode("");
                setPromoError("");
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h3>Enter Promo Code</h3>
            <p className="promo-modal-description">
              Have a promo code? Enter it below to get a discount on your booking.
            </p>
            <div className="promo-input-group">
              <input
                type="text"
                className="promo-input"
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value.toUpperCase());
                  setPromoError("");
                }}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleApplyPromoCode();
                  }
                }}
              />
              <button className="promo-apply-btn" onClick={handleApplyPromoCode}>
                Apply
              </button>
            </div>
            {promoError && <p className="promo-error">{promoError}</p>}
            {selectedListing.promoCode && (
              <div className="promo-suggestions">
                <p>Available promo code for this listing:</p>
                <div className="promo-codes-list">
                  <span onClick={() => {
                    setPromoCode(selectedListing.promoCode.toUpperCase());
                  }}>
                    {selectedListing.promoCode}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SelectListingItem;
                          