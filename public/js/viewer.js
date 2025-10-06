// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const workitemId = urlParams.get('workitemId');

let viewer = null;
let viewerUrn = null;

// Initialize viewer
async function initViewer() {
    try {
        // Get viewer token
        const tokenResponse = await fetch('/api/viewer/token');
        if (!tokenResponse.ok) {
            throw new Error('Failed to get viewer token');
        }
        const { access_token, expires_in } = await tokenResponse.json();
        
        // Initialize APS Viewer
        Autodesk.Viewing.Initializer({ 
            env: 'AutodeskProduction', 
            getAccessToken: (callback) => callback(access_token, expires_in)
        }, function () {
            const config = {
                extensions: ['Autodesk.DocumentBrowser']
            };
            viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById('preview'), config);
            viewer.start();
            viewer.setTheme('light-theme');
            
            console.log('Viewer initialized');
            hideOverlay();
        });
    } catch (error) {
        console.error('Error initializing viewer:', error);
        showError('Failed to initialize viewer: ' + error.message);
    }
}

// Load model in viewer
async function loadModel(urn) {
    if (!viewer) {
        console.error('Viewer not initialized');
        return;
    }
    
    try {
        return new Promise((resolve, reject) => {
            function onDocumentLoadSuccess(doc) {
                console.log('Document loaded successfully');
                viewer.setLightPreset(0);
                resolve(viewer.loadDocumentNode(doc, doc.getRoot().getDefaultGeometry()));
            }
            
            function onDocumentLoadFailure(code, message, errors) {
                console.error('Document load failed:', code, message, errors);
                reject({ code, message, errors });
            }
            
            Autodesk.Viewing.Document.load('urn:' + urn, onDocumentLoadSuccess, onDocumentLoadFailure);
        });
    } catch (error) {
        console.error('Error loading model:', error);
        throw error;
    }
}

// Check viewer status and load model if ready
async function checkViewerStatus() {
    if (!workitemId) {
        showError('No workitem ID provided');
        return;
    }
    
    try {
        const response = await fetch(`/api/bim-llm/viewer/${workitemId}`);
        if (!response.ok) {
            if (response.status === 404) {
                showStatus('RFA file not ready yet. This workitem may be using simulated workflow or still processing...');
                setTimeout(checkViewerStatus, 5000);
                return;
            }
            throw new Error('Failed to get viewer status');
        }
        
        const viewerInfo = await response.json();
        viewerUrn = viewerInfo.urn;
        
        console.log('Viewer status:', viewerInfo);
        
        switch (viewerInfo.status) {
            case 'n/a':
                showStatus('Model translation not started yet. Please wait...');
                setTimeout(checkViewerStatus, 5000);
                break;
                
            case 'inprogress':
                showStatus(`Model is being translated (${viewerInfo.progress || '0%'})...`);
                setTimeout(checkViewerStatus, 5000);
                break;
                
            case 'failed':
                showError('Model translation failed. Please try again.');
                break;
                
            case 'success':
                showStatus('Model ready! Loading viewer...');
                try {
                    await loadModel(viewerUrn);
                    hideOverlay();
                    enableDownload();
                } catch (error) {
                    showError('Failed to load model in viewer: ' + error.message);
                }
                break;
                
            default:
                showStatus('Unknown status: ' + viewerInfo.status);
                setTimeout(checkViewerStatus, 5000);
        }
    } catch (error) {
        console.error('Error checking viewer status:', error);
        showError('Failed to check viewer status: ' + error.message);
    }
}

// Show overlay with message
function showOverlay(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `
        <div class="notification">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
    overlay.style.display = 'flex';
}

// Hide overlay
function hideOverlay() {
    const overlay = document.getElementById('overlay');
    overlay.style.display = 'none';
}

// Show status message
function showStatus(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `
        <div class="notification">
            <div class="spinner"></div>
            <p>${message}</p>
        </div>
    `;
    overlay.style.display = 'flex';
}

// Show error message
function showError(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `
        <div class="notification">
            <div class="status-message error">
                <strong>Error:</strong> ${message}
            </div>
        </div>
    `;
    overlay.style.display = 'flex';
}

// Enable download button
function enableDownload() {
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.disabled = false;
    downloadBtn.onclick = () => {
        window.open(`/api/bim-llm/download/${workitemId}`, '_blank');
    };
}

// Setup refresh button
document.getElementById('refreshBtn').onclick = () => {
    if (workitemId) {
        checkViewerStatus();
    }
};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', async () => {
    if (!workitemId) {
        showError('No workitem ID provided in URL');
        return;
    }
    
    showOverlay('Initializing viewer...');
    await initViewer();
    
    if (viewer) {
        showOverlay('Checking model status...');
        await checkViewerStatus();
    }
});
