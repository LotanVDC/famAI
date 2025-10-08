/////////////////////////////////////////////////////////////////////
// MongoDB Database Configuration
// Copyright (c) 2024 famAI Platform
//
// This module handles MongoDB connection and configuration
/////////////////////////////////////////////////////////////////////

const mongoose = require('mongoose');

class DatabaseManager {
    constructor() {
        this.isConnected = false;
        this.connection = null;
    }

    /**
     * Connect to MongoDB database
     */
    async connect() {
        try {
            const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/famai';
            
            console.log('Connecting to MongoDB...');
            
            this.connection = await mongoose.connect(mongoUrl, {
                maxPoolSize: 10, // Maintain up to 10 socket connections
                serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
                socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
            });

            this.isConnected = true;
            console.log('✅ MongoDB connected successfully');
            
            // Handle connection events
            mongoose.connection.on('error', (err) => {
                console.error('❌ MongoDB connection error:', err);
                this.isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.log('⚠️ MongoDB disconnected');
                this.isConnected = false;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('✅ MongoDB reconnected');
                this.isConnected = true;
            });

            return this.connection;
            
        } catch (error) {
            console.error('❌ MongoDB connection failed:', error);
            this.isConnected = false;
            throw error;
        }
    }

    /**
     * Disconnect from MongoDB
     */
    async disconnect() {
        try {
            if (this.connection) {
                await mongoose.disconnect();
                this.isConnected = false;
                console.log('✅ MongoDB disconnected successfully');
            }
        } catch (error) {
            console.error('❌ Error disconnecting from MongoDB:', error);
            throw error;
        }
    }

    /**
     * Get connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            port: mongoose.connection.port,
            name: mongoose.connection.name
        };
    }

    /**
     * Health check for database
     */
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected', message: 'Database not connected' };
            }

            // Simple ping to check connection
            await mongoose.connection.db.admin().ping();
            
            return { 
                status: 'healthy', 
                message: 'Database connection is healthy',
                details: this.getStatus()
            };
        } catch (error) {
            return { 
                status: 'unhealthy', 
                message: 'Database health check failed',
                error: error.message
            };
        }
    }
}

// Create singleton instance
const databaseManager = new DatabaseManager();

module.exports = databaseManager;
