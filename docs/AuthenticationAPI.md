# Authentication API Documentation

API untuk authentication menggunakan JWT token yang membaca data dari database PostgreSQL eksternal (WMS Database).

## Configuration

Database connection untuk authentication:

- **Host:** 10.1.3.139
- **Port:** 5437
- **Database:** wmsdbdev
- **Username:** adempiere
- **Table:** ad_user

### Environment Variables

```env
WMS_DB_HOST=10.1.3.139
WMS_DB_PORT=5437
WMS_DB_NAME=wmsdbdev
WMS_DB_USER=postgres
WMS_DB_PASSWORD=your_password

JWT_SECRET=your-very-secure-secret-key
JWT_EXPIRES_IN=7d
```

## Database Schema

Table `ad_user`:

```sql
CREATE TABLE ad_user (
    ad_user_id SERIAL PRIMARY KEY,
    ad_client_id INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    isactive BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**Field Mapping:**

- `ad_user_id` → Model: `userId` (Primary Key)
- `ad_client_id` → Model: `clientId`
- `name` → Model: `name` (digunakan sebagai username untuk login)
- `password` → Model: `password` (auto-hashed dengan bcrypt)
- `email` → Model: `email`
- `isactive` → Model: `isActive`

## GraphQL Mutations & Queries

### 1. Login

Login dengan username dan password, mendapatkan JWT token.

**Mutation:**

```graphql
mutation AuthLogin($input: LoginInput!) {
  authLogin(input: $input) {
    success
    message
    token
    user {
      id
      username
      email
      name
      role
      isActive
      createdAt
      updatedAt
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "name": "admin",
    "password": "password123"
  }
}
```

**Response:**

```json
{
  "data": {
    "authLogin": {
      "success": true,
      "message": "Login successful",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "userId": "1",
        "clientId": 0,
        "name": "admin",
        "email": "admin@example.com",
        "isActive": true,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    }
  }
}
```

### 2. Register

Membuat user baru (jika dibutuhkan).

**Mutation:**

```graphql
mutation AuthRegister($input: RegisterInput!) {
  authRegister(input: $input) {
    success
    message
    token
    user {
      id
      username
      email
      name
      role
      isActive
    }
  }
}
```

**Variables:**

```json
{
  "input": {
    "name": "newuser",
    "password": "password123",
    "email": "newuser@example.com",
    "clientId": 0
  }
}
```

### 3. Get Current User (Me)

Mendapatkan informasi user yang sedang login (require authentication).

**Query:**

```graphql
query AuthMe {
  authMe {
    userId
    clientId
    name
    email
    isActive
    createdAt
    updatedAt
  }
}
```

**Headers:**

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 4. Verify Token

Memverifikasi apakah token masih valid.

**Query:**

```graphql
query AuthVerifyToken($token: String!) {
  authVerifyToken(token: $token) {
    valid
    message
    user {
      userId
      clientId
      name
      email
      isActive
    }
  }
}
```

**Variables:**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 5. Change Password

Mengubah password user yang sedang login (require authentication).

**Mutation:**

```graphql
mutation AuthChangePassword($input: ChangePasswordInput!) {
  authChangePassword(input: $input) {
    success
    message
  }
}
```

**Variables:**

```json
{
  "input": {
    "oldPassword": "oldpassword123",
    "newPassword": "newpassword123"
  }
}
```

**Headers:**

```json
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

## Authentication Flow

### 1. Login Flow

```mermaid
sequenceDiagram
    Client->>Server: authLogin(name, password)
    Server->>WMS DB: Find user by name in ad_user table
    WMS DB-->>Server: User data
    Server->>Server: Compare password with bcrypt
    Server->>Server: Generate JWT token (userId, clientId, name, email)
    Server-->>Client: Return token + user data
```

### 2. Protected Request Flow

```mermaid
sequenceDiagram
    Client->>Server: Request with Authorization header
    Server->>Server: Extract & verify JWT token
    Server->>WMS DB: Find user by userId from token in ad_user
    WMS DB-->>Server: User data
    Server->>Server: Check if user is active (isactive field)
    Server-->>Client: Execute resolver with user context
```

## Using Authentication in Your Code

### In Resolvers (Protected Routes)

```javascript
const { combineResolvers } = require('graphql-resolvers');
const isAuthenticated = require('../../middlewares/isAuthenticated');

module.exports = {
  Query: {
    protectedQuery: combineResolvers(
      isAuthenticated,
      async (_, args, { user }) => {
        // user adalah data user yang sudah authenticated
        console.log('Current user:', user);
        return someData;
      }
    ),
  },
};
```

### Making Authenticated Requests

#### Using cURL:

```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"query": "{ authMe { username email } }"}'
```

#### Using JavaScript (fetch):

```javascript
const token = localStorage.getItem('token');

fetch('http://localhost:5000/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    query: `
      query {
        authMe {
          userId
          clientId
          name
          email
        }
      }
    `,
  }),
});
```

## Error Handling

### Common Errors

1. **Invalid Credentials**

```json
{
  "errors": [
    {
      "message": "Invalid name or password",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

2. **User Inactive**

```json
{
  "errors": [
    {
      "message": "User account is inactive",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

3. **Invalid Token**

```json
{
  "errors": [
    {
      "message": "User not authenticated. Error: NOT_AUTHENTICATED",
      "extensions": {
        "code": "FORBIDDEN"
      }
    }
  ]
}
```

4. **Expired Token**

```json
{
  "errors": [
    {
      "message": "Invalid or expired token",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

## Security Best Practices

1. **JWT Secret**: Gunakan secret key yang kuat dan random untuk production
2. **Password Hashing**: Password di-hash menggunakan bcrypt dengan salt rounds 10
3. **HTTPS**: Selalu gunakan HTTPS di production untuk melindungi token
4. **Token Expiry**: Set expiry time yang sesuai (default: 7 hari)
5. **Refresh Token**: Implementasikan refresh token untuk long-lived sessions

## Testing

### Create Test User

**Using Script:**

```bash
npm run create-user
```

**Manual via GraphQL:**

```graphql
mutation {
  authRegister(
    input: {
      name: "testuser"
      password: "test123"
      email: "test@example.com"
      clientId: 0
    }
  ) {
    success
    message
    token
    user {
      userId
      name
      email
    }
  }
}
```

**Direct Database Insert (if needed):**

```sql
-- Login ke WMS database
psql -h 10.1.3.139 -p 5437 -U adempiere -d wmsdbdev

-- Insert user (password harus di-hash dulu dengan bcrypt)
INSERT INTO ad_user (ad_client_id, name, password, email, isactive)
VALUES (0, 'testuser', '$2b$10$...hashedPassword...', 'test@example.com', true);
```

### Test Login with Apollo Sandbox

1. Start server: `npm run dev`
2. Open: http://localhost:5000
3. Run login mutation with test credentials
4. Copy the token from response
5. Set Authorization header: `Bearer <token>`
6. Test protected queries like `authMe`

## Notes

- Password minimal 6 karakter
- Name (username) minimal 3 karakter
- Email harus valid format
- Token default expire dalam 7 hari
- User inactive (`isactive = false`) tidak bisa login
- Password di-hash otomatis saat create/update menggunakan bcrypt
- Field `name` di table `ad_user` digunakan sebagai username untuk login
- JWT token berisi: `userId`, `clientId`, `name`, dan `email`

## Test Credentials

Default test user yang dibuat oleh script `npm run create-user`:

- **Name:** admin
- **Password:** admin123
- **Email:** admin@example.com
- **Client ID:** 0
