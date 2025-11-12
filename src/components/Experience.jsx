import React, { useState, useEffect } from "react";
import '../pages/guest/guest.css'
import '../pages/guest/guest-main-slide.css'
import SlideshowWheel from './sildeshowWheel'
import Loading from './Loading'
import { useParams, useNavigate } from "react-router-dom";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";

const Experience = ({experienceData,loading}) => {
  const { guestId } = useParams();
  const navigate = useNavigate();
  const [favourites, setFavourites] = useState([]);
  const [loadingFav, setLoadingFav] = useState({});

  // 🧭 Load user's favourites on mount
  useEffect(() => {
    if (guestId) loadFavourites();
  }, [guestId]);

  const loadFavourites = async () => {
    try {
      const userDoc = await getDoc(doc(db, "Users", guestId));
      if (userDoc.exists()) {
        setFavourites(userDoc.data().favourites || []);
      }
    } catch (err) {
      console.error("Error loading favourites:", err);
    }
  };

  const toggleFavourite = async (listingId, e) => {
    e.stopPropagation();
    if (!guestId) {
      alert("Please log in to add favourites");
      return;
    }

    setLoadingFav((prev) => ({ ...prev, [listingId]: true }));

    try {
      const userRef = doc(db, "Users", guestId);
      const isFav = favourites.includes(listingId);

      if (isFav) {
        await updateDoc(userRef, { favourites: arrayRemove(listingId) });
        setFavourites((prev) => prev.filter((id) => id !== listingId));
      } else {
        await updateDoc(userRef, { favourites: arrayUnion(listingId) });
        setFavourites((prev) => [...prev, listingId]);
      }
    } catch (err) {
      console.error("Error updating favourites:", err);
      alert("Failed to update favourites.");
    } finally {
      setLoadingFav((prev) => ({ ...prev, [listingId]: false }));
    }
  };

  return (
    <div className="modern-listing-container">
      {loading ? (
        <Loading message="Loading listings..." />
      ) : experienceData && experienceData.length > 0 ? (
        <>
          <div className="modern-slideshow-wrapper">
            <SlideshowWheel data={experienceData} useCase={"Experience new things around your area:"} />
          </div>
          <div className="modern-listings-section">
            <div className="modern-listings-grid">
              {experienceData.map((experience, index) => {
                const isFavourite = favourites.includes(experience.id);
                const isLoading = loadingFav[experience.id];

                return (
                  <div
                    key={index}
                    className="modern-listing-card"
                    onClick={() => navigate(`listing/${experience.id}`)}
                  >
                    <div className="modern-listing-image-wrapper">
                      <img
                        src={experience.photos?.[0] || "/static/no photo.webp"}
                        alt={experience.title || "Experience"}
                        className="modern-listing-image"
                      />
                      <button
                        className={`modern-heart-button ${isFavourite ? "active" : ""}`}
                        onClick={(e) => toggleFavourite(experience.id, e)}
                        disabled={isLoading}
                        aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
                      >
                        {isLoading ? (
                          <span className="modern-loading-spinner">...</span>
                        ) : isFavourite ? (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                          </svg>
                        ) : (
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                    <div className="modern-listing-info">
                      <h3 className="modern-listing-title">{experience.title || "Untitled Experience"}</h3>
                      <p className="modern-listing-location">{experience.location || "No location info"}</p>
                      <p className="modern-listing-price">
                        ₱{experience.price || "0"} <span className="modern-price-label">per experience</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <div className="modern-empty-state">
          <p className="modern-empty-text">No Experience listings found.</p>
        </div>
      )}
    </div>
  )
}

export default Experience