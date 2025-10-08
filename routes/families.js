/////////////////////////////////////////////////////////////////////
// Family Management Routes
// Copyright (c) 2024 famAI Platform
//
// This module handles family creation, retrieval, and management
/////////////////////////////////////////////////////////////////////

const express = require('express');
const Family = require('../models/Family');
const User = require('../models/User');
const Session = require('../models/Session');

const router = express.Router();

/////////////////////////////////////////////////////////////////////
// Middleware for authentication
/////////////////////////////////////////////////////////////////////

router.use(async (req, res, next) => {
    const userId = req.session?.userId;
    
    if (!userId) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required'
        });
    }
    
    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json({
            success: false,
            error: 'User not found'
        });
    }
    
    req.user = user;
    next();
});

/////////////////////////////////////////////////////////////////////
// Family Routes
/////////////////////////////////////////////////////////////////////

/**
 * Get user's families
 * GET /api/families
 */
router.get('/', async (req, res) => {
    try {
        const { status, category, limit = 20, page = 1 } = req.query;
        const userId = req.user._id;
        
        const options = {
            status: status,
            category: category,
            limit: parseInt(limit),
            page: parseInt(page)
        };
        
        const families = await Family.findByUser(userId, options);
        
        // Get total count for pagination
        const totalCount = await Family.countDocuments({ createdBy: userId });
        
        res.json({
            success: true,
            families: families,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                pages: Math.ceil(totalCount / parseInt(limit))
            }
        });
        
    } catch (error) {
        console.error('Get families error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get families',
            details: error.message
        });
    }
});

/**
 * Get public families
 * GET /api/families/public
 */
router.get('/public', async (req, res) => {
    try {
        const { category, search, limit = 20, page = 1 } = req.query;
        
        const options = {
            category: category,
            search: search,
            limit: parseInt(limit),
            page: parseInt(page)
        };
        
        const families = await Family.findPublic(options);
        
        res.json({
            success: true,
            families: families
        });
        
    } catch (error) {
        console.error('Get public families error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get public families',
            details: error.message
        });
    }
});

/**
 * Get family by ID
 * GET /api/families/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        
        const family = await Family.findOne({
            _id: id,
            $or: [
                { createdBy: userId },
                { 'privacy.isPublic': true },
                { 'privacy.isShared': true, 'privacy.sharedWith.user': userId }
            ]
        }).populate('createdBy', 'profile.firstName profile.lastName email');
        
        if (!family) {
            return res.status(404).json({
                success: false,
                error: 'Family not found or access denied'
            });
        }
        
        // Increment view count
        await family.incrementViewCount();
        
        res.json({
            success: true,
            family: family
        });
        
    } catch (error) {
        console.error('Get family error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get family',
            details: error.message
        });
    }
});

/**
 * Create new family
 * POST /api/families
 */
router.post('/', async (req, res) => {
    try {
        const userId = req.user._id;
        const {
            name,
            description,
            category,
            originalPrompt,
            sir,
            generatedCode,
            qaValidation,
            sessionId
        } = req.body;
        
        // Check if user can create more families
        if (!req.user.canCreateFamily()) {
            return res.status(403).json({
                success: false,
                error: 'Monthly family creation limit reached',
                details: `You have created ${req.user.subscription.currentUsage} out of ${req.user.subscription.monthlyLimit} families this month`
            });
        }
        
        // Create new family
        const family = new Family({
            name: name || 'Untitled Family',
            description: description || '',
            category: category || 'Generic',
            createdBy: userId,
            sessionId: sessionId,
            originalPrompt: originalPrompt,
            sir: sir,
            generatedCode: generatedCode,
            qaValidation: qaValidation,
            status: 'draft'
        });
        
        await family.save();
        
        // Update user's family count
        await req.user.incrementFamilyCount();
        
        // Update session if provided
        if (sessionId) {
            const session = await Session.findOne({ sessionId: sessionId });
            if (session) {
                await session.updateCurrentFamily(family._id);
            }
        }
        
        res.status(201).json({
            success: true,
            message: 'Family created successfully',
            family: {
                id: family._id,
                name: family.name,
                category: family.category,
                status: family.status,
                createdAt: family.createdAt
            }
        });
        
    } catch (error) {
        console.error('Create family error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create family',
            details: error.message
        });
    }
});

