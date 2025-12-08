# Database-Backed Authentication Setup

This application now uses a database to store user accounts and connections instead of local storage.

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# MongoDB connection string for the application's own database
APP_DATABASE_URL=mongodb://your-connection-string-here
# OR use MONGODB_URI as an alias
MONGODB_URI=mongodb://your-connection-string-here

# Encryption key for encrypting connection strings in the database
# IMPORTANT: Change this to a secure random string in production!
ENCRYPTION_KEY=your-secure-encryption-key-here

# Backup password for clone, export, and backup operations
BACKUP_PASSWORD=adriangacor
```

## Database Schema

The application will automatically create the following collections in the `mycompass` database:

### `users`
- `_id`: ObjectId
- `email`: String (unique, indexed)
- `username`: String (optional, unique, sparse index)
- `passwordHash`: String (hashed with PBKDF2)
- `createdAt`: Date
- `updatedAt`: Date

### `sessions`
- `_id`: ObjectId
- `userId`: String (indexed)
- `token`: String (unique, indexed)
- `expiresAt`: Date (TTL index, expires after 30 days)
- `createdAt`: Date
- `userAgent`: String
- `ip`: String

### `connections`
- `_id`: ObjectId
- `userId`: String (indexed)
- `displayName`: String
- `encryptedConnectionString`: String (encrypted with ENCRYPTION_KEY)
- `createdAt`: Date
- `lastUsed`: Date (nullable)

## Features

1. **User Authentication**: Users can register and login with email/password
2. **Session Management**: Secure session tokens with 30-day expiration
3. **Encrypted Storage**: All connection strings are encrypted in the database
4. **User Isolation**: Each user only sees their own connections
5. **No Local Storage**: All data is stored in the database

## Migration from Local Storage

If you have existing connections in local storage, you'll need to:
1. Register a new account
2. Re-add your connections manually

The old master password system has been replaced with user accounts.


