/**
 * PDF Generator for Reviews Reports
 * Handles admin reviews reports
 */

import jsPDF from 'jspdf'
import { addLogo, addHeader, addFooter, formatDate, drawTableHeader, drawTableRow } from './commonPDF.js'

/**
 * Generate Reviews PDF Report
 * @param {Array} data - Array of review objects
 * @param {Object} options - Report options
 * @param {Object} options.dateRange - Date range object with startDate and endDate
 * @returns {Promise<jsPDF>} - jsPDF document instance
 */
export const generateReviewsPDF = async (data, options = {}) => {
  const {
    dateRange = {}
  } = options

  const doc = new jsPDF('portrait', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const lineHeight = 9
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

  const title = 'Admin Reviews Report'
  const subtitle = `Generated on: ${generatedDate}`
  const metadata = `Total Reviews: ${data.length}`

  addHeader(doc, {
    title,
    subtitle,
    metadata,
    margin,
    logoAdded,
    primaryColor: colors.primary
  })

  // Table headers with improved column widths
  const headers = ['Listing', 'Host', 'Reviewer', 'Rating', 'Comment', 'Date']
  const colWidths = [48, 38, 32, 14, 52, 28]

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
    if (yPos > pageHeight - 30) {
      doc.addPage()
      yPos = margin + 15

      // Redraw headers on new page
      drawTableHeader(doc, headers, colWidths, margin, yPos, margin, pageWidth, colors.primary)
      yPos += 6
    }

    // Prepare row data with better truncation
    const comment = truncateText(review.comment, 50)
    const ratingStars = '⭐'.repeat(Math.min(5, Math.max(0, review.rating || 0)))
    const formattedDate = formatDate(review.timestamp)

    const rowData = [
      truncateText(review.listingTitle, 28),
      truncateText(review.hostName, 22),
      truncateText(review.userName, 18),
      ratingStars,
      comment,
      formattedDate
    ]

    // Draw row with center-aligned rating
    drawTableRow(doc, rowData, colWidths, margin, yPos, margin, pageWidth, lineHeight, index, {
      centerAlignColumns: [3] // Center align rating column
    })

    yPos += lineHeight + 0.5
  })

  // Calculate summary statistics
  const averageRating = data.length > 0
    ? (data.reduce((sum, r) => sum + (r.rating || 0), 0) / data.length).toFixed(1)
    : 0

  // Add footer
  addFooter(doc, {
    summary: `Average Rating: ${averageRating} ⭐`,
    margin,
    primaryColor: colors.primary
  })

  return doc
}

