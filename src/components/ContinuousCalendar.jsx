import React, { useState } from "react";
import "./calendar.css";

const ContinuousCalendar = ({
  onClick,
  bookedDates = {},        // { dayNumber: "Status" } or { "2025-11-03": "Booked" } if you prefer date keys
  selectedDate = null,     // Date object for the selected day
  onBack = null,            // Optional callback for back button
  monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ],
  filters = [],             // e.g. ["Listing of Booked", "Name of Service"]
  showFilters = false       // toggle dropdown visibility
}) => {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [hoveredDayIndex, setHoveredDayIndex] = useState(null);

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();

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

  const getDayOfWeek = (day) => new Date(currentYear, currentMonth, day).getDay();

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <div className="calendar-controls">
         
          <button onClick={handlePrev}>❮</button>
          <button onClick={handleNext}>❯</button>
          <button onClick={handleToday} className="today-btn">Today</button>
        </div>

        <h2>{monthNames[currentMonth]} {currentYear}</h2>

        {showFilters && (
          <div className="calendar-filters">
            <select>
              <option value="">Select Filter</option>
              {filters.map((f, idx) => (
                <option key={idx} value={f}>{f}</option>
              ))}
            </select>
            <button>Search</button>
            <button>Edit</button>
          </div>
        )}
      </div>

      <div className="calendar-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => (
          <div
            key={d}
            className={`calendar-day-header ${hoveredDayIndex === i ? "hovered-column" : ""}`}
          >
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

          // Check if this day is selected
          const isSelected = selectedDate && 
            day === selectedDate.getDate() &&
            currentMonth === selectedDate.getMonth() &&
            currentYear === selectedDate.getFullYear();

          // You can pass bookedDates as { day: "Status" } or by date string key
          const key = `${currentYear}-${currentMonth + 1}-${day}`;
          const status = bookedDates[day] || bookedDates[key];
          
          // Get status class for color coding
          const getStatusClass = (status) => {
            if (!status) return '';
            const statusLower = status.toLowerCase();
            if (statusLower === 'pending') return 'status-pending';
            if (statusLower === 'confirmed') return 'status-confirmed';
            if (statusLower === 'declined' || statusLower === 'cancelled') return 'status-declined';
            return '';
          };
          const statusClass = getStatusClass(status);

          return (
            <div
              key={day}
              className={`calendar-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""} ${hoveredDayIndex === dayOfWeek ? "hovered-column" : ""}`}
              onClick={() => handleDayClick(day)}
              onMouseEnter={() => setHoveredDayIndex(dayOfWeek)}
              onMouseLeave={() => setHoveredDayIndex(null)}
            >
              <p className="day-number">{day}</p>
              {status && <p className={`day-text ${statusClass}`}>{status}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContinuousCalendar;
