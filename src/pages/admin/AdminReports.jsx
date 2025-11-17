import React, { useEffect, useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore'
import { db } from '../../config/firebase'
import Loading from '../../components/Loading'
import { generateBookingsPDF, generatePaymentsPDF, generateReviewsPDF, generateBookingReviewsPDF } from '../../utils/pdfGenerators'

const AdminReports = () => {
  const [listings, setListings] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [reportType, setReportType] = useState('bookings') // 'bookings', 'reviews', 'bookingReviews', or 'payments'
  const [selectedListing, setSelectedListing] = useState('all')
  const [selectedHost, setSelectedHost] = useState('all')
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  const [generating, setGenerating] = useState(false)
  const [hosts, setHosts] = useState([])
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const calendarRef = useRef(null)
  const dateRangeButtonRef = useRef(null)
  const [calendarPosition, setCalendarPosition] = useState({ top: 0, left: 0 })
  const [selectingStart, setSelectingStart] = useState(true) // Track if selecting start or end date

  // Position calendar when it opens
  useEffect(() => {
    if (showCalendar && dateRangeButtonRef.current) {
      const rect = dateRangeButtonRef.current.getBoundingClientRect()
      setCalendarPosition({
        top: rect.bottom + window.scrollY - 5, // Moved up by reducing offset from 8 to -5 (13px up)
        left: rect.left + window.scrollX
      })
    }
  }, [showCalendar])

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        showCalendar &&
        calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        dateRangeButtonRef.current &&
        !dateRangeButtonRef.current.contains(event.target)
      ) {
        setShowCalendar(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showCalendar])

  // Helper function to format date as YYYY-MM-DD
  const formatDate = (date) => {
    if (!date) return ''
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = formatDate(today)

  // Fetch all listings
  useEffect(() => {
    const fetchListings = async () => {
      try {
        const listingsQuery = collection(db, 'Listings')
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
  }, [])

  // Fetch all hosts
  useEffect(() => {
    const fetchHosts = async () => {
      try {
        const usersQuery = collection(db, 'Users')
        const snapshot = await getDocs(usersQuery)
        const hostsData = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(user => user.role === 'host')
        setHosts(hostsData)
      } catch (error) {
        console.error('Error fetching hosts:', error)
      }
    }
    fetchHosts()
  }, [])

  // Fetch all bookings
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const bookingsQuery = collection(db, 'Reservation')
        const snapshot = await getDocs(bookingsQuery)
        const bookingsData = []
        
        // Fetch guest and host names for each booking
        for (const docSnap of snapshot.docs) {
          const bookingData = { id: docSnap.id, ...docSnap.data() }
          
          // Get guest name
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
              bookingData.guestName = 'Guest'
            }
          } else {
            bookingData.guestName = 'Guest'
          }

          // Get host name
          if (bookingData.hostId) {
            try {
              const hostRef = doc(db, 'Users', bookingData.hostId)
              const hostSnap = await getDoc(hostRef)
              if (hostSnap.exists()) {
                const hostData = hostSnap.data()
                bookingData.hostName = hostData.firstName 
                  ? `${hostData.firstName} ${hostData.lastName || ''}`.trim()
                  : hostData.email || 'Host'
              } else {
                bookingData.hostName = 'Host'
              }
            } catch (err) {
              bookingData.hostName = 'Host'
            }
          } else {
            bookingData.hostName = 'Host'
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
  }, [])

  // Fetch reviews for listings
  const fetchReviews = async () => {
    const reviewsData = []
    console.log('Fetching reviews from listings:', listings.length)
    
    for (const listing of listings) {
      if (listing.ratings && Array.isArray(listing.ratings) && listing.ratings.length > 0) {
        console.log(`Listing ${listing.id} has ${listing.ratings.length} ratings`)
        for (const rating of listing.ratings) {
          // Handle timestamp - could be Firestore Timestamp or regular date
          let reviewTimestamp = rating.timestamp
          if (!reviewTimestamp) {
            // If no timestamp, use current date or skip
            console.warn('Rating without timestamp found:', rating)
            reviewTimestamp = new Date()
          } else if (reviewTimestamp.seconds) {
            // Firestore Timestamp with seconds property
            reviewTimestamp = new Date(reviewTimestamp.seconds * 1000)
          } else if (reviewTimestamp.toDate) {
            // Firestore Timestamp object
            reviewTimestamp = reviewTimestamp.toDate()
          } else if (typeof reviewTimestamp === 'string' || typeof reviewTimestamp === 'number') {
            // String or number timestamp
            reviewTimestamp = new Date(reviewTimestamp)
          }
          
          reviewsData.push({
            listingId: listing.id,
            listingTitle: listing.title || listing.name || 'Untitled',
            hostId: listing.hostId,
            userName: rating.userName || rating.userName || 'Anonymous',
            rating: Number(rating.rating) || 0, // Ensure rating is a number
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

  // Filter listings by selected host
  const filteredListings = useMemo(() => {
    if (selectedHost === 'all') {
      return listings
    }
    return listings.filter(listing => listing.hostId === selectedHost)
  }, [listings, selectedHost])

  // Filter bookings based on criteria
  const filteredBookings = useMemo(() => {
    let filtered = bookings

    // Filter by host first
    if (selectedHost !== 'all') {
      filtered = filtered.filter(b => b.hostId === selectedHost)
    }

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
  }, [bookings, selectedListing, selectedHost, dateRange])

  // Reset listing selection when host changes if current listing doesn't belong to new host
  useEffect(() => {
    if (selectedHost !== 'all' && selectedListing !== 'all') {
      const listing = listings.find(l => l.id === selectedListing)
      if (listing && listing.hostId !== selectedHost) {
        setSelectedListing('all')
      }
    }
  }, [selectedHost, selectedListing, listings])

  // Format date helper for PDF display
  const formatDateForDisplay = (dateValue) => {
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
        isAdmin: true,
        dateRange
      })
      pdf.save(`admin-bookings-report-${new Date().toISOString().split('T')[0]}.pdf`)
      alert('✅ Bookings report generated successfully!')
    } catch (error) {
      console.error('Error generating bookings report:', error)
      alert('❌ Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Generate Reviews Report
  const generateReviewsReport = async () => {
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
      const reviews = await fetchReviews()
      
      let filteredReviews = reviews

      // Filter by host first
      if (selectedHost !== 'all') {
        filteredReviews = filteredReviews.filter(r => r.hostId === selectedHost)
      }

      // Filter by listing
      if (selectedListing !== 'all') {
        filteredReviews = filteredReviews.filter(r => r.listingId === selectedListing)
      }

      // Filter by date range
      if (dateRange.startDate) {
        const startDate = new Date(dateRange.startDate)
        startDate.setHours(0, 0, 0, 0)
        filteredReviews = filteredReviews.filter(r => {
          if (!r.timestamp) return false
          let reviewDate
          if (r.timestamp instanceof Date) {
            reviewDate = r.timestamp
          } else if (r.timestamp.toDate) {
            reviewDate = r.timestamp.toDate()
          } else if (r.timestamp.seconds) {
            reviewDate = new Date(r.timestamp.seconds * 1000)
          } else {
            reviewDate = new Date(r.timestamp)
          }
          reviewDate.setHours(0, 0, 0, 0)
          return reviewDate >= startDate
        })
      }

      if (dateRange.endDate) {
        const endDate = new Date(dateRange.endDate)
        endDate.setHours(23, 59, 59, 999)
        filteredReviews = filteredReviews.filter(r => {
          if (!r.timestamp) return false
          let reviewDate
          if (r.timestamp instanceof Date) {
            reviewDate = r.timestamp
          } else if (r.timestamp.toDate) {
            reviewDate = r.timestamp.toDate()
          } else if (r.timestamp.seconds) {
            reviewDate = new Date(r.timestamp.seconds * 1000)
          } else {
            reviewDate = new Date(r.timestamp)
          }
          return reviewDate <= endDate
        })
      }
      
      console.log('Filtered reviews after date range:', filteredReviews.length)

      // Get host names for reviews
      const reviewsWithHostNames = await Promise.all(
        filteredReviews.map(async (review) => {
          if (review.hostId) {
            try {
              const hostRef = doc(db, 'Users', review.hostId)
              const hostSnap = await getDoc(hostRef)
              if (hostSnap.exists()) {
                const hostData = hostSnap.data()
                review.hostName = hostData.firstName 
                  ? `${hostData.firstName} ${hostData.lastName || ''}`.trim()
                  : hostData.email || 'Host'
              } else {
                review.hostName = 'Host'
              }
            } catch (err) {
              review.hostName = 'Host'
            }
          } else {
            review.hostName = 'Host'
          }
          return review
        })
      )

      const pdf = await generateReviewsPDF(reviewsWithHostNames, {
        dateRange
      })
      pdf.save(`admin-reviews-report-${new Date().toISOString().split('T')[0]}.pdf`)
      alert('✅ Reviews report generated successfully!')
    } catch (error) {
      console.error('Error generating reviews report:', error)
      alert('❌ Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Fetch booking reviews from Wishlist collection
  const fetchBookingReviews = async () => {
    const bookingReviewsData = []
    try {
      // Fetch all wishlist entries (booking reviews)
      const wishlistSnapshot = await getDocs(collection(db, 'Wishlist'))
      
      for (const wishlistDoc of wishlistSnapshot.docs) {
        const wishlistData = { id: wishlistDoc.id, ...wishlistDoc.data() }
        
        // Get reservation details
        let reservationData = null
        if (wishlistData.reservationId) {
          try {
            const reservationRef = doc(db, 'Reservation', wishlistData.reservationId)
            const reservationSnap = await getDoc(reservationRef)
            if (reservationSnap.exists()) {
              reservationData = { id: reservationSnap.id, ...reservationSnap.data() }
            }
          } catch (err) {
            console.error('Error fetching reservation:', err)
          }
        }
        
        // Get guest information
        let guestName = 'Guest'
        if (wishlistData.guestId) {
          try {
            const guestRef = doc(db, 'Users', wishlistData.guestId)
            const guestSnap = await getDoc(guestRef)
            if (guestSnap.exists()) {
              const guestData = guestSnap.data()
              guestName = guestData.firstName 
                ? `${guestData.firstName} ${guestData.lastName || ''}`.trim()
                : guestData.emailAddress || 'Guest'
            }
          } catch (err) {
            console.error('Error fetching guest:', err)
          }
        }
        
        // Get host information from reservation
        let hostName = 'Host'
        let hostId = null
        if (reservationData?.hostId) {
          hostId = reservationData.hostId
          try {
            const hostRef = doc(db, 'Users', reservationData.hostId)
            const hostSnap = await getDoc(hostRef)
            if (hostSnap.exists()) {
              const hostData = hostSnap.data()
              hostName = hostData.firstName 
                ? `${hostData.firstName} ${hostData.lastName || ''}`.trim()
                : hostData.emailAddress || 'Host'
            }
          } catch (err) {
            console.error('Error fetching host:', err)
          }
        }
        
        // Get listing information
        let listingTitle = 'N/A'
        let listingId = null
        if (reservationData?.listingId) {
          listingId = reservationData.listingId
          try {
            const listingRef = doc(db, 'Listings', reservationData.listingId)
            const listingSnap = await getDoc(listingRef)
            if (listingSnap.exists()) {
              const listingData = listingSnap.data()
              listingTitle = listingData.title || listingData.name || 'Untitled'
            }
          } catch (err) {
            console.error('Error fetching listing:', err)
          }
        }
        
        bookingReviewsData.push({
          id: wishlistData.id,
          reservationId: wishlistData.reservationId || 'N/A',
          guestId: wishlistData.guestId,
          guestName: guestName,
          hostId: hostId,
          hostName: hostName,
          listingId: listingId,
          listingTitle: listingTitle,
          rating: Number(wishlistData.rating) || 0,
          serviceThoughts: wishlistData.serviceThoughts || '',
          improvements: wishlistData.improvements || '',
          createdAt: wishlistData.createdAt || wishlistData.timestamp,
          timestamp: wishlistData.createdAt || wishlistData.timestamp
        })
      }
      
      // Sort by createdAt descending
      const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
      bookingReviewsData.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      
      return bookingReviewsData
    } catch (error) {
      console.error('Error fetching booking reviews:', error)
      return []
    }
  }

  // Generate Booking Reviews Report
  const generateBookingReviewsReport = async () => {
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
      const bookingReviews = await fetchBookingReviews()
      
      let filteredReviews = bookingReviews

      // Filter by host first
      if (selectedHost !== 'all') {
        filteredReviews = filteredReviews.filter(r => r.hostId === selectedHost)
      }

      // Filter by listing
      if (selectedListing !== 'all') {
        filteredReviews = filteredReviews.filter(r => r.listingId === selectedListing)
      }

      // Filter by date range
      if (dateRange.startDate) {
        const startDate = new Date(dateRange.startDate)
        startDate.setHours(0, 0, 0, 0)
        filteredReviews = filteredReviews.filter(r => {
          if (!r.createdAt && !r.timestamp) return false
          let reviewDate
          const dateValue = r.createdAt || r.timestamp
          if (dateValue instanceof Date) {
            reviewDate = dateValue
          } else if (dateValue?.toDate) {
            reviewDate = dateValue.toDate()
          } else if (dateValue?.seconds) {
            reviewDate = new Date(dateValue.seconds * 1000)
          } else {
            reviewDate = new Date(dateValue)
          }
          reviewDate.setHours(0, 0, 0, 0)
          return reviewDate >= startDate
        })
      }

      if (dateRange.endDate) {
        const endDate = new Date(dateRange.endDate)
        endDate.setHours(23, 59, 59, 999)
        filteredReviews = filteredReviews.filter(r => {
          if (!r.createdAt && !r.timestamp) return false
          let reviewDate
          const dateValue = r.createdAt || r.timestamp
          if (dateValue instanceof Date) {
            reviewDate = dateValue
          } else if (dateValue?.toDate) {
            reviewDate = dateValue.toDate()
          } else if (dateValue?.seconds) {
            reviewDate = new Date(dateValue.seconds * 1000)
          } else {
            reviewDate = new Date(dateValue)
          }
          return reviewDate <= endDate
        })
      }
      
      console.log('Filtered booking reviews after date range:', filteredReviews.length)

      if (filteredReviews.length === 0) {
        alert('⚠️ No booking reviews found for the selected filters. Please adjust your date range or filters.')
        setGenerating(false)
        return
      }

      const pdf = await generateBookingReviewsPDF(filteredReviews, {
        dateRange
      })
      pdf.save(`admin-booking-reviews-report-${new Date().toISOString().split('T')[0]}.pdf`)
      alert(`✅ Booking Reviews report generated successfully! (${filteredReviews.length} reviews)`)
    } catch (error) {
      console.error('Error generating booking reviews report:', error)
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

      // Get host names for bookings
      const paymentsWithHostNames = await Promise.all(
        filteredPayments.map(async (booking) => {
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

      const pdf = await generatePaymentsPDF(paymentsWithHostNames, {
        isAdmin: true,
        dateRange
      })
      pdf.save(`admin-payments-report-${new Date().toISOString().split('T')[0]}.pdf`)
      alert(`✅ Payment & Transaction report generated successfully! (${paymentsWithHostNames.length} transactions)`)
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
        .reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
      const totalServiceFee = filteredBookings
        .filter(b => b.status?.toLowerCase() === 'confirmed')
        .reduce((sum, b) => sum + (b.pricing?.serviceFee || 0), 0)
      
      return { total, confirmed, pending, cancelled, totalRevenue, totalServiceFee }
    } else {
      return { total: 0, averageRating: 0 }
    }
  }, [reportType, filteredBookings])

  if (loading) {
    return <Loading fullScreen message="Loading reports data..." />
  }

  // Get today's date in YYYY-MM-DD format for max date restriction

  return (
    <div style={{
      padding: '24px',
      fontFamily: '"Inter", sans-serif',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 10px 40px rgba(102, 126, 234, 0.15)',
        color: 'white'
      }}>
        <h1 style={{
          fontSize: 'clamp(1.5rem, 4vw, 2rem)',
          fontWeight: 700,
          margin: '0 0 8px 0',
          color: 'white'
        }}>
          Reports & Analytics
        </h1>
        <p style={{
          fontSize: '0.95rem',
          margin: 0,
          color: 'rgba(255, 255, 255, 0.9)'
        }}>
          Generate comprehensive reports for all bookings, reviews, and booking reviews across the platform
        </p>
      </div>

      {/* Report Type Selection */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '12px'
        }}>
          Report Type
        </label>
        <div style={{
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <button
            onClick={() => setReportType('bookings')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '10px',
              background: reportType === 'bookings' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : '#f3f4f6',
              color: reportType === 'bookings' ? 'white' : '#374151',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.95rem'
            }}
            onMouseEnter={(e) => {
              if (reportType !== 'bookings') {
                e.target.style.background = '#e5e7eb'
              }
            }}
            onMouseLeave={(e) => {
              if (reportType !== 'bookings') {
                e.target.style.background = '#f3f4f6'
              }
            }}
          >
            📊 Bookings Report
          </button>
          <button
            onClick={() => setReportType('reviews')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '10px',
              background: reportType === 'reviews' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : '#f3f4f6',
              color: reportType === 'reviews' ? 'white' : '#374151',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.95rem'
            }}
            onMouseEnter={(e) => {
              if (reportType !== 'reviews') {
                e.target.style.background = '#e5e7eb'
              }
            }}
            onMouseLeave={(e) => {
              if (reportType !== 'reviews') {
                e.target.style.background = '#f3f4f6'
              }
            }}
          >
            ⭐ Reviews Report
          </button>
          <button
            onClick={() => setReportType('bookingReviews')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '10px',
              background: reportType === 'bookingReviews' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : '#f3f4f6',
              color: reportType === 'bookingReviews' ? 'white' : '#374151',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.95rem'
            }}
            onMouseEnter={(e) => {
              if (reportType !== 'bookingReviews') {
                e.target.style.background = '#e5e7eb'
              }
            }}
            onMouseLeave={(e) => {
              if (reportType !== 'bookingReviews') {
                e.target.style.background = '#f3f4f6'
              }
            }}
          >
            📝 Booking Reviews Report
          </button>
          <button
            onClick={() => setReportType('payments')}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '10px',
              background: reportType === 'payments' 
                ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' 
                : '#f3f4f6',
              color: reportType === 'payments' ? 'white' : '#374151',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontSize: '0.95rem'
            }}
            onMouseEnter={(e) => {
              if (reportType !== 'payments') {
                e.target.style.background = '#e5e7eb'
              }
            }}
            onMouseLeave={(e) => {
              if (reportType !== 'payments') {
                e.target.style.background = '#f3f4f6'
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
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        position: 'relative',
        zIndex: 1
      }}>
        <h3 style={{
          fontSize: '1.125rem',
          fontWeight: 600,
          color: '#111827',
          marginBottom: '20px'
        }}>
          Filters
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          {/* Host Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Host
            </label>
            <select
              value={selectedHost}
              onChange={(e) => setSelectedHost(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: 'pointer'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#667eea'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
              }}
            >
              <option value="all">All Hosts</option>
              {hosts.map(host => (
                <option key={host.id} value={host.id}>
                  {host.firstName ? `${host.firstName} ${host.lastName || ''}`.trim() : host.email || 'Host'}
                </option>
              ))}
            </select>
          </div>

          {/* Listing Filter */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Listing
            </label>
            <select
              value={selectedListing}
              onChange={(e) => setSelectedListing(e.target.value)}
              disabled={selectedHost !== 'all' && filteredListings.length === 0}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                outline: 'none',
                boxSizing: 'border-box',
                cursor: selectedHost !== 'all' && filteredListings.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedHost !== 'all' && filteredListings.length === 0 ? 0.6 : 1,
                background: selectedHost !== 'all' && filteredListings.length === 0 ? '#f3f4f6' : 'white'
              }}
              onFocus={(e) => {
                if (!(selectedHost !== 'all' && filteredListings.length === 0)) {
                  e.target.style.borderColor = '#667eea'
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e5e7eb'
              }}
            >
              <option value="all">
                {selectedHost !== 'all' 
                  ? filteredListings.length > 0 
                    ? `All Listings (${filteredListings.length})` 
                    : 'No Listings Available'
                  : 'All Listings'}
              </option>
              {filteredListings.map(listing => (
                <option key={listing.id} value={listing.id}>
                  {listing.title || listing.name || 'Untitled'}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range - Single Calendar Picker */}
          <div style={{ position: 'relative', gridColumn: 'span 2' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '8px'
            }}>
              Date Range
            </label>
            <div
              ref={dateRangeButtonRef}
              onClick={() => {
                setShowCalendar(true)
                setSelectingStart(true)
              }}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '10px',
                fontSize: '0.95rem',
                background: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#667eea'
                e.currentTarget.style.background = '#f9fafb'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb'
                e.currentTarget.style.background = 'white'
              }}
            >
              <span style={{ color: (dateRange.startDate || dateRange.endDate) ? '#1f2937' : '#9ca3af' }}>
                {dateRange.startDate && dateRange.endDate
                  ? `${new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(dateRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : dateRange.startDate
                  ? `Start: ${new Date(dateRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                  : 'Select date range'}
              </span>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
            </div>

            {/* Date Range Calendar */}
            {showCalendar && createPortal(
              <div 
                ref={calendarRef}
                style={{
                  position: 'fixed',
                  zIndex: 99999,
                  top: `${calendarPosition.top}px`,
                  left: `${calendarPosition.left}px`,
                  padding: '20px',
                  background: 'white',
                  borderRadius: '16px',
                  border: '2px solid #e5e7eb',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
                  width: '380px',
                  maxHeight: '90vh',
                  overflowY: 'auto'
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {/* Status indicator */}
                <div style={{
                  marginBottom: '16px',
                  padding: '10px',
                  background: selectingStart ? '#eff6ff' : '#f0fdf4',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: selectingStart ? '#2563eb' : '#16a34a'
                }}>
                  {selectingStart ? '📅 Select Start Date' : '📅 Select End Date'}
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '20px'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarMonth === 0) {
                        setCalendarMonth(11)
                        setCalendarYear(calendarYear - 1)
                      } else {
                        setCalendarMonth(calendarMonth - 1)
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: '#374151',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f3f4f6'
                    }}
                  >
                    ❮
                  </button>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: 700,
                    color: '#111827'
                  }}>
                    {new Date(calendarYear, calendarMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (calendarMonth === 11) {
                        setCalendarMonth(0)
                        setCalendarYear(calendarYear + 1)
                      } else {
                        setCalendarMonth(calendarMonth + 1)
                      }
                    }}
                    style={{
                      padding: '8px 12px',
                      background: '#f3f4f6',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '1.2rem',
                      color: '#374151',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f3f4f6'
                    }}
                  >
                    ❯
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} style={{
                      textAlign: 'center',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      padding: '8px 0'
                    }}>
                      {day}
                    </div>
                  ))}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: '8px'
                }}>
                  {(() => {
                    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay()
                    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
                    const days = []
                    
                    for (let i = 0; i < firstDay; i++) {
                      days.push(
                        <div key={`empty-${i}`} style={{ aspectRatio: '1', minHeight: '40px' }}></div>
                      )
                    }
                    
                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = formatDate(new Date(calendarYear, calendarMonth, day))
                      const dateObj = new Date(calendarYear, calendarMonth, day)
                      dateObj.setHours(0, 0, 0, 0)
                      const isPast = dateObj > today
                      const isStartDate = dateRange.startDate === dateStr
                      const isEndDate = dateRange.endDate === dateStr
                      const isInRange = dateRange.startDate && dateRange.endDate && 
                                        dateStr >= dateRange.startDate && dateStr <= dateRange.endDate
                      const isToday = day === today.getDate() && 
                                     calendarMonth === today.getMonth() && 
                                     calendarYear === today.getFullYear()
                      const isBeforeStart = !selectingStart && dateRange.startDate && dateStr < dateRange.startDate

                      days.push(
                        <div
                          key={day}
                          onClick={() => {
                            if (isPast || (!selectingStart && isBeforeStart)) return
                            
                            if (selectingStart) {
                              // Selecting start date
                              if (dateRange.endDate && dateStr > dateRange.endDate) {
                                // If new start is after end, clear end and set new start
                                setDateRange({ startDate: dateStr, endDate: '' })
                                setSelectingStart(false)
                              } else {
                                setDateRange(prev => ({ ...prev, startDate: dateStr }))
                                setSelectingStart(false) // Switch to selecting end date
                              }
                            } else {
                              // Selecting end date
                              if (dateStr < dateRange.startDate) {
                                // If end is before start, swap them
                                setDateRange({ startDate: dateStr, endDate: dateRange.startDate })
                                setShowCalendar(false)
                              } else {
                                setDateRange(prev => ({ ...prev, endDate: dateStr }))
                                setShowCalendar(false) // Close calendar when both dates are selected
                              }
                            }
                          }}
                          style={{
                            aspectRatio: '1',
                            minHeight: '40px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '8px',
                            cursor: isPast || (!selectingStart && isBeforeStart) ? 'not-allowed' : 'pointer',
                            background: isStartDate || isEndDate
                              ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                              : isInRange
                              ? '#e0e7ff'
                              : isPast || (!selectingStart && isBeforeStart)
                              ? '#f3f4f6'
                              : 'white',
                            color: isStartDate || isEndDate
                              ? 'white'
                              : isInRange
                              ? '#4338ca'
                              : isPast || (!selectingStart && isBeforeStart)
                              ? '#9ca3af'
                              : '#111827',
                            border: isStartDate || isEndDate
                              ? '2px solid #667eea'
                              : isInRange
                              ? '2px solid #a5b4fc'
                              : isPast || (!selectingStart && isBeforeStart)
                              ? '2px solid #d1d5db'
                              : '2px solid #e5e7eb',
                            fontWeight: isStartDate || isEndDate ? 700 : isInRange ? 600 : 500,
                            fontSize: '0.9rem',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (!isPast && !(!selectingStart && isBeforeStart) && !isStartDate && !isEndDate) {
                              e.target.style.background = isInRange ? '#c7d2fe' : '#f9fafb'
                              e.target.style.borderColor = '#667eea'
                              e.target.style.transform = 'scale(1.05)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isPast && !(!selectingStart && isBeforeStart) && !isStartDate && !isEndDate) {
                              e.target.style.background = isInRange ? '#e0e7ff' : 'white'
                              e.target.style.borderColor = isInRange ? '#a5b4fc' : '#e5e7eb'
                              e.target.style.transform = 'scale(1)'
                            }
                          }}
                        >
                          <span>{day}</span>
                          {isToday && !isStartDate && !isEndDate && (
                            <span style={{
                              fontSize: '0.65rem',
                              marginTop: '2px',
                              color: isInRange ? '#4338ca' : '#667eea',
                              fontWeight: 700
                            }}>
                              Today
                            </span>
                          )}
                        </div>
                      )
                    }
                    
                    return days
                  })()}
                </div>

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setDateRange({ startDate: '', endDate: '' })
                      setSelectingStart(true)
                    }}
                    style={{
                      padding: '10px 20px',
                      background: '#f3f4f6',
                      color: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#e5e7eb'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#f3f4f6'
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCalendar(false)}
                    style={{
                      padding: '10px 20px',
                      background: '#667eea',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#5568d3'
                      e.target.style.transform = 'translateY(-1px)'
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = '#667eea'
                      e.target.style.transform = 'translateY(0)'
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>,
              document.body
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      {reportType === 'bookings' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
          position: 'relative',
          zIndex: 1
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #667eea'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Total Bookings
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              {statistics.total}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Confirmed
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              {statistics.confirmed}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #f59e0b'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Pending
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              {statistics.pending}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #ef4444'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Cancelled
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              {statistics.cancelled}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #8b5cf6'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Total Revenue
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              ₱{statistics.totalRevenue.toLocaleString()}
            </div>
          </div>

          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            borderLeft: '4px solid #ec4899'
          }}>
            <div style={{
              fontSize: '0.875rem',
              color: '#6b7280',
              marginBottom: '8px'
            }}>
              Service Fees
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: '#111827'
            }}>
              ₱{statistics.totalServiceFee.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Generate Report Button */}
      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
        textAlign: 'center',
        position: 'relative',
        zIndex: 1
      }}>
        <button
          onClick={
            reportType === 'bookings' ? generateBookingsReport :
            reportType === 'reviews' ? generateReviewsReport :
            reportType === 'bookingReviews' ? generateBookingReviewsReport :
            generatePaymentsReport
          }
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
              Generate {
                reportType === 'bookings' ? 'Bookings' : 
                reportType === 'reviews' ? 'Reviews' : 
                reportType === 'bookingReviews' ? 'Booking Reviews' : 
                'Payment & Transaction'
              } Report
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

export default AdminReports

