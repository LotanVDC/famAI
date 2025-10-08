/////////////////////////////////////////////////////////////////////
// Copyright (c) Autodesk, Inc. All rights reserved
// Written by Autodesk Partner Development
//
// Permission to use, copy, modify, and distribute this software in
// object code form for any purpose and without fee is hereby granted,
// provided that the above copyright notice appears in all copies and
// that both that copyright notice and the limited warranty and
// restricted rights notice below appear in all supporting
// documentation.
//
// AUTODESK PROVIDES THIS PROGRAM "AS IS" AND WITH ALL FAULTS.
// AUTODESK SPECIFICALLY DISCLAIMS ANY IMPLIED WARRANTY OF
// MERCHANTABILITY OR FITNESS FOR A PARTICULAR USE.  AUTODESK, INC.
// DOES NOT WARRANT THAT THE OPERATION OF THE PROGRAM WILL BE
// UNINTERRUPTED OR ERROR FREE.
/////////////////////////////////////////////////////////////////////

// Load environment variables from .env file
require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');

// Initialize MongoDB connection
const databaseManager = require('./config/database');

const PORT = process.env.PORT || 3000;
const config = require('./config');
if (config.credentials.client_id == null || config.credentials.client_secret == null) {
    console.error('Missing APS_CLIENT_ID or APS_CLIENT_SECRET env. variables.');
    return;
}

// Initialize database connection
async function initializeDatabase() {
    try {
        await databaseManager.connect();
        console.log('✅ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        process.exit(1);
    }
}

if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    };
}


var app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieSession({
    name: 'aps_session',
    keys: ['aps_secure_key'],
    maxAge: 14 * 24 * 60 * 60 * 1000 // 14 days, same as refresh token
}));
app.use(express.json({ limit: '50mb' }));
app.use('/api/aps', require('./routes/oauth'));
app.use('/api/aps', require('./routes/datamanagement'));
app.use('/api/aps', require('./routes/user'));
app.use('/api/aps', require('./routes/da4revit'));
app.use('/api/aps', require('./routes/daconfigure'));

// Authentication routes
app.use('/api/auth', require('./routes/auth'));

// Family management routes
app.use('/api/families', require('./routes/families'));

// famAI routes
app.use('/api/famai', require('./routes/famai'));

// BIM-LLM routes
app.use('/api/bim-llm', require('./routes/bim-llm'));

// Viewer routes
app.use('/api/viewer', require('./routes/viewer'));

// Serve login page at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve famAI interface
app.get('/famai', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'famai.html'));
});


// Serve BIM-LLM interface (legacy, redirects to famAI)
app.get('/bim-llm', (req, res) => {
    res.redirect('/famai');
});

// Serve viewer interface
app.get('/viewer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'viewer.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.statusCode).json(err);
});


// add socket connection
var server = require('http').Server(app); 
// MyApp.SocketIo is a global object, will be used to send
// status to the client
global.MyApp = {
    SocketIo : require('socket.io')(server)
};
global.MyApp.SocketIo.on('connection', function(socket){
    console.log('user connected to the socket');

    socket.on('disconnect', function(){
        console.log('user disconnected from the socket');
      });
})


// Start server after database initialization
async function startServer() {
    try {
        await initializeDatabase();
        
        server.listen(PORT, () => { 
            console.log(`🚀 Server listening on port ${PORT}`);
            console.log(`📊 Database: ${databaseManager.getStatus().name}`);
            console.log(`🔗 Access: http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    try {
        await databaseManager.disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    try {
        await databaseManager.disconnect();
        console.log('✅ Database disconnected');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Start the server
startServer();
