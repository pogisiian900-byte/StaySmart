import React, { useMemo, useState, useEffect } from 'react'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../config/firebase'

const HostAnalytics = ({ hostId, reservations }) => {
  const [listings, setListings] = useState({})
  const [selectedPeriod, setSelectedPeriod] = useState('6months') // 6months, 12months, all

  // Fetch listings for this host
  useEffect(() => {
    if (!hostId) return;
    
    const fetchListings = async () => {
      try {
        const q = query(
          collection(db, 'Listings'),
          where('hostId', '==', hostId)
        );
        const snapshot = await getDocs(q);
        const listingsData = {};
        snapshot.forEach((doc) => {
          listingsData[doc.id] = doc.data();
        });
        setListings(listingsData);
      } catch (error) {
        console.error('Error fetching listings:', error);
      }
    };
    
    fetchListings();
  }, [hostId]);

  // Calculate host earnings (total - service fee)
  const calculateHostEarning = (reservation) => {
    const total = reservation.pricing?.total || 0;
    const serviceFee = reservation.pricing?.serviceFee || 0;
    return total - serviceFee;
  };

  // Helper to convert Firebase timestamp to Date
  const toDate = (timestamp) => {
    if (!timestamp) return null;
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return new Date(timestamp);
  };

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!reservations || reservations.length === 0) {
      return {
        monthlyRevenue: [],
        bookingStatusDistribution: [],
        totalEarnings: 0,
        totalBookings: 0,
        averageBookingValue: 0,
        confirmedBookings: 0,
        completedBookings: 0,
        cancelledBookings: 0,
        pendingBookings: 0,
        topListings: [],
        yearlyComparison: { thisYear: 0, lastYear: 0 },
        monthlyComparison: { thisMonth: 0, lastMonth: 0 }
      };
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    // Determine date range based on selected period
    let startDate = new Date();
    if (selectedPeriod === '6months') {
      startDate.setMonth(startDate.getMonth() - 6);
    } else if (selectedPeriod === '12months') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      startDate = new Date(0); // All time
    }

    // Filter reservations by period
    const filteredReservations = reservations.filter(r => {
      const createdDate = toDate(r.createdAt);
      return createdDate && createdDate >= startDate;
    });

    // Calculate monthly revenue (last 6 or 12 months)
    const monthlyRevenue = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const periods = selectedPeriod === '6months' ? 6 : selectedPeriod === '12months' ? 12 : 12;
    for (let i = periods - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthReservations = filteredReservations.filter(r => {
        const createdDate = toDate(r.createdAt);
        if (!createdDate) return false;
        const status = (r.status || '').toLowerCase();
        return createdDate.getMonth() === month && 
               createdDate.getFullYear() === year &&
               (status === 'confirmed' || status === 'completed');
      });
      
      const monthEarnings = monthReservations.reduce((sum, r) => sum + calculateHostEarning(r), 0);
      
      monthlyRevenue.push({
        month: `${monthNames[month]} ${year.toString().slice(-2)}`,
        fullMonth: monthNames[month],
        year: year,
        income: monthEarnings
      });
    }

    // Booking status distribution
    const statusCounts = {
      confirmed: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      refunded: 0
    };

    filteredReservations.forEach(r => {
      const status = (r.status || '').toLowerCase();
      if (status in statusCounts) {
        statusCounts[status]++;
      } else {
        statusCounts.pending++;
      }
    });

    const bookingStatusDistribution = [
      { name: 'Confirmed', count: statusCounts.confirmed, color: '#10b981' },
      { name: 'Completed', count: statusCounts.completed, color: '#31326F' },
      { name: 'Pending', count: statusCounts.pending, color: '#f59e0b' },
      { name: 'Cancelled', count: statusCounts.cancelled, color: '#ef4444' },
      { name: 'Refunded', count: statusCounts.refunded, color: '#6b7280' }
    ].filter(item => item.count > 0);

    // Total earnings (all time confirmed/completed)
    const confirmedReservations = reservations.filter(r => {
      const status = (r.status || '').toLowerCase();
      return status === 'confirmed' || status === 'completed';
    });
    const totalEarnings = confirmedReservations.reduce((sum, r) => sum + calculateHostEarning(r), 0);

    // Average booking value
    const bookingValues = confirmedReservations.map(r => calculateHostEarning(r));
    const averageBookingValue = bookingValues.length > 0 
      ? bookingValues.reduce((sum, val) => sum + val, 0) / bookingValues.length 
      : 0;

    // Yearly comparison (this year vs last year)
    const thisYearReservations = reservations.filter(r => {
      const createdDate = toDate(r.createdAt);
      if (!createdDate) return false;
      const status = (r.status || '').toLowerCase();
      return createdDate.getFullYear() === currentYear && 
             (status === 'confirmed' || status === 'completed');
    });
    const thisYearEarnings = thisYearReservations.reduce((sum, r) => sum + calculateHostEarning(r), 0);

    const lastYearReservations = reservations.filter(r => {
      const createdDate = toDate(r.createdAt);
      if (!createdDate) return false;
      const status = (r.status || '').toLowerCase();
      return createdDate.getFullYear() === currentYear - 1 && 
             (status === 'confirmed' || status === 'completed');
    });
    const lastYearEarnings = lastYearReservations.reduce((sum, r) => sum + calculateHostEarning(r), 0);

    // Monthly comparison (this month vs last month)
    const thisMonthReservations = reservations.filter(r => {
      const createdDate = toDate(r.createdAt);
      if (!createdDate) return false;
      const status = (r.status || '').toLowerCase();
      return createdDate.getMonth() === currentMonth && 
             createdDate.getFullYear() === currentYear &&
             (status === 'confirmed' || status === 'completed');
    });
    const thisMonthEarnings = thisMonthReservations.reduce((sum, r) => sum + calculateHostEarning(r), 0);

    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const lastMonthReservations = reservations.filter(r => {
      const createdDate = toDate(r.createdAt);
      if (!createdDate) return false;
      const status = (r.status || '').toLowerCase();
      return createdDate.getMonth() === lastMonth && 
             createdDate.getFullYear() === lastMonthYear &&
             (status === 'confirmed' || status === 'completed');
    });
    const lastMonthEarnings = lastMonthReservations.reduce((sum, r) => sum + calculateHostEarning(r), 0);

    // Top performing listings
    const listingStats = {};
    confirmedReservations.forEach(r => {
      const listingId = r.listingId;
      if (listingId) {
        if (!listingStats[listingId]) {
          listingStats[listingId] = {
            listingId,
            name: listings[listingId]?.title || 'Unknown Listing',
            count: 0,
            earnings: 0
          };
        }
        listingStats[listingId].count++;
        listingStats[listingId].earnings += calculateHostEarning(r);
      }
    });

    const topListings = Object.values(listingStats)
      .sort((a, b) => b.earnings - a.earnings)
      .slice(0, 5);

    return {
      monthlyRevenue,
      bookingStatusDistribution,
      totalEarnings,
      totalBookings: reservations.length,
      averageBookingValue,
      confirmedBookings: statusCounts.confirmed,
      completedBookings: statusCounts.completed,
      cancelledBookings: statusCounts.cancelled,
      pendingBookings: statusCounts.pending,
      topListings,
      yearlyComparison: {
        thisYear: thisYearEarnings,
        lastYear: lastYearEarnings,
        change: lastYearEarnings > 0 ? ((thisYearEarnings - lastYearEarnings) / lastYearEarnings * 100) : 0
      },
      monthlyComparison: {
        thisMonth: thisMonthEarnings,
        lastMonth: lastMonthEarnings,
        change: lastMonthEarnings > 0 ? ((thisMonthEarnings - lastMonthEarnings) / lastMonthEarnings * 100) : 0
      }
    };
  }, [reservations, listings, selectedPeriod]);

  const maxRevenue = Math.max(...analytics.monthlyRevenue.map(d => d.income), 1);

  return (
    <div className="host-analytics">
      <div className="analytics-header">
        <h2>Analytics Overview</h2>
        <div className="period-selector">
          <button
            className={selectedPeriod === '6months' ? 'active' : ''}
            onClick={() => setSelectedPeriod('6months')}
          >
            6 Months
          </button>
          <button
            className={selectedPeriod === '12months' ? 'active' : ''}
            onClick={() => setSelectedPeriod('12months')}
          >
            12 Months
          </button>
          <button
            className={selectedPeriod === 'all' ? 'active' : ''}
            onClick={() => setSelectedPeriod('all')}
          >
            All Time
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="analytics-metrics-grid">
        <div className="analytics-metric-card">
          <div className="metric-label">Total Earnings</div>
          <div className="metric-value">₱{analytics.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-subtitle">All time confirmed/completed bookings</div>
        </div>

        <div className="analytics-metric-card">
          <div className="metric-label">Average Booking Value</div>
          <div className="metric-value">₱{analytics.averageBookingValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          <div className="metric-subtitle">Per confirmed/completed booking</div>
        </div>

        <div className="analytics-metric-card">
          <div className="metric-label">Total Bookings</div>
          <div className="metric-value">{analytics.totalBookings}</div>
          <div className="metric-subtitle">All booking statuses</div>
        </div>

        <div className="analytics-metric-card">
          <div className="metric-label">Completed Bookings</div>
          <div className="metric-value">{analytics.completedBookings}</div>
          <div className="metric-subtitle">Successfully completed</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="analytics-charts-grid">
        {/* Monthly Revenue Chart */}
        <div className="analytics-chart-card">
          <h3>Monthly Revenue Trend</h3>
          <div className="analytics-line-chart">
            <svg width="100%" height="250" viewBox="0 0 600 250">
              <defs>
                <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#31326F" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#31326F" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Y-axis */}
              <line x1="50" y1="30" x2="50" y2="210" stroke="#e5e7eb" strokeWidth="1" />
              {/* X-axis */}
              <line x1="50" y1="210" x2="570" y2="210" stroke="#e5e7eb" strokeWidth="1" />
              
              {/* Y-axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((val, i) => {
                const labelValue = Math.round(val * maxRevenue);
                return (
                  <text key={i} x="45" y={210 - (i * 45)} textAnchor="end" fontSize="11" fill="#6b7280">
                    {labelValue >= 1000 ? `₱${(labelValue / 1000).toFixed(1)}k` : `₱${labelValue}`}
                  </text>
                );
              })}
              
              {/* Area fill */}
              {analytics.monthlyRevenue.length > 0 && (
                <path
                  d={`M 50 210 ${analytics.monthlyRevenue.map((data, index) => {
                    const x = 70 + (index * (520 / Math.max(analytics.monthlyRevenue.length - 1, 1)));
                    const y = 210 - (data.income / maxRevenue * 180);
                    return `L ${x} ${y}`;
                  }).join(' ')} L ${70 + ((analytics.monthlyRevenue.length - 1) * (520 / Math.max(analytics.monthlyRevenue.length - 1, 1)))} 210 Z`}
                  fill="url(#revenueGradient)"
                />
              )}
              
              {/* Data points and line */}
              {analytics.monthlyRevenue.map((data, index) => {
                const x = 70 + (index * (520 / Math.max(analytics.monthlyRevenue.length - 1, 1)));
                const y = 210 - (data.income / maxRevenue * 180);
                const nextX = index < analytics.monthlyRevenue.length - 1 ? 70 + ((index + 1) * (520 / Math.max(analytics.monthlyRevenue.length - 1, 1))) : null;
                const nextY = nextX ? 210 - (analytics.monthlyRevenue[index + 1].income / maxRevenue * 180) : null;
                
                return (
                  <g key={index}>
                    {nextX && (
                      <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#31326F" strokeWidth="2.5" />
                    )}
                    <circle cx={x} cy={y} r="5" fill="#31326F" />
                    <text x={x} y="230" textAnchor="middle" fontSize="10" fill="#6b7280">
                      {data.fullMonth}
                    </text>
                    {/* Tooltip value on hover area */}
                    <title>{data.month}: ₱{data.income.toLocaleString()}</title>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Booking Status Distribution */}
        <div className="analytics-chart-card">
          <h3>Booking Status Distribution</h3>
          <div className="analytics-donut-chart">
            <svg width="220" height="220" viewBox="0 0 220 220">
              <circle cx="110" cy="110" r="85" fill="none" stroke="#e5e7eb" strokeWidth="25" />
              {analytics.bookingStatusDistribution.map((status, index) => {
                const total = analytics.bookingStatusDistribution.reduce((sum, s) => sum + s.count, 0);
                const percentage = total > 0 ? (status.count / total) * 100 : 0;
                const offset = analytics.bookingStatusDistribution.slice(0, index).reduce((sum, s) => sum + (s.count / total * 266.9), 0);
                const strokeDasharray = `${percentage * 2.669} 266.9`;
                
                return (
                  <circle
                    key={status.name}
                    cx="110"
                    cy="110"
                    r="85"
                    fill="none"
                    stroke={status.color}
                    strokeWidth="25"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 110 110)"
                  />
                );
              })}
              <text x="110" y="105" textAnchor="middle" fontSize="28" fontWeight="600" fill="#1f2937">
                {analytics.bookingStatusDistribution.reduce((sum, s) => sum + s.count, 0)}
              </text>
              <text x="110" y="125" textAnchor="middle" fontSize="13" fill="#6b7280">
                Total
              </text>
            </svg>
            <div className="analytics-chart-legend">
              {analytics.bookingStatusDistribution.map(status => (
                <div key={status.name} className="analytics-legend-item">
                  <div className="analytics-legend-color" style={{ background: status.color }}></div>
                  <span>{status.name} ({status.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="analytics-comparison-grid">
        <div className="analytics-comparison-card">
          <h3>Monthly Comparison</h3>
          <div className="comparison-content">
            <div className="comparison-item">
              <div className="comparison-label">This Month</div>
              <div className="comparison-value">₱{analytics.monthlyComparison.thisMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="comparison-item">
              <div className="comparison-label">Last Month</div>
              <div className="comparison-value">₱{analytics.monthlyComparison.lastMonth.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="comparison-change">
              <span className={analytics.monthlyComparison.change >= 0 ? 'positive' : 'negative'}>
                {analytics.monthlyComparison.change >= 0 ? '↑' : '↓'} {Math.abs(analytics.monthlyComparison.change).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        <div className="analytics-comparison-card">
          <h3>Yearly Comparison</h3>
          <div className="comparison-content">
            <div className="comparison-item">
              <div className="comparison-label">This Year</div>
              <div className="comparison-value">₱{analytics.yearlyComparison.thisYear.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="comparison-item">
              <div className="comparison-label">Last Year</div>
              <div className="comparison-value">₱{analytics.yearlyComparison.lastYear.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
            <div className="comparison-change">
              <span className={analytics.yearlyComparison.change >= 0 ? 'positive' : 'negative'}>
                {analytics.yearlyComparison.change >= 0 ? '↑' : '↓'} {Math.abs(analytics.yearlyComparison.change).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Listings */}
      {analytics.topListings.length > 0 && (
        <div className="analytics-top-listings">
          <h3>Top Performing Listings</h3>
          <div className="top-listings-list">
            {analytics.topListings.map((listing, index) => (
              <div key={listing.listingId} className="top-listing-item">
                <div className="listing-rank">#{index + 1}</div>
                <div className="listing-info">
                  <div className="listing-name">{listing.name}</div>
                  <div className="listing-stats">
                    {listing.count} booking{listing.count !== 1 ? 's' : ''} • ₱{listing.earnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HostAnalytics;
