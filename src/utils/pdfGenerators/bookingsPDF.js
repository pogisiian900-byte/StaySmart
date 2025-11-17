/**
 * PDF Generator for Bookings Reports
 * Handles both host and admin booking reports
 */

import jsPDF from 'jspdf'
import { addLogo, addHeader, addFooter, formatDate, formatCurrency, drawTableHeader, drawTableRow } from './commonPDF.js'

/**
 * Generate Bookings PDF Report
 * @param {Array} data - Array of booking objects
 * @param {Object} options - Report options
 * @param {boolean} options.isAdmin - Whether this is an admin report
 * @param {Object} options.dateRange - Date range object with startDate and endDate
 * @returns {Promise<jsPDF>} - jsPDF document instance
 */
export const generateBookingsPDF = async (data, options = {}) => {
  const {
    isAdmin = false,
    dateRange = {}
  } = options

  const doc = new jsPDF('landscape', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const lineHeight = 8
  const tableStartY = 60

  // Color scheme
  const colors = {
    primary: [49, 50, 111],
    primaryLight: [74, 77, 140],
    accent: [16, 185, 129],
    danger: [239, 68, 68],
    text: [31, 41, 55],
    textLight: [107, 114, 128]
  }

  // Add logo
  const logoAdded = await addLogo(doc, margin, 8)

  // Add header
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const title = isAdmin ? 'Admin Bookings Report' : 'Bookings Report'
  const subtitle = `Generated on: ${generatedDate}`
  const metadata = `Total Bookings: ${data.length}`

  addHeader(doc, {
    title,
    subtitle,
    metadata,
    margin,
    logoAdded,
    primaryColor: colors.primary
  })

  // Table headers with better column widths
  const headers = isAdmin
    ? ['ID', 'Listing', 'Host', 'Guest', 'Check-In', 'Check-Out', 'Nights', 'Status', 'Amount']
    : ['ID', 'Listing', 'Guest', 'Check-In', 'Check-Out', 'Nights', 'Status', 'Amount']

  // Improved column widths to prevent truncation
  const colWidths = isAdmin
    ? [24, 40, 34, 34, 30, 30, 16, 22, 28]
    : [30, 48, 40, 34, 34, 18, 24, 30]

  // Draw table header
  drawTableHeader(doc, headers, colWidths, margin, tableStartY, margin, pageWidth, colors.primary)

  // Table data
  let yPos = tableStartY + 6
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')

  // Helper function to truncate text intelligently
  const truncateText = (text, maxLength) => {
    if (!text) return 'N/A'
    const str = String(text)
    if (str.length <= maxLength) return str
    return str.substring(0, maxLength - 3) + '...'
  }

  data.forEach((booking, index) => {
    // Check for new page
    if (yPos > pageHeight - 40) {
      doc.addPage()
      yPos = margin + 15

      // Redraw headers on new page
      drawTableHeader(doc, headers, colWidths, margin, yPos, margin, pageWidth, colors.primary)
      yPos += 6
    }

    // Prepare row data with better truncation
    const totalAmount = booking.pricing?.total || 0
    const amountText = formatCurrency(totalAmount)

    // Format dates without truncation - use shorter format
    const checkInDate = formatDate(booking.checkIn)
    const checkOutDate = formatDate(booking.checkOut)

    const rowData = isAdmin
      ? [
          truncateText(booking.id, 12),
          truncateText(booking.listingTitle, 25),
          truncateText(booking.hostName, 20),
          truncateText(booking.guestName, 20),
          checkInDate,
          checkOutDate,
          String(booking.nights || 0),
          (booking.status || 'N/A').toUpperCase(),
          amountText
        ]
      : [
          truncateText(booking.id, 12),
          truncateText(booking.listingTitle, 28),
          truncateText(booking.guestName, 24),
          checkInDate,
          checkOutDate,
          String(booking.nights || 0),
          (booking.status || 'N/A').toUpperCase(),
          amountText
        ]

    // Determine status column and amount column indices
    const statusColumnIndex = isAdmin ? 7 : 6
    const amountColumnIndex = isAdmin ? 8 : 7
    const nightsColumnIndex = isAdmin ? 6 : 5

    // Draw row
    drawTableRow(doc, rowData, colWidths, margin, yPos, margin, pageWidth, lineHeight, index, {
      status: (booking.status || '').toLowerCase(),
      statusColumnIndex,
      amountColumnIndex,
      rightAlignColumns: [amountColumnIndex, nightsColumnIndex],
      centerAlignColumns: [nightsColumnIndex]
    })

    yPos += lineHeight + 0.5
  })

  // Calculate summary statistics
  const confirmedBookings = data.filter(b => b.status?.toLowerCase() === 'confirmed')
  const cancelledBookings = data.filter(b => b.status?.toLowerCase() === 'cancelled')
  const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
  const totalServiceFee = confirmedBookings.reduce((sum, b) => sum + (b.pricing?.serviceFee || 0), 0)

  // Add footer with summary
  const summaryLines = [
    `Total Bookings: ${data.length}  |  Confirmed: ${confirmedBookings.length}  |  Cancelled: ${cancelledBookings.length}`
  ]

  if (isAdmin && totalServiceFee > 0) {
    summaryLines.push(
      `Total Revenue: ${formatCurrency(totalRevenue)}`,
      `Total Service Fees: ${formatCurrency(totalServiceFee)}`
    )
  } else {
    summaryLines.push(`Total Revenue (Confirmed Only): ${formatCurrency(totalRevenue)}`)
  }

  addFooter(doc, {
    summaryLines,
    margin,
    primaryColor: colors.primary
  })

  return doc
}

