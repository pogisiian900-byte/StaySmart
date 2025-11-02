import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import '../pages/guest/guest-main-slide.css';
import Loading from './Loading';
function SlideshowWheel({ data, useCase }) {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [favourites, setFavourites] = useState([]);
    const [loading, setLoading] = useState({});
    const { guestId } = useParams();

  // Load user's favourites on mount - FIXED: useEffect instead of useState
  useEffect(() => {
    if (guestId) {
      loadFavourites();
    }
  }, [guestId]);

  const loadFavourites = async () => {
    try {
      const userDoc = await getDoc(doc(db, "Users", guestId));
      if (userDoc.exists()) {
        setFavourites(userDoc.data().favourites || []);
      }
    } catch (error) {
      console.error("Error loading favourites:", error);
    }
  };

  const toggleFavourite = async (listingId, e) => {
    e.stopPropagation();
    
    if (!guestId) {
      alert("Please log in to add favourites");
      return;
    }

    setLoading(prev => ({ ...prev, [listingId]: true }));

    try {
      const userRef = doc(db, "Users", guestId);
      const isFavourite = favourites.includes(listingId);

      if (isFavourite) {
        await updateDoc(userRef, {
          favourites: arrayRemove(listingId)
        });
        setFavourites(prev => prev.filter(id => id !== listingId));
      } else {
        await updateDoc(userRef, {
          favourites: arrayUnion(listingId)
        });
        setFavourites(prev => [...prev, listingId]);
      }
    } catch (error) {
      console.error("Error updating favourites:", error);
      alert("Failed to update favourites. Please try again.");
    } finally {
      setLoading(prev => ({ ...prev, [listingId]: false }));
    }
  };

  if (!data || data.length === 0) {
    return <Loading message="Loading listings..." />;
  }

  const prevSlide = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? data.length - 1 : prev - 1
    );
  };

  const nextSlide = () => {
    setCurrentIndex((prev) =>
      prev === data.length - 1 ? 0 : prev + 1
    );
  };

  const itemWidth = 400;
  const itemMargin = 20;
  const wheelItemWidth = itemWidth + itemMargin;

  return (
    <div className="slide-wheel">
      <div className="topBar-wheel">
        <div className="item-title">
          <a href="#">{useCase}</a>
        </div>

        <div className="switchButton">
          <button onClick={prevSlide}>
            <svg xmlns="http://www.w3.org/2000/svg" height="25px" viewBox="0 -960 960 960" width="25px" fill="black">
              <path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z" />
            </svg>
          </button>

          <button onClick={nextSlide}>
            <svg xmlns="http://www.w3.org/2000/svg" height="25px" viewBox="0 -960 960 960" width="25px" fill="black">
              <path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="items-container">
        <div
          className="items-group"
          style={{
            display: "flex",
            transform: `translateX(-${currentIndex * wheelItemWidth}px)`,
            transition: "0.4s ease-in-out",
          }}
        >
          {data.map((item, index) => {
            const isFavourite = favourites.includes(item.id);
            const isLoading = loading[item.id];

            return (
              <div 
                className="wheel-item" 
                key={index}
                onClick={() => navigate(`listing/${item.id}`)}
              >
                <img
                  src={item.photos && item.photos.length > 0 ? item.photos[0] : "/static/no photo.webp"}
                  alt={item.title || "Listing"}
                  width="300px"
                  height="200px"
                  style={{ objectFit: "cover", borderRadius: "10px" }}
                />
                <h2 id="wheel-item-title">{item.title}</h2>
                <p id="wheel-item-location">{item.location}</p>
                <p id="wheel-item-price">₱{item.price}</p>
                <p id="wheel-item-rating">
                  {item.rating || 0}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    height="18px"
                    viewBox="0 -960 960 960"
                    width="18px"
                    fill="#FFD700"
                    style={{ marginLeft: "5px" }}
                  >
                    <path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z" />
                  </svg>
                </p>
                <button 
                        onClick={(e) => toggleFavourite(item.id, e)}
                        disabled={isLoading}
                        style={{
                          backgroundColor: isFavourite ? "#ff385c" : "#fff",
                          color: isFavourite ? "#fff" : "#000",
                          border: `1px solid ${isFavourite ? "#ff385c" : "#ddd"}`,
                          cursor: isLoading ? "not-allowed" : "pointer",
                          opacity: isLoading ? 0.6 : 1
                        }}
                      >
                        {isLoading ? "..." : isFavourite ? (
                          // Filled heart (favourited)
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
                        ) : (
                          // Unfilled heart (not favourited)
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
                        )}
                      </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default SlideshowWheel;