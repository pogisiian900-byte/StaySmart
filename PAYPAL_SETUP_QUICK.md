# PayPal Payouts Setup Instructions

## Quick Setup Guide

### 1. Install Firebase CLI and Functions Dependencies

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Navigate to functions directory
cd functions

# Install dependencies
npm install
```

### 2. Get PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Create/Select your app
3. Copy **Client ID** and **Client Secret** (Sandbox or Live)

### 3. Configure PayPal Credentials in Firebase

```bash
# Set PayPal credentials (REPLACE WITH YOUR ACTUAL CREDENTIALS)
firebase functions:config:set paypal.client_id="YOUR_CLIENT_ID"
firebase functions:config:set paypal.client_secret="YOUR_CLIENT_SECRET"
firebase functions:config:set paypal.mode="sandbox"
```

### 4. Deploy Cloud Functions

```bash
# From project root
firebase deploy --only functions
```

### 5. Test the Integration

1. Host confirms a booking
2. System automatically sends money to host's PayPal email
3. Check Firestore `PayPalPayouts` collection for status
4. Check PayPal Sandbox account for payment

## How It Works

1. **Host confirms booking** → `HostBookings.jsx` calls `processPayPalPayout`
2. **Cloud Function** → Authenticates with PayPal API
3. **PayPal API** → Sends money to host's PayPal email
4. **Firestore** → Updates payout status

## Files Created

- `functions/index.js` - PayPal Payouts API integration
- `functions/package.json` - Dependencies
- `PAYPAL_PAYOUTS_SETUP.md` - Detailed documentation

## Important Notes

- ✅ PayPal credentials are stored securely in Firebase Functions config
- ✅ All API calls happen server-side (secure)
- ✅ Automatic error handling and status updates
- ✅ Works with both Sandbox and Live PayPal accounts

## Troubleshooting

### Function not found error
- Make sure functions are deployed: `firebase deploy --only functions`

### PayPal authentication error
- Verify credentials are set correctly: `firebase functions:config:get`
- Check PayPal Developer Dashboard for correct Client ID/Secret

### Payment not received
- Check Firestore `PayPalPayouts` collection for error messages
- Verify host's PayPal email is correct
- Check PayPal Sandbox account (if testing)

