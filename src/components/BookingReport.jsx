import React, { useEffect, useState, useMemo } from 'react'
import { collection, getDocs, query, where, doc, getDoc, or } from 'firebase/firestore'
import { db } from '../config/firebase'
import Loading from './Loading'
import { generateBookingsPDF } from '../utils/pdfGenerators'

const BookingReport = ({ hostId, admin = false }) => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  })
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState(null)

  // Fetch bookings (confirmed and cancelled only)
  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true)
        setError(null)

        let bookingsQuery
        if (hostId && !admin) {
          // For host: fetch only their bookings with confirmed or cancelled status
          // Note: Firestore 'in' queries work but have limitations with composite queries
          // We'll fetch and filter client-side to avoid index issues
          bookingsQuery = query(
            collection(db, 'Reservation'),
            where('hostId', '==', hostId)
          )
        } else {
          // For admin: fetch all bookings, then filter by status client-side
          bookingsQuery = collection(db, 'Reservation')
        }

        const snapshot = await getDocs(bookingsQuery)
        const bookingsData = []

        // Fetch guest and host names for each booking
        for (const docSnap of snapshot.docs) {
          const bookingData = { id: docSnap.id, ...docSnap.data() }

          // Filter by status - only confirmed and cancelled
          const status = (bookingData.status || '').toLowerCase()
          const isValidStatus = status === 'confirmed' || status === 'cancelled'
          
          if (isValidStatus) {
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
                console.error('Error fetching guest name:', err)
                bookingData.guestName = 'Guest'
              }
            } else {
              bookingData.guestName = 'Guest'
            }

            // Get host name (only for admin)
            if (admin && bookingData.hostId) {
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
                console.error('Error fetching host name:', err)
                bookingData.hostName = 'Host'
              }
            }
            
            bookingsData.push(bookingData)
          }
        }

        // Sort by createdAt desc
        const toMs = (v) => (v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (Date.parse(v) || 0)))
        bookingsData.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))

        setBookings(bookingsData)
      } catch (error) {
        console.error('Error fetching bookings:', error)
        setError('Failed to load bookings. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchBookings()
  }, [hostId, admin])

  // Filter bookings based on date range
  const filteredBookings = useMemo(() => {
    let filtered = bookings

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
  }, [bookings, dateRange])

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

  // Format date for display (short version)
  const formatDateShort = (dateValue) => {
    if (!dateValue) return 'N/A'
    const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Generate PDF Report
  const generatePDFReport = async () => {
    if (filteredBookings.length === 0) {
      alert('⚠️ No bookings found for the selected filters.')
      return
    }

    setGenerating(true)
    try {
      const pdf = await generateBookingsPDF(filteredBookings, {
        isAdmin: admin,
        dateRange
      })
      const filename = `booking-report-${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(filename)
      alert(`✅ Booking report generated successfully! (${filteredBookings.length} bookings)`)
    } catch (error) {
      console.error('Error generating PDF report:', error)
      alert('❌ Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // OLD SPECIALIZED PDF GENERATION REMOVED - Now using utility from pdfGenerators
  /*
  const _old_generatePDFReport = async () => {
    if (filteredBookings.length === 0) {
      alert('⚠️ No bookings found for the selected filters.')
      return
    }

    setGenerating(true)
    try {
      const doc = new jsPDF('landscape', 'mm', 'a4')
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      let yPos = 0
      const margin = 12
      const lineHeight = 8
      const tableStartY = 55
      
      // Color scheme - Modern professional palette
      const colors = {
        primary: [49, 50, 111],      // Dark blue-purple
        primaryLight: [74, 77, 140], // Lighter blue-purple
        accent: [16, 185, 129],      // Green for confirmed
        danger: [239, 68, 68],       // Red for cancelled
        text: [31, 41, 55],          // Dark gray text
        textLight: [107, 114, 128],  // Light gray text
        bgLight: [249, 250, 251],    // Light background
        bgConfirmed: [240, 253, 244], // Light green
        bgCancelled: [254, 242, 242], // Light red
        border: [229, 231, 235]      // Border gray
      }

      // Add logo
      let logoAdded = false
      try {
        const logoUrl = '/static/ss.png'
        const img = new Image()
        img.src = logoUrl
        await new Promise((resolve, reject) => {
          img.onload = () => {
            try {
              doc.addImage(img, 'PNG', margin, 8, 28, 10)
              logoAdded = true
              resolve()
            } catch (err) {
              reject(err)
            }
          }
          img.onerror = reject
          setTimeout(reject, 3000)
        })
      } catch (err) {
        console.log('Logo not loaded, continuing without it')
      }

      // Modern Header with gradient effect simulation
      doc.setFillColor(...colors.primary)
      doc.rect(0, 0, pageWidth, 50, 'F')
      
      // Decorative line at bottom of header
      doc.setDrawColor(...colors.primaryLight)
      doc.setLineWidth(0.5)
      doc.line(0, 50, pageWidth, 50)
      
      // White text on header
      doc.setTextColor(255, 255, 255)
      
      // Main title
      doc.setFontSize(24)
      doc.setFont('helvetica', 'bold')
      const titleX = logoAdded ? margin + 35 : margin
      doc.text('Booking Report', titleX, 22)
      
      // Subtitle
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(255, 255, 255)
      doc.text('Confirmed & Cancelled Reservations', titleX, 30)
      
      // Report metadata
      doc.setFontSize(9)
      doc.setTextColor(240, 240, 240)
      
      const generatedDate = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
      doc.text(`Generated: ${generatedDate}`, titleX, 38)

      if (dateRange.startDate && dateRange.endDate) {
        doc.text(`Period: ${formatDateShort(dateRange.startDate)} - ${formatDateShort(dateRange.endDate)}`, titleX, 44)
      }

      // Summary cards section
      const confirmedBookings = filteredBookings.filter(b => b.status?.toLowerCase() === 'confirmed')
      const cancelledBookings = filteredBookings.filter(b => b.status?.toLowerCase() === 'cancelled')
      const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
      
      yPos = 55
      
      // Summary boxes background
      doc.setFillColor(...colors.bgLight)
      doc.rect(margin, yPos, pageWidth - 2 * margin, 12, 'F')
      
      yPos += 3
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...colors.textLight)
      doc.text('SUMMARY', margin + 3, yPos)
      
      yPos += 4
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...colors.text)
      
      // Summary stats with colored indicators
      const summaryWidth = (pageWidth - 2 * margin - 6) / 4
      let summaryX = margin + 3
      
      // Total bookings
      doc.setFillColor(...colors.primary)
      doc.circle(summaryX + 1.5, yPos - 1, 1.5, 'F')
      doc.setTextColor(...colors.text)
      doc.text(`Total: ${filteredBookings.length}`, summaryX + 4, yPos)
      
      // Confirmed
      summaryX += summaryWidth
      doc.setFillColor(...colors.accent)
      doc.circle(summaryX + 1.5, yPos - 1, 1.5, 'F')
      doc.text(`Confirmed: ${confirmedBookings.length}`, summaryX + 4, yPos)
      
      // Cancelled
      summaryX += summaryWidth
      doc.setFillColor(...colors.danger)
      doc.circle(summaryX + 1.5, yPos - 1, 1.5, 'F')
      doc.text(`Cancelled: ${cancelledBookings.length}`, summaryX + 4, yPos)
      
      // Revenue
      summaryX += summaryWidth
      doc.setFillColor(139, 92, 246) // Purple
      doc.circle(summaryX + 1.5, yPos - 1, 1.5, 'F')
      doc.text(`Revenue: ₱${(totalRevenue / 1000).toFixed(1)}K`, summaryX + 4, yPos)
      
      // Table section
      yPos = tableStartY + 18
      
      // Table headers with modern styling
      const headers = admin 
        ? ['ID', 'Listing', 'Guest', 'Host', 'Check-In', 'Check-Out', 'Nights', 'Status', 'Amount']
        : ['ID', 'Listing', 'Guest', 'Check-In', 'Check-Out', 'Nights', 'Status', 'Amount']
      const colWidths = admin
        ? [24, 34, 27, 27, 28, 28, 16, 18, 32]
        : [26, 44, 36, 30, 30, 16, 20, 38]
      let xPos = margin

      // Header background
      doc.setFillColor(...colors.primary)
      doc.rect(margin, yPos - 7, pageWidth - 2 * margin, 10, 'F')
      
      // Header border
      doc.setDrawColor(...colors.primaryLight)
      doc.setLineWidth(0.3)
      doc.rect(margin, yPos - 7, pageWidth - 2 * margin, 10, 'D')
      
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      
      headers.forEach((header, i) => {
        const headerText = header === 'Amount' ? 'Amount (₱)' : header
        const textX = xPos + 4
        doc.text(headerText, textX, yPos - 1)
        xPos += colWidths[i]
      })

      // Table data with modern styling
      yPos = tableStartY + 28
      doc.setTextColor(...colors.text)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      
      filteredBookings.forEach((booking, index) => {
        // Check for new page
        if (yPos > pageHeight - 35) {
          doc.addPage()
          yPos = margin + 15
          
          // Redraw headers on new page
          doc.setFillColor(...colors.primary)
          doc.rect(margin, yPos - 7, pageWidth - 2 * margin, 10, 'F')
          doc.setDrawColor(...colors.primaryLight)
          doc.setLineWidth(0.3)
          doc.rect(margin, yPos - 7, pageWidth - 2 * margin, 10, 'D')
          doc.setTextColor(255, 255, 255)
          doc.setFont('helvetica', 'bold')
          doc.setFontSize(9)
          xPos = margin
          headers.forEach((header, i) => {
            const headerText = header === 'Amount' ? 'Amount (₱)' : header
            doc.text(headerText, xPos + 4, yPos - 1)
            xPos += colWidths[i]
          })
          yPos += 4
          doc.setTextColor(...colors.text)
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(8)
        }

        // Row background based on status
        const status = (booking.status || '').toLowerCase()
        if (status === 'confirmed') {
          doc.setFillColor(...colors.bgConfirmed)
        } else if (status === 'cancelled') {
          doc.setFillColor(...colors.bgCancelled)
        } else {
          // Alternating row background for other statuses
          if (index % 2 === 0) {
            doc.setFillColor(250, 250, 250)
          } else {
            doc.setFillColor(255, 255, 255)
          }
        }
        
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, lineHeight, 'F')
        
        // Row border
        doc.setDrawColor(...colors.border)
        doc.setLineWidth(0.2)
        doc.rect(margin, yPos - 5, pageWidth - 2 * margin, lineHeight, 'D')

        xPos = margin
        const totalAmount = booking.pricing?.total || 0
        const amountValue = totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        const amountText = `₱${amountValue}`
        
        const rowData = admin
          ? [
              (booking.id || 'N/A').substring(0, 8),
              (booking.listingTitle || 'N/A').substring(0, 22),
              (booking.guestName || 'Guest').substring(0, 20),
              (booking.hostName || 'Host').substring(0, 20),
              formatDateShort(booking.checkIn).substring(0, 11),
              formatDateShort(booking.checkOut).substring(0, 11),
              String(booking.nights || 0),
              (booking.status || 'N/A').toUpperCase().substring(0, 9),
              amountText
            ]
          : [
              (booking.id || 'N/A').substring(0, 8),
              (booking.listingTitle || 'N/A').substring(0, 28),
              (booking.guestName || 'Guest').substring(0, 24),
              formatDateShort(booking.checkIn).substring(0, 11),
              formatDateShort(booking.checkOut).substring(0, 11),
              String(booking.nights || 0),
              (booking.status || 'N/A').toUpperCase().substring(0, 9),
              amountText
            ]

        // Status color coding
        rowData.forEach((cell, i) => {
          const isStatusCol = admin ? i === 7 : i === 6
          const isAmountCol = admin ? i === 8 : i === 7
          
          if (isStatusCol) {
            // Color code status text
            if (status === 'confirmed') {
              doc.setTextColor(...colors.accent)
              doc.setFont('helvetica', 'bold')
            } else if (status === 'cancelled') {
              doc.setTextColor(...colors.danger)
              doc.setFont('helvetica', 'bold')
            } else {
              doc.setTextColor(...colors.text)
              doc.setFont('helvetica', 'normal')
            }
          } else if (isAmountCol) {
            doc.setTextColor(...colors.text)
            doc.setFont('helvetica', 'bold')
          } else {
            doc.setTextColor(...colors.text)
            doc.setFont('helvetica', 'normal')
          }
          
          if (isAmountCol) {
            const textWidth = doc.getTextWidth(String(cell))
            doc.text(String(cell), xPos + colWidths[i] - textWidth - 4, yPos - 1)
          } else {
            doc.text(String(cell), xPos + 4, yPos - 1)
          }
          xPos += colWidths[i]
        })

        yPos += lineHeight + 1
      })

      // Modern Footer with summary
      yPos = pageHeight - 28
      
      // Footer background
      doc.setFillColor(...colors.primary)
      doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 22, 'F')
      
      // Footer border
      doc.setDrawColor(...colors.primaryLight)
      doc.setLineWidth(0.5)
      doc.rect(margin, yPos - 3, pageWidth - 2 * margin, 22, 'D')
      
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      
      // Footer title
      doc.text('REPORT SUMMARY', margin + 4, yPos + 4)
      
      // Footer content
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(255, 255, 255)
      
      const footerLine1 = `Total Bookings: ${filteredBookings.length}  |  Confirmed: ${confirmedBookings.length}  |  Cancelled: ${cancelledBookings.length}`
      doc.text(footerLine1, margin + 4, yPos + 10)
      
      const footerLine2 = `Total Revenue (Confirmed Only): ₱${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      doc.text(footerLine2, margin + 4, yPos + 16)
      
      // Footer copyright
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(200, 200, 200)
      doc.text('© StaySmart - Booking Management System', pageWidth / 2, pageHeight - 5, { align: 'center' })

      // Save PDF
      const filename = `booking-report-${new Date().toISOString().split('T')[0]}.pdf`
      doc.save(filename)
      alert(`✅ Booking report generated successfully! (${filteredBookings.length} bookings)`)
    } catch (error) {
      console.error('Error generating PDF report:', error)
      alert('❌ Failed to generate report. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredBookings.length
    const confirmed = filteredBookings.filter(b => b.status?.toLowerCase() === 'confirmed').length
    const cancelled = filteredBookings.filter(b => b.status?.toLowerCase() === 'cancelled').length
    const totalRevenue = filteredBookings
      .filter(b => b.status?.toLowerCase() === 'confirmed')
      .reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
    
    return { total, confirmed, cancelled, totalRevenue }
  }, [filteredBookings])

  if (loading) {
    return <Loading fullScreen message="Loading booking report data..." />
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
            📋 Booking Report
          </h1>
          <p style={{
            fontSize: 'clamp(0.9rem, 2.5vw, 1.1rem)',
            margin: 0,
            color: 'rgba(255, 255, 255, 0.95)',
            fontWeight: 400
          }}>
            View all confirmed and cancelled reservations with detailed information
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          background: '#fee2e2',
          border: '2px solid #ef4444',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px',
          color: '#dc2626',
          fontWeight: 500
        }}>
          {error}
        </div>
      )}

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
          background: 'linear-gradient(135deg, #ffffff 0%, #fef2f2 100%)',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 4px 16px rgba(239, 68, 68, 0.1)',
          borderLeft: '5px solid #ef4444',
          transition: 'all 0.3s ease',
          cursor: 'default'
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

      {/* Bookings Table */}
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '32px',
        marginBottom: '28px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
        border: '1px solid #e5e7eb',
        overflowX: 'auto'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <h3 style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            color: '#111827',
            margin: 0,
            letterSpacing: '-0.3px'
          }}>
            Booking Details
          </h3>
          <div style={{
            fontSize: '0.875rem',
            color: '#6b7280',
            fontWeight: 500
          }}>
            {filteredBookings.length} {filteredBookings.length === 1 ? 'booking' : 'bookings'} found
          </div>
        </div>

        {filteredBookings.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '60px 20px',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📋</div>
            <p style={{ fontSize: '1.1rem', fontWeight: 500, margin: 0 }}>
              No bookings found for the selected filters.
            </p>
            <p style={{ fontSize: '0.9rem', marginTop: '8px', margin: 0 }}>
              Try adjusting your date range or check back later.
            </p>
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}>
            <thead>
              <tr style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white'
              }}>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  borderTopLeftRadius: '8px'
                }}>ID</th>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>Listing</th>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>Guest</th>
                {admin && (
                  <th style={{
                    padding: '14px 12px',
                    textAlign: 'left',
                    fontWeight: 600,
                    fontSize: '0.875rem'
                  }}>Host</th>
                )}
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>Check-In</th>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>Check-Out</th>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>Nights</th>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'left',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}>Status</th>
                <th style={{
                  padding: '14px 12px',
                  textAlign: 'right',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  borderTopRightRadius: '8px'
                }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((booking, index) => {
                const isConfirmed = booking.status?.toLowerCase() === 'confirmed'
                const isCancelled = booking.status?.toLowerCase() === 'cancelled'
                return (
                  <tr 
                    key={booking.id}
                    style={{
                      background: isConfirmed ? '#f0fdf4' : isCancelled ? '#fef2f2' : '#ffffff',
                      borderBottom: '1px solid #e5e7eb',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isConfirmed ? '#ecfdf5' : isCancelled ? '#fee2e2' : '#f9fafb'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isConfirmed ? '#f0fdf4' : isCancelled ? '#fef2f2' : '#ffffff'
                    }}
                  >
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151',
                      fontFamily: 'monospace'
                    }}>{booking.id.substring(0, 8)}...</td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151',
                      fontWeight: 500
                    }}>{booking.listingTitle || 'N/A'}</td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151'
                    }}>{booking.guestName || 'Guest'}</td>
                    {admin && (
                      <td style={{
                        padding: '14px 12px',
                        fontSize: '0.875rem',
                        color: '#374151'
                      }}>{booking.hostName || 'Host'}</td>
                    )}
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151'
                    }}>{formatDateShort(booking.checkIn)}</td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151'
                    }}>{formatDateShort(booking.checkOut)}</td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151',
                      textAlign: 'center'
                    }}>{booking.nights || 0}</td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem'
                    }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        borderRadius: '12px',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        background: isConfirmed ? '#d1fae5' : isCancelled ? '#fee2e2' : '#f3f4f6',
                        color: isConfirmed ? '#065f46' : isCancelled ? '#991b1b' : '#374151'
                      }}>
                        {booking.status || 'N/A'}
                      </span>
                    </td>
                    <td style={{
                      padding: '14px 12px',
                      fontSize: '0.875rem',
                      color: '#374151',
                      textAlign: 'right',
                      fontWeight: 600
                    }}>
                      ₱{(booking.pricing?.total || 0).toLocaleString('en-US', { 
                        minimumFractionDigits: 2, 
                        maximumFractionDigits: 2 
                      })}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

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
          onClick={generatePDFReport}
          disabled={generating || filteredBookings.length === 0}
          style={{
            padding: '16px 32px',
            border: 'none',
            borderRadius: '12px',
            background: generating || filteredBookings.length === 0
              ? '#9ca3af' 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: generating || filteredBookings.length === 0 ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: generating || filteredBookings.length === 0 ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px'
          }}
          onMouseEnter={(e) => {
            if (!generating && filteredBookings.length > 0) {
              e.target.style.transform = 'translateY(-2px)'
              e.target.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)'
            }
          }}
          onMouseLeave={(e) => {
            if (!generating && filteredBookings.length > 0) {
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
              Generate PDF Report
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
        {filteredBookings.length === 0 && (
          <p style={{
            fontSize: '0.875rem',
            color: '#ef4444',
            marginTop: '8px',
            marginBottom: 0,
            fontWeight: 500
          }}>
            ⚠️ No bookings found to generate report
          </p>
        )}
      </div>
    </div>
  )
}

export default BookingReport

