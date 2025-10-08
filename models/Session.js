/////////////////////////////////////////////////////////////////////
// Session Model for MongoDB
// Copyright (c) 2024 famAI Platform
//
// This module defines the Session schema for tracking user sessions
// and conversation history
/////////////////////////////////////////////////////////////////////

const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    // User who owns this session
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Session identifier
    sessionId: {
        type: String,
        required: true
    },
    
    // Session metadata
    name: {
        type: String,
        maxlength: 100,
        default: 'New Session'
    },
    
    description: {
        type: String,
        maxlength: 500,
        default: ''
    },
    
    // Session status
    status: {
        type: String,
        enum: ['active', 'completed', 'archived', 'failed'],
        default: 'active'
    },
    
    // Conversation history
    conversations: [{
        timestamp: {
            type: Date,
            default: Date.now
        },
        type: {
            type: String,
            enum: ['user_input', 'ai_response', 'system_message', 'error'],
            required: true
        },
        content: {
            prompt: String,
            response: mongoose.Schema.Types.Mixed,
            metadata: mongoose.Schema.Types.Mixed
        },
        familyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Family'
        }
    }],
    
    // Current family being worked on
    currentFamily: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Family'
    },
    
    // Session statistics
    stats: {
        totalInteractions: {
            type: Number,
            default: 0
        },
        familiesCreated: {
            type: Number,
            default: 0
        },
        totalTokens: {
            type: Number,
            default: 0
        },
        averageResponseTime: {
            type: Number,
            default: 0
        },
        lastActivity: {
            type: Date,
            default: Date.now
        }
    },
    
    // Session settings
    settings: {
        language: {
            type: String,
            default: 'en'
        },
        units: {
            type: String,
            enum: ['metric', 'imperial'],
            default: 'metric'
        },
        defaultLOD: {
            type: Number,
            enum: [100, 200, 300, 400, 500],
            default: 300
        },
        aiModel: {
            type: String,
            default: 'gemini-2.5-flash'
        }
    },
    
    // Session context
    context: {
        currentCategory: String,
        currentParameters: mongoose.Schema.Types.Mixed,
        preferences: mongoose.Schema.Types.Mixed,
        workingMemory: mongoose.Schema.Types.Mixed
    },
    
    // Tags for organization
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    
    // Session expiration
    expiresAt: {
        type: Date,
        default: function() {
            // Sessions expire after 30 days of inactivity
            return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Indexes
sessionSchema.index({ userId: 1, createdAt: -1 });
sessionSchema.index({ sessionId: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ 'stats.lastActivity': -1 });
sessionSchema.index({ expiresAt: 1 });

// Virtual for session duration
sessionSchema.virtual('duration').get(function() {
    if (this.updatedAt && this.createdAt) {
        return this.updatedAt.getTime() - this.createdAt.getTime();
    }
    return 0;
});

// Virtual for is active
sessionSchema.virtual('isActive').get(function() {
    return this.status === 'active' && this.expiresAt > new Date();
});

// Instance methods
sessionSchema.methods.addConversation = function(type, content, familyId = null) {
    this.conversations.push({
        timestamp: new Date(),
        type: type,
        content: content,
        familyId: familyId
    });
    
    this.stats.totalInteractions += 1;
    this.stats.lastActivity = new Date();
    
    if (type === 'ai_response' && content.response && content.response.sir) {
        this.stats.totalTokens += this.estimateTokens(content.response.sir);
    }
    
    return this.save();
};

sessionSchema.methods.updateCurrentFamily = function(familyId) {
    this.currentFamily = familyId;
    if (familyId) {
        this.stats.familiesCreated += 1;
    }
    this.stats.lastActivity = new Date();
    return this.save();
};

sessionSchema.methods.updateContext = function(contextUpdate) {
    this.context = { ...this.context, ...contextUpdate };
    this.stats.lastActivity = new Date();
    return this.save();
};

sessionSchema.methods.extendExpiry = function() {
    this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    return this.save();
};

sessionSchema.methods.estimateTokens = function(content) {
    // Simple token estimation (rough approximation)
    if (typeof content === 'string') {
        return Math.ceil(content.length / 4);
    }
    if (typeof content === 'object') {
        return Math.ceil(JSON.stringify(content).length / 4);
    }
    return 0;
};

// Static methods
sessionSchema.statics.findByUser = function(userId, options = {}) {
    const query = { userId: userId };
    
    if (options.status) {
        query.status = options.status;
    }
    
    if (options.active) {
        query.status = 'active';
        query.expiresAt = { $gt: new Date() };
    }
    
    return this.find(query)
        .sort({ 'stats.lastActivity': -1 })
        .limit(options.limit || 20)
        .populate('currentFamily', 'name category status')
        .populate('userId', 'profile.firstName profile.lastName email');
};

sessionSchema.statics.findActiveByUser = function(userId) {
    return this.findOne({
        userId: userId,
        status: 'active',
        expiresAt: { $gt: new Date() }
    }).populate('currentFamily');
};

sessionSchema.statics.cleanupExpired = function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

sessionSchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalSessions: { $sum: 1 },
                activeSessions: {
                    $sum: { 
                        $cond: [
                            { $and: [
                                { $eq: ['$status', 'active'] },
                                { $gt: ['$expiresAt', new Date()] }
                            ]}, 
                            1, 
                            0
                        ]
                    }
                },
                totalInteractions: { $sum: '$stats.totalInteractions' },
                totalFamilies: { $sum: '$stats.familiesCreated' },
                totalTokens: { $sum: '$stats.totalTokens' }
            }
        }
    ]);
};

// Pre-save middleware
sessionSchema.pre('save', function(next) {
    // Update last activity on save
    this.stats.lastActivity = new Date();
    
    // Extend expiry if session is being updated
    if (this.isModified() && !this.isNew) {
        this.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    
    next();
});

module.exports = mongoose.model('Session', sessionSchema);
