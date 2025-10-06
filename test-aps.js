const { OAuth } = require('./routes/common/oauth');

async function testAPS() {
    try {
        console.log('Testing APS Design Automation...');
        
        // Get OAuth token
        const oauth = new OAuth({});
        const oauth_client = oauth.get2LeggedClient();
        const oauth_token = await oauth_client.authenticate();
        
        console.log('OAuth token obtained');
        
        // Test activities endpoint
        const response = await fetch('https://developer.api.autodesk.com/da/us-east/v3/activities', {
            headers: {
                'Authorization': `Bearer ${oauth_token.access_token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('Available activities:', data.data);
            
            // Check if our activity exists
            const ourActivity = 'ouMmVqAI7vSaipf9MEu5OxO9XlbPizaMo8aFDilTgt0D2zkB.CreateWindowAppActivity+dev';
            const exists = data.data.includes(ourActivity);
            console.log(`Our activity (${ourActivity}) exists:`, exists);
            
            if (!exists) {
                console.log('Activity not found. Need to run Configure button.');
            }
        } else {
            console.error('Failed to get activities:', response.status, response.statusText);
        }
        
    } catch (error) {
        console.error('Error testing APS:', error);
    }
}

testAPS();
