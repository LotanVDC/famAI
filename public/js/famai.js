/////////////////////////////////////////////////////////////////////
// BIM-LLM Blueprint: Enhanced Frontend JavaScript
// Copyright (c) 2024 BIM-LLM Platform
//
// This module handles the frontend interactions for the BIM-LLM platform
/////////////////////////////////////////////////////////////////////

class BIMLLMInterface {
    constructor() {
        this.currentSessionId = null;
        this.socket = null;
        this.isGenerating = false;
        this.conversationHistory = [];
        this.currentFamilyData = null;
        
        this.initializeInterface();
        this.setupSocketConnection();
        this.loadUserProfile();
        this.initializeAPSConfiguration();
    }

    /**
     * Initialize the interface
     */
    initializeInterface() {
        // Show loading state
        this.showLoadingState();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI state
        this.updateStatus('ready', 'Ready to create BIM families');
        
        // Load recent sessions
        this.loadRecentSessions();
        
        // Set up auto-save
        this.setupAutoSave();
        
        // Hide loading state
        this.hideLoadingState();
    }

    /**
     * Show loading state
     */
    showLoadingState() {
        const sendButton = document.getElementById('sendButton');
        const sendButtonText = document.getElementById('sendButtonText');
        
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Loading...</span>';
        }
    }

    /**
     * Hide loading state
     */
    hideLoadingState() {
        const sendButton = document.getElementById('sendButton');
        const sendButtonText = document.getElementById('sendButtonText');
        
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Send</span>';
        }
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Chat input handling
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('input', this.handleInputChange.bind(this));
        }

        // Settings changes
        const lodLevel = document.getElementById('lodLevel');
        const qualityMode = document.getElementById('qualityMode');
        
        if (lodLevel) lodLevel.addEventListener('change', this.updateSettings.bind(this));
        if (qualityMode) qualityMode.addEventListener('change', this.updateSettings.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * Set up Socket.IO connection
     */
    setupSocketConnection() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateStatus('ready', "famAI here — all set, let's build something!");
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateStatus('error', 'Connection lost');
        });

        this.socket.on('Workitem-Notification', (data) => {
            this.handleWorkitemNotification(data);
        });

        this.socket.on('generation-progress', (data) => {
            this.handleGenerationProgress(data);
        });

        this.socket.on('qa-validation', (data) => {
            this.handleQAValidation(data);
        });
    }

    /**
     * Load user profile
     */
    async loadUserProfile() {
        try {
            const response = await fetch('/api/aps/user/profile');
            if (response.ok) {
                const profile = await response.json();
                document.getElementById('userName').textContent = profile.name || 'User';
            }
        } catch (error) {
            console.error('Failed to load user profile:', error);
        }
    }

    /**
     * Load recent sessions
     */
    async loadRecentSessions() {
        try {
            const response = await fetch('/api/bim-llm/v1/sessions');
            if (response.ok) {
                const sessions = await response.json();
                this.displayRecentSessions(sessions);
            }
        } catch (error) {
            console.error('Failed to load recent sessions:', error);
        }
    }

    /**
     * Display recent sessions in sidebar
     */
    displayRecentSessions(sessions) {
        const container = document.getElementById('recentSessions');
        if (!container) return;

        container.innerHTML = '';

        if (sessions.length === 0) {
            container.innerHTML = '<p class="text-center text-secondary">No recent sessions</p>';
            return;
        }

        sessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = 'session-item';
            sessionElement.innerHTML = `
                <div class="session-name">${session.familyMetadata.familyName}</div>
                <div class="session-meta">
                    <span class="session-category">${session.familyMetadata.category}</span>
                    <span class="session-date">${this.formatDate(session.createdAt)}</span>
                </div>
            `;
            
            sessionElement.addEventListener('click', () => {
                this.loadSession(session.sessionId);
            });
            
            container.appendChild(sessionElement);
        });
    }

    /**
     * Send message to BIM-LLM
     */
    async sendMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message || this.isGenerating) return;

        // Clear input
        chatInput.value = '';
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Generate session ID if needed
        if (!this.currentSessionId) {
            this.currentSessionId = this.generateSessionId();
        }

        // Update status
        this.updateStatus('processing', 'Generating BIM family...');
        this.isGenerating = true;
        
        // Show loading state on button
        this.showSendButtonLoading();

        try {
            // Send request to BIM-LLM API (use create endpoint for actual family generation)
            const response = await fetch('/api/famai/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    prompt: message,
                    sessionId: this.currentSessionId
                })
            });

            if (response.status === 401) {
                // Handle authentication error - show demo mode
                this.handleAuthenticationError(message);
                return;
            }

            const result = await response.json();

            if (result.success) {
                // Store family data
                this.currentFamilyData = result;
                
                // Add assistant response to chat
                this.addMessageToChat('assistant', this.formatAssistantResponse(result));
                
                // Show preview panel - don't auto-execute
                this.showPreviewPanel(result);
                
                // Update status to show design is complete
                this.updateStatus('ready', 'Family design completed! Click "Create Family" to start creation.');
                
            } else {
                throw new Error(result.error || 'Failed to generate family');
            }

        } catch (error) {
            console.error('Generation error:', error);
            this.addMessageToChat('assistant', `Sorry, I encountered an error: ${error.message}`);
            this.updateStatus('error', 'Generation failed');
        } finally {
            this.isGenerating = false;
            this.hideSendButtonLoading();
        }
    }

    /**
     * Show loading state on send button
     */
    showSendButtonLoading() {
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            sendButton.disabled = true;
            sendButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Generating...</span>';
        }
    }

    /**
     * Hide loading state on send button
     */
    hideSendButtonLoading() {
        const sendButton = document.getElementById('sendButton');
        if (sendButton) {
            sendButton.disabled = false;
            sendButton.innerHTML = '<i class="fas fa-paper-plane"></i> <span>Send</span>';
        }
    }

    /**
     * Handle authentication error with demo mode
     */
    handleAuthenticationError(message) {
        this.isGenerating = false;
        
        // Show demo mode response
        const demoResponse = this.generateDemoResponse(message);
        this.addMessageToChat('assistant', demoResponse);
        
        // Show demo preview panel
        this.showDemoPreviewPanel(message);
        
        // Update status
        this.updateStatus('ready', 'Demo mode - Sign in for full functionality');
        
        // Show authentication notice
        this.showAuthenticationNotice();
    }

    /**
     * Generate demo response for unauthenticated users
     */
    generateDemoResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('door')) {
            return `
                <div class="demo-response">
                    <p><i class="fas fa-info-circle"></i> <strong>Demo Mode:</strong> I understand you want to create a door family!</p>
                    <p>In demo mode, I can show you what the BIM-LLM Blueprint would generate:</p>
                    <div class="demo-family-summary">
                        <h4>Proposed Door Family:</h4>
                        <ul>
                            <li><strong>Category:</strong> Doors</li>
                            <li><strong>Type:</strong> Single-leaf parametric door</li>
                            <li><strong>Parameters:</strong> Width, Height, Thickness, Material</li>
                            <li><strong>LOD Level:</strong> 300 (Construction Documentation)</li>
                            <li><strong>Features:</strong> Glass panel, hardware, frame</li>
                        </ul>
                    </div>
                    <p class="demo-notice">To create actual Revit families, please sign in to your Autodesk account.</p>
                </div>
            `;
        } else if (lowerMessage.includes('window')) {
            return `
                <div class="demo-response">
                    <p><i class="fas fa-info-circle"></i> <strong>Demo Mode:</strong> I understand you want to create a window family!</p>
                    <p>In demo mode, I can show you what the BIM-LLM Blueprint would generate:</p>
                    <div class="demo-family-summary">
                        <h4>Proposed Window Family:</h4>
                        <ul>
                            <li><strong>Category:</strong> Windows</li>
                            <li><strong>Type:</strong> Double-hung parametric window</li>
                            <li><strong>Parameters:</strong> Width, Height, Sill Height, Frame Material</li>
                            <li><strong>LOD Level:</strong> 300 (Construction Documentation)</li>
                            <li><strong>Features:</strong> Adjustable sash, weatherstripping, hardware</li>
                        </ul>
                    </div>
                    <p class="demo-notice">To create actual Revit families, please sign in to your Autodesk account.</p>
                </div>
            `;
        } else if (lowerMessage.includes('furniture')) {
            return `
                <div class="demo-response">
                    <p><i class="fas fa-info-circle"></i> <strong>Demo Mode:</strong> I understand you want to create furniture!</p>
                    <p>In demo mode, I can show you what the BIM-LLM Blueprint would generate:</p>
                    <div class="demo-family-summary">
                        <h4>Proposed Furniture Family:</h4>
                        <ul>
                            <li><strong>Category:</strong> Furniture</li>
                            <li><strong>Type:</strong> Parametric office furniture</li>
                            <li><strong>Parameters:</strong> Width, Depth, Height, Material, Finish</li>
                            <li><strong>LOD Level:</strong> 200 (Design Development)</li>
                            <li><strong>Features:</strong> Adjustable dimensions, material options</li>
                        </ul>
                    </div>
                    <p class="demo-notice">To create actual Revit families, please sign in to your Autodesk account.</p>
                </div>
            `;
        } else {
            return `
                <div class="demo-response">
                    <p><i class="fas fa-info-circle"></i> <strong>Demo Mode:</strong> I understand you want to create a BIM family!</p>
                    <p>In demo mode, I can analyze your request and show you what the BIM-LLM Blueprint would generate:</p>
                    <div class="demo-family-summary">
                        <h4>Analysis of Your Request:</h4>
                        <ul>
                            <li><strong>Input:</strong> "${message}"</li>
                            <li><strong>Detected Category:</strong> Generic BIM Component</li>
                            <li><strong>Suggested Parameters:</strong> Standard dimensional and material parameters</li>
                            <li><strong>LOD Level:</strong> 200 (Design Development)</li>
                        </ul>
                    </div>
                    <p class="demo-notice">To create actual Revit families, please sign in to your Autodesk account.</p>
                </div>
            `;
        }
    }

    /**
     * Show demo preview panel
     */
    showDemoPreviewPanel(message) {
        const previewPanel = document.getElementById('previewPanel');
        if (!previewPanel) return;

        // Update family metadata with demo data
        document.getElementById('previewFamilyName').textContent = 'Demo Family';
        document.getElementById('previewCategory').textContent = 'Demo Category';
        document.getElementById('previewLOD').textContent = 'LOD 200';
        document.getElementById('previewParamCount').textContent = '5';

        // Show demo QA results
        this.showDemoQAResults();

        // Disable execute button
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = true;
            executeBtn.textContent = 'Sign In Required';
        }

        // Show panel
        previewPanel.style.display = 'flex';
    }

    /**
     * Show demo QA results
     */
    showDemoQAResults() {
        const qaResults = document.getElementById('qaResults');
        if (!qaResults) return;

        qaResults.innerHTML = `
            <div class="qa-item">
                <div class="qa-status demo"></div>
                <div class="qa-item-content">
                    <div class="qa-item-title">Demo Mode</div>
                    <div class="qa-item-details">Demo validation results</div>
                </div>
            </div>
        `;
    }

    /**
     * Show authentication notice
     */
    showAuthenticationNotice() {
        const notice = document.createElement('div');
        notice.className = 'auth-notice';
        notice.innerHTML = `
            <div class="auth-notice-content">
                <i class="fas fa-lock"></i>
                <span>Sign in to your Autodesk account to create actual Revit families</span>
                <button class="btn btn-primary btn-sm" onclick="window.location.href='/api/aps/login'">
                    Sign In
                </button>
            </div>
        `;
        
        // Add to top of chat
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.insertBefore(notice, chatMessages.firstChild);
        }
    }

    /**
     * Add message to chat interface
     */
    addMessageToChat(type, content) {
        const chatMessages = document.getElementById('chatMessages');
        if (!chatMessages) return;

        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}-message`;
        
        const avatar = this.getAvatarForType(type);
        const formattedContent = this.formatMessageContent(content, type);
        
        messageElement.innerHTML = `
            <div class="message-avatar">
                <i class="${avatar}"></i>
            </div>
            <div class="message-content">
                ${formattedContent}
            </div>
        `;

        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Store in conversation history
        this.conversationHistory.push({
            type: type,
            content: content,
            timestamp: new Date()
        });
    }

    /**
     * Format assistant response
     */
    formatAssistantResponse(result) {
        let response = `<p>I've generated a ${result.sir.familyMetadata.category} family called "${result.sir.familyMetadata.familyName}".</p>`;
        
        // Check if this is a demo response
        if (result.isDemo) {
            response = `<div class="demo-response">
                <p><i class="fas fa-info-circle"></i> <strong>Demo Mode:</strong> I've generated a demo ${result.sir.familyMetadata.category} family!</p>
                <p>This is a demonstration of what the BIM-LLM Blueprint would create:</p>
            </div>`;
        } else if (result.workitemId) {
            response = `<div class="success-response">
                <p><i class="fas fa-rocket"></i> <strong>Family Creation Started!</strong></p>
                <p>Your ${result.sir.familyMetadata.category} family is being created in the cloud...</p>
                <p><strong>Workitem ID:</strong> ${result.workitemId}</p>
            </div>`;
        }
        
        if (result.qaValidation && result.qaValidation.overallPass) {
            response += `<p class="success-message"><i class="fas fa-check-circle"></i> The family passed all quality checks and is ready for creation.</p>`;
        } else if (result.qaValidation) {
            response += `<p class="warning-message"><i class="fas fa-exclamation-triangle"></i> The family has some issues that should be addressed before creation.</p>`;
        }

        // Add family details
        response += `<div class="family-summary">
            <h4>Family Details:</h4>
            <ul>
                <li><strong>Category:</strong> ${result.sir.familyMetadata.category}</li>
                <li><strong>LOD Level:</strong> ${result.sir.familyMetadata.lodLevel}</li>
                <li><strong>Parameters:</strong> ${result.sir.parameters.familyParameters.length}</li>
                <li><strong>Family Types:</strong> ${result.sir.parameters.familyTypes.length}</li>
            </ul>
        </div>`;

        if (result.isDemo) {
            response += `<p class="demo-notice">To create actual Revit families, please sign in to your Autodesk account.</p>`;
        } else if (result.workitemId) {
            response += `<p class="success-notice">Family creation is in progress! Check the status panel for updates.</p>`;
        } else {
            response += `<p class="ready-notice">Family design is complete! Click "Create Family" in the preview panel to start creation.</p>`;
        }

        return response;
    }

    /**
     * Format message content based on type
     */
    formatMessageContent(content, type) {
        if (type === 'user') {
            return `<p>${this.escapeHtml(content)}</p>`;
        } else if (type === 'assistant') {
            return content; // Already formatted HTML
        } else {
            return `<p>${this.escapeHtml(content)}</p>`;
        }
    }

    /**
     * Get avatar icon for message type
     */
    getAvatarForType(type) {
        const avatars = {
            'user': 'fas fa-user',
            'assistant': 'fas fa-robot',
            'system': 'fas fa-info-circle'
        };
        return avatars[type] || 'fas fa-circle';
    }

    /**
     * Show preview panel with family data
     */
    showPreviewPanel(familyData) {
        const previewPanel = document.getElementById('previewPanel');
        if (!previewPanel) return;

        // Update family metadata
        document.getElementById('previewFamilyName').textContent = familyData.sir.familyMetadata.familyName;
        document.getElementById('previewCategory').textContent = familyData.sir.familyMetadata.category;
        document.getElementById('previewLOD').textContent = `LOD ${familyData.sir.familyMetadata.lodLevel}`;
        document.getElementById('previewParamCount').textContent = familyData.sir.parameters.familyParameters.length;

        // Update QA results
        this.updateQAResults(familyData.qaValidation);

        // Enable/disable execute button
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.disabled = !familyData.readyForExecution;
        }

        // Enable test button when preview is available
        const testBtn = document.getElementById('testBtn');
        if (testBtn) {
            testBtn.disabled = false;
        }

        // Show panel
        previewPanel.style.display = 'flex';
    }

    /**
     * Update QA results display
     */
    updateQAResults(qaValidation) {
        const qaResults = document.getElementById('qaResults');
        if (!qaResults) return;

        qaResults.innerHTML = '';

        Object.keys(qaValidation.validations).forEach(validationType => {
            const validation = qaValidation.validations[validationType];
            
            const qaItem = document.createElement('div');
            qaItem.className = 'qa-item';
            
            const statusClass = validation.pass ? 'pass' : (validation.warnings?.length > 0 ? 'warning' : 'fail');
            
            qaItem.innerHTML = `
                <div class="qa-status ${statusClass}"></div>
                <div class="qa-item-content">
                    <div class="qa-item-title">${this.formatValidationTitle(validationType)}</div>
                    <div class="qa-item-details">
                        Score: ${validation.score}/100
                        ${validation.issues?.length > 0 ? ` • ${validation.issues.length} issues` : ''}
                        ${validation.warnings?.length > 0 ? ` • ${validation.warnings.length} warnings` : ''}
                    </div>
                </div>
            `;
            
            qaResults.appendChild(qaItem);
        });
    }

    /**
     * Format validation title
     */
    formatValidationTitle(validationType) {
        const titles = {
            'geometryValidation': 'Geometry Validation',
            'parameterValidation': 'Parameter Validation',
            'performanceValidation': 'Performance Check',
            'complianceValidation': 'Compliance Check',
            'flexingValidation': 'Flexing Test',
            'metadataValidation': 'Metadata Validation'
        };
        return titles[validationType] || validationType;
    }

    /**
     * Execute family creation
     */
    async executeFamily() {
        if (!this.currentFamilyData) return;

        // Close the preview panel
        const previewPanel = document.getElementById('previewPanel');
        if (previewPanel) {
            previewPanel.style.display = 'none';
        }

        this.updateStatus('processing', 'Creating family locally...');
        
        try {
            const response = await fetch('/api/famai/v1/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    targetFolder: 'local' // Simplified for local download
                })
            });

            const result = await response.json();

            if (result.success) {
                this.updateStatus('processing', 'Family creation in progress...');
                this.trackWorkitem(result.workitemId);
                
                this.addMessageToChat('assistant', 
                    `Family creation started! Workitem ID: ${result.workitemId}. ` +
                    `Estimated completion time: ${result.estimatedCompletionTime} seconds.`
                );
            } else {
                throw new Error(result.error || 'Failed to execute family creation');
            }

        } catch (error) {
            console.error('Execution error:', error);
            
            // Check if it's a configuration error
            if (error.message.includes('AppBundle and Activity not configured')) {
                this.addMessageToChat('assistant', 
                    `⚠️ **Configuration Required**: ${error.message}\n\n` +
                    `**To fix this:**\n` +
                    `1. Go to the main page: <a href="/" target="_blank">Main Page</a>\n` +
                    `2. Click the "Configure" button in the top navigation\n` +
                    `3. Select "CreateWindowApp" from the AppBundle dropdown\n` +
                    `4. Select a Revit engine (e.g., "Autodesk.Revit+2023")\n` +
                    `5. Click "Create/Update" to set up the AppBundle and Activity\n` +
                    `6. Come back here and try again!\n\n` +
                    `This is a one-time setup that enables real Revit family creation.`
                );
                this.updateStatus('error', 'Configuration required');
            } else {
                this.addMessageToChat('assistant', `Failed to create family: ${error.message}`);
                this.updateStatus('error', 'Family creation failed');
            }
        }
    }

    /**
     * Dry-run test: build APS payload and show it without sending
     */
    async testFamily() {
        if (!this.currentFamilyData) return;
        try {
            const response = await fetch('/api/famai/v1/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    targetFolder: 'local',
                    options: { dryRun: true }
                })
            });
            const result = await response.json();
            if (result.success && result.dryRun) {
                console.log('DRY RUN - APS Parameters:', result.apsParams);
                console.log('DRY RUN - Workitem Payload:', result.workitem);
                if (result.meta) {
                    console.log('DRY RUN - Dimensions (ft):', result.meta.dimensions?.feet);
                    console.log('DRY RUN - Dimensions (mm):', result.meta.dimensions?.millimeters);
                    console.log('DRY RUN - windowParams JSON:', result.meta.windowParamsJson);
                }
                this.addMessageToChat('assistant', '✅ Test payload generated. Open console to view full APS parameters and payload.');
            } else {
                throw new Error(result.error || 'Failed to perform dry-run');
            }
        } catch (error) {
            console.error('Dry-run error:', error);
            this.addMessageToChat('assistant', `Dry-run failed: ${error.message}`);
        }
    }

    /**
     * Track workitem progress
     */
    async trackWorkitem(workitemId) {
        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/famai/status/${workitemId}`);
                const status = await response.json();

                console.log('Status check result:', status);
                this.updateProgress(status.progress || 0);
                this.updateStatus('processing', status.message || 'Family creation in progress...');

                if (status.status === 'success') {
                    this.updateStatus('ready', 'Family created successfully!');
                    this.addMessageToChat('assistant', 
                        `Family creation completed! 
                        <div style="margin-top: 10px;">
                            <a href="/api/famai/download/${workitemId}" target="_blank" class="btn btn-primary" style="margin-right: 10px;">📥 Download RFA</a>
                            <a href="/viewer?workitemId=${workitemId}" target="_blank" class="btn btn-secondary">👁️ View in 3D</a>
                        </div>`
                    );
                    this.hideProgress();
                } else if (status.status === 'failed') {
                    this.updateStatus('error', 'Family creation failed');
                    this.addMessageToChat('assistant', 'Family creation failed. Please try refining the design.');
                    this.hideProgress();
                } else if (status.status === 'inprogress' || status.status === 'pending' || status.status === 'submitted') {
                    // Continue checking with faster polling for smoother progress
                    setTimeout(checkStatus, 500);  // Check every 500ms instead of 2000ms
                }

            } catch (error) {
                console.error('Status check error:', error);
                this.updateStatus('error', 'Failed to check status');
                this.hideProgress();
            }
        };

        checkStatus();
    }

    /**
     * Refine family design
     */
    async refineFamily() {
        if (!this.currentFamilyData) return;

        this.showModal('refinementModal');
    }

    /**
     * Submit refinement
     */
    async submitRefinement() {
        const refinementInput = document.getElementById('refinementInput');
        const feedback = refinementInput.value.trim();
        
        if (!feedback) return;

        this.closeModal('refinementModal');
        this.updateStatus('processing', 'Refining family design...');

        try {
            const response = await fetch('/api/famai/v1/refine', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    feedback: feedback
                })
            });

            const result = await response.json();

            if (result.success) {
                this.currentFamilyData = result;
                this.showPreviewPanel(result);
                this.updateStatus('ready', 'Family design refined');
                
                this.addMessageToChat('assistant', 
                    `I've refined the family design based on your feedback. ` +
                    `Improvement score: +${result.improvementScore} points.`
                );
            } else {
                throw new Error(result.error || 'Failed to refine family');
            }

        } catch (error) {
            console.error('Refinement error:', error);
            this.addMessageToChat('assistant', `Failed to refine family: ${error.message}`);
            this.updateStatus('error', 'Refinement failed');
        }
    }

    /**
     * Generate variations
     */
    async generateVariations() {
        if (!this.currentFamilyData) return;

        this.showModal('variationsModal');
    }

    /**
     * Submit variation generation
     */
    async submitVariations() {
        const variationCount = document.getElementById('variationCount').value;
        const variationType = document.getElementById('variationType').value;

        this.closeModal('variationsModal');
        this.updateStatus('processing', 'Generating variations...');

        try {
            const response = await fetch('/api/famai/v1/variations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    variationCount: parseInt(variationCount),
                    variationType: variationType
                })
            });

            const result = await response.json();

            if (result.success) {
                this.updateStatus('ready', 'Variations generated');
                this.displayVariations(result.variations);
                
                this.addMessageToChat('assistant', 
                    `I've generated ${result.variations.length} variations of your family design. ` +
                    `Each variation has different dimensional or material properties.`
                );
            } else {
                throw new Error(result.error || 'Failed to generate variations');
            }

        } catch (error) {
            console.error('Variation generation error:', error);
            this.addMessageToChat('assistant', `Failed to generate variations: ${error.message}`);
            this.updateStatus('error', 'Variation generation failed');
        }
    }

    /**
     * Display variations
     */
    displayVariations(variations) {
        const variationPreview = document.getElementById('variationPreview');
        if (!variationPreview) return;

        variationPreview.innerHTML = '<h4>Generated Variations:</h4>';
        
        variations.forEach((variation, index) => {
            const variationElement = document.createElement('div');
            variationElement.className = 'variation-item';
            variationElement.innerHTML = `
                <div class="variation-header">
                    <h5>Variation ${index + 1}</h5>
                    <span class="variation-score">Score: ${variation.qaValidation.overallPass ? 'Pass' : 'Issues'}</span>
                </div>
                <div class="variation-details">
                    <p><strong>Name:</strong> ${variation.sir.familyMetadata.familyName}</p>
                    <p><strong>Parameters:</strong> ${variation.sir.parameters.familyParameters.length}</p>
                </div>
            `;
            
            variationPreview.appendChild(variationElement);
        });
    }

    /**
     * Handle input changes
     */
    handleInputChange(event) {
        const input = event.target;
        const value = input.value;
        
        // Auto-resize textarea
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 8 * 16) + 'px';
        
        // Show suggestions based on input
        this.updateSuggestions(value);
    }

    /**
     * Update input suggestions
     */
    updateSuggestions(input) {
        const suggestionsContainer = document.getElementById('inputSuggestions');
        if (!suggestionsContainer) return;

        const suggestions = this.generateSuggestions(input);
        
        if (suggestions.length === 0) {
            suggestionsContainer.innerHTML = '';
            return;
        }

        suggestionsContainer.innerHTML = suggestions.map(suggestion => 
            `<span class="suggestion-tag" onclick="useSuggestion('${suggestion}')">${suggestion}</span>`
        ).join('');
    }

    /**
     * Generate suggestions based on input
     */
    generateSuggestions(input) {
        const commonPatterns = [
            'Create a',
            'Design a',
            'Make a',
            'Generate a',
            'Build a'
        ];

        const categories = [
            'door',
            'window',
            'furniture',
            'structural beam',
            'column',
            'equipment'
        ];

        const modifiers = [
            'parametric',
            'adjustable',
            'customizable',
            'standard',
            'commercial',
            'residential'
        ];

        const suggestions = [];
        
        if (input.length < 3) return suggestions;

        // Add category suggestions
        categories.forEach(category => {
            if (category.includes(input.toLowerCase())) {
                suggestions.push(`Create a ${category}`);
            }
        });

        return suggestions.slice(0, 5);
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + Enter to send message
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            this.sendMessage();
        }

        // Escape to close modals
        if (event.key === 'Escape') {
            this.closeAllModals();
        }
    }

    /**
     * Handle resize events
     */
    handleResize() {
        // Adjust layout for mobile
        const isMobile = window.innerWidth < 768;
        const previewPanel = document.getElementById('previewPanel');
        
        if (previewPanel && isMobile) {
            previewPanel.style.position = 'fixed';
            previewPanel.style.bottom = '0';
            previewPanel.style.top = 'auto';
            previewPanel.style.height = '50vh';
        }
    }

    /**
     * Handle before unload
     */
    handleBeforeUnload(event) {
        if (this.isGenerating) {
            event.preventDefault();
            event.returnValue = 'Family generation is in progress. Are you sure you want to leave?';
        }
    }

    /**
     * Update status bar
     */
    updateStatus(status, message) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        
        if (statusText) {
            statusText.textContent = message;
        }
    }

    /**
     * Update progress bar
     */
    updateProgress(percentage) {
        console.log('Updating progress to:', percentage + '%');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const statusProgress = document.getElementById('statusProgress');
        
        if (statusProgress) {
            statusProgress.style.display = 'flex';
        }
        
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
        
        if (progressText) {
            progressText.textContent = `${Math.round(percentage)}%`;
        }
    }

    /**
     * Hide progress bar
     */
    hideProgress() {
        const statusProgress = document.getElementById('statusProgress');
        if (statusProgress) {
            statusProgress.style.display = 'none';
        }
    }

    /**
     * Show modal
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }

    /**
     * Close modal
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    /**
     * Close all modals
     */
    closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.classList.remove('active'));
    }

    /**
     * Utility methods
     */
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getCurrentContext() {
        return {
            conversationHistory: this.conversationHistory.slice(-5), // Last 5 messages
            currentFamily: this.currentFamilyData?.sir || null
        };
    }

    getCurrentOptions() {
        return {
            lodLevel: document.getElementById('lodLevel')?.value || '200',
            qualityMode: document.getElementById('qualityMode')?.value || 'balanced'
        };
    }

    async selectTargetFolder() {
        // Simplified folder selection for demo
        // In production, this would integrate with BIM 360 folder picker
        return 'b.1234567890abcdef1234567890abcdef12345678.d.1234567890abcdef1234567890abcdef12345678';
    }

    setupAutoSave() {
        // Auto-save conversation every 30 seconds
        setInterval(() => {
            if (this.conversationHistory.length > 0) {
                localStorage.setItem('bim-llm-conversation', JSON.stringify(this.conversationHistory));
            }
        }, 30000);
    }

    loadSession(sessionId) {
        // Load existing session
        this.currentSessionId = sessionId;
        // Implementation would load session data from API
    }

    startNewFamily() {
        this.currentSessionId = null;
        this.currentFamilyData = null;
        this.conversationHistory = [];
        
        // Clear chat
        const chatMessages = document.getElementById('chatMessages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
        
        // Hide preview panel
        const previewPanel = document.getElementById('previewPanel');
        if (previewPanel) {
            previewPanel.style.display = 'none';
        }
        
        // Reset status
        this.updateStatus('ready', 'Ready to create new family');
    }

    clearChat() {
        if (confirm('Are you sure you want to clear the chat?')) {
            this.startNewFamily();
        }
    }

    exportChat() {
        const chatData = {
            sessionId: this.currentSessionId,
            conversationHistory: this.conversationHistory,
            familyData: this.currentFamilyData,
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(chatData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bim-llm-session-${this.currentSessionId || 'new'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    updateSettings() {
        // Settings are automatically included in API calls
        console.log('Settings updated');
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            window.location.href = '/api/aps/logout';
        }
    }

    /**
     * Initialize APS Configuration
     */
    async initializeAPSConfiguration() {
        try {
            // Load engines (don't fail if this fails)
            try {
                await this.loadEngines();
            } catch (error) {
                console.warn('Failed to load engines, continuing without them:', error);
            }
            
            // Check current configuration status
            await this.checkConfigurationStatus();
            
            // Setup event listeners
            this.setupConfigurationEventListeners();
            
        } catch (error) {
            console.error('Error initializing APS configuration:', error);
            this.updateConfigurationStatus('error', 'Failed to initialize APS configuration');
        }
    }

    /**
     * Load available engines
     */
    async loadEngines() {
        try {
            const response = await fetch('/api/aps/designautomation/engines');
            if (!response.ok) {
                throw new Error('Failed to load engines');
            }
            
            const engines = await response.json();
            console.log('Engines response:', engines);
            
            const enginesSelect = document.getElementById('engines');
            
            enginesSelect.innerHTML = '<option value="">Select Engine...</option>';
            
            // Check if engines is an array and has items
            if (Array.isArray(engines) && engines.length > 0) {
                engines.forEach(engine => {
                    // Handle both string format and object format
                    let engineId, engineName;
                    if (typeof engine === 'string') {
                        engineId = engine;
                        engineName = engine;
                    } else if (engine && engine.id) {
                        engineId = engine.id;
                        engineName = engine.id;
                    } else {
                        return; // Skip invalid entries
                    }
                    
                    const option = document.createElement('option');
                    option.value = engineId;
                    option.textContent = engineName;
                    enginesSelect.appendChild(option);
                });
            } else {
                console.warn('No engines found or invalid response format');
                const option = document.createElement('option');
                option.value = '';
                option.textContent = 'No engines available';
                enginesSelect.appendChild(option);
            }
            
        } catch (error) {
            console.error('Error loading engines:', error);
            // Don't throw error, just show empty dropdown
            const enginesSelect = document.getElementById('engines');
            enginesSelect.innerHTML = '<option value="">Error loading engines</option>';
        }
    }

    /**
     * Check configuration status
     */
    async checkConfigurationStatus() {
        try {
            // Check if AppBundle and Activity exist
            const response = await fetch('/api/aps/designautomation/activities');
            if (!response.ok) {
                throw new Error('Failed to check activities');
            }
            
            const activities = await response.json();
            console.log('Activities response:', activities);
            
            // Check if activities is an array and has items
            if (!Array.isArray(activities) || activities.length === 0) {
                this.updateConfigurationStatus('not_configured', 'APS needs to be configured');
                document.getElementById('configControls').style.display = 'block';
                return;
            }
            
            // Find CreateWindowAppActivity with proper error handling
            const createWindowActivity = activities.find(activity => {
                if (!activity) {
                    return false;
                }
                
                // Handle both string format and object format
                let activityId;
                if (typeof activity === 'string') {
                    activityId = activity;
                } else if (typeof activity === 'object') {
                    activityId = activity.id || activity.activityId;
                } else {
                    return false;
                }
                
                return activityId && activityId.includes('CreateWindowAppActivity');
            });
            
            if (createWindowActivity) {
                this.updateConfigurationStatus('configured', 'APS is configured and ready');
                document.getElementById('configControls').style.display = 'none';
                document.getElementById('clearAccount').style.display = 'block';
            } else {
                this.updateConfigurationStatus('not_configured', 'APS needs to be configured');
                document.getElementById('configControls').style.display = 'block';
            }
            
        } catch (error) {
            console.error('Error checking configuration:', error);
            this.updateConfigurationStatus('error', 'Failed to check configuration: ' + error.message);
        }
    }

    /**
     * Setup configuration event listeners
     */
    setupConfigurationEventListeners() {
        // Configure APS button
        document.getElementById('createAppBundleActivity').addEventListener('click', () => {
            this.createAppBundleActivity();
        });
        
        // Clear configuration button
        document.getElementById('clearAccount').addEventListener('click', () => {
            this.clearConfiguration();
        });
    }

    /**
     * Create AppBundle and Activity
     */
    async createAppBundleActivity() {
        const zipFileName = document.getElementById('localBundles').value;
        const engine = document.getElementById('engines').value;
        
        if (!zipFileName || !engine) {
            alert('Please select both engine and bundle');
            return;
        }
        
        const fileName = zipFileName.split('.')[0];
        
        try {
            this.showConfigurationProgress('creating_appbundle', fileName + 'AppBundle');
            
            // Create AppBundle
            const appBundleResponse = await fetch('/api/aps/designautomation/appbundles', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName: fileName,
                    engine: engine
                })
            });
            
            if (!appBundleResponse.ok) {
                throw new Error('Failed to create AppBundle');
            }
            
            this.showConfigurationProgress('creating_activity', fileName + 'Activity');
            
            // Create Activity
            const activityResponse = await fetch('/api/aps/designautomation/activities', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    fileName: fileName,
                    engine: engine
                })
            });
            
            if (!activityResponse.ok) {
                throw new Error('Failed to create Activity');
            }
            
            this.showConfigurationProgress('creating_completed', fileName + 'AppBundle & ' + fileName + 'Activity');
            
            // Update status
            setTimeout(() => {
                this.checkConfigurationStatus();
            }, 2000);
            
        } catch (error) {
            console.error('Error creating AppBundle and Activity:', error);
            this.showConfigurationProgress('creating_failed', fileName + 'AppBundle & ' + fileName + 'Activity');
        }
    }

    /**
     * Clear configuration
     */
    async clearConfiguration() {
        const zipFileName = document.getElementById('localBundles').value;
        const fileName = zipFileName.split('.')[0];
        const activityName = fileName + 'Activity';
        const appBundleName = fileName + 'AppBundle';
        
        if (!confirm('Are you sure you want to delete the AppBundle & Activity for this zip Package?')) {
            return;
        }
        
        try {
            this.showConfigurationProgress('deleting_appbundle', appBundleName);
            
            // Delete AppBundle
            await fetch(`/api/aps/designautomation/appbundles/${appBundleName}`, {
                method: 'DELETE'
            });
            
            this.showConfigurationProgress('deleting_activity', activityName);
            
            // Delete Activity
            await fetch(`/api/aps/designautomation/activities/${activityName}`, {
                method: 'DELETE'
            });
            
            this.showConfigurationProgress('deleting_completed', appBundleName + ' & ' + activityName);
            
            // Update status
            setTimeout(() => {
                this.checkConfigurationStatus();
            }, 2000);
            
        } catch (error) {
            console.error('Error clearing configuration:', error);
            this.showConfigurationProgress('deleting_failed', appBundleName + ' & ' + activityName);
        }
    }

    /**
     * Update configuration status
     */
    updateConfigurationStatus(status, message) {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('configStatusText');
        
        statusIndicator.className = 'status-indicator';
        
        switch (status) {
            case 'configured':
                statusIndicator.classList.add('configured');
                statusText.textContent = message;
                break;
            case 'not_configured':
                statusIndicator.classList.add('error');
                statusText.textContent = message;
                break;
            case 'error':
                statusIndicator.classList.add('error');
                statusText.textContent = message;
                break;
            default:
                statusText.textContent = message;
        }
    }

    /**
     * Show configuration progress
     */
    showConfigurationProgress(status, info = '') {
        const progressBar = document.getElementById('configProgressBar');
        const progressText = document.getElementById('configText');
        const configProgress = document.getElementById('configProgress');
        const createBtn = document.getElementById('createAppBundleActivity');
        const clearBtn = document.getElementById('clearAccount');
        
        configProgress.style.display = 'block';
        
        switch (status) {
            case 'creating_appbundle':
                progressBar.style.width = '20%';
                progressText.innerHTML = '<h4>Step 1/2: Creating AppBundle: ' + info + '</h4>';
                createBtn.disabled = true;
                clearBtn.disabled = true;
                break;
            case 'creating_activity':
                progressBar.style.width = '60%';
                progressText.innerHTML = '<h4>Step 2/2: Creating Activity: ' + info + '</h4>';
                break;
            case 'creating_completed':
                progressBar.style.width = '100%';
                progressText.innerHTML = '<h4>✅ Configuration Complete: ' + info + '</h4>';
                setTimeout(() => {
                    configProgress.style.display = 'none';
                    createBtn.disabled = false;
                    clearBtn.disabled = false;
                }, 3000);
                break;
            case 'creating_failed':
                progressBar.style.width = '0%';
                progressText.innerHTML = '<h4>❌ Configuration Failed: ' + info + '</h4>';
                setTimeout(() => {
                    configProgress.style.display = 'none';
                    createBtn.disabled = false;
                    clearBtn.disabled = false;
                }, 5000);
                break;
            case 'deleting_appbundle':
                progressBar.style.width = '20%';
                progressText.innerHTML = '<h4>Step 1/2: Deleting AppBundle: ' + info + '</h4>';
                createBtn.disabled = true;
                clearBtn.disabled = true;
                break;
            case 'deleting_activity':
                progressBar.style.width = '60%';
                progressText.innerHTML = '<h4>Step 2/2: Deleting Activity: ' + info + '</h4>';
                break;
            case 'deleting_completed':
                progressBar.style.width = '100%';
                progressText.innerHTML = '<h4>✅ Configuration Cleared: ' + info + '</h4>';
                setTimeout(() => {
                    configProgress.style.display = 'none';
                    createBtn.disabled = false;
                    clearBtn.disabled = false;
                }, 3000);
                break;
            case 'deleting_failed':
                progressBar.style.width = '0%';
                progressText.innerHTML = '<h4>❌ Clear Failed: ' + info + '</h4>';
                setTimeout(() => {
                    configProgress.style.display = 'none';
                    createBtn.disabled = false;
                    clearBtn.disabled = false;
                }, 5000);
                break;
        }
    }

    /**
     * Initialize model selection functionality
     */
    initializeModelSelection() {
        this.selectedModel = null;
        this.models = [];
        
        // Load models on initialization
        this.loadModels();
        
        // Set up refresh interval (every 30 seconds)
        setInterval(() => {
            this.loadModels();
        }, 30000);
    }

    /**
     * Load available models from the server
     */
    async loadModels() {
        try {
            const response = await fetch('/api/famai/v1/models');
            const data = await response.json();
            
            if (data.success) {
                this.models = data.models;
                this.renderModels();
            } else {
                console.error('Failed to load models:', data.error);
            }
        } catch (error) {
            console.error('Error loading models:', error);
        }
    }

    /**
     * Render the models list
     */
    renderModels() {
        const modelList = document.getElementById('modelList');
        const noModels = document.getElementById('noModels');
        const viewModelBtn = document.getElementById('viewModelBtn');
        
        if (this.models.length === 0) {
            noModels.style.display = 'block';
            modelList.innerHTML = '';
            modelList.appendChild(noModels);
            viewModelBtn.disabled = true;
            return;
        }
        
        noModels.style.display = 'none';
        modelList.innerHTML = '';
        
        this.models.forEach(model => {
            const modelItem = this.createModelItem(model);
            modelList.appendChild(modelItem);
        });
        
        // Update view button state
        viewModelBtn.disabled = !this.selectedModel;
    }

    /**
     * Create a model item element
     */
    createModelItem(model) {
        const item = document.createElement('div');
        item.className = 'model-item';
        item.dataset.workitemId = model.workitemId;
        
        const createdDate = new Date(model.createdAt).toLocaleDateString();
        const createdTime = new Date(model.createdAt).toLocaleTimeString();
        
        item.innerHTML = `
            <div class="model-header">
                <div class="model-name">${model.familyName}</div>
                <div class="model-date">${createdDate} ${createdTime}</div>
            </div>
            <div class="model-meta">
                <div class="model-dimensions">
                    <span class="dimension-badge">W: ${model.dimensions.width}mm</span>
                    <span class="dimension-badge">H: ${model.dimensions.height}mm</span>
                </div>
                <div class="model-file">${model.fileName}</div>
            </div>
        `;
        
        // Add click handler
        item.addEventListener('click', () => {
            this.selectModel(model);
        });
        
        return item;
    }

    /**
     * Select a model
     */
    selectModel(model) {
        // Remove previous selection
        document.querySelectorAll('.model-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // Add selection to clicked item
        const item = document.querySelector(`[data-workitem-id="${model.workitemId}"]`);
        if (item) {
            item.classList.add('selected');
        }
        
        this.selectedModel = model;
        
        // Update view button
        const viewModelBtn = document.getElementById('viewModelBtn');
        viewModelBtn.disabled = false;
        
        console.log('Selected model:', model);
    }

    /**
     * Open the viewer with the selected model
     */
    async openViewer() {
        if (!this.selectedModel) {
            alert('Please select a model first');
            return;
        }
        
        try {
            // Show viewer container
            const viewerContainer = document.getElementById('viewerContainer');
            const viewerTitle = document.getElementById('viewerTitle');
            const viewerLoading = document.getElementById('viewerLoading');
            
            viewerContainer.classList.add('active');
            viewerTitle.textContent = this.selectedModel.familyName;
            viewerLoading.style.display = 'block';
            
            // Get model details
            const response = await fetch(`/api/famai/v1/models/${this.selectedModel.workitemId}`);
            const data = await response.json();
            
            if (data.success) {
                const model = data.model;
                
                // Initialize APS Viewer
                await this.initializeViewer(model);
            } else {
                throw new Error(data.error || 'Failed to get model details');
            }
            
        } catch (error) {
            console.error('Error opening viewer:', error);
            alert('Failed to open viewer: ' + error.message);
            this.closeViewer();
        }
    }

    /**
     * Initialize the APS Viewer
     */
    async initializeViewer(model) {
        try {
            // Get viewer token
            const tokenResponse = await fetch('/api/viewer/token');
            const tokenData = await tokenResponse.json();
            
            if (!tokenData.access_token) {
                throw new Error('Failed to get viewer token');
            }
            
            // Initialize APS Viewer
            const options = {
                env: 'AutodeskProduction',
                getAccessToken: () => tokenData.access_token,
                api: 'derivativeV2'
            };
            
            Autodesk.Viewing.Initializer(options, () => {
                const viewer = new Autodesk.Viewing.GuiViewer3D(document.getElementById('viewer'));
                viewer.start();
                
                // Load the model
                const documentId = `urn:${model.urn}`;
                Autodesk.Viewing.Document.load(documentId, (doc) => {
                    const viewables = doc.getRoot().getDefaultGeometry();
                    if (viewables) {
                        viewer.loadDocumentNode(doc, viewables).then(() => {
                            // Hide loading indicator
                            document.getElementById('viewerLoading').style.display = 'none';
                            console.log('Model loaded successfully');
                        });
                    } else {
                        throw new Error('No viewables found in document');
                    }
                }, (error) => {
                    throw new Error('Failed to load document: ' + error);
                });
            });
            
        } catch (error) {
            console.error('Error initializing viewer:', error);
            throw error;
        }
    }

    /**
     * Close the viewer
     */
    closeViewer() {
        const viewerContainer = document.getElementById('viewerContainer');
        viewerContainer.classList.remove('active');
        
        // Clear viewer content
        const viewer = document.getElementById('viewer');
        viewer.innerHTML = '';
        
        // Show loading indicator again
        document.getElementById('viewerLoading').style.display = 'block';
    }
}

