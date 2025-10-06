@echo off
echo Setting up environment variables for APS Create Revit Family project
echo.
echo You need to get these values from the APS Developer Portal:
echo 1. Go to https://developer.autodesk.com/myapps/create
echo 2. Create a new app or use an existing one
echo 3. Set Callback URL to: http://localhost:3000/api/aps/callback/oauth
echo.
echo Please enter your APS credentials:
echo.

set /p APS_CLIENT_ID="Enter your APS Client ID: "
set /p APS_CLIENT_SECRET="Enter your APS Client Secret: "

echo.
echo Setting environment variables...
set APS_CALLBACK_URL=http://localhost:3000/api/aps/callback/oauth
set APS_WEBHOOK_URL=http://localhost:3000/api/aps/callback/designautomation
set DESIGN_AUTOMATION_NICKNAME=%APS_CLIENT_ID%
set DESIGN_AUTOMATION_ACTIVITY_NAME=CreateWindowAppActivity
set DESIGN_AUTOMATION_ACTIVITY_ALIAS=dev
set DESIGN_AUTOMATION_FAMILY_TEMPLATE=https://developer.api.autodesk.com/oss/v2/signedresources/2f4fe740-e6eb-4966-a657-06ef5ae13dfa?region=US

echo.
echo Environment variables set successfully!
echo.
echo To start the server, run: npm start
echo.
echo Note: For production use, you'll need to set up ngrok for the webhook URL:
echo 1. Download ngrok from https://ngrok.com/
echo 2. Run: ngrok http 3000
echo 3. Copy the ngrok URL and update APS_WEBHOOK_URL
echo.
pause
