import React, { useState } from "react";
import './calendar.css'

const ContinuousCalendar = ({ onClick }) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [hoveredDayIndex, setHoveredDayIndex] = useState(null);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const bookedDates = {
    3: "Booked",
    7: "Available",
    10: "Maintenance",
    15: "Full",
  };

  const handlePrev = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNext = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
  };

  const handleDayClick = (day) => {
    if (onClick) onClick(day, currentMonth + 1, currentYear);
  };

  // Get the weekday for a given day in the current month
  const getDayOfWeek = (day) => new Date(currentYear, currentMonth, day).getDay();

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-controls">
          <button onClick={handlePrev}>❮</button>
          <button onClick={handleNext}>❯</button>
          <button onClick={handleToday} className="today-btn">Today</button>
        </div>

        <h2>{months[currentMonth]} {currentYear}</h2>

        <div className="calendar-filters">
          <select>
            <option value="">Listing of Booked</option>
            <option value="">Name of Service</option>
          </select>
          <button>Open Search</button>
          <button>Edit</button>
        </div>
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
          <div key={d} className={`calendar-day-header ${hoveredDayIndex === i ? "hovered-column" : ""}`}>
            {d}
          </div>
        ))}

        {Array.from({ length: firstDay }).map((_, i) => (
          <div key={`empty-${i}`} className="calendar-day empty"></div>
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayOfWeek = getDayOfWeek(day);
          const isToday =
            day === today.getDate() &&
            currentMonth === today.getMonth() &&
            currentYear === today.getFullYear();

          const status = bookedDates[day];

          return (
            <div
              key={day}
              className={`calendar-day ${isToday ? "today" : ""} ${hoveredDayIndex === dayOfWeek ? "hovered-column" : ""}`}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoveredDayIndex(dayOfWeek)}
              onMouseLeave={() => setHoveredDayIndex(null)}
            >
              <p className="day-number">{day}</p>
              {status && <p className="day-text">{status}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContinuousCalendar;
