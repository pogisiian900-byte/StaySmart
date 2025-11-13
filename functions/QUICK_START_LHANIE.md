# Quick Start Guide: Configure PayPal for lhanie@business.example.com

## Platform Account
- **Email**: `lhanie@business.example.com`
- **Account ID**: `88UKGRJYCMYBN`

## Complete Setup Checklist

### ✅ Step 1: Create PayPal App (5 minutes)

1. Go to: https://developer.paypal.com/dashboard/
2. Switch to **Sandbox** mode
3. Go to "My Apps & Credentials"
4. Click "Create App"
5. Name: `StaySmart Platform`
6. Select account: `lhanie@business.example.com` (or ID `88UKGRJYCMYBN`)
7. Copy **Client ID** and **Secret**

**Detailed guide**: See `PAYPAL_APP_SETUP_LHANIE.md`

### ✅ Step 2: Update .env File (2 minutes)

1. Open `functions/.env` file
2. Replace placeholders with your actual credentials:
   ```env
   PAYPAL_CLIENT_ID=your_actual_client_id_from_step_1
   PAYPAL_CLIENT_SECRET=your_actual_secret_from_step_1
   PAYPAL_MODE=sandbox
   PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
   ```
3. Save the file

### ✅ Step 3: Add Test Funds (3 minutes)

1. Go to: https://developer.paypal.com/dashboard/
2. Switch to **Sandbox** mode
3. Go to "Accounts"
4. Find `lhanie@business.example.com`
5. Click on the account
6. Add test funds (recommended: ₱50,000 PHP)

**Detailed guide**: See `ADD_FUNDS_LHANIE_ACCOUNT.md`

### ✅ Step 4: Verify Configuration (1 minute)

Run the verification script:
```bash
cd functions
npm run verify-paypal
```

This will:
- ✅ Check .env file has credentials
- ✅ Verify credentials are not placeholders
- ✅ Test PayPal API authentication
- ✅ Confirm everything is working

**Expected output**: "✅ SUCCESS: PayPal configuration is working correctly!"

### ✅ Step 5: Test Withdrawal

1. Start your app
2. Try withdrawing a small amount (₱100)
3. Check browser console for logs
4. Check Firebase Functions logs for PayPal API calls
5. Verify user's PayPal account received the funds

## All Guides Available

- **`PAYPAL_APP_SETUP_LHANIE.md`** - Create PayPal App for lhanie account
- **`ADD_FUNDS_LHANIE_ACCOUNT.md`** - Add test funds to lhanie account
- **`PAYPAL_CONFIG_VERIFICATION.md`** - Complete verification guide
- **`TEST_PAYPAL_CONFIG.md`** - Testing guide
- **`ENV_SETUP.md`** - General environment setup

## Quick Commands

```bash
# Verify PayPal configuration
cd functions
npm run verify-paypal

# Check Firebase Functions logs
firebase functions:log

# Deploy functions (after updating .env)
firebase deploy --only functions
```

## Troubleshooting

**Verification script fails?**
- Check `.env` file exists in `functions/` directory
- Verify credentials are actual values (not placeholders)
- Make sure Client ID and Secret are from PayPal App for `lhanie@business.example.com`

**Withdrawal fails with "insufficient funds"?**
- Add test funds to `lhanie@business.example.com` account
- See `ADD_FUNDS_LHANIE_ACCOUNT.md`

**Need help?**
- Check the detailed guides listed above
- Review Firebase Functions logs for specific errors
- Verify all steps in this checklist are completed

