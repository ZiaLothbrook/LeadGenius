# Postmark Dynamic Server Management Setup

## Overview

This platform now supports **dynamic Postmark server creation** where each user gets their own dedicated Postmark server for improved organization, tracking, and email deliverability. This multi-tenant approach provides:

- **Dedicated Servers**: Each user/organization gets their own Postmark server
- **Better Organization**: Separate email streams for different users
- **Enhanced Tracking**: User-specific analytics and bounce handling
- **Improved Deliverability**: Isolated sender reputation per user
- **Custom Configuration**: User-specific from addresses and branding

## Required API Keys

### 1. Account API Token (POSTMARK_SERVER_API)
- **Purpose**: Used to create and manage Postmark servers programmatically
- **Where to get it**: Postmark Account → Account API Tokens
- **Environment Variable**: `POSTMARK_SERVER_API`
- **Note**: This is different from a Server API token

### 2. Server API Token (POSTMARK_API_KEY) - Optional
- **Purpose**: Default/fallback server for system emails
- **Where to get it**: Postmark → Servers → [Your Server] → API Tokens
- **Environment Variable**: `POSTMARK_API_KEY`
- **Note**: Optional - users can rely entirely on their dedicated servers

## Setup Steps

### Step 1: Get Account API Token
1. Login to your Postmark account
2. Go to **Account Settings** → **API Tokens**
3. Create a new **Account API Token**
4. Copy the token and add it as `POSTMARK_SERVER_API` secret in Replit

### Step 2: Configure Environment (Optional)
Set these optional environment variables for system-wide defaults:
```env
POSTMARK_FROM_EMAIL=noreply@yourdomain.com
POSTMARK_FROM_NAME=Your Company Name
```

### Step 3: Test the Setup
Once configured, the system will automatically:
- Create dedicated servers for users on first email send
- Handle server management through the API
- Provide fallback functionality

## API Endpoints

### Create Server for User
```bash
POST /api/postmark/server/create
Content-Type: application/json
Authorization: Bearer <user-token>

{
  "serverName": "My Company Email Server",
  "serverConfig": {
    "color": "blue",
    "trackOpens": true,
    "trackLinks": "HtmlAndText"
  }
}
```

### Auto-Create Server
```bash
POST /api/postmark/server/auto-create
Authorization: Bearer <user-token>
```

### Check Server Status
```bash
GET /api/postmark/server/status
Authorization: Bearer <user-token>
```

### Update Server Configuration
```bash
PATCH /api/postmark/server/config
Content-Type: application/json
Authorization: Bearer <user-token>

{
  "fromEmail": "john@company.com",
  "fromName": "John Smith",
  "serverName": "Updated Server Name"
}
```

### Delete Server (Danger!)
```bash
DELETE /api/postmark/server
Authorization: Bearer <user-token>
```

## How It Works

### Automatic Server Creation
1. **User sends first email**: System checks if user has dedicated server
2. **No server found**: Automatically creates server using Account API
3. **Server created**: User record updated with server details
4. **Email sent**: Uses user's dedicated server for all future emails

### Multi-Tenant Email Delivery
```typescript
// System automatically handles user-specific servers
await postmarkService.sendEmail({
  to: 'prospect@company.com',
  subject: 'Introduction',
  htmlContent: '<h1>Hello</h1>',
  userId: 'user-123' // System routes to user's dedicated server
});
```

### Fallback Strategy
1. **User-specific server**: Primary (if available)
2. **Default server**: Fallback (if POSTMARK_API_KEY set)
3. **Mock mode**: Development/testing (if no keys configured)

## Benefits

### For Users
- **Dedicated Infrastructure**: Own server with isolated reputation
- **Custom Branding**: Use their own domain and from address
- **Better Analytics**: Server-specific email statistics
- **Higher Deliverability**: Isolated sender reputation

### For Platform
- **Scalable Architecture**: Each user isolated from others
- **Better Organization**: Clear separation of email streams
- **Flexible Configuration**: Per-user email settings
- **Enterprise Ready**: Supports multi-tenant use cases

## Database Schema

The system adds these fields to the users table:
```sql
postmarkServerId        VARCHAR   -- Postmark server ID
postmarkServerToken     VARCHAR   -- Server API token
postmarkServerName      VARCHAR   -- Server display name
postmarkFromEmail       VARCHAR   -- Custom from email
postmarkFromName        VARCHAR   -- Custom from name
postmarkServerCreatedAt TIMESTAMP -- Server creation date
```

## Monitoring

### System Health
```bash
GET /api/communication/status
```
Returns comprehensive status including:
- Account API availability
- User server counts
- Configuration status
- Feature capabilities

### User Analytics
Each user's dedicated server provides:
- Email delivery statistics
- Bounce/complaint tracking
- Open/click analytics
- Server-specific reporting

## Security Considerations

1. **API Token Security**: Account API tokens are stored as environment secrets
2. **User Isolation**: Each user's server tokens are stored in database
3. **Access Control**: Users can only manage their own servers
4. **Audit Trail**: All server operations are logged

## Troubleshooting

### Common Issues

**"Account API not configured"**
- Ensure `POSTMARK_SERVER_API` environment variable is set
- Check the token has Account-level permissions

**"User already has server"**
- Normal behavior - each user gets one server
- Use update endpoints to modify existing servers

**"Server creation failed"**
- Check Account API token permissions
- Verify Postmark account has remaining server quota
- Check server name uniqueness

### Support
For issues with this setup:
1. Check environment variables are correctly set
2. Verify Account API token permissions in Postmark
3. Review application logs for detailed error messages
4. Test with a simple auto-create request first

## Migration Guide

### From Single Server to Multi-Tenant
If migrating from a single-server setup:

1. **Keep existing POSTMARK_API_KEY**: Will serve as fallback
2. **Add POSTMARK_SERVER_API**: Enable dynamic server creation
3. **Existing users**: Will automatically get dedicated servers on next email
4. **No downtime**: System gracefully handles the transition

### From SendGrid
If migrating from SendGrid:
1. **Superior Deliverability**: Postmark offers 83.3% vs SendGrid's 61.3% inbox placement
2. **Transparent Pricing**: $15/month for 10,000 emails vs complex SendGrid pricing
3. **Better Developer Experience**: Excellent API and TypeScript support
4. **Enhanced Analytics**: More detailed delivery and engagement metrics