# PayPal Payouts API Integration Setup

This guide explains how to set up PayPal Payouts API to automatically send money to hosts when they confirm bookings.

## Prerequisites

1. PayPal Developer Account
2. Firebase project with Cloud Functions enabled
3. PayPal Sandbox or Live credentials

## Step 1: Set Up Firebase Cloud Functions

1. Install Firebase CLI:
```bash
npm install -g firebase-tools
```

2. Login to Firebase:
```bash
firebase login
```

3. Initialize Functions (if not already done):
```bash
cd functions
npm install
```

## Step 2: Configure PayPal Credentials

### Option A: Firebase Functions Config (Recommended for Production)

```bash
firebase functions:config:set paypal.client_id="YOUR_PAYPAL_CLIENT_ID"
firebase functions:config:set paypal.client_secret="YOUR_PAYPAL_CLIENT_SECRET"
firebase functions:config:set paypal.mode="sandbox"  # or "live" for production
```

### Option B: Environment Variables (For Local Development)

Create a `.env` file in the `functions` directory:

```
PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_PAYPAL_CLIENT_SECRET
PAYPAL_MODE=sandbox
```

## Step 3: Get PayPal Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Log in and navigate to "Apps & Credentials"
3. Create a new app or use existing one
4. Copy the **Client ID** and **Client Secret**
5. For Sandbox testing, use Sandbox credentials
6. For Production, use Live credentials

## Step 4: Deploy Cloud Functions

```bash
firebase deploy --only functions
```

## Step 5: Enable PayPal Payouts API

1. In PayPal Developer Dashboard, ensure Payouts API is enabled for your app
2. For Sandbox: Automatically enabled
3. For Live: Requires approval from PayPal

## How It Works

### Automatic Flow (Recommended)

When a host confirms a booking:

1. **Frontend** (`HostBookings.jsx`):
   - Creates a payout record in Firestore `PayPalPayouts` collection
   - Calls the Cloud Function `processPayPalPayout`
   - Updates the payout record with results

2. **Cloud Function** (`functions/index.js`):
   - Receives payout request with host PayPal email and amount
   - Authenticates with PayPal API
   - Creates PayPal payout batch
   - Updates Firestore with payout status

### Manual Trigger (Alternative)

The `onPayoutCreated` trigger automatically processes payouts when new records are added to `PayPalPayouts` collection. This is a backup mechanism.

## Testing

### Sandbox Testing

1. Create a test PayPal account in Sandbox
2. Use that email as the host's PayPal email in profile
3. Confirm a booking
4. Check PayPal Sandbox account for payment

### Sandbox Test Accounts

You can create test accounts in PayPal Developer Dashboard:
- Business Account (receives payouts)
- Personal Account (for testing)

## Payout Status Flow

- `pending` → Initial state when created
- `processing` → PayPal is processing the payout
- `SUCCESS` → Payment sent successfully
- `failed` → Payment failed, check error message

## Monitoring

Check payout status:

1. **Firestore**: Monitor `PayPalPayouts` collection
2. **PayPal Dashboard**: View payout batches
3. **Firebase Logs**: `firebase functions:log`

## Production Checklist

- [ ] Switch to Live PayPal credentials
- [ ] Update `paypal.mode` to `"live"`
- [ ] Get PayPal Payouts API approval
- [ ] Test with small amounts first
- [ ] Set up error monitoring
- [ ] Configure refund policies

## Error Handling

The system handles errors gracefully:

- **Invalid PayPal Email**: Payout record marked as failed
- **API Errors**: Error details saved to Firestore
- **Network Issues**: Retry mechanism can be added

## Security Notes

- Never expose PayPal credentials in frontend code
- Always use Cloud Functions for API calls
- Keep credentials in Firebase Functions config
- Use environment variables for local development

## Support

For PayPal API issues:
- [PayPal Payouts API Documentation](https://developer.paypal.com/docs/api/payments.payouts-batch/v1/)
- [PayPal Developer Support](https://developer.paypal.com/support/)

