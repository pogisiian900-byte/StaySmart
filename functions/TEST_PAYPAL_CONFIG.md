# Test PayPal Configuration

## Quick Test Steps

### 1. Check Firebase Functions Logs for PayPal Authentication

Run this command to check if PayPal credentials are working:

```bash
firebase functions:log --only processPayPalPayoutRest
```

**Look for:**
- ✅ "PayPal configuration:" with `hasClientId: true` and `hasClientSecret: true`
- ✅ "PayPal client created successfully"
- ❌ "PayPal credentials not configured" - means .env file is missing or has placeholders

### 2. Test PayPal Access Token

The function should successfully get an access token. Look for:
- ✅ No errors when calling PayPal API
- ❌ "Failed to get PayPal access token" - means credentials are invalid

### 3. Test a Small Withdrawal

1. **In your app**, try withdrawing a small amount (e.g., ₱100)
2. **Check browser console** for:
   - "=== SENDING PAYPAL PAYOUT REQUEST ==="
   - "Receiver Email:" and "Payer ID:" logs
   - Success or error messages

3. **Check Firebase Functions logs** for:
   - "=== PROCESSING PAYPAL PAYOUT (REST API) ==="
   - "Receiver Email:" and "Payer ID:" logs
   - PayPal API response

### 4. Common Issues and Solutions

#### Issue: "PayPal credentials not configured"
**Solution:**
- Check `functions/.env` file exists
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are not placeholders
- For deployed functions, check Firebase environment variables

#### Issue: "Insufficient funds"
**Solution:**
- Add test funds to platform account (`lhanie@business.example.com`)
- See `ADD_TEST_FUNDS_GUIDE.md` for instructions
- Verify you're adding funds to the correct account

#### Issue: "Invalid receiver"
**Solution:**
- Check user's PayPal email or payer ID is correct
- Verify user's PayPal account exists in sandbox
- Check console logs for "Receiver Email:" and "Payer ID:" values

#### Issue: "Authentication failed"
**Solution:**
- Verify Client ID and Secret are correct
- Check they're from the PayPal App associated with `lhanie@business.example.com`
- Ensure you're using Sandbox credentials (not Live)

## Verification Checklist

- [ ] `.env` file exists in `functions/` directory
- [ ] `PAYPAL_CLIENT_ID` is set (not a placeholder)
- [ ] `PAYPAL_CLIENT_SECRET` is set (not a placeholder)
- [ ] Credentials are from PayPal App for `lhanie@business.example.com`
- [ ] Platform account has test funds (at least ₱10,000)
- [ ] Firebase Functions can authenticate with PayPal (check logs)
- [ ] Test withdrawal works (small amount like ₱100)

## Next Steps After Testing

Once everything works:
1. ✅ Platform account has sufficient test funds
2. ✅ Withdrawals are working correctly
3. ✅ User balances are deducted properly
4. ✅ Funds are sent to user PayPal accounts

You're all set! 🎉

