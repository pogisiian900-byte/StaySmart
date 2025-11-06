import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import money from '/static/Money.png'
import calendar from '/static/Calendar.png'
import UpcomingBookings from './UpcomingBookings'
import TodaysBooking from './TodaysBooking'


const HostDashboard = () => {
  const { hostId } = useParams()
  const [showBooking, setShowBooking] = useState("today")


 
  return (
    <div className="host-dashboard">
      <div className="dashboard-group">
        <button
          className={showBooking === "today" ? "today dashboardSelected" : "today"}
          onClick={() => setShowBooking("today")}
        >
          Today's Bookings
        </button>
        <button
          className={showBooking === "upcoming" ? "upcoming dashboardSelected" : "upcoming"}
          onClick={() => setShowBooking("upcoming")}
        >
          Upcoming Bookings
        </button>
      </div>

      {/* --- Conditional Booking Display --- */}
      {showBooking === "today" ? <TodaysBooking hostId={hostId} /> : <UpcomingBookings hostId={hostId} />}

      <hr className="divider" />

      {/* --- Quick Stats Section --- */}
      <div className="quick-statistics">
        <div className="earnings-item">
          <div className="earnings-text">
            <p>
              The Earnings of ( Month of <b>November</b> )
            </p>
            <p className="amount">₱30,000</p>
          </div>
          <img src={money} alt="money" />
        </div>

        <div className="earnings-item">
          <div className="earnings-text">
            <p>Total Bookings</p>
            <p className="amount">20</p>
          </div>
          <img src={calendar} alt="calendar" />
        </div>
      </div>
    </div>
  )
}

export default HostDashboard
