/////////////////////////////////////////////////////////////////////
// Family Model for MongoDB
// Copyright (c) 2024 famAI Platform
//
// This module defines the Family schema and model for storing
// created Revit families and their metadata
/////////////////////////////////////////////////////////////////////

const mongoose = require('mongoose');

const familySchema = new mongoose.Schema({
    // Basic family information
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    
    description: {
        type: String,
        maxlength: 500,
        default: ''
    },
    
    category: {
        type: String,
        required: true,
        enum: [
            'Doors', 'Windows', 'Furniture', 'Structural Framing', 
            'Structural Columns', 'Mechanical Equipment', 
            'Electrical Equipment', 'Plumbing Fixtures', 'Generic'
        ]
    },
    
    // User who created this family
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Session information
    sessionId: {
        type: String,
        required: true
    },
    
    // Original prompt that generated this family
    originalPrompt: {
        type: String,
        required: true,
        maxlength: 1000
    },
    
    // Structured Intermediate Representation (SIR) - flexible structure
    sir: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    
    // Generated code
    generatedCode: {
        python: {
            type: String,
            default: ''
        },
        metadata: {
            executionTime: Number,
            complexity: String,
            linesOfCode: Number,
            familyName: String,
            category: String,
            lodLevel: Number
        }
    },
    
    // Quality Assurance results
    qaValidation: {
        overallPass: {
            type: Boolean,
            default: false
        },
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        validations: {
            geometryValidation: {
                pass: Boolean,
                score: Number,
                issues: [String],
                warnings: [String]
            },
            parameterValidation: {
                pass: Boolean,
                score: Number,
                issues: [String],
                warnings: [String]
            },
            performanceValidation: {
                pass: Boolean,
                score: Number,
                issues: [String],
                warnings: [String]
            },
            complianceValidation: {
                pass: Boolean,
                score: Number,
                issues: [String],
                warnings: [String]
            },
            flexingValidation: {
                pass: Boolean,
                score: Number,
                issues: [String],
                warnings: [String]
            },
            metadataValidation: {
                pass: Boolean,
                score: Number,
                issues: [String],
                warnings: [String]
            }
        },
        recommendations: [String]
    },
    
    // APS Design Automation information
    apsExecution: {
        workitemId: {
            type: String
        },
        status: {
            type: String,
            enum: ['pending', 'inprogress', 'success', 'failed', 'cancelled'],
            default: 'pending'
        },
        progress: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        submittedAt: Date,
        completedAt: Date,
        estimatedCompletionTime: Number, // in seconds
        errorMessage: String,
        debugInfo: mongoose.Schema.Types.Mixed
    },
    
    // File information
    files: {
        rfaFile: {
            filename: String,
            size: Number, // in bytes
            downloadUrl: String,
            bucketKey: String,
            objectKey: String,
            urn: String, // For viewer
            createdAt: Date
        },
        thumbnail: {
            url: String,
            width: Number,
            height: Number
        },
        viewer: {
            urn: String,
            translationStatus: {
                type: String,
                enum: ['not_started', 'in_progress', 'completed', 'failed'],
                default: 'not_started'
            },
            manifest: mongoose.Schema.Types.Mixed
        }
    },
    
    // Family parameters (extracted for easy querying)
    parameters: {
        width: Number,
        height: Number,
        depth: Number,
        sillHeight: Number,
        inset: Number,
        materials: [String],
        windowStyle: String, // For windows
        doorType: String, // For doors
        custom: mongoose.Schema.Types.Mixed
    },
    
    // Tags for organization and search
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    
    // Family status
    status: {
        type: String,
        enum: ['draft', 'generating', 'ready', 'failed', 'archived'],
        default: 'draft'
    },
    
    // Version control
    version: {
        type: Number,
        default: 1
    },
    
    parentFamily: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Family'
    },
    
    // Refinement history
    refinements: [{
        prompt: String,
        changes: mongoose.Schema.Types.Mixed,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Usage statistics
    stats: {
        downloadCount: {
            type: Number,
            default: 0
        },
        viewCount: {
            type: Number,
            default: 0
        },
        lastAccessed: Date,
        rating: {
            average: {
                type: Number,
                min: 0,
                max: 5,
                default: 0
            },
            count: {
                type: Number,
                default: 0
            }
        }
    },
    
    // Privacy settings
    privacy: {
        isPublic: {
            type: Boolean,
            default: false
        },
        isShared: {
            type: Boolean,
            default: false
        },
        sharedWith: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            permission: {
                type: String,
                enum: ['view', 'download', 'edit'],
                default: 'view'
            }
        }]
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes for performance
familySchema.index({ createdBy: 1, createdAt: -1 });
familySchema.index({ category: 1 });
familySchema.index({ status: 1 });
familySchema.index({ 'apsExecution.workitemId': 1 });
familySchema.index({ sessionId: 1 });
familySchema.index({ tags: 1 });
familySchema.index({ 'privacy.isPublic': 1 });
familySchema.index({ 'stats.rating.average': -1 });
familySchema.index({ 'stats.downloadCount': -1 });

// Text index for search
familySchema.index({
    name: 'text',
    description: 'text',
    originalPrompt: 'text',
    tags: 'text'
});

// Virtual for full file path
familySchema.virtual('filePath').get(function() {
    if (this.files.rfaFile && this.files.rfaFile.filename) {
        return `/api/families/${this._id}/download`;
    }
    return null;
});

// Virtual for viewer URL
familySchema.virtual('viewerUrl').get(function() {
    if (this.files.viewer && this.files.viewer.urn) {
        return `/viewer?urn=${encodeURIComponent(this.files.viewer.urn)}`;
    }
    return null;
});

// Virtual for family age
familySchema.virtual('age').get(function() {
    return Date.now() - this.createdAt.getTime();
});

// Pre-save middleware
familySchema.pre('save', function(next) {
    // Update parameters from SIR if not already set
    if (this.sir && this.sir.parameters && this.sir.parameters.familyParameters) {
        const params = this.sir.parameters.familyParameters;
        
        // Handle both array and string formats
        let familyParams = params;
        if (typeof params === 'string') {
            try {
                familyParams = JSON.parse(params);
            } catch (e) {
                console.warn('Failed to parse familyParameters string');
                familyParams = [];
            }
        }
        
        // Extract common parameters
        const widthParam = familyParams.find(p => p.name && p.name.toLowerCase().includes('width'));
        const heightParam = familyParams.find(p => p.name && p.name.toLowerCase().includes('height'));
        const depthParam = familyParams.find(p => p.name && p.name.toLowerCase().includes('depth'));
        const sillParam = familyParams.find(p => p.name && p.name.toLowerCase().includes('sill'));
        const insetParam = familyParams.find(p => p.name && p.name.toLowerCase().includes('inset'));
        
        if (widthParam && !this.parameters.width) {
            this.parameters.width = widthParam.defaultValue;
        }
        if (heightParam && !this.parameters.height) {
            this.parameters.height = heightParam.defaultValue;
        }
        if (depthParam && !this.parameters.depth) {
            this.parameters.depth = depthParam.defaultValue;
        }
        if (sillParam && !this.parameters.sillHeight) {
            this.parameters.sillHeight = sillParam.defaultValue;
        }
        if (insetParam && !this.parameters.inset) {
            this.parameters.inset = insetParam.defaultValue;
        }
    }
    
    next();
});

// Instance methods
familySchema.methods.updateStatus = function(status, progress = null) {
    this.status = status;
    if (progress !== null) {
        this.apsExecution.progress = progress;
    }
    if (status === 'success') {
        this.apsExecution.completedAt = new Date();
        this.apsExecution.status = 'success';
    } else if (status === 'failed') {
        this.apsExecution.status = 'failed';
    }
    return this.save();
};

familySchema.methods.incrementDownloadCount = function() {
    this.stats.downloadCount += 1;
    this.stats.lastAccessed = new Date();
    return this.save();
};

familySchema.methods.incrementViewCount = function() {
    this.stats.viewCount += 1;
    this.stats.lastAccessed = new Date();
    return this.save();
};

familySchema.methods.addRefinement = function(prompt, changes) {
    this.refinements.push({
        prompt: prompt,
        changes: changes,
        timestamp: new Date()
    });
    this.version += 1;
    return this.save();
};

// Static methods
familySchema.statics.findByUser = function(userId, options = {}) {
    const query = { createdBy: userId };
    
    if (options.status) {
        query.status = options.status;
    }
    
    if (options.category) {
        query.category = options.category;
    }
    
    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(options.limit || 50)
        .populate('createdBy', 'profile.firstName profile.lastName email');
};

familySchema.statics.findPublic = function(options = {}) {
    const query = { 'privacy.isPublic': true, status: 'ready' };
    
    if (options.category) {
        query.category = options.category;
    }
    
    if (options.search) {
        query.$text = { $search: options.search };
    }
    
    return this.find(query)
        .sort({ 'stats.rating.average': -1, createdAt: -1 })
        .limit(options.limit || 20)
        .populate('createdBy', 'profile.firstName profile.lastName');
};

familySchema.statics.getCategoryStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                avgRating: { $avg: '$stats.rating.average' },
                totalDownloads: { $sum: '$stats.downloadCount' }
            }
        },
        { $sort: { count: -1 } }
    ]);
};

familySchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        { $match: { createdBy: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalFamilies: { $sum: 1 },
                readyFamilies: {
                    $sum: { $cond: [{ $eq: ['$status', 'ready'] }, 1, 0] }
                },
                totalDownloads: { $sum: '$stats.downloadCount' },
                avgRating: { $avg: '$stats.rating.average' },
                categories: { $addToSet: '$category' }
            }
        }
    ]);
};

module.exports = mongoose.model('Family', familySchema);
