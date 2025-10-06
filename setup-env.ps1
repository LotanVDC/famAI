Write-Host "Setting up environment variables for APS Create Revit Family project" -ForegroundColor Green
Write-Host ""
Write-Host "You need to get these values from the APS Developer Portal:" -ForegroundColor Yellow
Write-Host "1. Go to https://developer.autodesk.com/myapps/create" -ForegroundColor Cyan
Write-Host "2. Create a new app or use an existing one" -ForegroundColor Cyan
Write-Host "3. Set Callback URL to: http://localhost:3000/api/aps/callback/oauth" -ForegroundColor Cyan
Write-Host ""
Write-Host "Please enter your APS credentials:" -ForegroundColor Yellow
Write-Host ""

$clientId = Read-Host "Enter your APS Client ID"
$clientSecret = Read-Host "Enter your APS Client Secret"

Write-Host ""
Write-Host "Setting environment variables..." -ForegroundColor Green

$env:APS_CLIENT_ID = $clientId
$env:APS_CLIENT_SECRET = $clientSecret
$env:APS_CALLBACK_URL = "http://localhost:3000/api/aps/callback/oauth"
$env:APS_WEBHOOK_URL = "http://localhost:3000/api/aps/callback/designautomation"
$env:DESIGN_AUTOMATION_NICKNAME = $clientId
$env:DESIGN_AUTOMATION_ACTIVITY_NAME = "CreateWindowAppActivity"
$env:DESIGN_AUTOMATION_ACTIVITY_ALIAS = "dev"
$env:DESIGN_AUTOMATION_FAMILY_TEMPLATE = "https://developer.api.autodesk.com/oss/v2/signedresources/2f4fe740-e6eb-4966-a657-06ef5ae13dfa?region=US"

Write-Host ""
Write-Host "Environment variables set successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "To start the server, run: npm start" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: For production use, you'll need to set up ngrok for the webhook URL:" -ForegroundColor Yellow
Write-Host "1. Download ngrok from https://ngrok.com/" -ForegroundColor Cyan
Write-Host "2. Run: ngrok http 3000" -ForegroundColor Cyan
Write-Host "3. Copy the ngrok URL and update APS_WEBHOOK_URL" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to continue"
