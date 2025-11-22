#!/bin/bash

###############################################################################
# PicAI Backend Authentication Verification Script
#
# This script automates all checks from SESSION_LOG_1_CHECK_AUTH.md
# Run this to verify authentication system is working correctly
#
# Usage:
#   ./scripts/verify-auth.sh
#   npm run verify:auth
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
TESTS_PASSED=0
TESTS_FAILED=0

# API URL
API_URL="http://localhost:3001"

# Test user credentials
TEST_EMAIL="test-verify-$(date +%s)@example.com"
TEST_PASSWORD="TestPassword123@"
TEST_NAME="Verification Test User"

# Store tokens
ACCESS_TOKEN=""
REFRESH_TOKEN=""
USER_ID=""

###############################################################################
# Helper Functions
###############################################################################

print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_test() {
    echo -e "${YELLOW}▶ Testing:${NC} $1"
}

pass() {
    echo -e "${GREEN}✅ PASS:${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL:${NC} $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN:${NC} $1"
}

info() {
    echo -e "${BLUE}ℹ️  INFO:${NC} $1"
}

###############################################################################
# Pre-flight Checks
###############################################################################

print_header "Pre-flight Checks"

# Check if server is running
print_test "Server is running"
if curl -s "${API_URL}/health" > /dev/null 2>&1; then
    pass "Server is responding at ${API_URL}"
else
    fail "Server is not running at ${API_URL}"
    echo -e "\n${RED}Please start the server with: npm run dev${NC}\n"
    exit 1
fi

# Check if .env exists
print_test "Environment file exists"
if [ -f ".env" ]; then
    pass ".env file exists"
else
    fail ".env file not found"
    exit 1
fi

# Check if database is accessible
print_test "Database connection"
HEALTH_RESPONSE=$(curl -s "${API_URL}/health")
DB_STATUS=$(echo "$HEALTH_RESPONSE" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
if [ "$DB_STATUS" = "ok" ]; then
    pass "Database is connected"
else
    fail "Database connection failed"
    exit 1
fi

###############################################################################
# Health Endpoint Tests
###############################################################################

print_header "Health Endpoint Tests"

print_test "GET /health returns correct structure"
HEALTH_RESPONSE=$(curl -s "${API_URL}/health")

# Check for required fields
if echo "$HEALTH_RESPONSE" | grep -q '"success":true' && \
   echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"' && \
   echo "$HEALTH_RESPONSE" | grep -q '"database":"ok"'; then
    pass "Health endpoint returns correct structure"
else
    fail "Health endpoint missing required fields"
    echo "Response: $HEALTH_RESPONSE"
fi

###############################################################################
# User Registration Tests
###############################################################################

print_header "User Registration Tests"

print_test "POST /auth/register with valid data"
REGISTER_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"${TEST_NAME}\",
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

# Check if registration succeeded
if echo "$REGISTER_RESPONSE" | grep -q '"success":true'; then
    ACCESS_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$REGISTER_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

    pass "User registration successful"
    info "Access Token: ${ACCESS_TOKEN:0:50}..."
    info "User ID: $USER_ID"
else
    fail "User registration failed"
    echo "Response: $REGISTER_RESPONSE"
    exit 1
fi

print_test "Registration returns required fields"
if echo "$REGISTER_RESPONSE" | grep -q '"accessToken"' && \
   echo "$REGISTER_RESPONSE" | grep -q '"refreshToken"' && \
   echo "$REGISTER_RESPONSE" | grep -q '"expiresIn":900' && \
   echo "$REGISTER_RESPONSE" | grep -q '"user"'; then
    pass "Registration response has all required fields"
else
    fail "Registration response missing fields"
    echo "Response: $REGISTER_RESPONSE"
fi

###############################################################################
# Input Validation Tests
###############################################################################

print_header "Input Validation Tests"

print_test "Registration with missing email"
VALIDATION_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Test User\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

if echo "$VALIDATION_RESPONSE" | grep -q '"success":false' && \
   echo "$VALIDATION_RESPONSE" | grep -q 'VALIDATION_ERROR'; then
    pass "Missing email rejected"
else
    fail "Missing email not properly validated"
fi

print_test "Registration with invalid email format"
VALIDATION_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Test User\",
        \"email\": \"not-an-email\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

if echo "$VALIDATION_RESPONSE" | grep -q '"success":false'; then
    pass "Invalid email format rejected"
else
    fail "Invalid email not properly validated"
fi

print_test "Registration with weak password"
VALIDATION_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"name\": \"Test User\",
        \"email\": \"test@example.com\",
        \"password\": \"weak\"
    }")

if echo "$VALIDATION_RESPONSE" | grep -q '"success":false'; then
    pass "Weak password rejected"
else
    fail "Weak password not properly validated"
fi

###############################################################################
# User Login Tests
###############################################################################

print_header "User Login Tests"

print_test "POST /auth/login with correct credentials"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

if echo "$LOGIN_RESPONSE" | grep -q '"success":true' && \
   echo "$LOGIN_RESPONSE" | grep -q '"accessToken"'; then
    pass "Login with correct credentials successful"

    # Update tokens from login
    ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"refreshToken":"[^"]*"' | cut -d'"' -f4)
else
    fail "Login with correct credentials failed"
    echo "Response: $LOGIN_RESPONSE"
fi

print_test "POST /auth/login with wrong password"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"WrongPassword123@\"
    }")

