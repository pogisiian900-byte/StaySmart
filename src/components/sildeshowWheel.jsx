import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

function SlideshowWheel({ data, useCase}) {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const {guestId} = useParams();
  if (!data || data.length === 0) {
    return <p>Loading listings...</p>;
  }

  // Move to previous listing
  const prevSlide = () => {
    setCurrentIndex((prev) =>
      prev === 0 ? data.length - 1 : prev - 1
    );
  };

  // Move to next listing
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
          {data.map((item, index) => (
            <div className="wheel-item" key={index}
                onClick={() => navigate(`listing/${item.id}`)} // ✅ correct path
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SlideshowWheel;
    