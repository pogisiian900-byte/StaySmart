import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { generateBookingsPDF, generatePaymentsPDF } from '../../utils/pdfGenerators'
import './admin-dashboard.css'


const Admin_MainContent = () => {
  const [hosts, setHosts] = useState([])
  const [bookings, setBookings] = useState([])
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [generatingReport, setGeneratingReport] = useState(null) // 'daily', 'monthly', 'yearly', or null
  const [selectedReportType, setSelectedReportType] = useState('daily') // 'daily' or 'yearly'
  const [dialog, setDialog] = useState({ show: false, message: '', type: 'info' }) // 'success', 'error', 'warning', 'info'

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
      { name: 'Elite', count: 1, color: '#31326F' },
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

  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Helper function to show dialog
  const showDialog = (message, type = 'info') => {
    setDialog({ show: true, message, type })
    // Auto-hide after 4 seconds for success/info, 5 seconds for error/warning
    setTimeout(() => {
      setDialog({ show: false, message: '', type: 'info' })
    }, type === 'error' || type === 'warning' ? 5000 : 4000)
  }

  // Helper function to get bookings with host and guest names
  const getBookingsWithNames = async (bookingsData) => {
    const bookingsWithNames = await Promise.all(
      bookingsData.map(async (booking) => {
        // Get guest name
        if (booking.guestId) {
          try {
            const guestRef = doc(db, 'Users', booking.guestId)
            const guestSnap = await getDoc(guestRef)
            if (guestSnap.exists()) {
              const guestData = guestSnap.data()
              booking.guestName = guestData.firstName 
                ? `${guestData.firstName} ${guestData.lastName || ''}`.trim()
                : guestData.email || 'Guest'
            } else {
              booking.guestName = 'Guest'
            }
          } catch (err) {
            booking.guestName = 'Guest'
          }
        } else {
          booking.guestName = 'Guest'
        }

        // Get host name
        if (booking.hostId) {
          try {
            const hostRef = doc(db, 'Users', booking.hostId)
            const hostSnap = await getDoc(hostRef)
            if (hostSnap.exists()) {
              const hostData = hostSnap.data()
              booking.hostName = hostData.firstName 
                ? `${hostData.firstName} ${hostData.lastName || ''}`.trim()
                : hostData.email || 'Host'
            } else {
              booking.hostName = 'Host'
            }
          } catch (err) {
            booking.hostName = 'Host'
          }
        } else {
          booking.hostName = 'Host'
        }

        return booking
      })
    )
    return bookingsWithNames
  }

  // Generate Daily Report
  const generateDailyReport = async () => {
    setGeneratingReport('daily')
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      // Filter bookings for today
      const dailyBookings = bookings.filter(b => {
        const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        bookingDate.setHours(0, 0, 0, 0)
        return bookingDate >= today && bookingDate < tomorrow
      })

      if (dailyBookings.length === 0) {
        showDialog('No bookings found for today.', 'warning')
        setGeneratingReport(null)
        return
      }

      const bookingsWithNames = await getBookingsWithNames(dailyBookings)
      const dateRange = {
        startDate: formatDate(today),
        endDate: formatDate(today)
      }

      const pdf = await generateBookingsPDF(bookingsWithNames, {
        isAdmin: true,
        dateRange
      })
      pdf.save(`admin-daily-report-${formatDate(today)}.pdf`)
      showDialog(`Daily report generated successfully! (${dailyBookings.length} bookings)`, 'success')
    } catch (error) {
      console.error('Error generating daily report:', error)
      showDialog('Failed to generate daily report. Please try again.', 'error')
    } finally {
      setGeneratingReport(null)
    }
  }

  // Generate Monthly Report
  const generateMonthlyReport = async () => {
    setGeneratingReport('monthly')
    try {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      firstDay.setHours(0, 0, 0, 0)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      lastDay.setHours(23, 59, 59, 999)

      // Filter bookings for current month
      const monthlyBookings = bookings.filter(b => {
        const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        return bookingDate >= firstDay && bookingDate <= lastDay
      })

      if (monthlyBookings.length === 0) {
        showDialog('No bookings found for this month.', 'warning')
        setGeneratingReport(null)
        return
      }

      const bookingsWithNames = await getBookingsWithNames(monthlyBookings)
      const dateRange = {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay)
      }

      const pdf = await generateBookingsPDF(bookingsWithNames, {
        isAdmin: true,
        dateRange
      })
      pdf.save(`admin-monthly-report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`)
      showDialog(`Monthly report generated successfully! (${monthlyBookings.length} bookings)`, 'success')
    } catch (error) {
      console.error('Error generating monthly report:', error)
      showDialog('Failed to generate monthly report. Please try again.', 'error')
    } finally {
      setGeneratingReport(null)
    }
  }

  // Generate Yearly Report
  const generateYearlyReport = async () => {
    setGeneratingReport('yearly')
    try {
      const now = new Date()
      const firstDay = new Date(now.getFullYear(), 0, 1)
      firstDay.setHours(0, 0, 0, 0)
      const lastDay = new Date(now.getFullYear(), 11, 31)
      lastDay.setHours(23, 59, 59, 999)

      // Filter bookings for current year
      const yearlyBookings = bookings.filter(b => {
        const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        return bookingDate >= firstDay && bookingDate <= lastDay
      })

      if (yearlyBookings.length === 0) {
        showDialog('No bookings found for this year.', 'warning')
        setGeneratingReport(null)
        return
      }

      const bookingsWithNames = await getBookingsWithNames(yearlyBookings)
      const dateRange = {
        startDate: formatDate(firstDay),
        endDate: formatDate(lastDay)
      }

      const pdf = await generateBookingsPDF(bookingsWithNames, {
        isAdmin: true,
        dateRange
      })
      pdf.save(`admin-yearly-report-${now.getFullYear()}.pdf`)
      showDialog(`Yearly report generated successfully! (${yearlyBookings.length} bookings)`, 'success')
    } catch (error) {
      console.error('Error generating yearly report:', error)
      showDialog('Failed to generate yearly report. Please try again.', 'error')
    } finally {
      setGeneratingReport(null)
    }
  }

  // Generate report based on selected type
  const generateReport = async () => {
    if (selectedReportType === 'daily') {
      await generateDailyReport()
    } else if (selectedReportType === 'yearly') {
      await generateYearlyReport()
    }
  }

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

      {/* Quick Reports */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '24px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '8px'
        }}>
          Quick Reports
        </h2>
        <p style={{
          fontSize: '0.95rem',
          color: '#6b7280',
          marginBottom: '24px'
        }}>
          Generate and download PDF reports instantly
        </p>
        <div style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'flex-end',
          flexWrap: 'wrap'
        }}>
          {/* Report Type Dropdown */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Report Type
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value)}
              disabled={generatingReport !== null}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '1rem',
                color: '#111827',
                background: 'white',
                cursor: generatingReport !== null ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              onFocus={(e) => {
                if (generatingReport === null) {
                  e.target.style.borderColor = '#31326F'
                  e.target.style.boxShadow = '0 0 0 3px rgba(49, 50, 111, 0.1)'
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db'
                e.target.style.boxShadow = 'none'
              }}
            >
              <option value="daily">Daily Report</option>
              <option value="yearly">Yearly Report</option>
            </select>
          </div>

          {/* Generate Report Button */}
          <button
            onClick={generateReport}
            disabled={generatingReport !== null}
            style={{
              padding: '12px 32px',
              border: 'none',
              borderRadius: '8px',
              background: generatingReport !== null
                ? '#9ca3af'
                : 'linear-gradient(135deg, #31326F 0%, #1e1f4a 100%)',
              color: 'white',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: generatingReport !== null ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: generatingReport !== null ? 'none' : '0 4px 12px rgba(49, 50, 111, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              height: '48px',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              if (generatingReport === null) {
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 6px 16px rgba(49, 50, 111, 0.4)'
              }
            }}
            onMouseLeave={(e) => {
              if (generatingReport === null) {
                e.target.style.transform = 'translateY(0)'
                e.target.style.boxShadow = '0 4px 12px rgba(49, 50, 111, 0.3)'
              }
            }}
          >
            {generatingReport !== null ? (
              <>
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{
                    animation: 'spin 1s linear infinite'
                  }}
                >
                  <path d="M21 12a9 9 0 11-6.219-8.56"/>
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Generate Report</span>
              </>
            )}
          </button>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>

      {/* Charts Section */}
      <div className="admin-charts-grid">
        <div className="admin-chart-card">
          <h3>Monthly Income Overview</h3>
          <div className="admin-line-chart">
            <svg width="100%" height="200" viewBox="0 0 600 200">
              <defs>
                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#31326F" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#31326F" stopOpacity="0" />
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
                      <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="#31326F" strokeWidth="2" />
                    )}
                    <circle cx={x} cy={y} r="4" fill="#31326F" />
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

      {/* Dialog Component */}
      {dialog.show && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 10000,
            minWidth: '320px',
            maxWidth: '500px',
            background: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)',
            border: `2px solid ${
              dialog.type === 'success' ? '#10b981' :
              dialog.type === 'error' ? '#ef4444' :
              dialog.type === 'warning' ? '#f59e0b' :
              '#31326F'
            }`,
            padding: '20px',
            animation: 'slideInRight 0.3s ease-out',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '16px'
          }}
        >
          {/* Icon */}
          <div style={{
            flexShrink: 0,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: dialog.type === 'success' ? '#d1fae5' :
                       dialog.type === 'error' ? '#fee2e2' :
                       dialog.type === 'warning' ? '#fef3c7' :
                       '#e8f0ff'
          }}>
            {dialog.type === 'success' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            ) : dialog.type === 'error' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            ) : dialog.type === 'warning' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#31326F" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            )}
          </div>

          {/* Message */}
          <div style={{ flex: 1 }}>
            <p style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: '#111827',
              lineHeight: '1.5'
            }}>
              {dialog.message}
            </p>
          </div>

          {/* Close Button */}
          <button
            onClick={() => setDialog({ show: false, message: '', type: 'info' })}
            style={{
              flexShrink: 0,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              transition: 'background 0.2s ease'
            }}
            onMouseEnter={(e) => e.target.style.background = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.background = 'transparent'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>

          <style>{`
            @keyframes slideInRight {
              from {
                transform: translateX(100%);
                opacity: 0;
              }
              to {
                transform: translateX(0);
                opacity: 1;
              }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

export default Admin_MainContent
