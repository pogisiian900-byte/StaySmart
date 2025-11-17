/**
 * Common PDF utilities for shared functionality
 * Used across all PDF report generators
 */

/**
 * Add logo to PDF document
 * @param {jsPDF} doc - jsPDF document instance
 * @param {number} margin - Left margin in mm
 * @param {number} yPos - Y position in mm
 * @returns {Promise<boolean>} - Whether logo was successfully added
 */
export const addLogo = async (doc, margin = 15, yPos = 8) => {
  try {
    const logoUrl = '/static/ss.png'
    const img = new Image()
    img.src = logoUrl
    await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          doc.addImage(img, 'PNG', margin, yPos, 25, 8)
          resolve()
        } catch (err) {
          reject(err)
        }
      }
      img.onerror = reject
      setTimeout(reject, 3000)
    })
    return true
  } catch (err) {
    console.log('Logo not loaded, continuing without it')
    return false
  }
}

/**
 * Add modern header to PDF document
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Object} options - Header options
 * @param {string} options.title - Main title
 * @param {string} options.subtitle - Subtitle (optional)
 * @param {string} options.metadata - Additional metadata (optional)
 * @param {number} options.margin - Left margin in mm
 * @param {boolean} options.logoAdded - Whether logo was added
 * @param {Array<number>} options.primaryColor - RGB color array [r, g, b]
 */
export const addHeader = (doc, options = {}) => {
  const {
    title = 'Report',
    subtitle = '',
    metadata = '',
    margin = 15,
    logoAdded = false,
    primaryColor = [49, 50, 111] // Default dark blue-purple
  } = options

  const pageWidth = doc.internal.pageSize.getWidth()
  const headerHeight = 50

  // Header background with gradient effect
  doc.setFillColor(...primaryColor)
  doc.rect(0, 0, pageWidth, headerHeight, 'F')

  // Decorative line at bottom of header
  const lightColor = primaryColor.map(c => Math.min(255, c + 30))
  doc.setDrawColor(...lightColor)
  doc.setLineWidth(0.5)
  doc.line(0, headerHeight, pageWidth, headerHeight)

  // White text on header
  doc.setTextColor(255, 255, 255)

  // Main title
  const titleX = logoAdded ? margin + 35 : margin
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(title, titleX, 22)

  // Subtitle
  if (subtitle) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(subtitle, titleX, 30)
  }

  // Metadata
  if (metadata) {
    doc.setFontSize(9)
    doc.setTextColor(240, 240, 240)
    doc.text(metadata, titleX, subtitle ? 38 : 30)
  }

  return headerHeight
}

/**
 * Add footer to PDF document
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Object} options - Footer options
 * @param {string} options.summary - Summary text (optional)
 * @param {Array<string>} options.summaryLines - Array of summary lines (optional)
 * @param {number} options.margin - Left margin in mm
 * @param {Array<number>} options.primaryColor - RGB color array [r, g, b]
 */
export const addFooter = (doc, options = {}) => {
  const {
    summary = '',
    summaryLines = [],
    margin = 15,
    primaryColor = [49, 50, 111]
  } = options

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const footerHeight = summaryLines.length > 0 ? 25 : 15
  let yPos = pageHeight - footerHeight

  // Footer background
  doc.setFillColor(...primaryColor)
  doc.rect(margin, yPos - 3, pageWidth - 2 * margin, footerHeight, 'F')

  // Footer border
  const lightColor = primaryColor.map(c => Math.min(255, c + 30))
  doc.setDrawColor(...lightColor)
  doc.setLineWidth(0.5)
  doc.rect(margin, yPos - 3, pageWidth - 2 * margin, footerHeight, 'D')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)

  // Footer title
  if (summaryLines.length > 0 || summary) {
    doc.text('REPORT SUMMARY', margin + 4, yPos + 4)
  }

  // Footer content
  if (summaryLines.length > 0) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    summaryLines.forEach((line, index) => {
      doc.text(line, margin + 4, yPos + 10 + (index * 6))
    })
  } else if (summary) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(summary, margin + 4, yPos + 10)
  }

  // Footer copyright
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 200, 200)
  doc.text('© StaySmart - Booking Management System', pageWidth / 2, pageHeight - 5, { align: 'center' })
}

/**
 * Format date for display
 * @param {Date|Timestamp|string} dateValue - Date value
 * @param {boolean} includeTime - Whether to include time
 * @param {boolean} shortFormat - Use shorter format (MMM DD, YY) for tables
 * @returns {string} - Formatted date string
 */
