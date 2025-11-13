/**
 * PayPal Error Handler Utility
 * 
 * Standardized error handling for PayPal operations across the application.
 * This ensures consistent error messages for the same errors regardless of where they occur.
 * 
 * @module paypalErrorHandler
 */

/**
 * Extract and format error message from Firebase Function error
 * 
 * @param {Error} error - The error object from Firebase Function call
 * @param {Object} options - Optional configuration
 * @param {string} options.defaultMessage - Default error message if extraction fails
 * @param {string} options.operation - Operation name for context (e.g., 'payout', 'deposit', 'balance sync')
 * @returns {string} User-friendly error message
 */
export const extractPayPalErrorMessage = (error, options = {}) => {
  const {
    defaultMessage = 'PayPal operation failed. Please try again.',
    operation = 'operation'
  } = options;

  // Get all error properties for debugging
  const allErrorKeys = Object.getOwnPropertyNames(error);
  
  // Log error details for debugging (in development)
  if (process.env.NODE_ENV === 'development') {
    console.error('PayPal error details:', {
      code: error.code,
      message: error.message,
      details: error.details,
      keys: allErrorKeys
    });
  }

  // Handle Firebase Function error codes
  if (error.code === 'functions/not-found') {
    return `PayPal ${operation} function not found. Please ensure Firebase Functions are deployed.`;
  }

  if (error.code === 'functions/unauthenticated') {
    return `You must be logged in to process PayPal ${operation}.`;
  }

  if (error.code === 'functions/invalid-argument') {
    // Try to extract the actual error message
    if (error.message && error.message !== 'invalid-argument') {
      return error.message;
    }
    return `Invalid ${operation} request. Please check your input.`;
  }

  if (error.code === 'functions/failed-precondition') {
    // Try to extract the actual error message
    if (error.message && error.message !== 'failed-precondition') {
      return error.message;
    }
    return `PayPal credentials not configured or insufficient funds. Please contact support.`;
  }

  // Handle functions/internal errors - try to extract the actual message
  if (error.code === 'functions/internal') {
    let extractedMessage = null;

    // Check error.message (might contain the actual message)
    if (error.message && error.message !== 'internal' && error.message.trim().length > 0) {
      extractedMessage = error.message.replace(/^PayPal .+ failed:\s*/i, '');
    }

    // Check error.details
    if (!extractedMessage && error.details) {
      if (typeof error.details === 'string') {
        extractedMessage = error.details;
      } else if (error.details.message) {
        extractedMessage = error.details.message.replace(/^PayPal .+ failed:\s*/i, '');
      } else if (error.details.errorMessage) {
        extractedMessage = error.details.errorMessage;
      } else if (error.details.originalError) {
        extractedMessage = error.details.originalError;
      }
    }

    // Check customData
    if (!extractedMessage && error.customData) {
      if (typeof error.customData === 'string') {
        extractedMessage = error.customData;
      } else if (error.customData.message) {
        extractedMessage = error.customData.message;
      }
    }

    // Check all other properties for error messages
    if (!extractedMessage) {
      for (const key of allErrorKeys) {
        if (key !== 'code' && key !== 'name' && key !== 'stack' && key !== 'message') {
          const value = error[key];
          if (typeof value === 'string' && value.length > 10 && value !== 'internal') {
            // Check if it looks like an error message
            if (value.includes('PayPal') || value.includes('payout') || value.includes('failed') || 
                value.includes('error') || value.includes('invalid') || value.includes('insufficient')) {
              extractedMessage = value;
              break;
            }
          }
        }
      }
    }

    if (extractedMessage) {
      return extractedMessage;
    }

    // If we still haven't found a message, provide helpful guidance
    return `PayPal ${operation} failed. The error details are not available in the browser. Please check your Firebase Functions logs to see the specific error. Common issues include: insufficient funds in the platform PayPal account, invalid receiver email/payer ID, or PayPal API configuration problems.`;
  }

  // Handle standard error messages with PayPal-specific error detection
  if (error.message) {
    const errorMsg = error.message.toUpperCase();
    
    // Map common PayPal error patterns to user-friendly messages
    if (errorMsg.includes('INSUFFICIENT_FUNDS') || errorMsg.includes('INSUFFICIENT')) {
      if (errorMsg.includes('PLATFORM') || errorMsg.includes('ACCOUNT')) {
        return `PayPal ${operation} failed: Platform PayPal account has insufficient funds. For sandbox testing, add test funds to your platform PayPal sandbox account.`;
      }
      return `Insufficient funds for ${operation}. Please check your balance.`;
    }

    if (errorMsg.includes('INVALID_RECEIVER') || 
        (errorMsg.includes('INVALID') && (errorMsg.includes('RECEIVER') || errorMsg.includes('EMAIL') || errorMsg.includes('PAYER')))) {
      return `Invalid PayPal receiver. Please check your PayPal email or payer ID in your profile.`;
    }

    if (errorMsg.includes('AUTHENTICATION') || errorMsg.includes('AUTH') || errorMsg.includes('401') || errorMsg.includes('403')) {
      return `PayPal authentication failed. Please contact support.`;
    }

    if (errorMsg.includes('NOT_FOUND') || errorMsg.includes('NOT FOUND')) {
      return `PayPal account not found. Please verify your PayPal email or payer ID.`;
    }

    if (errorMsg.includes('CREDENTIALS') || errorMsg.includes('NOT CONFIGURED')) {
      return `PayPal credentials not configured. Please contact support.`;
    }

    // If the error message looks informative, use it
    if (error.message.length > 20 && !errorMsg.includes('INTERNAL')) {
      return error.message;
    }
  }

  // Fallback to default message
  return defaultMessage;
};