// Global functions for HTML onclick handlers
function sendMessage() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.sendMessage();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
        alert('Please wait for the interface to load completely');
    }
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

function useExample(promptOrType) {
    const examples = {
        'door': 'Create a 36-inch wide parametric single-leaf door with glass panel and hardware',
        'window': 'Design a double-hung window with adjustable width and height, including sill height parameter',
        'furniture': 'Make a parametric office desk with drawers, adjustable width and depth'
    };
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        // Use the prompt directly if it's a string, otherwise look it up in examples
        chatInput.value = examples[promptOrType] || promptOrType;
        chatInput.focus();
    }
}

function useSuggestion(suggestion) {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.value = suggestion;
        chatInput.focus();
    }
}

function executeFamily() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.executeFamily();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function testFamily() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.testFamily();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function refineFamily() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.refineFamily();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function generateVariations() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.generateVariations();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function submitRefinement() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.submitRefinement();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function submitVariations() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.submitVariations();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function closeModal(modalId) {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.closeModal(modalId);
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function togglePreview() {
    const previewPanel = document.getElementById('previewPanel');
    if (previewPanel) {
        previewPanel.style.display = previewPanel.style.display === 'none' ? 'flex' : 'none';
    }
}

function startNewFamily() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.startNewFamily();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function clearChat() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.clearChat();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function exportChat() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.exportChat();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function updateSettings() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.updateSettings();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function logout() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.logout();
    } else {
        console.error('BIM-LLM Interface not initialized yet');
    }
}

