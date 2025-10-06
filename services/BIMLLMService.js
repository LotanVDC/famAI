/////////////////////////////////////////////////////////////////////
// BIM-LLM Blueprint: Gemini API Integration Module
// Copyright (c) 2024 BIM-LLM Platform
//
// This module handles integration with Google's Gemini API for
// natural language to structured BIM content generation
/////////////////////////////////////////////////////////////////////

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('../config');

class BIMLLMService {
    constructor() {
        this.demoMode = !!config.demoMode || !process.env.GEMINI_API_KEY;
        this.apiKey = process.env.GEMINI_API_KEY;

        if (!this.demoMode) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.model = this.genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            generationConfig: {
                temperature: 0.1, // Low temperature for deterministic output
                topK: 1,
                topP: 0.8,
                maxOutputTokens: 8192,
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH", 
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
            });
        }
        
        // Conversation context management
        this.conversationHistory = new Map();
        this.contextVariables = new Map();
    }

    /**
     * Generate Structured Intermediate Representation (SIR) from natural language
     * @param {string} userPrompt - Natural language description of desired BIM content
     * @param {string} sessionId - Unique session identifier for context management
     * @param {Object} previousContext - Previous conversation context
     * @returns {Promise<Object>} Structured Intermediate Representation
     */
    async generateSIR(userPrompt, sessionId, previousContext = {}) {
        try {
            if (this.demoMode) {
                return this.generateDemoSIR(userPrompt, sessionId);
            }
            // Build context-aware prompt
            const systemPrompt = this.buildSystemPrompt(previousContext);
            const fullPrompt = `${systemPrompt}\n\nUser Request: ${userPrompt}`;
            
            // Generate content using Gemini
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();
            
            // Parse JSON response
            const sir = this.parseSIRResponse(text);
            
            // Validate SIR structure
            this.validateSIR(sir);
            
            // Store in conversation history
            this.updateConversationContext(sessionId, userPrompt, sir);
            
            return {
                success: true,
                sir: sir,
                sessionId: sessionId,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('BIM-LLM SIR Generation Error:', error);
            
            // Fallback to demo mode on any error
            console.log('BIMLLMService: Falling back to demo mode');
            return this.generateDemoSIR(userPrompt, sessionId);
        }
    }

    /**
     * Generate demo SIR for unauthenticated users or API failures
     */
    generateDemoSIR(userPrompt, sessionId) {
        const lowerPrompt = userPrompt.toLowerCase();
        
        // Extract dimensions from prompt with unit detection
        let width = 2.0, height = 4.0;  // Default in feet (Revit's internal units)
        
        // More specific regex patterns that look for number immediately adjacent to keywords
        // Pattern: number + unit + (0-3 words) + keyword OR keyword + (0-3 words) + number + unit
        const widthMmMatch = lowerPrompt.match(/(\d+)\s*mm\s+(?:\w+\s+){0,2}wide|(\d+)\s*mm\s+(?:\w+\s+){0,2}width|wide\s+(?:\w+\s+){0,2}(\d+)\s*mm|width\s+(?:\w+\s+){0,2}(\d+)\s*mm/);
        const heightMmMatch = lowerPrompt.match(/(\d+)\s*mm\s+(?:\w+\s+){0,2}high|(\d+)\s*mm\s+(?:\w+\s+){0,2}height|high\s+(?:\w+\s+){0,2}(\d+)\s*mm|height\s+(?:\w+\s+){0,2}(\d+)\s*mm/);
        
        // For feet - similar pattern
        const widthFtMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s+(?:\w+\s+){0,2}wide|(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s+(?:\w+\s+){0,2}width|wide\s+(?:\w+\s+){0,2}(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')|width\s+(?:\w+\s+){0,2}(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')/);
        const heightFtMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s+(?:\w+\s+){0,2}high|(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s+(?:\w+\s+){0,2}height|high\s+(?:\w+\s+){0,2}(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')|height\s+(?:\w+\s+){0,2}(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')/);
        
        // Convert mm to feet (Revit internal units): 1 foot = 304.8 mm
        if (widthMmMatch) {
            const widthMm = parseInt(widthMmMatch[1] || widthMmMatch[2] || widthMmMatch[3] || widthMmMatch[4]);
            width = widthMm / 304.8;  // Convert mm to feet
            console.log(`Extracted width: ${widthMm} mm = ${width.toFixed(4)} feet`);
        } else if (widthFtMatch) {
            width = parseFloat(widthFtMatch[1] || widthFtMatch[2] || widthFtMatch[3] || widthFtMatch[4] || '2.0');
            console.log(`Extracted width: ${width} feet`);
        }
        
        if (heightMmMatch) {
            const heightMm = parseInt(heightMmMatch[1] || heightMmMatch[2] || heightMmMatch[3] || heightMmMatch[4]);
            height = heightMm / 304.8;  // Convert mm to feet
            console.log(`Extracted height: ${heightMm} mm = ${height.toFixed(4)} feet`);
        } else if (heightFtMatch) {
            height = parseFloat(heightFtMatch[1] || heightFtMatch[2] || heightFtMatch[3] || heightFtMatch[4] || '4.0');
            console.log(`Extracted height: ${height} feet`);
        }
        
        // Extract sill height (distance from floor to window bottom)
        let sillHeight = 3.0;  // Default: 3 feet (~900mm)
        const sillHeightMmMatch = lowerPrompt.match(/(\d+)\s*mm\s+(?:\w+\s+){0,3}(?:sill|from\s+floor|above\s+floor|floor\s+to)/);
        const sillHeightFtMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s+(?:\w+\s+){0,3}(?:sill|from\s+floor|above\s+floor|floor\s+to)/);
        
        if (sillHeightMmMatch) {
            const sillHeightMm = parseInt(sillHeightMmMatch[1]);
            sillHeight = sillHeightMm / 304.8;  // Convert mm to feet
            console.log(`Extracted sill height: ${sillHeightMm} mm = ${sillHeight.toFixed(4)} feet`);
        } else if (sillHeightFtMatch) {
            sillHeight = parseFloat(sillHeightFtMatch[1]);
            console.log(`Extracted sill height: ${sillHeight} feet`);
        }
        
        // Extract inset (frame depth)
        let inset = 0.05;  // Default: 0.05 feet (~15mm)
        const insetMmMatch = lowerPrompt.match(/(\d+)\s*mm\s+(?:\w+\s+){0,2}(?:inset|depth|frame\s+depth)/);
        const insetFtMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:ft|foot|feet|')\s+(?:\w+\s+){0,2}(?:inset|depth|frame\s+depth)/);
        const insetInchMatch = lowerPrompt.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")\s+(?:\w+\s+){0,2}(?:inset|depth|frame\s+depth)/);
        
        if (insetMmMatch) {
            const insetMm = parseInt(insetMmMatch[1]);
            inset = insetMm / 304.8;  // Convert mm to feet
            console.log(`Extracted inset: ${insetMm} mm = ${inset.toFixed(4)} feet`);
        } else if (insetInchMatch) {
            const insetInch = parseFloat(insetInchMatch[1]);
            inset = insetInch / 12;  // Convert inches to feet
            console.log(`Extracted inset: ${insetInch} inches = ${inset.toFixed(4)} feet`);
        } else if (insetFtMatch) {
            inset = parseFloat(insetFtMatch[1]);
            console.log(`Extracted inset: ${inset} feet`);
        }
        
        // Extract materials from prompt
        let glassMaterial = 'Default';
        let sashMaterial = 'Default';
        
        if (lowerPrompt.includes('glass')) {
            glassMaterial = 'Glass';
        }
        if (lowerPrompt.includes('wood') || lowerPrompt.includes('timber')) {
            sashMaterial = 'Wood';
        } else if (lowerPrompt.includes('metal') || lowerPrompt.includes('steel') || lowerPrompt.includes('aluminum')) {
            sashMaterial = 'Metal';
        }
        
        let demoFamily = {
            familyMetadata: {
                familyName: "Generated Family",
                category: "Generic",
                description: "Parametric family generated from natural language",
                lodLevel: 200,
                isHosted: false,
                hostingType: null
            },
            geometryDefinition: {
                extrusions: [{
                    name: "MainBody",
                    profile: [
                        { x: 0, y: 0 },
                        { x: width, y: 0 },
                        { x: width, y: height },
                        { x: 0, y: height }
                    ],
                    startPoint: { x: 0, y: 0, z: 0 },
                    endPoint: { x: width, y: height, z: 100 },
                    material: sashMaterial
                }],
                blends: [],
                sweeps: [],
                revolves: []
            },
            parameters: {
                familyParameters: [
                    { name: "Width", type: "Length", defaultValue: width, isInstance: true },
                    { name: "Height", type: "Length", defaultValue: height, isInstance: true },
                    { name: "SillHeight", type: "Length", defaultValue: sillHeight, isInstance: true },
                    { name: "Inset", type: "Length", defaultValue: inset, isInstance: true },
                    { name: "GlassPaneMaterial", type: "Material", defaultValue: glassMaterial, isInstance: true },
                    { name: "SashMaterial", type: "Material", defaultValue: sashMaterial, isInstance: true }
                ],
                familyTypes: [{
                    name: "Type 1",
                    parameters: { 
                        Width: width, 
                        Height: height,
                        SillHeight: sillHeight,
                        Inset: inset,
                        GlassPaneMaterial: glassMaterial,
                        SashMaterial: sashMaterial
                    }
                }]
            },
            constraints: [],
            materials: [
                { name: glassMaterial, color: "#87CEEB" },
                { name: sashMaterial, color: "#8B4513" }
            ],
            visibility: {
                coarse: true,
                medium: true,
                fine: true
            }
        };

        // Customize based on prompt content
        if (lowerPrompt.includes('door')) {
            demoFamily.familyMetadata.category = "Doors";
            demoFamily.familyMetadata.familyName = "Generated Door";
            demoFamily.familyMetadata.description = "Parametric door family";
            demoFamily.geometryDefinition.extrusions[0].endPoint.z = 50; // Door thickness
        } else if (lowerPrompt.includes('window')) {
            demoFamily.familyMetadata.category = "Windows";
            demoFamily.familyMetadata.familyName = "Generated Window";
            demoFamily.familyMetadata.description = "Parametric window family";
            demoFamily.geometryDefinition.extrusions[0].endPoint.z = 100; // Window frame
            
            // Add glass pane geometry
            demoFamily.geometryDefinition.extrusions.push({
                name: "GlassPane",
                profile: [
                    { x: 10, y: 10 },
                    { x: width - 10, y: 10 },
                    { x: width - 10, y: height - 10 },
                    { x: 10, y: height - 10 }
                ],
                startPoint: { x: 10, y: 10, z: 5 },
                endPoint: { x: width - 10, y: height - 10, z: 95 },
                material: glassMaterial
            });
        } else if (lowerPrompt.includes('furniture')) {
            demoFamily.familyMetadata.category = "Furniture";
            demoFamily.familyMetadata.familyName = "Generated Furniture";
            demoFamily.familyMetadata.description = "Parametric furniture family";
        }

        return {
            success: true,
            sir: demoFamily,
            sessionId: sessionId,
            timestamp: new Date().toISOString(),
            isDemo: true
        };
    }

    /**
     * Build system prompt with BIM-specific instructions
     */
    buildSystemPrompt(context = {}) {
        return `You are a specialized BIM-LLM Programmer Agent for Revit Family creation. Your role is to convert natural language descriptions into structured, machine-readable BIM specifications.

CRITICAL REQUIREMENTS:
1. You MUST output ONLY valid JSON following the Structured Intermediate Representation (SIR) schema
2. You are NOT generating geometry directly - you are creating code specifications
3. You MUST maintain context from previous interactions in this session
4. You MUST infer implicit BIM requirements (hosting, constraints, etc.)

SIR SCHEMA STRUCTURE:
{
  "familyMetadata": {
    "familyName": "string",
    "category": "string (e.g., 'Doors', 'Windows', 'Furniture')",
    "description": "string",
    "lodLevel": "number (100-500)",
    "isHosted": "boolean",
    "hostingType": "string (if hosted)"
  },
  "geometryDefinition": {
    "extrusions": [
      {
        "name": "string",
        "startPoint": {"x": 0, "y": 0, "z": 0},
        "endPoint": {"x": 0, "y": 0, "z": 0},
        "profile": "array of points",
        "material": "string",
        "visibility": {"coarse": true, "medium": true, "fine": true}
      }
    ],
    "referencePlanes": [
      {
        "name": "string",
        "origin": {"x": 0, "y": 0, "z": 0},
        "normal": {"x": 0, "y": 0, "z": 1},
        "locked": true
      }
    ],
    "constraints": [
      {
        "element1": "string",
        "element2": "string", 
        "constraintType": "string",
        "offset": 0
      }
    ]
  },
  "parameters": {
    "familyParameters": [
      {
        "name": "string",
        "type": "string (Length, Number, Text, Material, etc.)",
        "group": "string",
        "isInstance": true,
        "defaultValue": "any",
        "formula": "string (optional)"
      }
    ],
    "sharedParameters": [],
    "familyTypes": [
      {
        "name": "string",
        "parameters": {}
      }
    ]
  },
  "materials": [
    {
      "name": "string",
      "parameterName": "string",
      "defaultValue": "string"
    }
  ],
  "nestedFamilies": [],
  "visibilitySettings": {
    "coarse": ["element1", "element2"],
    "medium": ["element1", "element2"],
    "fine": ["element1", "element2"]
  }
}

CONTEXT AWARENESS:
Previous context: ${JSON.stringify(context, null, 2)}

IMPLICIT BIM REQUIREMENTS:
- For doors: Include wall cutting voids, hosting parameters, swing direction
- For windows: Include wall cutting voids, hosting parameters, sill height
- For furniture: Include placement constraints, material parameters
- For MEP: Include connection points, flow direction parameters

OUTPUT ONLY VALID JSON - NO EXPLANATIONS OR MARKDOWN.`;
    }

    /**
     * Parse and validate SIR response from Gemini
     */
    parseSIRResponse(text) {
        try {
            // Extract JSON from response (remove any markdown formatting)
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in response');
            }
            
            const sir = JSON.parse(jsonMatch[0]);
            return sir;
        } catch (error) {
            throw new Error(`Failed to parse SIR response: ${error.message}`);
        }
    }

    /**
     * Validate SIR structure against required schema
     */
    validateSIR(sir) {
        const requiredFields = [
            'familyMetadata',
            'geometryDefinition', 
            'parameters',
            'materials',
            'visibilitySettings'
        ];
        
        for (const field of requiredFields) {
            if (!sir[field]) {
                throw new Error(`Missing required SIR field: ${field}`);
            }
        }
        
        // Validate family metadata
        if (!sir.familyMetadata.familyName || !sir.familyMetadata.category) {
            throw new Error('Missing required family metadata');
        }
        
        // Validate LOD level
        const lod = sir.familyMetadata.lodLevel;
        if (lod < 100 || lod > 500) {
            throw new Error('LOD level must be between 100 and 500');
        }
    }

    /**
     * Update conversation context for iterative design
     */
    updateConversationContext(sessionId, userPrompt, sir) {
        if (!this.conversationHistory.has(sessionId)) {
            this.conversationHistory.set(sessionId, []);
        }
        
        const history = this.conversationHistory.get(sessionId);
        history.push({
            timestamp: new Date().toISOString(),
            userPrompt: userPrompt,
            sir: sir,
            type: 'generation'
        });
        
        // Keep only last 10 interactions to manage context size
        if (history.length > 10) {
            history.shift();
        }
    }

    /**
     * Get conversation history for context-aware generation
     */
    getConversationContext(sessionId) {
        const history = this.conversationHistory.get(sessionId) || [];
        return {
            recentInteractions: history.slice(-3), // Last 3 interactions
            totalInteractions: history.length,
            sessionId: sessionId
        };
    }

    /**
     * Generate iterative refinement based on feedback
     */
    async refineSIR(sessionId, feedback, originalSIR) {
        try {
            const context = this.getConversationContext(sessionId);
            
            const refinementPrompt = `Based on the following feedback, refine the existing SIR:

FEEDBACK: ${feedback}

ORIGINAL SIR: ${JSON.stringify(originalSIR, null, 2)}

CONTEXT: ${JSON.stringify(context, null, 2)}

Provide an updated SIR that addresses the feedback while maintaining all valid aspects of the original design. Output ONLY valid JSON.`;

            const result = await this.model.generateContent(refinementPrompt);
            const response = await result.response;
            const text = response.text();
            
            const refinedSIR = this.parseSIRResponse(text);
            this.validateSIR(refinedSIR);
            
            // Update context
            this.updateConversationContext(sessionId, `Refinement: ${feedback}`, refinedSIR);
            
            return {
                success: true,
                sir: refinedSIR,
                sessionId: sessionId,
                refinementType: 'feedback_based'
            };
            
        } catch (error) {
            console.error('SIR Refinement Error:', error);
            return {
                success: false,
                error: error.message,
                sessionId: sessionId
            };
        }
    }

    /**
     * Generate batch variations of a base SIR
     */
    async generateVariations(baseSIR, variationCount = 5) {
        try {
            const variations = [];
            
            for (let i = 0; i < variationCount; i++) {
                const variationPrompt = `Create a variation of this BIM family design:

BASE SIR: ${JSON.stringify(baseSIR, null, 2)}

Create variation ${i + 1} with different dimensions, materials, or parametric relationships while maintaining the core functionality. Output ONLY valid JSON.`;

                const result = await this.model.generateContent(variationPrompt);
                const response = await result.response;
                const text = response.text();
                
                const variation = this.parseSIRResponse(text);
                this.validateSIR(variation);
                
                variations.push(variation);
            }
            
            return {
                success: true,
                variations: variations,
                baseSIR: baseSIR
            };
            
        } catch (error) {
            console.error('Variation Generation Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = BIMLLMService;
