# Quick Setup Guide for APS Create Revit Family

## Prerequisites
1. **APS Account**: Create an account at [APS Developer Portal](https://developer.autodesk.com)
2. **Create an App**: Go to [Create App](https://developer.autodesk.com/myapps/create) and set:
   - Callback URL: `http://localhost:3000/api/aps/callback/oauth`
   - Note down your **Client ID** and **Client Secret**

## Quick Start

### Option 1: Use the Setup Script (Recommended)
Run one of these scripts to set up environment variables:

**Windows Command Prompt:**
```cmd
setup-env.bat
```

**PowerShell:**
```powershell
.\setup-env.ps1
```

### Option 2: Manual Setup
Set these environment variables in your terminal:

**Windows Command Prompt:**
```cmd
set APS_CLIENT_ID=your_client_id_here
set APS_CLIENT_SECRET=your_client_secret_here
set APS_CALLBACK_URL=http://localhost:3000/api/aps/callback/oauth
set APS_WEBHOOK_URL=http://localhost:3000/api/aps/callback/designautomation
set DESIGN_AUTOMATION_NICKNAME=your_client_id_here
set DESIGN_AUTOMATION_ACTIVITY_NAME=CreateWindowAppActivity
set DESIGN_AUTOMATION_ACTIVITY_ALIAS=dev
set DESIGN_AUTOMATION_FAMILY_TEMPLATE=https://developer.api.autodesk.com/oss/v2/signedresources/2f4fe740-e6eb-4966-a657-06ef5ae13dfa?region=US
```

**PowerShell:**
```powershell
$env:APS_CLIENT_ID="your_client_id_here"
$env:APS_CLIENT_SECRET="your_client_secret_here"
$env:APS_CALLBACK_URL="http://localhost:3000/api/aps/callback/oauth"
$env:APS_WEBHOOK_URL="http://localhost:3000/api/aps/callback/designautomation"
$env:DESIGN_AUTOMATION_NICKNAME="your_client_id_here"
$env:DESIGN_AUTOMATION_ACTIVITY_NAME="CreateWindowAppActivity"
$env:DESIGN_AUTOMATION_ACTIVITY_ALIAS="dev"
$env:DESIGN_AUTOMATION_FAMILY_TEMPLATE="https://developer.api.autodesk.com/oss/v2/signedresources/2f4fe740-e6eb-4966-a657-06ef5ae13dfa?region=US"
```

## Start the Application
```cmd
npm start
```

## Access the Application
Open your browser and go to: http://localhost:3000

## Next Steps
1. Use the "Configure" button in the web app to set up AppBundle & Activity
2. For production, set up ngrok for webhook URL:
   - Download ngrok from https://ngrok.com/
   - Run: `ngrok http 3000`
   - Update APS_WEBHOOK_URL with the ngrok URL

## Troubleshooting
- Make sure you have Node.js 14+ installed
- Verify your APS credentials are correct
- Check that the callback URL matches your app settings
- For webhook issues, ensure ngrok is running and URL is updated