function useRefinementSuggestion(type) {
    const suggestions = {
        'dimensions': 'Adjust the dimensions to be more standard',
        'materials': 'Add material parameters for different components',
        'parameters': 'Add more parametric controls for flexibility',
        'geometry': 'Modify the geometry to be more detailed'
    };
    
    const refinementInput = document.getElementById('refinementInput');
    if (refinementInput && suggestions[type]) {
        refinementInput.value = suggestions[type];
    }
}

function loadTemplate() {
    alert('Template loading feature coming soon!');
}

function showExamples() {
    alert('Examples feature coming soon!');
}

function refreshModels() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.loadModels();
    }
}

function openViewer() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.openViewer();
    }
}

function closeViewer() {
    if (window.bimLLMInterface) {
        window.bimLLMInterface.closeViewer();
    }
}

// Initialize the interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('Initializing BIM-LLM Interface...');
        window.bimLLMInterface = new BIMLLMInterface();
        // Initialize model selection
        window.bimLLMInterface.initializeModelSelection();
        
        console.log('BIM-LLM Interface initialized successfully');
    } catch (error) {
        console.error('Failed to initialize BIM-LLM Interface:', error);
        // Show error message to user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notice';
        errorDiv.innerHTML = `
            <div style="background: #ff6b6b; color: white; padding: 15px; margin: 10px; border-radius: 5px; text-align: center;">
                <i class="fas fa-exclamation-triangle"></i>
                <strong>Error:</strong> Failed to initialize BIM-LLM Interface. Please refresh the page.
            </div>
        `;
        document.body.insertBefore(errorDiv, document.body.firstChild);
    }
});
