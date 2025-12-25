# Google Cloud Setup Guide for LifeOS

This guide will help you set up Google Cloud Project to enable Google Drive backup and Calendar sync.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click the project dropdown at the top and select **New Project**
3. Name it "LifeOS" and click **Create**

## Step 2: Enable APIs

1. Go to **APIs & Services > Library**
2. Search for and enable:
   - **Google Drive API**
   - **Google Calendar API**

## Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type, click **Create**
3. Fill in:
   - App name: `LifeOS`
   - User support email: Your email
   - Developer contact: Your email
4. Click **Save and Continue**
5. On Scopes page, click **Add or Remove Scopes**, add:
   - `https://www.googleapis.com/auth/drive.file`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `https://www.googleapis.com/auth/calendar.events`
6. Click **Save and Continue** through remaining steps

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. Choose **Web application**
4. Name: `LifeOS Web`
5. Add Authorized JavaScript origins:
   - `http://localhost:5173` (development)
   - Your production URL (e.g., `https://your-app.vercel.app`)
6. Click **Create**
7. Copy your **Client ID**

## Step 5: Add Client ID to App

Create a `.env` file in your project root:

```env
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

## Step 6: Test the Integration

1. Run `npm run dev`
2. Open the app and click "Sign in with Google"
3. Grant permissions when prompted
4. Your data will now sync to Google Drive!

---

## Troubleshooting

### "Access Blocked" Error
- Make sure your OAuth consent screen has your email as a test user
- Go to **OAuth consent screen > Test users** and add your email

### "Redirect URI mismatch" Error
- Ensure `http://localhost:5173` is in your authorized origins

### Production Deployment
For production, you'll need to:
1. Add your production URL to authorized origins
2. Submit for OAuth verification if you have many users
