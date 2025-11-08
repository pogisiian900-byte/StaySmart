import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { collection, onSnapshot, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "../../config/firebase";
import Loading from "../Loading";
import moneyIcon from "/static/Money.png";
import calendarIcon from "/static/Calendar.png";
import receiptIcon from "/static/receipt-text.png";
import homeIcon from "/static/home.png";

const Earnings = () => {
  const navigate = useNavigate();
  const { hostId } = useParams();
  const [activeTab, setActiveTab] = useState("transactions");
  const [reservations, setReservations] = useState([]);
  const [listings, setListings] = useState([]);
  const [guests, setGuests] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [serviceFilter, setServiceFilter] = useState("All Services");

  const handleTabClick = (tab) => setActiveTab(tab);

  // Fetch reservations
  useEffect(() => {
    if (!hostId) return;
    
    const q = query(
      collection(db, 'Reservation'),
      where('hostId', '==', hostId)
    );
    
    const unsub = onSnapshot(q, async (snap) => {
      const list = [];
      const guestIds = new Set();
      
      snap.forEach((d) => {
        const data = d.data();
        list.push({ id: d.id, ...data });
        if (data.guestId) guestIds.add(data.guestId);
      });
      
      // Sort by createdAt desc
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)));
      list.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      
      setReservations(list);
      
      // Fetch guest names
      const guestData = {};
      for (const guestId of guestIds) {
        try {
          const guestRef = doc(db, 'Users', guestId);
          const guestSnap = await getDoc(guestRef);
          if (guestSnap.exists()) {
            const guestInfo = guestSnap.data();
            guestData[guestId] = `${guestInfo.firstName || ''} ${guestInfo.lastName || ''}`.trim() || guestInfo.email || 'Unknown Guest';
          }
        } catch (error) {
          console.error('Error fetching guest:', error);
        }
      }
      setGuests(guestData);
      
      // Fetch listings
      const listingIds = new Set(list.map(r => r.listingId).filter(Boolean));
      const listingData = {};
      for (const listingId of listingIds) {
        try {
          const listingRef = doc(db, 'Listings', listingId);
          const listingSnap = await getDoc(listingRef);
          if (listingSnap.exists()) {
            listingData[listingId] = listingSnap.data();
          }
        } catch (error) {
          console.error('Error fetching listing:', error);
        }
      }
      setListings(listingData);
      
      setLoading(false);
    });
    
    return () => unsub();
  }, [hostId]);

  // Calculate earnings
  const earningsData = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Calculate host earnings (total - service fee)
    const calculateHostEarning = (reservation) => {
      const total = reservation.pricing?.total || 0;
      const serviceFee = reservation.pricing?.serviceFee || 0;
      return total - serviceFee;
    };
    
    // All-time earnings (only confirmed/completed)
    const allTimeEarnings = reservations
      .filter(r => {
        const status = (r.status || '').toLowerCase();
        return status === 'confirmed' || status === 'completed';
      })
      .reduce((sum, r) => sum + calculateHostEarning(r), 0);
    
    // This month's earnings
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
    
    // Pending payouts (confirmed but not yet paid out)
    const pendingPayouts = reservations
      .filter(r => {
        const status = (r.status || '').toLowerCase();
        return status === 'confirmed' && !r.paidOut;
      })
      .reduce((sum, r) => sum + calculateHostEarning(r), 0);
    
    // Total bookings
    const totalBookings = reservations.length;
    
    return {
      allTimeEarnings,
      thisMonthEarnings,
      pendingPayouts,
      totalBookings
    };
  }, [reservations]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return reservations.filter(r => {
      // Search filter
      if (searchQuery) {
        const guestName = guests[r.guestId] || '';
        const bookingId = r.id || '';
        const listingTitle = listings[r.listingId]?.title || '';
        const searchLower = searchQuery.toLowerCase();
        if (!guestName.toLowerCase().includes(searchLower) &&
            !bookingId.toLowerCase().includes(searchLower) &&
            !listingTitle.toLowerCase().includes(searchLower)) {
          return false;
        }
      }
      
      // Status filter
      if (statusFilter !== 'All Status') {
        const status = (r.status || '').toLowerCase();
        if (statusFilter.toLowerCase() !== status) {
          return false;
        }
      }
      
      // Service filter (by listing title)
      if (serviceFilter !== 'All Services') {
        const listingTitle = listings[r.listingId]?.title || '';
        if (!listingTitle.toLowerCase().includes(serviceFilter.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });
  }, [reservations, searchQuery, statusFilter, serviceFilter, guests, listings]);

  // Get unique services for filter
  const uniqueServices = useMemo(() => {
    const services = new Set();
    reservations.forEach(r => {
      const listingTitle = listings[r.listingId]?.title;
      if (listingTitle) services.add(listingTitle);
    });
    return Array.from(services).sort();
  }, [reservations, listings]);

  if (loading) {
    return (
      <div className="earnings-container">
        <Loading />
      </div>
    );
  }

  return (
    <div className="earnings-container">
      {/* 🧭 Top Navigation */}


      {/* Tabs */}
      <div className="earnings-tabs">
        <button
          className={activeTab === "transactions" ? "tab-btn active" : "tab-btn"}
          onClick={() => handleTabClick("transactions")}
        >
          Transactions
        </button>
        <button
          className={activeTab === "payouts" ? "tab-btn active" : "tab-btn"}
          onClick={() => handleTabClick("payouts")}
        >
          Payouts
        </button>
      </div>

      {/* 🔍 Filter Area */}
      <div className="earnings-filters">
        <input 
          type="text" 
          placeholder="Search booking, guest, or listing..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)}>
          <option>All Services</option>
          {uniqueServices.map(service => (
            <option key={service} value={service}>{service}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option>All Status</option>
          <option>Confirmed</option>
          <option>Completed</option>
          <option>Pending</option>
          <option>Cancelled</option>
        </select>
      </div>
      
      {/* Overview Cards */}
      <div className="overview-div">
        <div className="overview-card">
          <div className="overview-card-header">
            <img src={moneyIcon} alt="Money" className="overview-icon" />
            <p>Total Earnings (All-Time)</p>
          </div>
          <p className="overview-amount">₱{earningsData.allTimeEarnings.toLocaleString()}</p>
        </div>
        <div className="overview-card">
          <div className="overview-card-header">
            <img src={calendarIcon} alt="Calendar" className="overview-icon" />
            <p>This Month's Earnings</p>
          </div>
          <p className="overview-amount">₱{earningsData.thisMonthEarnings.toLocaleString()}</p>
        </div>
        <div className="overview-card">
          <div className="overview-card-header">
            <img src={receiptIcon} alt="Receipt" className="overview-icon" />
            <p>Pending Payouts</p>
          </div>
          <p className="overview-amount">₱{earningsData.pendingPayouts.toLocaleString()}</p>
        </div>
        <div className="overview-card">
          <div className="overview-card-header">
            <img src={homeIcon} alt="Home" className="overview-icon" />
            <p>Total Bookings</p>
          </div>
          <p className="overview-amount">{earningsData.totalBookings}</p>
        </div>
      </div>
      {/* Transactions Table */}
      {activeTab === "transactions" && (
        <div className="table-wrapper">
          {filteredTransactions.length === 0 ? (
            <div className="table-empty">
              <p>No transactions found</p>
            </div>
          ) : (
            <table className="earningTable">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Booker Full Name</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Service</th>
                  <th>Amount Earned</th>
                  <th>Booking Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((reservation) => {
                  const guestName = guests[reservation.guestId] || 'Unknown Guest';
                  const listing = listings[reservation.listingId];
                  const listingTitle = listing?.title || 'Unknown Listing';
                  
                  // Calculate host earning (total - service fee)
                  const total = reservation.pricing?.total || 0;
                  const serviceFee = reservation.pricing?.serviceFee || 0;
                  const hostEarning = total - serviceFee;
                  
                  // Format dates
                  const formatDate = (date) => {
                    if (!date) return 'N/A';
                    const d = date.toDate ? date.toDate() : new Date(date);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  };
                  
                  const status = (reservation.status || '').toLowerCase();
                  const statusClass = status === 'completed' || status === 'confirmed' 
                    ? 'completed' 
                    : status === 'pending' 
                    ? 'pending' 
                    : status === 'cancelled' 
                    ? 'cancelled' 
                    : 'pending';
                  
                  return (
                    <tr key={reservation.id}>
                      <td className="booking-id">#{reservation.id.slice(0, 8).toUpperCase()}</td>
                      <td>{guestName}</td>
                      <td>{formatDate(reservation.checkIn)}</td>
                      <td>{formatDate(reservation.checkOut)}</td>
                      <td>{listingTitle}</td>
                      <td className="amount-earned">₱{hostEarning.toLocaleString()}</td>
                      <td className={`status ${statusClass}`}>
                        {reservation.status || 'Pending'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Payouts Table */}
      {activeTab === "payouts" && (
        <div className="table-wrapper">
          {reservations.filter(r => {
            const status = (r.status || '').toLowerCase();
            return status === 'confirmed' || status === 'completed';
          }).length === 0 ? (
            <div className="table-empty">
              <p>No payouts available</p>
            </div>
          ) : (
            <table className="earningTable">
              <thead>
                <tr>
                  <th>Payout ID</th>
                  <th>Date Issued</th>
                  <th>Bank / Method</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservations
                  .filter(r => {
                    const status = (r.status || '').toLowerCase();
                    return status === 'confirmed' || status === 'completed';
                  })
                  .map((reservation, index) => {
                    const total = reservation.pricing?.total || 0;
                    const serviceFee = reservation.pricing?.serviceFee || 0;
                    const payoutAmount = total - serviceFee;
                    
                    const formatDate = (date) => {
                      if (!date) return 'N/A';
                      const d = date.toDate ? date.toDate() : new Date(date);
                      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    };
                    
                    const paymentMethod = reservation.paymentMethod || {};
                    const method = paymentMethod.type === 'paypal' 
                      ? 'PayPal' 
                      : paymentMethod.type === 'card' 
                      ? 'Card' 
                      : 'PayPal';
                    
                    const reference = paymentMethod.transactionId || paymentMethod.reference || `REF${reservation.id.slice(0, 8).toUpperCase()}`;
                    const issuedDate = reservation.createdAt || reservation.updatedAt;
                    const isPaidOut = reservation.paidOut === true;
                    const statusClass = isPaidOut ? 'completed' : 'processing';
                    const statusText = isPaidOut ? 'Completed' : 'Processing';
                    
                    return (
                      <tr key={reservation.id}>
                        <td className="payout-id">#PYT-{String(index + 1).padStart(3, '0')}</td>
                        <td>{formatDate(issuedDate)}</td>
                        <td>{method}</td>
                        <td className="reference">{reference}</td>
                        <td className="payout-amount">₱{payoutAmount.toLocaleString()}</td>
                        <td className={`status ${statusClass}`}>{statusText}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>
      )}
    
    </div>
  );
};

export default Earnings;
