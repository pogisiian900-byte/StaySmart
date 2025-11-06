# PayPal Payment Flow Issue & Solution

## Current Problem

The host's PayPal sandbox account doesn't change because:

1. **No Actual Payment Processing**: When a guest uses PayPal, the system only saves the payment method information (email, payer ID) but doesn't actually charge the guest or transfer money.

2. **Current Flow**:
   - Guest clicks PayPal → Saves payment method info → Creates reservation
   - Host confirms → Updates Firestore earnings → But NO money is transferred to host's PayPal

3. **Missing Components**:
   - Actual payment charging when guest reserves
   - Money transfer to host's PayPal account when booking is confirmed
   - PayPal Payouts API integration

## What Needs to Happen

### For Real PayPal Payments:

1. **When Guest Reserves**:
   - Actually charge the guest's PayPal account
   - Hold the funds in your platform account
   - Update reservation with payment status

2. **When Host Confirms**:
   - Transfer the subtotal amount to host's PayPal account using PayPal Payouts API
   - Keep the service fee in platform account
   - Update transaction records

## Implementation Requirements

### Backend API Needed:
```
POST /api/paypal/process-payment
- Charge guest's PayPal
- Hold funds

POST /api/paypal/payout-to-host
- Transfer to host's PayPal account
- Update payout status
```

### PayPal APIs Required:
1. **PayPal Orders API** - To charge guests
2. **PayPal Payouts API** - To transfer money to hosts
3. **PayPal Webhooks** - To handle payment confirmations

### Environment Variables Needed:
```env
VITE_PAYPAL_CLIENT_ID=sandbox_client_id
VITE_PAYPAL_SECRET=sandbox_secret (NEVER in frontend!)
PAYPAL_MODE=sandbox (or live)
```

## Current Code Changes

The code now tracks PayPal payouts in Firestore (`PayPalPayouts` collection) but **requires a backend API** to actually process the transfers.

### What Was Added:
- Track host's PayPal email when confirming bookings
- Create payout records in Firestore
- Track payment method types (PayPal vs Card)
- Payout status tracking

### What Still Needs Backend:
- Actual PayPal API calls to process payments
- Secure handling of PayPal secrets (not in frontend!)
- Webhook handling for payment confirmations

## Testing in Sandbox

To test actual PayPal transfers:
1. Create sandbox accounts for guest and host
2. Set up backend API with PayPal Payouts API
3. Process payments through backend
4. Check sandbox accounts for actual transfers

## Quick Fix for Testing (Development Only)

For sandbox testing without backend, you can manually:
1. Check `PayPalPayouts` collection in Firestore
2. Process payouts manually using PayPal Developer Dashboard
3. Or use PayPal Sandbox testing tools

