import React, { useState, useEffect } from "react";
import SlideshowWheel from "./sildeshowWheel";
import { useParams, useNavigate } from "react-router-dom";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import Loading from "./Loading";

const Home = ({ roomData, loading }) => {
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
    <div className="home-container">
      {loading ? (
        <Loading message="Loading listings..." />
      ) : roomData && roomData.length > 0 ? (
        <>
          <SlideshowWheel data={roomData} useCase={"Stay around your area:"} />
        <br />
          <hr />
          <br />
          <div className="allHomes">
            {roomData.map((room, index) => {
              const isFavourite = favourites.includes(room.id);
              const isLoading = loadingFav[room.id];

              return (
                <div
                  key={index}
                  className="roomCard"
                  onClick={() => navigate(`listing/${room.id}`)}
                >
                  <div className="roomImageWrapper">
                    <img
                      src={room.photos[0] || "/static/no photo.webp"}
                      alt={room.title || "Room"}
                      className="roomImage"
                    />
                    <button
                      className={`heartButton ${isFavourite ? "active" : ""}`}
                      onClick={(e) => toggleFavourite(room.id, e)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        "..."
                      ) : isFavourite ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="22"
                          height="22"
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
                  <div className="roomInfo">
                    <h3 className="roomTitle">{room.title || "Untitled Room"}</h3>
                    <p className="roomLocation">{room.location || "No location info"}</p>
                    <p className="roomPrice">
                      ₱{room.price || "0"} <span className="perNight"></span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="noListings">No room listings found.</p>
      )}
    </div>
  );
};

export default Home;
