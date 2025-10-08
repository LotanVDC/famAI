/////////////////////////////////////////////////////////////////////
// User Authentication Routes
// Copyright (c) 2024 famAI Platform
//
// This module handles user registration, login, and authentication
/////////////////////////////////////////////////////////////////////

const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Session = require('../models/Session');
const { OAuth } = require('./common/oauth');

const router = express.Router();

/////////////////////////////////////////////////////////////////////
// Helper Functions
/////////////////////////////////////////////////////////////////////

/**
 * Generate a unique session ID
 */
function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new user session
 */
async function createUserSession(userId, sessionName = 'New Session') {
    try {
        const sessionId = generateSessionId();
        
        const session = new Session({
            userId: userId,
            sessionId: sessionId,
            name: sessionName,
            status: 'active'
        });
        
        await session.save();
        return session;
    } catch (error) {
        console.error('Error creating user session:', error);
        throw error;
    }
}

/////////////////////////////////////////////////////////////////////
// Authentication Routes
/////////////////////////////////////////////////////////////////////

/**
 * Register a new user
 * POST /api/auth/register
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName, displayName, company, role } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                error: 'User with this email already exists'
            });
        }
        
        // Create new user
        const user = new User({
            email: email,
            password: password,
            profile: {
                firstName: firstName || '',
                lastName: lastName || '',
                displayName: displayName || '',
                company: company || '',
                role: role || 'other'
            }
        });
        
        await user.save();
        
        // Create initial session
        const session = await createUserSession(user._id, 'Welcome Session');
        
        // Update user's last login
        await user.updateLastLogin();
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: {
                id: user._id,
                email: user.email,
                profile: user.profile,
                sessionId: session.sessionId
            }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed',
            details: error.message
        });
    }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Email and password are required'
            });
        }
        
        // Find user by email
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                error: 'Invalid email or password'
            });
        }
        
        // Check if user is active
        if (user.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'Account is not active'
            });
        }
        
        // Update last login
        await user.updateLastLogin();
        
        // Create or get active session
        let session = await Session.findActiveByUser(user._id);
        if (!session) {
            session = await createUserSession(user._id, 'Active Session');
        } else {
            await session.extendExpiry();
        }
        
        // Set session in cookie
        req.session.userId = user._id.toString();
        req.session.sessionId = session.sessionId;
        req.session.isAuthenticated = true;
        
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                email: user.email,
                profile: user.profile,
                preferences: user.preferences,
                stats: user.stats,
                subscription: user.subscription,
                sessionId: session.sessionId
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            details: error.message
        });
    }
});

/**
 * Logout user
 * POST /api/auth/logout
 */
router.post('/logout', async (req, res) => {
    try {
        // Clear session
        req.session = null;
        
        res.json({
            success: true,
            message: 'Logout successful'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            details: error.message
        });
    }
});

/**
 * Get current user profile
 * GET /api/auth/profile
 */
router.get('/profile', async (req, res) => {
    try {
        const userId = req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                profile: user.profile,
                preferences: user.preferences,
                stats: user.stats,
                subscription: user.subscription,
                status: user.status,
                createdAt: user.createdAt,
                lastLogin: user.lastLogin
            }
        });
        
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get profile',
            details: error.message
        });
    }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', async (req, res) => {
    try {
        const userId = req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Update profile fields
        const { firstName, lastName, displayName, company, role, bio } = req.body;
        
        if (firstName !== undefined) user.profile.firstName = firstName;
        if (lastName !== undefined) user.profile.lastName = lastName;
        if (displayName !== undefined) user.profile.displayName = displayName;
        if (company !== undefined) user.profile.company = company;
        if (role !== undefined) user.profile.role = role;
        if (bio !== undefined) user.profile.bio = bio;
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                email: user.email,
                profile: user.profile
            }
        });
        
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update profile',
            details: error.message
        });
    }
});

/**
 * Update user preferences
 * PUT /api/auth/preferences
 */
router.put('/preferences', async (req, res) => {
    try {
        const userId = req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Update preferences
        const { language, timezone, units, defaultLOD, notifications } = req.body;
        
        if (language !== undefined) user.preferences.language = language;
        if (timezone !== undefined) user.preferences.timezone = timezone;
        if (units !== undefined) user.preferences.units = units;
        if (defaultLOD !== undefined) user.preferences.defaultLOD = defaultLOD;
        if (notifications !== undefined) user.preferences.notifications = { ...user.preferences.notifications, ...notifications };
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Preferences updated successfully',
            preferences: user.preferences
        });
        
    } catch (error) {
        console.error('Preferences update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update preferences',
            details: error.message
        });
    }
});

/**
 * Change password
 * PUT /api/auth/password
 */
router.put('/password', async (req, res) => {
    try {
        const userId = req.session?.userId;
        const { currentPassword, newPassword } = req.body;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                error: 'Current password and new password are required'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                error: 'Current password is incorrect'
            });
        }
        
        // Update password
        user.password = newPassword;
        await user.save();
        
        res.json({
            success: true,
            message: 'Password changed successfully'
        });
        
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to change password',
            details: error.message
        });
    }
});

/**
 * Get user statistics
 * GET /api/auth/stats
 */
router.get('/stats', async (req, res) => {
    try {
        const userId = req.session?.userId;
        
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'Not authenticated'
            });
        }
        
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        
        // Get session statistics
        const sessionStats = await Session.getUserStats(userId);
        
        res.json({
            success: true,
            stats: {
                user: user.stats,
                sessions: sessionStats[0] || {
                    totalSessions: 0,
                    activeSessions: 0,
                    totalInteractions: 0,
                    totalFamilies: 0,
                    totalTokens: 0
                }
            }
        });
        
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get statistics',
            details: error.message
        });
    }
});

/**
 * Check authentication status
 * GET /api/auth/status
 */
router.get('/status', (req, res) => {
    const isAuthenticated = req.session?.isAuthenticated || false;
    const userId = req.session?.userId || null;
    
    res.json({
        success: true,
        authenticated: isAuthenticated,
        userId: userId
    });
});

module.exports = router;
