import React from 'react'
import ContinuousCalendar from '../ContinuousCalendar.jsx'
import Select from '../ContinuousCalendar.jsx'
const Bookings = () => {

 const handleDateClick = (day, month, year) => {
    alert(`Clicked: ${day}/${month + 1}/${year}`);
  };

  return (
    <div>
      
         
      <ContinuousCalendar onClick={handleDateClick}/>

    </div>
  )
}

export default Bookings