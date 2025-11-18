# Next Steps: Complete PayPal Withdrawal Setup

## ✅ Current Status

Your PayPal configuration is verified and working:
- ✅ Credentials are set and valid
- ✅ PayPal authentication successful
- ✅ Access token obtained

## Step 1: Add Test Funds to Sender Account

**IMPORTANT**: The account that sends money (associated with your Client ID/Secret) needs funds.

### How to Add Test Funds:

1. **Go to PayPal Developer Dashboard**
   - Visit: https://developer.paypal.com/dashboard/
   - Switch to **Sandbox** mode (toggle at top)

2. **Navigate to Accounts**
   - Click on "Accounts" in the left sidebar
   - Find the account associated with your Client ID/Secret
   - (This should be `lhanie@business.example.com` if you followed the setup guide)

3. **Add Test Funds**
   - Click on the account
   - Look for "Add Funds" or "Fund Account" button
   - Add test funds (recommended: ₱50,000 PHP minimum)
   - In sandbox, you can add unlimited test funds

4. **Verify Funds Added**
   - Check the account balance shows the funds you added
   - Note: It may take a few seconds to update

### Quick Check:
- Account email: Should be `lhanie@business.example.com` (or the account your Client ID is associated with)
- Account balance: Should show sufficient funds (e.g., ₱50,000+)

## Step 2: Test a Withdrawal

1. **Start your app** (if not already running)
   ```bash
   npm run dev
   ```

2. **Navigate to withdrawal page**
   - Go to the PayPal/withdrawal section in your app
   - Make sure you're logged in

3. **Try a small withdrawal**
   - Enter a small amount (e.g., ₱100)
   - Enter the receiver PayPal email or payer ID
   - Click withdraw

4. **Monitor the process**
   - Watch the browser console for logs
   - Check for any error messages
   - The withdrawal should:
     - Deduct from your Firebase balance first
     - Send money to the receiver's PayPal account
     - If it fails, refund your Firebase balance automatically

## Step 3: Check Firebase Functions Logs

If the withdrawal fails or you want to see detailed information:

### Option 1: Firebase Console (Web)
1. Go to: https://console.firebase.google.com/
2. Select your project: `staysmart-77486`
3. Navigate to: **Functions** → **Logs**
4. Filter by: `processPayPalPayoutRest`
5. Look for recent logs with:
   - `=== PROCESSING PAYPAL PAYOUT (REST API) ===`
   - `=== PAYPAL CREDENTIALS CHECK ===`
   - `=== REQUESTING PAYPAL ACCESS TOKEN ===`
   - `=== PAYPAL PAYOUT REQUEST DATA ===`
   - Any error messages

### Option 2: Firebase CLI
```bash
firebase functions:log --only processPayPalPayoutRest
```

### What to Look For:
- ✅ **Success**: Look for `✅ PayPal payout successful` with batch ID
- ❌ **Errors**: Look for specific error messages like:
  - `INSUFFICIENT_FUNDS` - Sender account needs more funds
  - `INVALID_RECEIVER` - Receiver email/payer ID is wrong
  - `AUTHENTICATION_FAILURE` - Credentials issue (shouldn't happen if verification passed)
  - `invalid_client` - Wrong Client ID/Secret

## Troubleshooting

### Error: "Insufficient funds"
- **Solution**: Add more test funds to the sender account (lhanie@business.example.com)

### Error: "Invalid receiver"
- **Solution**: Verify the receiver email or payer ID is correct
- Make sure the receiver account exists in PayPal sandbox

### Error: "PayPal payout failed" (generic)
- **Solution**: Check Firebase Functions logs for the specific error
- Look for the detailed error message in the logs

### Withdrawal succeeds but receiver doesn't get money
- **Solution**: 
  - Check the payout batch status in PayPal dashboard
  - Verify the receiver email/payer ID is correct
  - Check if the receiver account exists and is verified

## Verification Checklist

Before testing withdrawal, make sure:
- [ ] Credentials are set in `functions/.env` (✅ Done)
- [ ] PayPal authentication works (✅ Done)
- [ ] Test funds added to sender account (⏳ Do this now)
- [ ] Receiver PayPal account exists (verify this)
- [ ] Firebase Functions are deployed (if testing in production)

## Expected Flow

1. **User initiates withdrawal**
   - User enters amount and receiver info
   - Firebase balance is deducted first

2. **PayPal payout request**
   - Function gets access token
   - Sends payout request to PayPal API
   - PayPal processes from sender account to receiver account

3. **Success**
   - PayPal returns batch ID
   - Transaction recorded in Firebase
   - User sees success message

4. **Failure (automatic refund)**
   - If payout fails, Firebase balance is automatically refunded
   - User sees error message with details

## Need Help?

If you encounter issues:
1. Check Firebase Functions logs first (most detailed info)
2. Check browser console for client-side errors
3. Verify all checklist items are completed
4. Review the error messages - they should now be more specific

---

**Ready to test?** Start with Step 1 (add test funds), then proceed to Step 2 (test withdrawal).

