/**
 * Update family
 * PUT /api/families/:id
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        
        const family = await Family.findOne({
            _id: id,
            createdBy: userId
        });
        
        if (!family) {
            return res.status(404).json({
                success: false,
                error: 'Family not found or access denied'
            });
        }
        
        // Update allowed fields
        const allowedUpdates = [
            'name', 'description', 'tags', 'privacy.isPublic', 
            'privacy.isShared', 'status'
        ];
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                if (field.includes('.')) {
                    const [parent, child] = field.split('.');
                    if (!family[parent]) family[parent] = {};
                    family[parent][child] = req.body[field];
                } else {
                    family[field] = req.body[field];
                }
            }
        });
        
        await family.save();
        
        res.json({
            success: true,
            message: 'Family updated successfully',
            family: family
        });
        
    } catch (error) {
        console.error('Update family error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update family',
            details: error.message
        });
    }
});

/**
 * Update family execution status
 * PUT /api/families/:id/status
 */
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, progress, workitemId, errorMessage } = req.body;
        const userId = req.user._id;
        
        const family = await Family.findOne({
            _id: id,
            createdBy: userId
        });
        
        if (!family) {
            return res.status(404).json({
                success: false,
                error: 'Family not found or access denied'
            });
        }
        
        // Update APS execution info
        if (workitemId) {
            family.apsExecution.workitemId = workitemId;
        }
        
        if (errorMessage) {
            family.apsExecution.errorMessage = errorMessage;
        }
        
        // Update status and progress
        await family.updateStatus(status, progress);
        
        res.json({
            success: true,
            message: 'Family status updated successfully',
            family: {
                id: family._id,
                status: family.status,
                apsExecution: family.apsExecution
            }
        });
        
    } catch (error) {
        console.error('Update family status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update family status',
            details: error.message
        });
    }
});

/**
 * Add refinement to family
 * POST /api/families/:id/refinements
 */
router.post('/:id/refinements', async (req, res) => {
    try {
        const { id } = req.params;
        const { prompt, changes } = req.body;
        const userId = req.user._id;
        
        const family = await Family.findOne({
            _id: id,
            createdBy: userId
        });
        
        if (!family) {
            return res.status(404).json({
                success: false,
                error: 'Family not found or access denied'
            });
        }
        
        await family.addRefinement(prompt, changes);
        
        res.json({
            success: true,
            message: 'Refinement added successfully',
            family: {
                id: family._id,
                version: family.version,
                refinements: family.refinements
            }
        });
        
    } catch (error) {
        console.error('Add refinement error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add refinement',
            details: error.message
        });
    }
});

/**
 * Download family file
 * GET /api/families/:id/download
 */
router.get('/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        
        const family = await Family.findOne({
            _id: id,
            $or: [
                { createdBy: userId },
                { 'privacy.isPublic': true },
                { 'privacy.isShared': true, 'privacy.sharedWith.user': userId }
            ]
        });
        
        if (!family) {
            return res.status(404).json({
                success: false,
                error: 'Family not found or access denied'
            });
        }
        
        if (family.status !== 'ready') {
            return res.status(400).json({
                success: false,
                error: 'Family is not ready for download',
                status: family.status
            });
        }
        
        if (!family.files.rfaFile || !family.files.rfaFile.downloadUrl) {
            return res.status(404).json({
                success: false,
                error: 'Family file not available'
            });
        }
        
        // Increment download count
        await family.incrementDownloadCount();
        
        // Redirect to download URL
        res.redirect(family.files.rfaFile.downloadUrl);
        
    } catch (error) {
        console.error('Download family error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to download family',
            details: error.message
        });
    }
});

/**
 * Delete family
 * DELETE /api/families/:id
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;
        
        const family = await Family.findOne({
            _id: id,
            createdBy: userId
        });
        
        if (!family) {
            return res.status(404).json({
                success: false,
                error: 'Family not found or access denied'
            });
        }
        
        await Family.findByIdAndDelete(id);
        
        res.json({
            success: true,
            message: 'Family deleted successfully'
        });
        
    } catch (error) {
        console.error('Delete family error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete family',
            details: error.message
        });
    }
});

/**
 * Get family statistics
 * GET /api/families/stats
 */
router.get('/stats/overview', async (req, res) => {
    try {
        const userId = req.user._id;
        
        // Get user's family statistics
        const userStats = await Family.getUserStats(userId);
        
        // Get category statistics
        const categoryStats = await Family.getCategoryStats();
        
        res.json({
            success: true,
            stats: {
                user: userStats[0] || {
                    totalFamilies: 0,
                    readyFamilies: 0,
                    totalDownloads: 0,
                    avgRating: 0,
                    categories: []
                },
                categories: categoryStats
            }
        });
        
    } catch (error) {
        console.error('Get family stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get family statistics',
            details: error.message
        });
    }
});

/**
 * Search families
 * GET /api/families/search
 */
router.get('/search', async (req, res) => {
    try {
        const { q, category, limit = 20 } = req.query;
        const userId = req.user._id;
        
        if (!q) {
            return res.status(400).json({
                success: false,
                error: 'Search query is required'
            });
        }
        
        const searchQuery = {
            $and: [
                { $text: { $search: q } },
                {
                    $or: [
                        { createdBy: userId },
                        { 'privacy.isPublic': true },
                        { 'privacy.isShared': true, 'privacy.sharedWith.user': userId }
                    ]
                }
            ]
        };
        
        if (category) {
            searchQuery.$and.push({ category: category });
        }
        
        const families = await Family.find(searchQuery)
            .sort({ score: { $meta: 'textScore' } })
            .limit(parseInt(limit))
            .populate('createdBy', 'profile.firstName profile.lastName');
        
        res.json({
            success: true,
            families: families,
            query: q
        });
        
    } catch (error) {
        console.error('Search families error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search families',
            details: error.message
        });
    }
});

module.exports = router;
