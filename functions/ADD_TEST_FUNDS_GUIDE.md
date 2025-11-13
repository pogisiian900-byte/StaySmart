# How to Add Test Funds to Platform PayPal Account

## Platform Account Details
- **Email**: `lhanie@business.example.com`
- **Account ID**: `88UKGRJYCMYBN`

## Steps to Add Test Funds

### Method 1: Via PayPal Developer Dashboard (Recommended)

1. **Go to PayPal Developer Dashboard**
   - Visit: https://developer.paypal.com/dashboard/
   - Log in with your PayPal account

2. **Switch to Sandbox Mode**
   - Toggle the "Sandbox" switch at the top of the page
   - Make sure it shows "Sandbox" (not "Live")

3. **Navigate to Accounts**
   - Click on "Accounts" in the left sidebar
   - Or go to: https://developer.paypal.com/dashboard/accounts

4. **Find Your Platform Account**
   - Look for account email: `lhanie@business.example.com`
   - Or search for account ID: `88UKGRJYCMYBN`
   - Click on the account to view details

5. **Add Test Funds**
   - In the account details, look for "Add Funds" or "Fund Account" button
   - Click it
   - Enter amount (e.g., ₱10,000 or $200 USD)
   - Confirm
   - The funds should appear in the account balance immediately

### Method 2: Via PayPal Sandbox Account Login

1. **Get Sandbox Account Credentials**
   - In PayPal Developer Dashboard → Accounts
   - Find `lhanie@business.example.com`
   - Click "View/Edit account"
   - Note the password (or reset it)

2. **Log in to Sandbox PayPal**
   - Go to: https://www.sandbox.paypal.com/
   - Log in with:
     - Email: `lhanie@business.example.com`
     - Password: (from step 1)

3. **Add Funds**
   - Once logged in, go to Wallet
   - Click "Add Money" or "Transfer Money"
   - Add test funds

## Recommended Test Fund Amount

For testing withdrawals, add at least:
- **Minimum**: ₱10,000 PHP (or equivalent)
- **Recommended**: ₱50,000 PHP (or equivalent)
- **Note**: In sandbox, you can add unlimited test funds

## Verify Funds Were Added

1. Check account balance in PayPal Developer Dashboard
2. Or log in to sandbox PayPal account and check wallet balance
3. The balance should show the amount you added

## Important Notes

- ✅ Test funds are unlimited in sandbox - add as much as you need
- ✅ Funds are added instantly in sandbox
- ✅ These are test funds only - not real money
- ⚠️ Make sure you're adding funds to the **platform account** (`lhanie@business.example.com`), not a user account
- ⚠️ The platform account is the one associated with your `PAYPAL_CLIENT_ID`

## Troubleshooting

**Can't find "Add Funds" button?**
- Make sure you're in Sandbox mode
- Try logging in directly to sandbox PayPal (https://www.sandbox.paypal.com/)
- Some sandbox accounts may need to be activated first

**Funds not showing?**
- Refresh the page
- Check you're looking at the correct account
- Verify you're in Sandbox mode (not Live)

