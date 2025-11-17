/**
 * PDF Generator for Payment & Transaction Reports
 * Handles both host and admin payment reports
 */

import jsPDF from 'jspdf'
import { addLogo, addHeader, addFooter, formatDate, formatCurrency, drawTableHeader, drawTableRow } from './commonPDF.js'

/**
 * Generate Payments PDF Report
 * @param {Array} data - Array of payment/booking objects
 * @param {Object} options - Report options
 * @param {boolean} options.isAdmin - Whether this is an admin report
 * @param {Object} options.dateRange - Date range object with startDate and endDate
 * @returns {Promise<jsPDF>} - jsPDF document instance
 */
export const generatePaymentsPDF = async (data, options = {}) => {
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

  const title = isAdmin ? 'Admin Payment & Transaction Report' : 'Payment & Transaction Report'
  const subtitle = `Generated on: ${generatedDate}`
  const metadata = `Total Transactions: ${data.length}`

  addHeader(doc, {
    title,
    subtitle,
    metadata,
    margin,
    logoAdded,
    primaryColor: colors.primary
  })

  // Table headers with improved column widths
  const headers = isAdmin
    ? ['Booking ID', 'Listing', 'Host', 'Guest', 'Amount', 'Service Fee', 'Total', 'Date', 'Status']
    : ['Booking ID', 'Listing', 'Guest', 'Amount', 'Service Fee', 'Total', 'Date', 'Status']

  // Improved column widths to prevent truncation
  const colWidths = isAdmin
    ? [22, 38, 32, 32, 26, 26, 26, 30, 20]
    : [28, 44, 36, 28, 28, 28, 32, 22]

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
    const serviceFee = booking.pricing?.serviceFee || 0
    const subtotal = booking.pricing?.subtotal || 0

    const amountText = formatCurrency(subtotal)
    const serviceFeeText = formatCurrency(serviceFee)
    const totalText = formatCurrency(totalAmount)

    const bookingDate = booking.createdAt?.toDate ? booking.createdAt.toDate() : new Date(booking.createdAt)
    const formattedDate = formatDate(bookingDate)

    const rowData = isAdmin
      ? [
          truncateText(booking.id, 12),
          truncateText(booking.listingTitle, 25),
          truncateText(booking.hostName, 20),
          truncateText(booking.guestName, 20),
          amountText,
          serviceFeeText,
          totalText,
          formattedDate,
          (booking.status || 'N/A').toUpperCase()
        ]
      : [
          truncateText(booking.id, 12),
          truncateText(booking.listingTitle, 28),
          truncateText(booking.guestName, 24),
          amountText,
          serviceFeeText,
          totalText,
          formattedDate,
          (booking.status || 'N/A').toUpperCase()
        ]

    // Determine column indices for right alignment
    const amountColumns = isAdmin ? [4, 5, 6] : [3, 4, 5]
    const statusColumnIndex = isAdmin ? 8 : 7

    // Draw row
    drawTableRow(doc, rowData, colWidths, margin, yPos, margin, pageWidth, lineHeight, index, {
      status: (booking.status || '').toLowerCase(),
      statusColumnIndex,
      rightAlignColumns: amountColumns
    })

    yPos += lineHeight + 0.5
  })

  // Calculate summary statistics
  const totalRevenue = data.reduce((sum, b) => sum + (b.pricing?.total || 0), 0)
  const totalServiceFees = data.reduce((sum, b) => sum + (b.pricing?.serviceFee || 0), 0)
  const totalSubtotal = data.reduce((sum, b) => sum + (b.pricing?.subtotal || 0), 0)

  // Add footer with summary
  const summaryLines = [
    `Total Revenue: ${formatCurrency(totalRevenue)}`,
    `Total Service Fees: ${formatCurrency(totalServiceFees)}`,
    `Total Subtotal: ${formatCurrency(totalSubtotal)}`
  ]

  addFooter(doc, {
    summaryLines,
    margin,
    primaryColor: colors.primary
  })

  return doc
}

