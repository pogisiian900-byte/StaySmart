/**
 * PDF Generator for Booking Reviews Reports
 * Handles admin booking reviews reports from Wishlist collection
 */

import jsPDF from 'jspdf'
import { addLogo, addHeader, addFooter, formatDate, drawTableHeader, drawTableRow } from './commonPDF.js'

/**
 * Generate Booking Reviews PDF Report
 * @param {Array} data - Array of booking review objects from Wishlist
 * @param {Object} options - Report options
 * @param {Object} options.dateRange - Date range object with startDate and endDate
 * @returns {Promise<jsPDF>} - jsPDF document instance
 */
export const generateBookingReviewsPDF = async (data, options = {}) => {
  const {
    dateRange = {}
  } = options

  const doc = new jsPDF('portrait', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const lineHeight = 10
  const tableStartY = 60

  // Color scheme
  const colors = {
    primary: [49, 50, 111],
    primaryLight: [74, 77, 140],
    accent: [16, 185, 129],
    text: [31, 41, 55]
  }

  // Add logo
  const logoAdded = await addLogo(doc, margin, 8)

  // Add header
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const title = 'Admin Booking Reviews Report'
  const subtitle = `Generated on: ${generatedDate}`
  const metadata = `Total Booking Reviews: ${data.length}`

  addHeader(doc, {
    title,
    subtitle,
    metadata,
    margin,
    logoAdded,
    primaryColor: colors.primary
  })

  // Table headers with improved column widths
  const headers = ['Reservation ID', 'Guest', 'Host', 'Listing', 'Rating', 'Date']
  const colWidths = [30, 35, 35, 40, 15, 25]

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

  data.forEach((review, index) => {
    // Check for new page
    if (yPos > pageHeight - 50) {
      doc.addPage()
      yPos = margin + 15

      // Redraw headers on new page
      drawTableHeader(doc, headers, colWidths, margin, yPos, margin, pageWidth, colors.primary)
      yPos += 6
    }

    // Prepare row data
    const reservationId = truncateText(review.reservationId, 12)
    const guestName = truncateText(review.guestName, 20)
    const hostName = truncateText(review.hostName, 20)
    const listingTitle = truncateText(review.listingTitle, 25)
    
    // Ensure rating is a number and format it
    const ratingValue = Number(review.rating) || 0
    const clampedRating = Math.min(5, Math.max(0, ratingValue))
    const ratingDisplay = `${clampedRating.toFixed(1)}/5`
    
    const formattedDate = formatDate(review.createdAt || review.timestamp)

    const rowData = [
      reservationId,
      guestName,
      hostName,
      listingTitle,
      ratingDisplay,
      formattedDate
    ]

    // Draw row with center-aligned rating
    drawTableRow(doc, rowData, colWidths, margin, yPos, margin, pageWidth, lineHeight, index, {
      centerAlignColumns: [4] // Center align rating column
    })

    yPos += lineHeight + 1

    // Add review details below the row if available
    const hasDetails = review.serviceThoughts || review.improvements
    if (hasDetails && yPos < pageHeight - 40) {
      doc.setFontSize(7.5)
      doc.setTextColor(80, 80, 80)
      
      let detailY = yPos
      
      if (review.serviceThoughts) {
        const thoughts = truncateText(review.serviceThoughts, 80)
        doc.text(`Thoughts: ${thoughts}`, margin + 2, detailY)
        detailY += 4
      }
      
      if (review.improvements) {
        const improvements = truncateText(review.improvements, 80)
        doc.text(`Suggestions: ${improvements}`, margin + 2, detailY)
        detailY += 4
      }
      
      yPos = detailY + 2
      doc.setFontSize(8.5)
      doc.setTextColor(colors.text[0], colors.text[1], colors.text[2])
    }
  })

  // Calculate summary statistics
  const averageRating = data.length > 0
    ? (data.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / data.length).toFixed(1)
    : 0

  // Add footer
  addFooter(doc, {
    summary: `Average Rating: ${averageRating}/5 | Total Reviews: ${data.length}`,
    margin,
    primaryColor: colors.primary
  })

  return doc
}

