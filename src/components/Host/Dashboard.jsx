import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import money from '/static/Money.png'
import calendar from '/static/Calendar.png'
import UpcomingBookings from './UpcomingBookings'
import TodaysBooking from './TodaysBooking'
import HostAnalytics from './HostAnalytics'


const HostDashboard = () => {
  const { hostId } = useParams()
  const [showBooking, setShowBooking] = useState("today")
  const [reservations, setReservations] = useState([])
  const [loading, setLoading] = useState(true)

  // Fetch reservations
  useEffect(() => {
    if (!hostId) return;
    
    const q = query(
      collection(db, 'Reservation'),
      where('hostId', '==', hostId)
    );
    
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      
      // Sort by createdAt desc
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)));
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      
      setReservations(list);
      setLoading(false);
    });
    
    return () => unsub();
  }, [hostId]);

  // Calculate earnings and bookings
  const dashboardStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const currentMonthName = monthNames[currentMonth];
    
    // Calculate host earnings (total - service fee)
    const calculateHostEarning = (reservation) => {
      const total = reservation.pricing?.total || 0;
      const serviceFee = reservation.pricing?.serviceFee || 0;
      return total - serviceFee;
    };
    
    // This month's earnings (only confirmed/completed)
    const thisMonthEarnings = reservations
      .filter(r => {
        const status = (r.status || '').toLowerCase();
        if (status !== 'confirmed' && status !== 'completed') return false;
        
        const createdAt = r.createdAt;
        if (!createdAt) return false;
        
        const createdDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
        return createdDate.getMonth() === currentMonth && createdDate.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + calculateHostEarning(r), 0);
    
    // Total bookings
    const totalBookings = reservations.length;
    
    return {
      thisMonthEarnings,
      totalBookings,
      currentMonthName
    };
  }, [reservations]);
 
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
              The Earnings of ( Month of <b>{dashboardStats.currentMonthName}</b> )
            </p>
            <p className="amount">₱{dashboardStats.thisMonthEarnings.toLocaleString()}</p>
          </div>
          <img src={money} alt="money" />
        </div>

        <div className="earnings-item">
          <div className="earnings-text">
            <p>Total Bookings</p>
            <p className="amount">{dashboardStats.totalBookings}</p>
          </div>
          <img src={calendar} alt="calendar" />
        </div>
      </div>

      <hr className="divider" />

      {/* --- Analytics Section --- */}
      <HostAnalytics hostId={hostId} reservations={reservations} />
    </div>
  )
}

export default HostDashboard
