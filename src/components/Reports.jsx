import React, { useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import Loading from './Loading'
import { generateBookingsPDF, generatePaymentsPDF } from '../utils/pdfGenerators'

const Reports = ({ hostId: propHostId }) => {
  const params = useParams()
  const hostId = propHostId || params.hostId
  const [listings, setListings] = useState([])
  const [bookings, setBookings] = useState([])
  const [allReviews, setAllReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState('bookings') // 'bookings' or 'payments'
  const [selectedListing, setSelectedListing] = useState('all')
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  const [generating, setGenerating] = useState(false)

  // Fetch listings for the host
  useEffect(() => {
    const fetchListings = async () => {
      if (!hostId) return
      try {
        const listingsQuery = query(
          collection(db, 'Listings'),
          where('hostId', '==', hostId)
        )
        const snapshot = await getDocs(listingsQuery)
        const listingsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        setListings(listingsData)
      } catch (error) {
        console.error('Error fetching listings:', error)
      }
    }
    fetchListings()
  }, [hostId])

  // Fetch bookings for the host
  useEffect(() => {
    const fetchBookings = async () => {
      if (!hostId) return
      try {
        const bookingsQuery = query(
          collection(db, 'Reservation'),
          where('hostId', '==', hostId)
        )
        const snapshot = await getDocs(bookingsQuery)
        const bookingsData = []
        
        // Fetch guest names for each booking
        for (const docSnap of snapshot.docs) {
          const bookingData = { id: docSnap.id, ...docSnap.data() }
          
          // Try to get guest name
          if (bookingData.guestId) {
            try {
              const guestRef = doc(db, 'Users', bookingData.guestId)
              const guestSnap = await getDoc(guestRef)
              if (guestSnap.exists()) {
                const guestData = guestSnap.data()
                bookingData.guestName = guestData.firstName 
                  ? `${guestData.firstName} ${guestData.lastName || ''}`.trim()
                  : guestData.email || 'Guest'
              } else {
                bookingData.guestName = 'Guest'
              }
            } catch (err) {
              console.error('Error fetching guest name:', err)
              bookingData.guestName = 'Guest'
            }
          } else {
            bookingData.guestName = 'Guest'
          }
          
          bookingsData.push(bookingData)
        }
        
        // Sort by createdAt desc
        const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
        bookingsData.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
        
        setBookings(bookingsData)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching bookings:', error)
        setLoading(false)
      }
    }
    fetchBookings()
  }, [hostId])

  // Fetch reviews for listings
  const fetchReviews = async (listingsToProcess) => {
    const reviewsData = []
    const listingsArray = listingsToProcess || listings
    console.log('Fetching reviews from listings:', listingsArray.length)
    
    for (const listing of listingsArray) {
      if (listing.ratings && Array.isArray(listing.ratings) && listing.ratings.length > 0) {
        console.log(`Listing ${listing.id} has ${listing.ratings.length} ratings`)
        for (const rating of listing.ratings) {
          // Handle timestamp - could be Firestore Timestamp or regular date
          let reviewTimestamp = rating.timestamp
          if (!reviewTimestamp) {
            // If no timestamp, use current date or skip
            console.warn('Rating without timestamp found:', rating)
            reviewTimestamp = new Date()
          } else if (reviewTimestamp.seconds !== undefined) {
            // Firestore Timestamp with seconds property
            reviewTimestamp = new Date(reviewTimestamp.seconds * 1000)
          } else if (reviewTimestamp.toDate && typeof reviewTimestamp.toDate === 'function') {
            // Firestore Timestamp object
            reviewTimestamp = reviewTimestamp.toDate()
          } else if (typeof reviewTimestamp === 'string' || typeof reviewTimestamp === 'number') {
            // String or number timestamp
            reviewTimestamp = new Date(reviewTimestamp)
          }
          
          reviewsData.push({
            listingId: listing.id,
            listingTitle: listing.title || listing.name || 'Untitled',
            userName: rating.userName || 'Anonymous',
            rating: Number(rating.rating) || 0,
            comment: rating.comment || '',
            timestamp: reviewTimestamp,
            userId: rating.userId || ''
          })
        }
      }
    }
    
    console.log('Total reviews fetched:', reviewsData.length)
    return reviewsData
  }

  // Fetch reviews when listings change
  useEffect(() => {
    const loadReviews = async () => {
      if (listings.length > 0) {
        const reviews = await fetchReviews(listings)
        setAllReviews(reviews)
        console.log('Reviews loaded into state:', reviews.length)
      } else {
        setAllReviews([])
      }
    }
    loadReviews()
  }, [listings])

  // Filter bookings based on criteria
  const filteredBookings = useMemo(() => {
    let filtered = bookings

    // Filter by listing
    if (selectedListing !== 'all') {
      filtered = filtered.filter(b => b.listingId === selectedListing)
    }

    // Filter by date range
    if (dateRange.startDate) {
      const startDate = new Date(dateRange.startDate)
      startDate.setHours(0, 0, 0, 0)
      filtered = filtered.filter(b => {
        const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        bookingDate.setHours(0, 0, 0, 0)
        return bookingDate >= startDate
      })
    }

    if (dateRange.endDate) {
      const endDate = new Date(dateRange.endDate)
      endDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter(b => {
        const bookingDate = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
        return bookingDate <= endDate
      })
    }

    return filtered
  }, [bookings, selectedListing, dateRange])

  // Format date helper
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A'
    const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Generate Bookings Report
  const generateBookingsReport = async () => {
    // Validate date range
    if (!dateRange.startDate || !dateRange.endDate) {
      alert('⚠️ Please select both Start Date and End Date before generating the report.')
      return
    }

    // Validate that end date is after start date
    if (new Date(dateRange.endDate) < new Date(dateRange.startDate)) {
      alert('⚠️ End Date must be after Start Date.')
      return
    }

    setGenerating(true)
    try {
      const pdf = await generateBookingsPDF(filteredBookings, {
        isAdmin: false,
        dateRange
      })
      pdf.save(`bookings-report-${new Date().toISOString().split('T')[0]}.pdf`)
      alert('✅ Bookings report generated successfully!')
    } catch (error) {
      console.error('Error generating bookings report:', error)
      alert('❌ Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Generate Payment & Transaction Report
  const generatePaymentsReport = async () => {
    // Validate date range
    if (!dateRange.startDate || !dateRange.endDate) {
      alert('⚠️ Please select both Start Date and End Date before generating the report.')
      return
    }

    // Validate that end date is after start date
    if (new Date(dateRange.endDate) < new Date(dateRange.startDate)) {
      alert('⚠️ End Date must be after Start Date.')
      return
    }

    setGenerating(true)
    try {
      // Use filtered bookings for payment transactions
      let filteredPayments = filteredBookings.filter(b => {
        // Only include confirmed bookings (completed transactions)
        return b.status?.toLowerCase() === 'confirmed' || b.status?.toLowerCase() === 'completed'
      })

      console.log('Filtered payments for PDF:', filteredPayments.length)
      
      if (filteredPayments.length === 0) {
        alert('⚠️ No payment transactions found for the selected filters. Please adjust your date range or filters.')
        setGenerating(false)
        return
      }

      const pdf = await generatePaymentsPDF(filteredPayments, {
        isAdmin: false,
        dateRange
      })
      pdf.save(`payments-report-${new Date().toISOString().split('T')[0]}.pdf`)
      alert(`✅ Payment & Transaction report generated successfully! (${filteredPayments.length} transactions)`)
    } catch (error) {
      console.error('Error generating payments report:', error)
      alert('❌ Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    if (reportType === 'bookings') {
      const total = filteredBookings.length
      const confirmed = filteredBookings.filter(b => b.status?.toLowerCase() === 'confirmed').length
      const pending = filteredBookings.filter(b => b.status?.toLowerCase() === 'pending').length
      const cancelled = filteredBookings.filter(b => b.status?.toLowerCase() === 'cancelled').length
      const totalRevenue = filteredBookings
        .filter(b => b.status?.toLowerCase() === 'confirmed')
        .reduce((sum, b) => sum + (b.pricing?.subtotal || 0), 0)
      
      return { total, confirmed, pending, cancelled, totalRevenue }
    } else {
      // For payments, calculate from filtered bookings (confirmed/completed only)
      const paymentBookings = filteredBookings.filter(b => {
        return b.status?.toLowerCase() === 'confirmed' || b.status?.toLowerCase() === 'completed'
      })
      
      const total = paymentBookings.length
      const totalRevenue = paymentBookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
      const totalServiceFees = paymentBookings.reduce((sum, b) => sum + (b.pricing?.serviceFee || 0), 0)
      const totalSubtotal = paymentBookings.reduce((sum, b) => sum + (b.pricing?.subtotal || 0), 0)
      
      return { total, totalRevenue, totalServiceFees, totalSubtotal }
    }
  }, [reportType, filteredBookings, allReviews, selectedListing, dateRange])

  if (loading) {
    return <Loading fullScreen message="Loading reports data..." />
  }

  // Get today's date in YYYY-MM-DD format for max date restriction
  const today = new Date().toISOString().split('T')[0]

  return (
    <div style={{
      padding: 'clamp(16px, 3vw, 32px)',
      fontFamily: '"Inter", sans-serif',
      maxWidth: '1400px',
      margin: '0 auto',
      background: '#f9fafb',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: 'clamp(20px, 4vw, 32px)',
        marginBottom: '32px',
        boxShadow: '0 20px 60px rgba(102, 126, 234, 0.25)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-10%',
          width: '300px',
          height: '300px',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: '50%',
          filter: 'blur(60px)'
        }}></div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{
            fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
            fontWeight: 800,
            margin: '0 0 12px 0',
            color: 'white',
            letterSpacing: '-0.5px'
          }}>
            📊 Reports & Analytics
          </h1>
          <p style={{
            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
            margin: 0,
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: 400
          }}>
            Generate comprehensive reports for bookings and payment transactions with detailed insights
          </p>
        </div>
      </div>

      {/* Report Type Selection */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '28px',
        marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <label style={{
          display: 'block',
          fontSize: '1rem',
          fontWeight: 700,
          color: '#111827',
          marginBottom: '16px',
          letterSpacing: '-0.3px'
        }}>
          Select Report Type
        </label>
        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setReportType('bookings')}
            style={{
              padding: '16px 28px',
              border: reportType === 'bookings' ? 'none' : '2px solid #e5e7eb',
              borderRadius: '12px',
              background: reportType === 'bookings' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : '#ffffff',
              color: reportType === 'bookings' ? 'white' : '#374151',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '1rem',
              boxShadow: reportType === 'bookings' 
                ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                : '0 2px 4px rgba(0, 0, 0, 0.05)',
              transform: reportType === 'bookings' ? 'translateY(-2px)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (reportType !== 'bookings') {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#667eea'
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
              }
            }}
            onMouseLeave={(e) => {
              if (reportType !== 'bookings') {
                e.target.style.background = '#ffffff'
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.transform = 'none'
                e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
              }
            }}
          >
            📊 Bookings Report
          </button>
          <button
            onClick={() => setReportType('payments')}
            style={{
              padding: '16px 28px',
              border: reportType === 'payments' ? 'none' : '2px solid #e5e7eb',
              borderRadius: '12px',
              background: reportType === 'payments' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : '#ffffff',
              color: reportType === 'payments' ? 'white' : '#374151',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              fontSize: '1rem',
              boxShadow: reportType === 'payments' 
                ? '0 4px 12px rgba(102, 126, 234, 0.3)' 
                : '0 2px 4px rgba(0, 0, 0, 0.05)',
              transform: reportType === 'payments' ? 'translateY(-2px)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (reportType !== 'payments') {
                e.target.style.background = '#f9fafb'
                e.target.style.borderColor = '#667eea'
                e.target.style.transform = 'translateY(-2px)'
                e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)'
              }
            }}
            onMouseLeave={(e) => {
              if (reportType !== 'payments') {
                e.target.style.background = '#ffffff'
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.transform = 'none'
                e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.05)'
              }
            }}
          >
            💳 Payment & Transaction Reports
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px'
        }}>
          <div style={{
            width: '4px',
            height: '24px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '2px'
          }}></div>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.3px'
          }}>
            Filters & Options
          </h3>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px'
        }}>
          {/* Listing Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '10px'
            }}>
              📋 Listing
            </label>
            <select
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer',
                background: 'white',
                transition: 'all 0.2s ease',
                fontWeight: 500
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            >
              <option value="all">All Listings</option>
              {listings.map(listing => (
                <option key={listing.id} value={listing.id}>
                  {listing.title || listing.name || 'Untitled'}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '10px'
            }}>
              📅 Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
              max={today}
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'white',
                transition: 'all 0.2s ease',
                fontWeight: 500
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>

          {/* End Date */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '10px'
            }}>
              📅 End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
              min={dateRange.startDate}
              max={today}
              style={{
                width: '100%',
                padding: '14px 18px',
                border: '2px solid #e5e7eb',
                borderRadius: '12px',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'white',
                transition: 'all 0.2s ease',
                fontWeight: 500
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
                e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
                e.target.style.boxShadow = 'none'
              }}
            />
          </div>
        </div>
      </div>

      {/* Statistics */}
      {reportType === 'bookings' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '28px'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(102, 126, 234, 0.1)',
            borderLeft: '5px solid #667eea',
            transition: 'all 0.3s ease',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(102, 126, 234, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(102, 126, 234, 0.1)'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '10px',
              fontWeight: 600
            }}>
              📊 Total Bookings
            </div>
            <div style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#667eea',
              lineHeight: '1.2'
            }}>
              {statistics.total}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(16, 185, 129, 0.1)',
            borderLeft: '5px solid #10b981',
            transition: 'all 0.3s ease',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(16, 185, 129, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.1)'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '10px',
              fontWeight: 600
            }}>
              ✅ Confirmed
            </div>
            <div style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#10b981',
              lineHeight: '1.2'
            }}>
              {statistics.confirmed}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.1)',
            borderLeft: '5px solid #f59e0b',
            transition: 'all 0.3s ease',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(245, 158, 11, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(245, 158, 11, 0.1)'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '10px',
              fontWeight: 600
            }}>
              ⏳ Pending
            </div>
            <div style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#f59e0b',
              lineHeight: '1.2'
            }}>
              {statistics.pending}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.1)',
            borderLeft: '5px solid #ef4444',
            transition: 'all 0.3s ease',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(239, 68, 68, 0.1)'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '10px',
              fontWeight: 600
            }}>
              ❌ Cancelled
            </div>
            <div style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#ef4444',
              lineHeight: '1.2'
            }}>
              {statistics.cancelled}
            </div>
          </div>

          <div style={{
            background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 16px rgba(139, 92, 246, 0.1)',
            borderLeft: '5px solid #8b5cf6',
            transition: 'all 0.3s ease',
            cursor: 'default'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(139, 92, 246, 0.15)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(139, 92, 246, 0.1)'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '10px',
              fontWeight: 600
            }}>
              💰 Total Revenue
            </div>
            <div style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#8b5cf6',
              lineHeight: '1.2'
            }}>
              ₱{statistics.totalRevenue.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Button */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <button
          onClick={reportType === 'bookings' ? generateBookingsReport : generatePaymentsReport}
          disabled={generating || !dateRange.startDate || !dateRange.endDate}
          style={{
            padding: '16px 32px',
            border: 'none',
            borderRadius: '12px',
            background: generating || !dateRange.startDate || !dateRange.endDate
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: generating || !dateRange.startDate || !dateRange.endDate ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: generating || !dateRange.startDate || !dateRange.endDate ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            if (!generating) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!generating) {
              e.target.style.transform = 'translateY(0)'
              e.target.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)'
            }
          }}
        >
          {generating ? (
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
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              `}</style>
              Generating...
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Generate {reportType === 'bookings' ? 'Bookings' : 'Payment & Transaction'} Report
            </>
          )}
        </button>
        <p style={{
          fontSize: '0.875rem',
          color: '#6b7280',
          marginTop: '12px',
          marginBottom: 0
        }}>
          Report will be downloaded as PDF file
        </p>
        {(!dateRange.startDate || !dateRange.endDate) && (
          <p style={{
            fontSize: '0.875rem',
            color: '#ef4444',
            marginTop: '8px',
            marginBottom: 0,
            fontWeight: 500
          }}>
            ⚠️ Please select both Start Date and End Date to generate the report
          </p>
        )}
      </div>
    </div>
  )
}

export default Reports

