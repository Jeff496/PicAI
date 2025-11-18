# Authentication Integration Test Guide

This guide provides step-by-step instructions for testing the authentication endpoints once the Express server is running.

## Prerequisites

1. **Database Setup**:
   ```bash
   # Run Prisma migrations to create tables
   npx prisma migrate dev

   # Verify database connection
   npx prisma studio
   ```

2. **Environment Variables**:
   Ensure `.env` file has all required values (see `.env.example`)

3. **Start Server**:
   ```bash
   npm run dev
   ```

## Test Scenarios

### 1. User Registration

**Endpoint**: `POST /auth/register`

**Valid Request**:
```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

**Expected Response (201)**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "profilePictureUrl": null
  }
}
```

**Invalid Requests**:

1. **Duplicate Email** (400 USER_EXISTS):
   ```bash
   # Register same email again
   curl -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "SecurePass123!",
       "name": "Another User"
     }'
   ```

2. **Weak Password** (400 VALIDATION_ERROR):
   ```bash
   curl -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "weak@example.com",
       "password": "weak",
       "name": "Weak User"
     }'
   ```

3. **Invalid Email** (400 VALIDATION_ERROR):
   ```bash
   curl -X POST http://localhost:3001/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "not-an-email",
       "password": "SecurePass123!",
       "name": "Invalid User"
     }'
   ```

---

### 2. User Login

**Endpoint**: `POST /auth/login`

**Valid Request**:
```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response (200)**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "profilePictureUrl": null
  }
}
```

**Invalid Requests**:

1. **Wrong Password** (401 INVALID_CREDENTIALS):
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "test@example.com",
       "password": "WrongPassword123!"
     }'
   ```

2. **Non-existent Email** (401 INVALID_CREDENTIALS):
   ```bash
   curl -X POST http://localhost:3001/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "nonexistent@example.com",
       "password": "SecurePass123!"
     }'
   ```

---

### 3. Token Refresh

**Endpoint**: `POST /auth/refresh`

**Valid Request**:
```bash
# Replace with actual refresh token from login/register response
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }"
```

**Expected Response (200)**:
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Invalid Requests**:

1. **Missing Token** (400 MISSING_TOKEN):
   ```bash
   curl -X POST http://localhost:3001/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

2. **Invalid Token** (401 INVALID_REFRESH_TOKEN):
   ```bash
   curl -X POST http://localhost:3001/auth/refresh \
     -H "Content-Type: application/json" \
     -d '{
       "refreshToken": "invalid.token.here"
     }'
   ```

3. **Access Token Used Instead** (401 INVALID_REFRESH_TOKEN):
   ```bash
   # Using access token instead of refresh token
   ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

   curl -X POST http://localhost:3001/auth/refresh \
     -H "Content-Type: application/json" \
     -d "{
       \"refreshToken\": \"$ACCESS_TOKEN\"
     }"
   ```

---

### 4. Get Current User

**Endpoint**: `GET /auth/me`

**Valid Request**:
```bash
# Replace with actual access token from login/register response
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Expected Response (200)**:
```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "name": "Test User",
    "profilePictureUrl": null
  }
}
```

**Invalid Requests**:

1. **Missing Authorization Header** (401 NO_TOKEN):
   ```bash
   curl -X GET http://localhost:3001/auth/me
   ```

2. **Invalid Token Format** (401 NO_TOKEN):
   ```bash
   curl -X GET http://localhost:3001/auth/me \
     -H "Authorization: invalid-format"
   ```

3. **Expired Access Token** (401 TOKEN_EXPIRED):
   ```bash
   # Wait 15 minutes after login, then use old access token
   EXPIRED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

   curl -X GET http://localhost:3001/auth/me \
     -H "Authorization: Bearer $EXPIRED_TOKEN"
   ```

---

### 5. Logout

**Endpoint**: `POST /auth/logout`

**Valid Request**:
```bash
# Replace with actual access token
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

curl -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Expected Response (200)**:
```json
{
  "success": true,
  "message": "Logged out successfully. Please clear tokens on client."
}
```

**Note**: Since JWT is stateless, logout is handled client-side by clearing tokens from storage. The server response is for consistency.

---

## Complete Test Flow

Here's a complete flow to test all endpoints in sequence:

```bash
#!/bin/bash
# Save as test-auth-flow.sh and run: chmod +x test-auth-flow.sh && ./test-auth-flow.sh

echo "=== 1. Register new user ==="
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "flowtest@example.com",
    "password": "FlowTest123!",
    "name": "Flow Test User"
  }')

echo "$REGISTER_RESPONSE" | jq '.'
ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.accessToken')
REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r '.refreshToken')

echo -e "\n=== 2. Get current user with access token ==="
curl -s -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n=== 3. Logout ==="
curl -s -X POST http://localhost:3001/auth/logout \
  -H "Authorization: Bearer $ACCESS_TOKEN" | jq '.'

echo -e "\n=== 4. Login again ==="
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "flowtest@example.com",
    "password": "FlowTest123!"
  }')

echo "$LOGIN_RESPONSE" | jq '.'
NEW_ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.accessToken')
NEW_REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.refreshToken')

echo -e "\n=== 5. Refresh access token ==="
REFRESH_RESPONSE=$(curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$NEW_REFRESH_TOKEN\"
  }")

echo "$REFRESH_RESPONSE" | jq '.'
REFRESHED_ACCESS_TOKEN=$(echo "$REFRESH_RESPONSE" | jq -r '.accessToken')

echo -e "\n=== 6. Get current user with refreshed token ==="
curl -s -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer $REFRESHED_ACCESS_TOKEN" | jq '.'

echo -e "\n=== All tests completed ==="
```

---

## Expected Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `USER_EXISTS` | 400 | Email already registered |
| `MISSING_TOKEN` | 400 | Required token not provided |
| `INVALID_CREDENTIALS` | 401 | Email or password incorrect |
| `NO_TOKEN` | 401 | Missing or invalid Authorization header |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `TOKEN_INVALID` | 401 | Token signature invalid |
| `TOKEN_MALFORMED` | 401 | Token structure invalid |
| `USER_NOT_FOUND` | 401 | User from token doesn't exist |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token has expired |
| `INVALID_REFRESH_TOKEN` | 401 | Refresh token is invalid or is actually an access token |

---

## Token Expiration Testing

**Access Token** (15 minutes):
```bash
# 1. Login and save token
ACCESS_TOKEN=$(curl -s -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePass123!"}' \
  | jq -r '.accessToken')

# 2. Use token immediately (should work)
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# 3. Wait 16 minutes, then use again (should fail with TOKEN_EXPIRED)
sleep 960 # 16 minutes
curl -X GET http://localhost:3001/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**Refresh Token** (7 days):
```bash
# Similar process, but wait 8 days to test refresh token expiration
# Refresh token should work for 7 days, then expire
```

---

## Database Verification

After running tests, verify database state:

```bash
# Open Prisma Studio
npx prisma studio

# Or query directly
npx prisma db execute --stdin <<EOF
SELECT id, email, name, created_at FROM users ORDER BY created_at DESC LIMIT 5;
EOF
```

---

## Cleanup Test Data

```bash
# Delete test users from database
npx prisma db execute --stdin <<EOF
DELETE FROM users WHERE email IN ('test@example.com', 'flowtest@example.com');
EOF
```

---

## Next Steps

After verifying all auth endpoints work:
1. Integrate auth routes into main Express app
2. Add rate limiting middleware for auth endpoints
3. Implement token blacklisting for logout (optional)
4. Add forgot password / reset password endpoints
5. Add email verification for new registrations
6. Proceed with photo upload and management endpoints
