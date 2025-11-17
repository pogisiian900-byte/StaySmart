/**
 * PDF Generator for Policy/Terms and Conditions
 */

import jsPDF from 'jspdf'
import { addLogo, addHeader, addFooter } from './commonPDF.js'

/**
 * Generate Policy PDF
 * @param {string} policyText - The policy text content
 * @returns {Promise<jsPDF>} - jsPDF document instance
 */
export const generatePolicyPDF = async (policyText) => {
  if (!policyText || !policyText.trim()) {
    throw new Error('Policy text is required to generate PDF')
  }

  const doc = new jsPDF('portrait', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const lineHeight = 7
  const contentStartY = 50

  // Color scheme
  const colors = {
    primary: [49, 50, 111],
    primaryLight: [74, 77, 140]
  }

  // Add logo
  const logoAdded = await addLogo(doc, margin, 8)

  // Add header
  const generatedDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  addHeader(doc, {
    title: 'Terms and Conditions',
    subtitle: 'StaySmart Platform',
    metadata: `Generated on ${generatedDate}`,
    margin,
    logoAdded,
    primaryColor: colors.primary
  })

  // Set text color and font for content
  doc.setTextColor(31, 41, 55)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  // Split policy text into paragraphs
  const paragraphs = policyText.split(/\n\n+/).filter(p => p.trim())
  let yPos = contentStartY

  paragraphs.forEach((paragraph, paraIndex) => {
    const lines = paragraph.trim().split('\n')
    
    lines.forEach((line, lineIndex) => {
      // Check if line starts with a number (section header)
      const isHeader = /^\d+\./.test(line.trim())
      
      if (isHeader) {
        // Section header styling
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(12)
        doc.setTextColor(...colors.primary)
      } else {
        // Regular text styling
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(10)
        doc.setTextColor(31, 41, 55)
      }

      // Check if we need a new page
      if (yPos > pageHeight - 30) {
        doc.addPage()
        yPos = margin + 10
        
        // Add header to new page
        addHeader(doc, {
          title: 'Terms and Conditions',
          subtitle: 'StaySmart Platform',
          metadata: `Generated on ${generatedDate}`,
          margin,
          logoAdded: false,
          primaryColor: colors.primary
        })
        yPos = contentStartY
      }

      // Split long lines into multiple lines if needed
      const maxWidth = pageWidth - 2 * margin
      const splitLines = doc.splitTextToSize(line.trim(), maxWidth)
      
      splitLines.forEach((splitLine, splitIndex) => {
        // Check if we need a new page before adding this line
        if (yPos > pageHeight - 30) {
          doc.addPage()
          yPos = margin + 10
          
          // Add header to new page
          addHeader(doc, {
            title: 'Terms and Conditions',
            subtitle: 'StaySmart Platform',
            metadata: `Generated on ${generatedDate}`,
            margin,
            logoAdded: false,
            primaryColor: colors.primary
          })
          yPos = contentStartY
        }
        
        doc.text(splitLine, margin, yPos)
        yPos += lineHeight + (splitIndex < splitLines.length - 1 ? 0 : (isHeader ? 3 : 2))
      })
    })

    // Add extra space after paragraphs
    if (paraIndex < paragraphs.length - 1) {
      yPos += 4
    }
  })

  // Add footer
  addFooter(doc, {
    summary: 'This document contains the official Terms and Conditions for the StaySmart platform.',
    margin,
    primaryColor: colors.primary
  })

  return doc
}

