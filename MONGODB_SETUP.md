# MongoDB Integration for famAI

This document explains how to set up and use MongoDB with the famAI platform for user management and family storage.

## Overview

The MongoDB integration provides:

- **User Authentication**: Registration, login, and profile management
- **Family Storage**: Persistent storage of created families and their metadata
- **Session Management**: User session tracking and conversation history
- **User Dashboard**: Personal dashboard showing created families

## Prerequisites

1. **MongoDB 8.0.10 Community** running on `localhost:27017`
2. **Node.js** with npm
3. **famAI** project dependencies installed

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```env
# MongoDB Configuration
MONGODB_URL=mongodb://localhost:27017/famai

# Your existing APS and Gemini API keys
APS_CLIENT_ID=your_aps_client_id
APS_CLIENT_SECRET=your_aps_client_secret
GEMINI_API_KEY=your_gemini_api_key
# ... other existing variables
```

### 3. Initialize Database

```bash
# Basic setup (creates indexes and admin user)
npm run setup-db

# Setup with sample data (includes demo families)
npm run setup-db-samples
```

### 4. Start the Server

```bash
npm start
```

## Database Schema

### Users Collection

Stores user accounts and profiles:

```javascript
{
  _id: ObjectId,
  email: String (unique),
  password: String (hashed),
  profile: {
    firstName: String,
    lastName: String,
    displayName: String,
    company: String,
    role: String // architect, engineer, designer, student, other
  },
  authProvider: String, // local, google, microsoft, autodesk
  preferences: {
    language: String,
    units: String, // metric, imperial
    defaultLOD: Number,
    notifications: Object
  },
  subscription: {
    plan: String, // free, pro, enterprise
    status: String,
    monthlyLimit: Number,
    currentUsage: Number
  },
  stats: {
    familiesCreated: Number,
    totalUsageTime: Number,
    lastActivity: Date
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Families Collection

Stores created Revit families:

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  category: String, // Windows, Doors, Furniture, etc.
  createdBy: ObjectId (ref: User),
  sessionId: String,
  originalPrompt: String,
  sir: Object, // Structured Intermediate Representation
  generatedCode: {
    python: String,
    metadata: Object
  },
  qaValidation: {
    overallPass: Boolean,
    overallScore: Number,
    validations: Object
  },
  apsExecution: {
    workitemId: String,
    status: String,
    progress: Number
  },
  files: {
    rfaFile: {
      filename: String,
      downloadUrl: String,
      bucketKey: String,
      objectKey: String
    }
  },
  parameters: {
    width: Number,
    height: Number,
    materials: [String]
  },
  status: String, // draft, generating, ready, failed
  stats: {
    downloadCount: Number,
    viewCount: Number,
    rating: Object
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Sessions Collection

Stores user sessions and conversation history:

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  sessionId: String (unique),
  name: String,
  status: String, // active, completed, archived
  conversations: [{
    timestamp: Date,
    type: String, // user_input, ai_response, system_message
    content: Object,
    familyId: ObjectId (ref: Family)
  }],
  currentFamily: ObjectId (ref: Family),
  stats: {
    totalInteractions: Number,
    familiesCreated: Number,
    totalTokens: Number
  },
  expiresAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile
- `PUT /api/auth/profile` - Update user profile
- `GET /api/auth/status` - Check authentication status

### Family Management

- `GET /api/families` - Get user's families
- `GET /api/families/:id` - Get specific family
- `POST /api/families` - Create new family
- `PUT /api/families/:id` - Update family
- `DELETE /api/families/:id` - Delete family
- `GET /api/families/:id/download` - Download RFA file
- `GET /api/families/stats/overview` - Get family statistics

## User Interface

### New Pages

1. **Registration Page** (`/register.html`)
   - User account creation
   - Profile information collection
   - Role selection

2. **Dashboard** (`/dashboard`)
   - View created families
   - Filter by category and status
   - Download and manage families
   - View statistics

### Updated Pages

1. **Main Interface** (`/famai`)
   - Added Dashboard button
   - User-specific family creation
   - Session management

2. **Login Page** (`/`)
   - Link to registration page
   - Improved authentication flow

## Default Admin Account

After running `npm run setup-db`, you can use:

- **Email**: `admin@famai.com`
- **Password**: `admin123`

This account has enterprise-level access with no limits.

## User Subscription Plans

### Free Plan
- 10 families per month
- Basic features
- Standard support

### Pro Plan
- Unlimited families
- Advanced features
- Priority support

### Enterprise Plan
- Unlimited families
- All features
- Custom integrations
- Dedicated support

## Security Features

1. **Password Hashing**: bcrypt with salt rounds
2. **Session Management**: Secure cookie-based sessions
3. **Input Validation**: Comprehensive validation on all inputs
4. **Rate Limiting**: Protection against abuse
5. **Data Sanitization**: XSS and injection protection

## Database Indexes

The setup script creates optimized indexes for:

- User email lookup
- Family queries by user and category
- Session management
- Text search capabilities
- Performance optimization

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   ```bash
   # Check if MongoDB is running
   mongosh --eval "db.runCommand('ping')"
   
   # Check connection string
   echo $MONGODB_URL
   ```

2. **Authentication Errors**
   - Verify user exists in database
   - Check password hashing
   - Validate session cookies

3. **Family Creation Issues**
   - Check user subscription limits
   - Verify APS configuration
   - Review error logs

### Useful Commands

```bash
# Connect to MongoDB
mongosh famai

# View users
db.users.find().pretty()

# View families
db.families.find().pretty()

# View sessions
db.sessions.find().pretty()

# Reset database (WARNING: Deletes all data)
db.dropDatabase()
```

## Performance Considerations

1. **Indexes**: All queries are optimized with proper indexes
2. **Pagination**: Large result sets are paginated
3. **Caching**: Session data is cached in memory
4. **Connection Pooling**: MongoDB connections are pooled
5. **Query Optimization**: Aggregation pipelines for statistics

## Backup and Recovery

### Backup Database
```bash
mongodump --db famai --out ./backup
```

### Restore Database
```bash
mongorestore --db famai ./backup/famai
```

## Monitoring

The application includes:

- Database connection health checks
- User activity tracking
- Family creation statistics
- Error logging and monitoring
- Performance metrics

## Next Steps

1. **Production Deployment**: Configure production MongoDB cluster
2. **User Management**: Implement user roles and permissions
3. **Advanced Features**: Add family sharing and collaboration
4. **Analytics**: Implement detailed usage analytics
5. **Integration**: Connect with external authentication providers

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review application logs
3. Verify MongoDB connectivity
4. Check environment variables
5. Contact the development team

---

**Note**: This integration maintains backward compatibility with the existing famAI functionality while adding persistent user management and family storage capabilities.