export const formatDate = (dateValue, includeTime = false, shortFormat = false) => {
  if (!dateValue) return 'N/A'
  const date = dateValue?.toDate ? dateValue.toDate() : new Date(dateValue)
  
  if (includeTime) {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
  
  if (shortFormat) {
    // Shorter format for tables: "Nov 18, 2025"
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default: 'PHP')
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount, currency = 'PHP') => {
  const value = parseFloat(amount) || 0
  return `${currency} ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Draw table header row
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Array<string>} headers - Array of header labels
 * @param {Array<number>} colWidths - Array of column widths
 * @param {number} xPos - Starting X position
 * @param {number} yPos - Y position
 * @param {number} margin - Left margin
 * @param {number} pageWidth - Page width
 * @param {Array<number>} primaryColor - RGB color array [r, g, b]
 */
export const drawTableHeader = (doc, headers, colWidths, xPos, yPos, margin, pageWidth, primaryColor = [49, 50, 111]) => {
  const headerHeight = 11
  const headerTop = yPos - headerHeight + 1

  // Header background with better styling
  doc.setFillColor(...primaryColor)
  doc.rect(margin, headerTop, pageWidth - 2 * margin, headerHeight, 'F')

  // Header border - all sides
  const lightColor = primaryColor.map(c => Math.min(255, c + 30))
  doc.setDrawColor(...lightColor)
  doc.setLineWidth(0.5)
  doc.rect(margin, headerTop, pageWidth - 2 * margin, headerHeight, 'D')

  // Draw vertical lines between columns (white lines for separation)
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.3)
  let currentX = margin
  for (let i = 0; i < colWidths.length - 1; i++) {
    currentX += colWidths[i]
    doc.line(currentX, headerTop, currentX, headerTop + headerHeight)
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)

  currentX = margin
  headers.forEach((header, i) => {
    const headerText = header === 'Amount' ? 'Amount (PHP)' : header
    // Center align text in header cells
    const cellCenter = currentX + colWidths[i] / 2
    doc.text(headerText, cellCenter, yPos - 3, { align: 'center' })
    currentX += colWidths[i]
  })
}

/**
 * Draw table row with alternating colors
 * @param {jsPDF} doc - jsPDF document instance
 * @param {Array} rowData - Array of cell values
 * @param {Array<number>} colWidths - Array of column widths
 * @param {number} xPos - Starting X position
 * @param {number} yPos - Y position
 * @param {number} margin - Left margin
 * @param {number} pageWidth - Page width
 * @param {number} lineHeight - Row height
 * @param {number} index - Row index (for alternating colors)
 * @param {Object} options - Additional options
 */
export const drawTableRow = (doc, rowData, colWidths, xPos, yPos, margin, pageWidth, lineHeight, index, options = {}) => {
  const {
    rowColors = {
      even: [249, 250, 251],
      odd: [255, 255, 255],
      confirmed: [240, 253, 244],
      cancelled: [254, 242, 242]
    },
    status = '',
    rightAlignColumns = [],
    centerAlignColumns = [],
    statusColumnIndex = -1,
    amountColumnIndex = -1
  } = options

  const cellPadding = 5
  const rowTop = yPos - lineHeight + 2

  // Row background
  let bgColor
  if (status === 'confirmed') {
    bgColor = rowColors.confirmed
  } else if (status === 'cancelled') {
    bgColor = rowColors.cancelled
  } else {
    bgColor = index % 2 === 0 ? rowColors.even : rowColors.odd
  }

  doc.setFillColor(...bgColor)
  doc.rect(margin, rowTop, pageWidth - 2 * margin, lineHeight, 'F')

  // Row border - all sides
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.3)
  doc.rect(margin, rowTop, pageWidth - 2 * margin, lineHeight, 'D')

  // Draw vertical lines between columns for better separation
  doc.setDrawColor(229, 231, 235)
  doc.setLineWidth(0.2)
  let currentX = margin
  for (let i = 0; i < colWidths.length - 1; i++) {
    currentX += colWidths[i]
    doc.line(currentX, rowTop, currentX, rowTop + lineHeight)
  }

  // Draw cells
  currentX = margin
  rowData.forEach((cell, i) => {
    const isStatusCol = i === statusColumnIndex
    const isAmountCol = i === amountColumnIndex || rightAlignColumns.includes(i)
    const isCenterCol = centerAlignColumns.includes(i)

    // Set text color and style based on column type
    if (isStatusCol) {
      if (status === 'confirmed') {
        doc.setTextColor(16, 185, 129)
        doc.setFont('helvetica', 'bold')
      } else if (status === 'cancelled') {
        doc.setTextColor(239, 68, 68)
        doc.setFont('helvetica', 'bold')
      } else {
        doc.setTextColor(31, 41, 55)
        doc.setFont('helvetica', 'normal')
      }
    } else if (isAmountCol) {
      doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'normal')
    }

    // Draw text with proper alignment
    const cellText = String(cell)
    if (isAmountCol || rightAlignColumns.includes(i)) {
      // Right align
      const textWidth = doc.getTextWidth(cellText)
      doc.text(cellText, currentX + colWidths[i] - cellPadding, yPos - 1, { align: 'right' })
    } else if (isCenterCol) {
      // Center align
      doc.text(cellText, currentX + colWidths[i] / 2, yPos - 1, { align: 'center' })
    } else {
      // Left align
      doc.text(cellText, currentX + cellPadding, yPos - 1)
    }

    currentX += colWidths[i]
  })
}

