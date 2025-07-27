# Postmark Setup Guide

## Step 1: Create a Server for Email Sending

You have the Account API token, now you need to create a server:

1. **Log into your Postmark dashboard**
2. **Click "Create your first server" or "Servers" → "Add Server"**
3. **Configure your server:**
   - Server Name: "AI Lead Generation Platform" (or your preferred name)
   - Color: Choose any color for organization
   - Environment: Select "Production" (for live emails) or "Development" (for testing)

## Step 2: Get Your Server API Token

After creating the server:

1. **Click on your newly created server**
2. **Go to "Settings" → "API Tokens"**
3. **Copy the "Server API token"** (this is what we need)
4. **Add it to your environment variables as `POSTMARK_API_KEY`**

## Step 3: Configure Sender Signature

For production email sending:

1. **Go to "Sender Signatures"**
2. **Add a signature** with your email domain (e.g., noreply@yourdomain.com)
3. **Verify the sender signature** by clicking the confirmation link in your email

## Step 4: Test Email Sending

Once you have the Server API token:
- The system will automatically detect it and enable email functionality
- You can test email campaigns through the platform
- All emails will be tracked with delivery statistics

## Expected Results

With Postmark configured:
- ✅ 83.3% inbox placement rate (vs SendGrid's 61.3%)
- ✅ Lightning-fast delivery (typically under 5 seconds)
- ✅ Transparent pricing: $15/month for 10,000 emails
- ✅ Real-time delivery tracking and bounce handling
- ✅ Professional email templates and analytics

## Environment Variable

Add this to your environment:
```
POSTMARK_API_KEY=your_server_api_token_here
```

The server API token looks like: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`