# PayPal Configuration Verification Guide

## Platform Account Information
- **Account Email**: `lhanie@business.example.com`
- **Account ID**: `88UKGRJYCMYBN`

## Step 1: Verify .env File Configuration

Check that `functions/.env` contains actual credentials (not placeholders):

```env
PAYPAL_CLIENT_ID=actual_client_id_here (should start with letters/numbers, not "your_paypal")
PAYPAL_CLIENT_SECRET=actual_secret_here (should be a long string, not "your_paypal")
PAYPAL_MODE=sandbox
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com
```

**To verify:**
1. Open `functions/.env` file
2. Check that `PAYPAL_CLIENT_ID` is NOT "your_paypal_client_id_here"
3. Check that `PAYPAL_CLIENT_SECRET` is NOT "your_paypal_client_secret_here"
4. Both should be actual values from PayPal Developer Dashboard

## Step 2: Verify PayPal App Association

The Client ID and Secret in `.env` should be from a PayPal App that:

1. **Is created in PayPal Developer Dashboard:**
   - Go to https://developer.paypal.com/dashboard/
   - Log in with account that owns `lhanie@business.example.com`
   - Switch to **Sandbox** mode
   - Go to "My Apps & Credentials"
   - Verify the app exists

2. **Is associated with the platform account:**
   - The app should be linked to sandbox business account `lhanie@business.example.com` (or account ID `88UKGRJYCMYBN`)
   - Check the app details to confirm which account it's associated with

3. **Has Payouts API permissions:**
   - PayPal Payouts API should be enabled for the app
   - Check app settings/permissions

## Step 3: Add Test Funds to Platform Account

**IMPORTANT**: The platform account needs funds to send payouts!

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/)
2. Switch to **Sandbox** mode (toggle at top)
3. Go to "Accounts" section
4. Find account `lhanie@business.example.com` or search for account ID `88UKGRJYCMYBN`
5. Click on the account to view details
6. Look for "Add Funds" or "Fund Account" option
7. Add test funds (unlimited in sandbox - add at least ₱10,000 PHP for testing)
8. Verify the account balance shows the funds

**Note**: In sandbox, you can add unlimited test funds. Add enough to test multiple withdrawals.

## Step 4: Test Configuration

### Check Firebase Functions Logs

1. Deploy or run Firebase Functions locally
2. Check logs for PayPal authentication:
   ```bash
   firebase functions:log
   ```
3. Look for:
   - "PayPal configuration:" - should show `hasClientId: true` and `hasClientSecret: true`
   - "PayPal client created successfully" - indicates credentials work
   - Any "PayPal credentials not configured" errors

### Test a Withdrawal

1. Try a small withdrawal (e.g., ₱100)
2. Check Firebase Functions logs for:
   - "Processing PayPal payout (REST API)"
   - "Receiver Email:" and "Payer ID:" logs
   - Success or error messages
3. If you get "insufficient funds" error:
   - Go back to Step 3 and add more test funds to platform account
4. If withdrawal succeeds:
   - Check user's PayPal account received the funds
   - Verify Firebase balance was deducted correctly

## Troubleshooting

### "PayPal credentials not configured"
- Check `.env` file exists in `functions/` directory
- Verify credentials are not placeholders
- For deployed functions, check Firebase environment variables are set

### "Insufficient funds" error
- Platform account (`lhanie@business.example.com`) needs funds
- Add test funds in PayPal Developer Dashboard (Sandbox mode)
- Verify you're adding funds to the correct account (the one associated with your Client ID)

### "Invalid receiver" error
- Check user's PayPal email or payer ID is correct
- Verify user's PayPal account exists in sandbox

## Next Steps After Verification

Once everything is verified:
1. ✅ `.env` file has actual credentials
2. ✅ PayPal App is associated with platform account
3. ✅ Platform account has test funds
4. ✅ Configuration tested and working

You're ready to test withdrawals!

