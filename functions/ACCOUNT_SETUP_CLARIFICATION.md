# PayPal Account Setup Clarification

## Important: How PayPal Payout API Works

**The PayPal Payout API sends money FROM the account associated with the Client ID/Secret TO the recipient account.**

### Key Point:
- **Sender Account** = The account associated with the Client ID/Secret in your `.env` file
- **Receiver Account** = The user's PayPal account (email or payer ID)

## Your Setup Requirements

Based on your request: **"use lhanie as sender of money but using Harold's account"**

### Option 1: Use lhanie's Account Credentials (Recommended)
1. **Create PayPal App** using `lhanie@business.example.com` account
2. **Get Client ID and Secret** from that app
3. **Put credentials in `functions/.env`**
4. **Result**: Money will be sent FROM lhanie's account TO user's account

### Option 2: Use Harold's Account Credentials (If you prefer)
1. **Create PayPal App** using Harold's PayPal Developer account
2. **Associate the app** with `lhanie@business.example.com` business account
3. **Get Client ID and Secret** from that app
4. **Put credentials in `functions/.env`**
5. **Result**: Money will be sent FROM lhanie's account (if app is associated with it) TO user's account

## Important Notes:

1. **The Client ID/Secret determines the sender account**
   - If you use lhanie's Client ID/Secret → sends from lhanie's account
   - If you use Harold's Client ID/Secret → sends from Harold's account (unless app is associated with lhanie)

2. **The sender account must have funds**
   - The account that sends money (lhanie's account) must have sufficient funds
   - Add test funds to the sender account for sandbox testing

3. **App Association Matters**
   - When creating a PayPal App, you can associate it with a specific business account
   - The app's Client ID/Secret will send money from the associated account

## Recommended Setup:

**Use lhanie@business.example.com account credentials:**
1. Log in to PayPal Developer Dashboard with lhanie's account
2. Create a PayPal App
3. Get Client ID and Secret
4. Add test funds to lhanie's account
5. Put credentials in `functions/.env`

This ensures money is sent from lhanie's account, which is what you want.

## Current Configuration Check:

Run this to verify your current setup:
```bash
cd functions
npm run verify-paypal
```

This will show:
- ✅ If credentials are set
- ✅ If credentials are valid
- ✅ Which account the credentials are associated with

## Next Steps:

1. **Decide which account to use as sender** (lhanie or Harold)
2. **Create PayPal App** for that account
3. **Get Client ID and Secret**
4. **Update `functions/.env`** with credentials
5. **Add test funds** to the sender account
6. **Test withdrawal** to verify it works

## Troubleshooting:

**If withdrawal fails:**
- Check Firebase Functions logs for detailed error messages
- Verify credentials are correct (not placeholders)
- Verify sender account has funds
- Verify receiver email/payer ID is correct
- Check that PayPal App has Payouts API enabled

