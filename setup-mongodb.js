#!/usr/bin/env node

/////////////////////////////////////////////////////////////////////
// MongoDB Setup Script for famAI
// Copyright (c) 2024 famAI Platform
//
// This script helps set up the MongoDB database with initial data
/////////////////////////////////////////////////////////////////////

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Family = require('./models/Family');
const Session = require('./models/Session');

// MongoDB connection URL
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/famai';

async function setupDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URL);
        console.log('✅ Connected to MongoDB successfully');

        // Create indexes
        console.log('📊 Creating database indexes...');
        await createIndexes();
        console.log('✅ Indexes created successfully');

        // Create admin user if it doesn't exist
        console.log('👤 Setting up admin user...');
        await createAdminUser();
        console.log('✅ Admin user setup complete');

        // Create sample data (optional)
        if (process.argv.includes('--with-samples')) {
            console.log('📝 Creating sample data...');
            await createSampleData();
            console.log('✅ Sample data created');
        }

        console.log('🎉 Database setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Start the server: npm start');
        console.log('2. Visit: http://localhost:3000');
        console.log('3. Register a new account or use the admin account');
        console.log('\n🔑 Admin credentials:');
        console.log('Email: admin@famai.com');
        console.log('Password: admin123');

    } catch (error) {
        console.error('❌ Database setup failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

async function createIndexes() {
    try {
        // User indexes
        await createIndexIfNotExists(User.collection, { email: 1 }, { unique: true });
        await createIndexIfNotExists(User.collection, { 'providerIds.google': 1 });
        await createIndexIfNotExists(User.collection, { 'providerIds.microsoft': 1 });
        await createIndexIfNotExists(User.collection, { 'providerIds.autodesk': 1 });
        await createIndexIfNotExists(User.collection, { status: 1 });
        await createIndexIfNotExists(User.collection, { createdAt: -1 });

        // Family indexes
        await createIndexIfNotExists(Family.collection, { createdBy: 1, createdAt: -1 });
        await createIndexIfNotExists(Family.collection, { category: 1 });
        await createIndexIfNotExists(Family.collection, { status: 1 });
        await createIndexIfNotExists(Family.collection, { 'apsExecution.workitemId': 1 });
        await createIndexIfNotExists(Family.collection, { sessionId: 1 });
        await createIndexIfNotExists(Family.collection, { tags: 1 });
        await createIndexIfNotExists(Family.collection, { 'privacy.isPublic': 1 });
        await createIndexIfNotExists(Family.collection, { 'stats.rating.average': -1 });
        await createIndexIfNotExists(Family.collection, { 'stats.downloadCount': -1 });
        
        // Text search index
        await createIndexIfNotExists(Family.collection, {
            name: 'text',
            description: 'text',
            originalPrompt: 'text',
            tags: 'text'
        });

        // Session indexes
        await createIndexIfNotExists(Session.collection, { userId: 1, createdAt: -1 });
        await createIndexIfNotExists(Session.collection, { sessionId: 1 }, { unique: true });
        await createIndexIfNotExists(Session.collection, { status: 1 });
        await createIndexIfNotExists(Session.collection, { 'stats.lastActivity': -1 });
        await createIndexIfNotExists(Session.collection, { expiresAt: 1 }, { expireAfterSeconds: 0 });
        
    } catch (error) {
        console.log('⚠️ Some indexes may already exist, continuing...');
    }
}

async function createIndexIfNotExists(collection, indexSpec, options = {}) {
    try {
        await collection.createIndex(indexSpec, options);
        console.log(`✅ Created index: ${JSON.stringify(indexSpec)}`);
    } catch (error) {
        if (error.code === 86 || error.message.includes('already exists')) {
            console.log(`ℹ️ Index already exists: ${JSON.stringify(indexSpec)}`);
        } else {
            throw error;
        }
    }
}

async function createAdminUser() {
    const adminEmail = 'admin@famai.com';
    const adminPassword = 'admin123';

    // Check if admin user already exists
    const existingAdmin = await User.findByEmail(adminEmail);
    if (existingAdmin) {
        console.log('👤 Admin user already exists');
        return;
    }

    // Create admin user
    const adminUser = new User({
        email: adminEmail,
        password: adminPassword,
        profile: {
            firstName: 'Admin',
            lastName: 'User',
            displayName: 'famAI Administrator',
            company: 'famAI Platform',
            role: 'architect'
        },
        status: 'active',
        emailVerified: true,
        subscription: {
            plan: 'enterprise',
            status: 'active',
            monthlyLimit: 1000
        }
    });

    await adminUser.save();
    console.log('👤 Admin user created successfully');
}

async function createSampleData() {
    // Create a sample user
    const sampleUser = new User({
        email: 'demo@famai.com',
        password: 'demo123',
        profile: {
            firstName: 'Demo',
            lastName: 'User',
            displayName: 'Demo User',
            company: 'Demo Company',
            role: 'architect'
        },
        status: 'active',
        emailVerified: true
    });

    await sampleUser.save();

    // Create sample families
    const sampleFamilies = [
        {
            name: 'Modern Double Hung Window',
            description: 'A contemporary double hung window with clean lines',
            category: 'Windows',
            createdBy: sampleUser._id,
            sessionId: 'sample-session-1',
            originalPrompt: 'Create a modern double hung window 3 feet wide and 4 feet tall with aluminum frame',
            sir: {
                familyMetadata: {
                    familyName: 'Modern Double Hung Window',
                    category: 'Windows',
                    description: 'Contemporary double hung window',
                    lodLevel: 300
                },
                geometryDefinition: {
                    extrusions: [{
                        name: 'MainFrame',
                        profile: [
                            { x: 0, y: 0 },
                            { x: 3, y: 0 },
                            { x: 3, y: 4 },
                            { x: 0, y: 4 }
                        ],
                        startPoint: { x: 0, y: 0, z: 0 },
                        endPoint: { x: 3, y: 4, z: 0.1 },
                        material: 'Aluminum'
                    }]
                },
                parameters: {
                    familyParameters: [
                        { name: 'Width', type: 'Length', defaultValue: 3, isInstance: true },
                        { name: 'Height', type: 'Length', defaultValue: 4, isInstance: true }
                    ]
                }
            },
            parameters: {
                width: 3,
                height: 4,
                materials: ['Aluminum', 'Glass']
            },
            status: 'ready',
            qaValidation: {
                overallPass: true,
                overallScore: 95
            }
        },
        {
            name: 'Standard Interior Door',
            description: 'A standard 30-inch interior door',
            category: 'Doors',
            createdBy: sampleUser._id,
            sessionId: 'sample-session-2',
            originalPrompt: 'Create a standard interior door 30 inches wide and 80 inches tall',
            sir: {
                familyMetadata: {
                    familyName: 'Standard Interior Door',
                    category: 'Doors',
                    description: 'Standard interior door',
                    lodLevel: 300
                },
                geometryDefinition: {
                    extrusions: [{
                        name: 'DoorPanel',
                        profile: [
                            { x: 0, y: 0 },
                            { x: 2.5, y: 0 },
                            { x: 2.5, y: 6.67 },
                            { x: 0, y: 6.67 }
                        ],
                        startPoint: { x: 0, y: 0, z: 0 },
                        endPoint: { x: 2.5, y: 6.67, z: 0.125 },
                        material: 'Wood'
                    }]
                },
                parameters: {
                    familyParameters: [
                        { name: 'Width', type: 'Length', defaultValue: 2.5, isInstance: true },
                        { name: 'Height', type: 'Length', defaultValue: 6.67, isInstance: true }
                    ]
                }
            },
            parameters: {
                width: 2.5,
                height: 6.67,
                materials: ['Wood']
            },
            status: 'ready',
            qaValidation: {
                overallPass: true,
                overallScore: 90
            }
        }
    ];

    for (const familyData of sampleFamilies) {
        const family = new Family(familyData);
        await family.save();
    }

    console.log('📝 Sample data created successfully');
}

// Run setup if called directly
if (require.main === module) {
    setupDatabase();
}

module.exports = { setupDatabase };
