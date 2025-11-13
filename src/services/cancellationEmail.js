import emailjs from 'emailjs-com'

// EmailJS Configuration for Cancellation Emails
// NOTE: This uses a DIFFERENT service template and public key than confirmation emails
const CANCELLATION_EMAILJS_CONFIG = {
  serviceId: 'service_400q9zk', // Your EmailJS Service ID (can be same or different)
  templateId: 'template_h7zbzij', // ⚠️ UPDATE THIS with your cancellation template ID
  publicKey: 'O_2qRNxx6nQ8FWjZ8' // ⚠️ UPDATE THIS with your cancellation public key
}

/**
 * Helper function to sanitize strings for EmailJS
 * EmailJS doesn't like null, undefined, or special characters
 */
const sanitizeString = (str) => {
  if (!str) return ''
  // Convert to string, remove null/undefined, trim whitespace
  return String(str).trim().replace(/\0/g, '') || ''
}

/**
 * Helper function to format currency safely
 */
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return 'PHP 0'
  const num = typeof amount === 'number' ? amount : parseFloat(amount) || 0
  return `PHP ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Send cancellation email to guest when booking is cancelled
 * 
 * @param {Object} reservationData - The reservation data object
 * @param {string} reservationData.guestId - Guest user ID
 * @param {string} reservationData.listingTitle - Title of the listing
 * @param {string|Date} reservationData.checkIn - Check-in date
 * @param {string|Date} reservationData.checkOut - Check-out date
 * @param {number} reservationData.nights - Number of nights
 * @param {Object} reservationData.pricing - Pricing information
 * @param {number} reservationData.pricing.total - Total amount
 * @param {string} reservationId - Reservation document ID
 * @param {Object} guestData - Guest user data from Firestore
 * @param {string} guestData.emailAddress - Guest email address
 * @param {string} guestData.firstName - Guest first name
 * @param {string} guestData.lastName - Guest last name
 * 
 * @returns {Promise<{success: boolean, email: string}>}
 */
export const sendCancellationEmail = async (reservationData, reservationId, guestData) => {
  try {
    // Try multiple possible email field names
    const guestEmail = guestData?.emailAddress || guestData?.email || guestData?.userEmail || ''
    const guestName = `${guestData?.firstName || ''} ${guestData?.lastName || ''}`.trim() || 'Guest'
    
    console.log('Guest data for cancellation email:', {
      guestId: reservationData.guestId,
      emailAddress: guestData?.emailAddress,
      email: guestData?.email,
      guestEmail: guestEmail,
      guestName: guestName
    })
    
    if (!guestEmail || guestEmail.trim() === '' || !guestEmail.includes('@')) {
      console.error('❌ Email is empty or invalid! Cannot send cancellation email.')
      console.error('Guest data:', {
        guestId: reservationData.guestId,
        guestEmail: guestEmail,
        guestName: guestName,
        allGuestData: guestData
      })
      return { success: false, email: guestEmail, error: 'Invalid email address' }
    }
    
    // Format dates for email
    const checkInDate = new Date(reservationData.checkIn).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    const checkOutDate = new Date(reservationData.checkOut).toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    })
    
    // Validate email before preparing template params
    const sanitizedEmail = sanitizeString(guestEmail)
    if (!sanitizedEmail || sanitizedEmail.trim() === '' || !sanitizedEmail.includes('@')) {
      console.error('❌ Email is empty or invalid! Cannot send email.')
      return { success: false, email: guestEmail, error: 'Invalid email address' }
    }
    
    // Prepare email template parameters
    // All values are sanitized to prevent "corrupted variables" error
    // IMPORTANT: EmailJS template must have "To Email" field set to one of these variable names
    const templateParams = {
      to_name: sanitizeString(guestName) || 'Guest',
      to_email: sanitizedEmail, // Primary email field
      reply_to: sanitizedEmail, // Some EmailJS templates use this for recipient
      email: sanitizedEmail, // Alternative name some templates use
      listing_title: sanitizeString(reservationData.listingTitle) || 'Your listing',
      check_in: sanitizeString(checkInDate),
      check_out: sanitizeString(checkOutDate),
      nights: String(reservationData.nights || 0),
      nights_plural: (reservationData.nights || 0) !== 1 ? 's' : '',
      reservation_id: sanitizeString(reservationId.substring(0, 8).toUpperCase()),
      total_amount: formatCurrency(reservationData.pricing?.total || 0),
      refund_amount: formatCurrency(reservationData.pricing?.total || 0), // Usually same as total for cancellation
      dashboard_url: sanitizeString(`${window.location.origin}/guest/${reservationData.guestId}`),
      cancellation_date: sanitizeString(new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      })),
      cancellation_reason: sanitizeString(reservationData.cancellationReason || 'Booking cancelled'),
    }
    
    // Remove any undefined or null values (EmailJS doesn't like them)
    Object.keys(templateParams).forEach(key => {
      if (templateParams[key] === undefined || templateParams[key] === null) {
        templateParams[key] = ''
      }
    })
    
    console.log('✅ Cancellation email template parameters prepared (sanitized):', {
      to_email: templateParams.to_email,
      to_name: templateParams.to_name,
      hasEmail: !!templateParams.to_email && templateParams.to_email.length > 0,
      emailValid: templateParams.to_email.includes('@'),
      total_amount: templateParams.total_amount,
      reservation_id: templateParams.reservation_id,
      allParams: Object.keys(templateParams),
    })
    
    // Validate all parameters are strings (EmailJS requirement)
    const invalidParams = Object.entries(templateParams).filter(([key, value]) => {
      return typeof value !== 'string' && typeof value !== 'number'
    })
    if (invalidParams.length > 0) {
      console.warn('⚠️ Non-string/number parameters found:', invalidParams)
    }

    // CRITICAL: Log the exact payload being sent to EmailJS
    console.log('📧 Sending cancellation email to EmailJS:', {
      serviceId: CANCELLATION_EMAILJS_CONFIG.serviceId,
      templateId: CANCELLATION_EMAILJS_CONFIG.templateId,
      publicKey: CANCELLATION_EMAILJS_CONFIG.publicKey.substring(0, 10) + '...',
      templateParams: {
        ...templateParams,
        to_email: templateParams.to_email,
        emailLength: templateParams.to_email?.length || 0
      }
    })

    // Send email using EmailJS
    const emailResponse = await emailjs.send(
      CANCELLATION_EMAILJS_CONFIG.serviceId,
      CANCELLATION_EMAILJS_CONFIG.templateId,
      templateParams,
      CANCELLATION_EMAILJS_CONFIG.publicKey
    )
    
    console.log('✅ Cancellation email sent successfully to:', guestEmail)
    console.log('EmailJS Response:', emailResponse)
    
    return { success: true, email: guestEmail }
  } catch (emailSendError) {
    console.error('❌ Failed to send cancellation email:', emailSendError)
    console.error('Full error object:', JSON.stringify(emailSendError, null, 2))
    
    // Log detailed error for debugging
    if (emailSendError.text) {
      console.error('EmailJS Error Details:', emailSendError.text)
    }
    if (emailSendError.status) {
      console.error('EmailJS Error Status:', emailSendError.status)
    }
    
    // Log what was actually sent
    console.error('What was sent to EmailJS:', {
      to_email: templateParams?.to_email,
      to_email_type: typeof templateParams?.to_email,
      to_email_length: templateParams?.to_email?.length,
      allParams: templateParams
    })
    
    throw emailSendError
  }
}

export default sendCancellationEmail

