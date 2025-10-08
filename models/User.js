/////////////////////////////////////////////////////////////////////
// User Model for MongoDB
// Copyright (c) 2024 famAI Platform
//
// This module defines the User schema and model
/////////////////////////////////////////////////////////////////////

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    // Basic user information
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    
    password: {
        type: String,
        required: function() {
            return this.authProvider === 'local';
        },
        minlength: 6
    },
    
    // Profile information
    profile: {
        firstName: {
            type: String,
            trim: true,
            maxlength: 50
        },
        lastName: {
            type: String,
            trim: true,
            maxlength: 50
        },
        displayName: {
            type: String,
            trim: true,
            maxlength: 100
        },
        avatar: {
            type: String, // URL to avatar image
            default: null
        },
        bio: {
            type: String,
            maxlength: 500,
            default: ''
        },
        company: {
            type: String,
            maxlength: 100,
            default: ''
        },
        role: {
            type: String,
            enum: ['architect', 'engineer', 'designer', 'student', 'other'],
            default: 'other'
        }
    },
    
    // Authentication providers
    authProvider: {
        type: String,
        enum: ['local', 'google', 'microsoft', 'autodesk'],
        default: 'local'
    },
    
    // External provider IDs
    providerIds: {
        google: String,
        microsoft: String,
        autodesk: String
    },
    
    // APS (Autodesk Platform Services) integration
    apsIntegration: {
        clientId: String,
        accessToken: String,
        refreshToken: String,
        tokenExpiry: Date,
        isConfigured: {
            type: Boolean,
            default: false
        },
        lastSync: Date
    },
    
    // User preferences
    preferences: {
        language: {
            type: String,
            default: 'en',
            enum: ['en', 'es', 'fr', 'de', 'zh']
        },
        timezone: {
            type: String,
            default: 'UTC'
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
        notifications: {
            email: {
                type: Boolean,
                default: true
            },
            push: {
                type: Boolean,
                default: true
            },
            familyComplete: {
                type: Boolean,
                default: true
            },
            systemUpdates: {
                type: Boolean,
                default: false
            }
        }
    },
    
    // Account status
    status: {
        type: String,
        enum: ['active', 'inactive', 'suspended', 'pending'],
        default: 'active'
    },
    
    // Email verification
    emailVerified: {
        type: Boolean,
        default: false
    },
    emailVerificationToken: String,
    emailVerificationExpiry: Date,
    
    // Password reset
    passwordResetToken: String,
    passwordResetExpiry: Date,
    
    // Login tracking
    lastLogin: Date,
    loginCount: {
        type: Number,
        default: 0
    },
    
    // Usage statistics
    stats: {
        familiesCreated: {
            type: Number,
            default: 0
        },
        totalUsageTime: {
            type: Number, // in minutes
            default: 0
        },
        lastActivity: Date,
        favoriteCategories: [{
            category: String,
            count: Number
        }]
    },
    
    // Subscription and billing
    subscription: {
        plan: {
            type: String,
            enum: ['free', 'pro', 'enterprise'],
            default: 'free'
        },
        status: {
            type: String,
            enum: ['active', 'cancelled', 'expired', 'trial'],
            default: 'active'
        },
        startDate: Date,
        endDate: Date,
        monthlyLimit: {
            type: Number,
            default: 10 // families per month for free plan
        },
        currentUsage: {
            type: Number,
            default: 0
        }
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt
    toJSON: { 
        virtuals: true,
        transform: function(doc, ret) {
            delete ret.password;
            delete ret.emailVerificationToken;
            delete ret.passwordResetToken;
            delete ret.__v;
            return ret;
        }
    },
    toObject: { virtuals: true }
});

// Indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ 'providerIds.google': 1 });
userSchema.index({ 'providerIds.microsoft': 1 });
userSchema.index({ 'providerIds.autodesk': 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
    if (this.profile.firstName && this.profile.lastName) {
        return `${this.profile.firstName} ${this.profile.lastName}`;
    }
    return this.profile.displayName || this.email.split('@')[0];
});

// Virtual for display name
userSchema.virtual('displayName').get(function() {
    return this.profile.displayName || this.fullName || this.email.split('@')[0];
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
    // Only hash the password if it has been modified (or is new)
    if (!this.isModified('password')) return next();
    
    try {
        // Hash password with cost of 12
        const salt = await bcrypt.genSalt(12);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to update last login
userSchema.methods.updateLastLogin = function() {
    this.lastLogin = new Date();
    this.loginCount += 1;
    this.stats.lastActivity = new Date();
    return this.save();
};

// Instance method to increment family count
userSchema.methods.incrementFamilyCount = function() {
    this.stats.familiesCreated += 1;
    this.subscription.currentUsage += 1;
    this.stats.lastActivity = new Date();
    return this.save();
};

// Instance method to check if user can create more families
userSchema.methods.canCreateFamily = function() {
    if (this.subscription.plan === 'free') {
        return this.subscription.currentUsage < this.subscription.monthlyLimit;
    }
    return true; // Pro and Enterprise plans have no limits
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
    return this.findOne({ email: email.toLowerCase() });
};

// Static method to find by provider ID
userSchema.statics.findByProviderId = function(provider, providerId) {
    return this.findOne({ [`providerIds.${provider}`]: providerId });
};

// Static method to get user statistics
userSchema.statics.getUserStats = function() {
    return this.aggregate([
        {
            $group: {
                _id: null,
                totalUsers: { $sum: 1 },
                activeUsers: {
                    $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                },
                totalFamilies: { $sum: '$stats.familiesCreated' },
                avgFamiliesPerUser: { $avg: '$stats.familiesCreated' }
            }
        }
    ]);
};

module.exports = mongoose.model('User', userSchema);