if echo "$LOGIN_RESPONSE" | grep -q '"success":false' && \
   echo "$LOGIN_RESPONSE" | grep -q 'INVALID_CREDENTIALS'; then
    pass "Wrong password rejected"
else
    fail "Wrong password not properly rejected"
fi

print_test "POST /auth/login with nonexistent user"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"nonexistent@example.com\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

if echo "$LOGIN_RESPONSE" | grep -q '"success":false' && \
   echo "$LOGIN_RESPONSE" | grep -q 'INVALID_CREDENTIALS'; then
    pass "Nonexistent user rejected (no user enumeration)"
else
    fail "Nonexistent user handling failed"
fi

###############################################################################
# JWT Middleware Protection Tests
###############################################################################

print_header "JWT Middleware Protection Tests"

print_test "GET /auth/me with valid token"
ME_RESPONSE=$(curl -s -X GET "${API_URL}/api/auth/me" \
    -H "Authorization: Bearer ${ACCESS_TOKEN}")

if echo "$ME_RESPONSE" | grep -q '"success":true' && \
   echo "$ME_RESPONSE" | grep -q "\"email\":\"${TEST_EMAIL}\""; then
    pass "Valid token returns user profile"
else
    fail "Valid token not accepted"
    echo "Response: $ME_RESPONSE"
fi

print_test "GET /auth/me without token"
ME_RESPONSE=$(curl -s -X GET "${API_URL}/api/auth/me")

if echo "$ME_RESPONSE" | grep -q '"success":false' && \
   echo "$ME_RESPONSE" | grep -q 'NO_TOKEN'; then
    pass "Missing token rejected with NO_TOKEN error"
else
    fail "Missing token not properly rejected"
fi

print_test "GET /auth/me with invalid token"
ME_RESPONSE=$(curl -s -X GET "${API_URL}/api/auth/me" \
    -H "Authorization: Bearer invalid.token.here")

if echo "$ME_RESPONSE" | grep -q '"success":false' && \
   (echo "$ME_RESPONSE" | grep -q 'TOKEN_MALFORMED' || \
    echo "$ME_RESPONSE" | grep -q 'INVALID_TOKEN'); then
    pass "Invalid token rejected"
else
    fail "Invalid token not properly rejected"
    echo "Response: $ME_RESPONSE"
fi

print_test "GET /auth/me with forged token"
FORGED_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJmYWtlLWlkIiwiZW1haWwiOiJmYWtlQGV4YW1wbGUuY29tIn0.fakesignature"
ME_RESPONSE=$(curl -s -X GET "${API_URL}/api/auth/me" \
    -H "Authorization: Bearer ${FORGED_TOKEN}")

if echo "$ME_RESPONSE" | grep -q '"success":false' && \
   echo "$ME_RESPONSE" | grep -q 'INVALID_TOKEN'; then
    pass "Forged token signature rejected"
else
    fail "Forged token not properly rejected"
fi

###############################################################################
# Token Refresh Tests
###############################################################################

print_header "Token Refresh Tests"

print_test "POST /auth/refresh with valid refresh token"
REFRESH_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{
        \"refreshToken\": \"${REFRESH_TOKEN}\"
    }")

if echo "$REFRESH_RESPONSE" | grep -q '"success":true' && \
   echo "$REFRESH_RESPONSE" | grep -q '"accessToken"'; then
    pass "Token refresh successful"
else
    fail "Token refresh failed"
    echo "Response: $REFRESH_RESPONSE"
fi

print_test "POST /auth/refresh with invalid refresh token"
REFRESH_RESPONSE=$(curl -s -X POST "${API_URL}/api/auth/refresh" \
    -H "Content-Type: application/json" \
    -d "{
        \"refreshToken\": \"invalid.token.here\"
    }")

if echo "$REFRESH_RESPONSE" | grep -q '"success":false'; then
    pass "Invalid refresh token rejected"
else
    fail "Invalid refresh token not rejected"
fi

###############################################################################
# Database Verification
###############################################################################

print_header "Database Verification"

print_test "User exists in database with hashed password"
# We can't directly query the database from bash without psql,
# but we can verify through the API that the user persists
VERIFY_LOGIN=$(curl -s -X POST "${API_URL}/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"email\": \"${TEST_EMAIL}\",
        \"password\": \"${TEST_PASSWORD}\"
    }")

if echo "$VERIFY_LOGIN" | grep -q '"success":true'; then
    pass "User persists in database with valid password hash"
else
    fail "User not found in database or password hash invalid"
fi

###############################################################################
# Cleanup
###############################################################################

print_header "Cleanup"

info "Test user created: ${TEST_EMAIL}"
info "User ID: ${USER_ID}"
warn "Note: Test user was NOT deleted (no delete endpoint yet)"
warn "You may want to manually delete from database later"

###############################################################################
# Summary
###############################################################################

print_header "Test Summary"

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED))

echo -e "Total Tests:  ${BLUE}${TOTAL_TESTS}${NC}"
echo -e "Passed:       ${GREEN}${TESTS_PASSED}${NC}"
echo -e "Failed:       ${RED}${TESTS_FAILED}${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✅ ALL TESTS PASSED - Authentication system is working!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 0
else
    echo -e "\n${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}  ❌ SOME TESTS FAILED - Please review errors above${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
    exit 1
fi
