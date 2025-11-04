# PayPal Sandbox Integration Setup

## Getting Started with PayPal Sandbox

1. **Create a PayPal Developer Account**
   - Go to https://developer.paypal.com/
   - Sign up or log in with your PayPal account

2. **Create a Sandbox App**
   - Navigate to Dashboard > Apps & Credentials
   - Click "Create App"
   - Name it "StaySmart Sandbox" (or any name you prefer)
   - Select "Merchant" as the app type
   - Copy your **Client ID** and **Secret**

3. **Set Up Environment Variables**
   - Create a `.env` file in the root of your project
   - Add the following line:
   ```
   VITE_PAYPAL_CLIENT_ID=your_sandbox_client_id_here
   ```
   - Replace `your_sandbox_client_id_here` with your actual Sandbox Client ID
   - Note: Since this project uses Vite, environment variables must be prefixed with `VITE_`

4. **Test PayPal Sandbox Accounts**
   - In PayPal Developer Dashboard, go to Accounts > Sandbox Accounts
   - You can create test accounts or use the default test accounts
   - Use these test accounts to test payments in Sandbox mode

5. **Testing**
   - When testing, use PayPal Sandbox test accounts
   - Make sure your app is running in development mode
   - The PayPal buttons will use Sandbox environment automatically

## Payment Flow

- Users can choose between Credit/Debit Card or PayPal
- For PayPal: Clicking "Pay with PayPal" will redirect to PayPal Sandbox
- After successful PayPal connection, the payment method is saved to Firestore
- The booking can only be confirmed if a payment method exists

## Production Setup

When ready for production:
1. Create a production app in PayPal Developer Dashboard
2. Use the production Client ID in your environment variables
3. Update the PayPalScriptProvider to use production credentials

