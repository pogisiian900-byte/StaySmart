import React from 'react'
import thumbnail from '/homesImg/room1.avif'
const Listings = () => {

  const handleViewBookings = ()=>{

  }

   const handleEdit = ()=>{
    
  }
   const handleDelete = ()=>{
    
  }
  return (
    <div>
        <div className="listingNav">
            <div className="listingIcon">
                <img src="" alt="" />
            <p>My Listings</p>
            </div>
            <button>All</button>
            <button>Room</button>
            <button>Service</button>
            <button>Experience</button>
         <button>+ Create new Listing</button>
        </div>
        <br />
        <div className="listings-group">
          <div className="listing-item">
            <img src={thumbnail} alt="" width={"250px"} />
            <p> Apartment in Bulacan</p>
            <p>Location</p>
            <p>Booked: listing.bookedCount days this month</p>
            <p>Availability: </p>
            <p>Price per night</p>
          <div className="listing-actions">
            <button onClick={handleViewBookings}>📅 View Calendar</button>
            <button onClick={handleEdit}>✏️ Edit</button>
            <button onClick={handleDelete}>🗑️ Delete</button>
          </div>
          </div>
          <div className="listing-item">
            <img src={thumbnail} alt="" width={"250px"} />
            <p> Apartment in Bulacan</p>
            <p>Location</p>
            <p>Booked: listing.bookedCount days this month</p>
            <p>Availability: </p>
            <p>Price per night</p>
          <div className="listing-actions">
            <button onClick={handleViewBookings}>📅 View Calendar</button>
            <button onClick={handleEdit}>✏️ Edit</button>
            <button onClick={handleDelete}>🗑️ Delete</button>
          </div>
          </div>
          <div className="listing-item">
            <img src={thumbnail} alt="" width={"250px"} />
            <p> Apartment in Bulacan</p>
            <p>Location</p>
            <p>Booked: listing.bookedCount days this month</p>
            <p>Availability: </p>
            <p>Price per night</p>
          <div className="listing-actions">
            <button onClick={handleViewBookings}>📅 View Calendar</button>
            <button onClick={handleEdit}>✏️ Edit</button>
            <button onClick={handleDelete}>🗑️ Delete</button>
          </div>
          </div>
        </div>
    </div>
  )
}

export default Listings