/**
 * Categorize PayPal error for better UX handling
 * 
 * @param {Error} error - The error object
 * @returns {Object} Error category information
 */
export const categorizePayPalError = (error) => {
  const errorMsg = (error.message || '').toUpperCase();
  const errorCode = error.code || '';

  // Check for specific error types
  if (errorCode === 'functions/unauthenticated' || 
      errorMsg.includes('AUTHENTICATION') || 
      errorMsg.includes('AUTH') ||
      errorCode.includes('401') || 
      errorCode.includes('403')) {
    return {
      type: 'authentication',
      userAction: 'Please contact support to verify PayPal credentials.',
      retryable: false
    };
  }

  if (errorMsg.includes('INSUFFICIENT_FUNDS') || errorMsg.includes('INSUFFICIENT')) {
    return {
      type: 'insufficient_funds',
      userAction: 'Please add funds to your PayPal account or contact support.',
      retryable: true
    };
  }

  if (errorMsg.includes('INVALID_RECEIVER') || 
      (errorMsg.includes('INVALID') && (errorMsg.includes('RECEIVER') || errorMsg.includes('EMAIL')))) {
    return {
      type: 'invalid_receiver',
      userAction: 'Please update your PayPal email or payer ID in your profile.',
      retryable: false
    };
  }

  if (errorCode === 'functions/not-found') {
    return {
      type: 'function_not_found',
      userAction: 'Please ensure Firebase Functions are deployed.',
      retryable: false
    };
  }

  if (errorCode === 'functions/invalid-argument') {
    return {
      type: 'invalid_argument',
      userAction: 'Please check your input and try again.',
      retryable: true
    };
  }

  // Default to generic error
  return {
    type: 'unknown',
    userAction: 'Please try again or contact support if the problem persists.',
    retryable: true
  };
};

/**
 * Format error for display to user
 * 
 * @param {Error} error - The error object
 * @param {Object} options - Optional configuration
 * @param {string} options.operation - Operation name for context
 * @param {string} options.defaultMessage - Default error message
 * @returns {Object} Formatted error object with message and category
 */
export const formatPayPalError = (error, options = {}) => {
  const message = extractPayPalErrorMessage(error, options);
  const category = categorizePayPalError(error);

  return {
    message,
    category: category.type,
    userAction: category.userAction,
    retryable: category.retryable,
    originalError: error
  };
};

export default {
  extractPayPalErrorMessage,
  categorizePayPalError,
  formatPayPalError
};

