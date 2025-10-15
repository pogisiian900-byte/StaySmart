import { useState } from "react";
//TODO: BE MORE DYNAMIC
function slideshowWheel({jsonData}){ // Slider for all nato for service, room, experience
    console.log(jsonData);
    const [currentImgIndex, setCurrentImgIndex] = useState(0);
   if (!jsonData || !jsonData.rooms || !jsonData.services || !jsonData.experiences) {
    return <p>Loading...</p>; // fallback UI
  }
    function prevSlide() {
  setCurrentImgIndex((prev) =>
    prev === 0 ? jsonData.rooms.length - 1 : prev - 1
    
  );
}

function nextSlide() {
  setCurrentImgIndex((prev) =>
    prev === jsonData.rooms.length - 1 ? 0 : prev + 1
  );
}
    const item_width = 400;
    const item_margin = 20;
    const wheel_item_WIDTH = item_width + item_margin
    return(
        <div className="slide-wheel">

            <div className="topBar-wheel">
                <div className="item-title">
                    <a href="#"> 
                    Popular Homes in Paris
                    </a>
                </div>
                
                <div className="switchButton">
                    <button onClick={prevSlide}><svg xmlns="http://www.w3.org/2000/svg" height="25px" viewBox="0 -960 960 960" width="25px" fill="black"><path d="M400-80 0-480l400-400 71 71-329 329 329 329-71 71Z"/></svg>
                    </button>

                    <button onClick={nextSlide}><svg xmlns="http://www.w3.org/2000/svg" height="25px" viewBox="0 -960 960 960" width="25px" fill="black"><path d="m321-80-71-71 329-329-329-329 71-71 400 400L321-80Z"/></svg>
                    </button>
                </div>
            </div>

            <div className="items-container">
                <div className="items-group" 
            
                style={{
                    display:"flex",
                    transform: `translateX(-${currentImgIndex * wheel_item_WIDTH}px)`,
                    transition: "0.4s ease-in-out"
                }}>
                     {[...jsonData.rooms, ...jsonData.rooms].map((item, index) => (
                        <div className="wheel-item" key={index}>
                        <img src={item.roomThumbnail} alt={item.title} width="300px" />
                        <h2 id="wheel-item-title">{item.title}</h2>
                                <p id="wheel-item-price">{item.price} ₱</p>
                                <p id="wheel-item-nightNumber">for {item.nightNumber} nights</p>
                                <p id="wheel-item-rating">{item.rating}
                                    <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#ffffffff"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/></svg>
                                </p>
                        </div>
                    ))}
                    {[...jsonData.rooms, ...jsonData.rooms].map((item, index) => (
                        <div className="wheel-item" key={index}>
                        <img src={item.roomThumbnail} alt={item.title} width="300px" />
                        <h2 id="wheel-item-title">{item.title}</h2>
                                <p id="wheel-item-price">{item.price} ₱</p>
                                <p id="wheel-item-nightNumber">for {item.nightNumber} nights</p>
                                <p id="wheel-item-rating">{item.rating}
                                    <svg xmlns="http://www.w3.org/2000/svg" height="30px" viewBox="0 -960 960 960" width="30px" fill="#ffffffff"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z"/></svg>
                                </p>
                        </div>
                    ))}
                    </div>
            </div>
        </div>

    );

    
}

export default slideshowWheel;