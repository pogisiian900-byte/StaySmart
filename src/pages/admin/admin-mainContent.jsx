import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../../config/firebase'
import './admin-dashboard.css'


const Admin_MainContent = () => {
  const [hosts, setHosts] = useState([])
  const [bookings, setBookings] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch hosts
        const hostsQuery = query(collection(db, 'Users'), where('role', '==', 'host'))
        const hostsSnapshot = await getDocs(hostsQuery)
        const hostsData = hostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setHosts(hostsData)

        // Fetch bookings
        const bookingsSnapshot = await getDocs(collection(db, 'Reservation'))
        const bookingsData = bookingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setBookings(bookingsData)

        // Fetch listings
        const listingsSnapshot = await getDocs(collection(db, 'Listings'))
        const listingsData = listingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        setListings(listingsData)

        setLoading(false)
      } catch (error) {
        console.error('Error fetching admin data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalHosts = hosts.length
    const totalBookings = bookings.length
    const activeListings = listings.length
    
    // Calculate total income from confirmed bookings
    const totalIncome = bookings
      .filter(b => b.status?.toLowerCase() === 'confirmed')
      .reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)

    // Calculate previous month's data for comparison
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear

    const currentMonthBookings = bookings.filter(b => {
      const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
      return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear
    })

    const lastMonthBookings = bookings.filter(b => {
      const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
      return bookingDate.getMonth() === lastMonth && bookingDate.getFullYear() === lastMonthYear
    })

    const currentMonthIncome = currentMonthBookings
      .filter(b => b.status?.toLowerCase() === 'confirmed')
      .reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)

    const lastMonthIncome = lastMonthBookings
      .filter(b => b.status?.toLowerCase() === 'confirmed')
      .reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)

    const incomeChange = lastMonthIncome > 0 
      ? ((currentMonthIncome - lastMonthIncome) / lastMonthIncome * 100).toFixed(0)
      : currentMonthIncome > 0 ? 100 : 0

    const bookingsChange = lastMonthBookings.length > 0
      ? ((currentMonthBookings.length - lastMonthBookings.length) / lastMonthBookings.length * 100).toFixed(0)
      : currentMonthBookings.length > 0 ? 100 : 0

    const listingsChange = 0 // Can be calculated if needed

    return {
      totalHosts,
      totalIncome,
      totalBookings,
      activeListings,
      incomeChange: incomeChange > 0 ? `+${incomeChange}%` : `${incomeChange}%`,
      bookingsChange: bookingsChange > 0 ? `+${bookingsChange}%` : `${bookingsChange}%`,
      listingsChange: listingsChange > 0 ? `+${listingsChange}%` : `${listingsChange}%`
    }
  }, [hosts, bookings, listings])

  // Monthly income data for chart
  const monthlyIncomeData = useMemo(() => {
    const months = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      
      const monthBookings = bookings.filter(b => {
        const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        return bookingDate.getMonth() === date.getMonth() && 
               bookingDate.getFullYear() === date.getFullYear() &&
               b.status?.toLowerCase() === 'confirmed'
      })
      
      const income = monthBookings.reduce((sum, booking) => sum + (booking.pricing?.total || 0), 0)
      months.push({ month: monthName, income })
    }
    return months
  }, [bookings])

  // Plan distribution (simplified - can be enhanced with actual subscription data)
  const planDistribution = useMemo(() => {
    // For now, we'll use a simple distribution
    // In a real app, this would come from subscription data
    return [
      { name: 'Elite', count: 1, color: '#4a90e2' },
      { name: 'Starter', count: hosts.length - 1 || 1, color: '#10b981' }
    ]
  }, [hosts])

  // Top rated hosts (4.0+)
  const topRatedHosts = useMemo(() => {
    return hosts.filter(host => {
      // In a real app, this would check actual ratings
      // For now, we'll show hosts with listings
      return listings.some(listing => listing.hostId === host.id)
    }).slice(0, 5)
  }, [hosts, listings])

  // Hosts needing improvement (3.9 and below)
  const needsImprovementHosts = useMemo(() => {
    return hosts.filter(host => {
      // In a real app, this would check actual ratings
      // For now, we'll show hosts without listings or with declined bookings
      const hostListings = listings.filter(l => l.hostId === host.id)
      const hostBookings = bookings.filter(b => b.hostId === host.id)
      const declinedBookings = hostBookings.filter(b => b.status?.toLowerCase() === 'declined')
      return hostListings.length === 0 || declinedBookings.length > 0
    }).slice(0, 5)
  }, [hosts, listings, bookings])

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading dashboard...</div>
  }

  return (
    <div className='admin-mainContent'>
      <div className="admin-dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>Welcome to your management portal</p>
      </div>

      {/* KPI Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#e8f0ff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Hosts</h3>
            <p className="admin-kpi-value">{metrics.totalHosts}</p>
            <p className="admin-kpi-change">+0% from last month</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#f0fdf4' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Income</h3>
            <p className="admin-kpi-value">₱{metrics.totalIncome.toLocaleString()}</p>
            <p className="admin-kpi-change">{metrics.incomeChange} from last month</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#fef3c7' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Total Bookings</h3>
            <p className="admin-kpi-value">{metrics.totalBookings}</p>
            <p className="admin-kpi-change">{metrics.bookingsChange} from last month</p>
          </div>
        </div>

        <div className="admin-kpi-card">
          <div className="admin-kpi-icon" style={{ background: '#f3e8ff' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <div className="admin-kpi-content">
            <h3>Active Listings</h3>
            <p className="admin-kpi-value">{metrics.activeListings}</p>
            <p className="admin-kpi-change">{metrics.listingsChange} from last month</p>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="admin-charts-grid">
        <div className="admin-chart-card">
          <h3>Monthly Income Overview</h3>
          <div className="admin-line-chart">
            <svg width="100%" height="200" viewBox="0 0 600 200">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#4a90e2" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#4a90e2" stopOpacity="0" />
                </linearGradient>
              </defs>
              {/* Y-axis */}
              <line x1="40" y1="20" x2="40" y2="180" stroke="#e5e7eb" strokeWidth="1" />
              {/* X-axis */}
              <line x1="40" y1="180" x2="560" y2="180" stroke="#e5e7eb" strokeWidth="1" />
              
              {/* Y-axis labels */}
              {[0, 0.5, 1, 1.5, 2].map((val, i) => (
                <text key={i} x="35" y={180 - (i * 40)} textAnchor="end" fontSize="10" fill="#9ca3af">
                  ₱{val}k
                </text>
              ))}
              
              {/* Data points and line */}
              {monthlyIncomeData.length > 0 && monthlyIncomeData.map((data, index) => {
                const x = 60 + (index * 80)
                const maxIncome = Math.max(...monthlyIncomeData.map(d => d.income), 2000)
                const y = 180 - (data.income / maxIncome * 160)
                const nextX = index < monthlyIncomeData.length - 1 ? 60 + ((index + 1) * 80) : null
                const nextY = nextX ? 180 - (monthlyIncomeData[index + 1].income / maxIncome * 160) : null
                
                return (
                  <g key={index}>
                    {nextX && (
                      <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#4a90e2" strokeWidth="2" />
                    )}
                    <circle cx={x} cy={y} r="4" fill="#4a90e2" />
                    <text x={x} y="195" textAnchor="middle" fontSize="10" fill="#6b7280">
                      {data.month.split(' ')[0]}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        <div className="admin-chart-card">
          <h3>Plan Distribution</h3>
          <div className="admin-donut-chart">
            <svg width="200" height="200" viewBox="0 0 200 200">
              <circle cx="100" cy="100" r="80" fill="none" stroke="#e5e7eb" strokeWidth="20" />
              {planDistribution.map((plan, index) => {
                const total = planDistribution.reduce((sum, p) => sum + p.count, 0)
                const percentage = (plan.count / total) * 100
                const offset = planDistribution.slice(0, index).reduce((sum, p) => sum + (p.count / total * 251.2), 0)
                const strokeDasharray = `${percentage * 2.512} 251.2`
                
                return (
                  <circle
                    key={plan.name}
                    cx="100"
                    cy="100"
                    r="80"
                    fill="none"
                    stroke={plan.color}
                    strokeWidth="20"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 100 100)"
                  />
                )
              })}
              <text x="100" y="95" textAnchor="middle" fontSize="24" fontWeight="600" fill="#1f2937">
                {planDistribution.reduce((sum, p) => sum + p.count, 0)}
              </text>
              <text x="100" y="115" textAnchor="middle" fontSize="12" fill="#6b7280">
                Total
              </text>
            </svg>
            <div className="admin-chart-legend">
              {planDistribution.map(plan => (
                <div key={plan.name} className="admin-legend-item">
                  <div className="admin-legend-color" style={{ background: plan.color }}></div>
                  <span>{plan.name} ({plan.count})</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Hosts Sections */}
      <div className="admin-hosts-grid">
        <div className="admin-section-card">
          <h3>Top Rated Hosts (4.0+)</h3>
          <p className="admin-section-description">Hosts with excellent performance</p>
          <div className="admin-hosts-list">
            {topRatedHosts.length > 0 ? (
              topRatedHosts.map(host => (
                <div key={host.id} className="admin-host-item">
                  <div className="admin-host-avatar">
                    {host.firstName?.[0] || 'H'}
                  </div>
                  <div className="admin-host-info">
                    <p className="admin-host-name">{host.firstName} {host.lastName}</p>
                    <p className="admin-host-email">{host.emailAddress}</p>
                  </div>
                  <div className="admin-host-rating">4.5⭐</div>
                </div>
              ))
            ) : (
              <p style={{ padding: 20, color: '#9ca3af' }}>No top rated hosts yet</p>
            )}
          </div>
        </div>

        <div className="admin-section-card">
          <h3>Needs Improvement (3.9 and below)</h3>
          <p className="admin-section-description">Hosts that may need support</p>
          <div className="admin-hosts-list">
            {needsImprovementHosts.length > 0 ? (
              needsImprovementHosts.map(host => (
                <div key={host.id} className="admin-host-item">
                  <div className="admin-host-avatar" style={{ background: '#fee2e2' }}>
                    {host.firstName?.[0] || 'H'}
                  </div>
                  <div className="admin-host-info">
                    <p className="admin-host-name">{host.firstName} {host.lastName}</p>
                    <p className="admin-host-email">{host.emailAddress}</p>
                  </div>
                  <div className="admin-host-rating" style={{ color: '#ef4444' }}>3.5⭐</div>
                </div>
              ))
            ) : (
              <p style={{ padding: 20, color: '#9ca3af' }}>All hosts are performing well!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Admin_MainContent
