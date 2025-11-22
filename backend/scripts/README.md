# Backend Verification Scripts

This directory contains automated verification scripts to ensure the PicAI backend is working correctly.

## Overview

These scripts automate the manual checks from `SESSION_LOG_1_CHECK_AUTH.md` to verify the authentication system remains functional as the codebase evolves.

---

## Available Scripts

### 1. `verify-auth.sh`

**Purpose:** Comprehensive authentication system verification

**What it tests:**
- ✅ Server health endpoint
- ✅ Database connection
- ✅ User registration
- ✅ Input validation (missing fields, invalid email, weak password)
- ✅ User login (correct/incorrect credentials)
- ✅ JWT middleware protection
- ✅ Token verification (valid, missing, invalid, forged)
- ✅ Token refresh functionality
- ✅ Database persistence

**Usage:**
```bash
# From backend directory
npm run verify:auth

# Or directly
bash scripts/verify-auth.sh
```

**Requirements:**
- Server must be running: `npm run dev`
- PostgreSQL database must be accessible
- `.env` file must be configured

**Output:**
- Colored test results (green = pass, red = fail)
- Summary of total tests passed/failed
- Exit code 0 if all tests pass, 1 if any fail

**Example Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Pre-flight Checks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

▶ Testing: Server is running
✅ PASS: Server is responding at http://localhost:3001
▶ Testing: Database connection
✅ PASS: Database is connected

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Test Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Tests:  20
Passed:       20
Failed:       0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✅ ALL TESTS PASSED - Authentication system is working!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Notes:**
- Creates a test user with timestamp-based email
- Test user is NOT automatically deleted
- Safe to run multiple times (creates new user each time)

---

## Integration Tests

In addition to the shell script, there are Vitest-based integration tests:

**File:** `tests/auth.integration.test.ts`

**What it tests:**
- AuthService password hashing and comparison
- JWT token generation and verification
- Token refresh functionality
- Database user creation
- Login flow simulation
- Environment variable validation

**Usage:**
```bash
# Run auth integration tests only
npm run test:auth

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

---

## Complete Verification

To run all verification checks:

```bash
# Run type checking + bash tests + Vitest tests
npm run verify:all
```

This will:
1. Check TypeScript compilation (`npm run type-check`)
2. Run bash verification script (`npm run verify:auth`)
3. Run Vitest integration tests (`npm run test:auth`)

**Exit codes:**
- `0`: All checks passed
- `1`: At least one check failed

---

## CI/CD Integration

### GitHub Actions

The verification script is integrated into GitHub Actions:

**File:** `.github/workflows/verify-auth.yml`

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual workflow dispatch

**What it does:**
1. Spins up PostgreSQL 18 in Docker
2. Installs dependencies
3. Runs database migrations
4. Starts server in background
5. Runs `verify-auth.sh`
6. Runs `auth.integration.test.ts`
7. Uploads logs on failure

**View results:**
- Go to: `https://github.com/{your-org}/PicAI/actions`
- Look for "Verify Authentication System" workflow

---

## When to Run These Scripts

### During Development

**Run before committing:**
```bash
npm run verify:all
```

**Quick check after code changes:**
```bash
npm run verify:auth
```

### Before Deploying

Always run full verification:
```bash
npm run verify:all
```

### After Pulling Changes

Verify authentication still works:
```bash
npm run verify:auth
```

### In CI/CD Pipeline

Automatically runs on:
- Every push to main/develop
- Every pull request

---

## Troubleshooting

### Error: "Server is not running"

**Solution:**
```bash
# Start server in another terminal
npm run dev

# Then run verification
npm run verify:auth
```

### Error: "Database connection failed"

**Check:**
1. PostgreSQL is running
2. `.env` has correct `DATABASE_URL`
3. Database exists and migrations are applied

**Fix:**
```bash
# Verify database URL
cat .env | grep DATABASE_URL

# Run migrations
npm run db:migrate
```

### Error: "Module not found"

**Solution:**
```bash
# Regenerate Prisma client
npm run db:generate

# Reinstall dependencies
npm install
```

### Error: Rate limit errors

**Explanation:** Some tests may hit rate limits if run too quickly.

**Solution:**
- Wait a few seconds and retry
- Rate limits reset after cooldown period

### Test user cleanup

The verification script creates test users but doesn't delete them.

**Manual cleanup:**
```bash
# Open Prisma Studio
npm run db:studio

# Find users with email pattern: test-verify-*@example.com
# Delete them manually
```

---

## Adding New Verification Tests

### To the Bash Script (`verify-auth.sh`)

1. Add test in appropriate section
2. Use helper functions:
   - `print_test "Description"`
   - `pass "Success message"`
   - `fail "Failure message"`
   - `info "Info message"`

**Example:**
```bash
print_test "My new test"
RESPONSE=$(curl -s "${API_URL}/my-endpoint")

if echo "$RESPONSE" | grep -q '"success":true'; then
    pass "My test passed"
else
    fail "My test failed"
fi
```

### To Vitest Tests (`auth.integration.test.ts`)

1. Add test in appropriate `describe` block
2. Follow existing patterns

**Example:**
```typescript
it('should test new functionality', async () => {
  const result = await myFunction();
  expect(result).toBe(expectedValue);
});
```

---

## Best Practices

### 1. Run Before Every Commit
Add to your git workflow:
```bash
git add .
npm run verify:all
git commit -m "Your message"
```

### 2. Use in Pre-commit Hooks

Install `husky`:
```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run verify:all"
```

### 3. Monitor CI Results

Check GitHub Actions after every push:
- Green checkmark = All tests passed
- Red X = Tests failed (investigate immediately)

### 4. Keep Tests Fast

- Bash script: ~10-15 seconds
- Vitest tests: ~5-10 seconds
- Total: Under 30 seconds

### 5. Update Tests When Changing Auth

If you modify authentication logic:
1. Update SESSION_LOG_1_CHECK_AUTH.md
2. Update verify-auth.sh
3. Update auth.integration.test.ts
4. Run all tests to verify

---

## Script Maintenance

**Update when:**
- Adding new auth endpoints
- Changing JWT configuration
- Modifying password requirements
- Adding new validation rules
- Changing error codes

**Don't forget to:**
- Update SESSION_LOG_1_CHECK_AUTH.md
- Update this README
- Test on clean database
- Verify in CI/CD

---

## Questions?

If verification fails:
1. Read error messages carefully
2. Check server logs: `logs/combined-*.log`
3. Verify `.env` configuration
4. Ensure database is up to date
5. Check SESSION_LOG_1_CHECK_AUTH.md for manual steps

---

**Last Updated:** November 21, 2025
**Maintainer:** Development Team
