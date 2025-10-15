import React from 'react'
import imgEx from "/static/me.png"
const TodaysBooking = () => {
  return (
    <div className='TodaysBooking'>
        <h1>Today's Booking</h1>
     <div className="booking-list">
         {[...Array(6)].map((_, index) => (
           <div className="booking-row" key={index}>
            <div className="booking-row-group">
            <h3>{index+ 1}. </h3>
             <img className="booking-row__thumb" src={imgEx} alt="room thumbnail" />
            </div>
             <div className="booking-row__info">
               <p className="text-3xl font-bold text-blue-600 text-center">Ian Harold</p>
               <p className="booking-row__meta">Room | Niugan Hotel</p>
             </div>
             <p className="booking-row__date">10/08/2025</p>
           </div>
         ))}
       </div>
    </div>
  )
}

export default TodaysBooking