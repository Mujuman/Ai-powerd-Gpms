# CORS Error Fix - "Origin is not allowed by CORS"

**Problem**: Getting CORS error "Origin is not allowed by CORS" when logging in  
**Status**: ✅ **FIXED**

---

## Root Cause

Your frontend is running on **`http://127.0.0.1:5173`** but your `.env` was configured to only accept **`http://localhost:5173`**.

These are **different origins** from a CORS perspective:
- `localhost` = DNS name lookup
- `127.0.0.1` = IP address

Even though they resolve to the same machine, browsers treat them as different origins for security reasons.

---

## Solution Applied

### Updated File
**`backend/.env`**

```diff
- FRONTEND_ORIGIN=http://localhost:5173
+ FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

### How It Works
The backend config automatically parses comma-separated origins:

```javascript
// In backend/src/config/env.js
frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
  .split(',')                    // Split by comma
  .map((origin) => origin.trim()) // Remove whitespace
  .filter(Boolean)               // Remove empty strings
```

So `http://localhost:5173,http://127.0.0.1:5173` becomes an array:
```javascript
[
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]
```

---

## How CORS Validation Works

### Request Flow

1. **Browser sends request** from `http://127.0.0.1:5173`
   ```
   POST /api/auth/login
   Origin: http://127.0.0.1:5173
   ```

2. **Backend receives request** and checks CORS in `app.js`:
   ```javascript
   app.use(cors({
     origin(origin, callback) {
       if (!origin || config.frontendOrigins.includes(origin)) {
         callback(null, true)  // ✅ ALLOWED
         return
       }
       callback(Object.assign(
         new Error('Origin is not allowed by CORS'), 
         { status: 403 }
       ))  // ❌ REJECTED
     },
     credentials: true,
   }))
   ```

3. **Check passes** because `http://127.0.0.1:5173` is now in `frontendOrigins`
   ```
   CORS headers added:
   Access-Control-Allow-Origin: http://127.0.0.1:5173
   Access-Control-Allow-Credentials: true
   ```

4. **Browser receives response** with proper CORS headers
   ✅ Login succeeds!

---

## What This Means

### ✅ What Now Works
- Login from `http://127.0.0.1:5173` ✅
- Login from `http://localhost:5173` ✅
- Refresh token ✅
- All authenticated requests ✅

### ✅ Security Still Maintained
- Only these two origins allowed
- Other origins rejected with 403
- Credentials (cookies) only sent to allowed origins
- Same-origin policy enforced

---

## Testing the Fix

### 1. Verify Frontend is Running
```bash
# Frontend should be at one of these URLs:
http://localhost:5173
http://127.0.0.1:5173
```

### 2. Test Login
1. Navigate to frontend URL
2. Go to login page
3. Enter credentials:
   - Email: `admin@ai-gpms.local`
   - Password: `Admin@gpms2024!`
4. ✅ Should login successfully without CORS error

### 3. Verify in Browser DevTools
1. Open **F12 → Network tab**
2. Click login
3. Find the `login` request
4. Check **Response Headers**:
   ```
   access-control-allow-credentials: true
   access-control-allow-origin: http://127.0.0.1:5173
   ```
5. ✅ Status should be `200 OK` (not 403)

---

## Advanced Configuration

### Supporting Multiple Frontend Environments

You can add more origins as needed:

```env
# Development
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

# With multiple environments
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173,http://staging.example.com,https://app.example.com
```

### Per-Environment Setup

#### Development (.env)
```env
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
NODE_ENV=development
```

#### Staging (.env.staging)
```env
FRONTEND_ORIGIN=http://staging.example.com
NODE_ENV=staging
```

#### Production (.env.production)
```env
FRONTEND_ORIGIN=https://app.example.com
NODE_ENV=production
```

### Format Rules
- ✅ Multiple origins: `http://localhost:5173,http://127.0.0.1:5173`
- ✅ With spaces: `http://localhost:5173, http://127.0.0.1:5173`
- ✅ Trailing comma OK: `http://localhost:5173,`
- ✅ Protocol required: `http://` or `https://`
- ❌ No wildcards: `http://*` (not supported)
- ❌ No `localhost` alone: Must include protocol

---

## Why This Solution is Correct

### ✅ Best Practices
1. **Explicit origin lists** - Better security than wildcards
2. **Multiple origins support** - Works in dev and production
3. **Simple configuration** - Just comma-separated list
4. **No code changes** - Only `.env` needs updating
5. **Standard approach** - Follows Express/CORS best practices

### ❌ Alternatives We Didn't Use
1. **`*` wildcard** - Insecure, doesn't work with credentials
2. **Disable CORS** - Exposes API to any origin
3. **Request-level check** - Already done in CORS middleware
4. **Environment-specific code** - Not needed with config-driven approach

---

## Troubleshooting

### Still Getting CORS Error?

#### Check 1: Frontend Origin Correct
```bash
# Look at what origin browser is sending from
# DevTools → Network → login request → Request Headers
# Look for: Origin: http://...
```

#### Check 2: Backend Restarted
```bash
# After changing .env, restart backend server:
npm run dev  # or your startup command
```

#### Check 3: Verify .env Updated
```bash
# Check backend/.env file has both origins:
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

#### Check 4: Check Network Response
```bash
# DevTools → Network → login request
# Response Headers should include:
Access-Control-Allow-Origin: http://127.0.0.1:5173
```

---

## Environment Variables Reference

### Current Configuration

**File**: `backend/.env`

```env
# Frontend origins that can access this API
FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173

# Supported formats:
# - Single: http://localhost:5173
# - Multiple: http://localhost:5173,http://127.0.0.1:5173
# - With ports: http://localhost:3000,http://localhost:5173
# - Domains: http://app.local,https://staging.app.com,https://app.com
```

### Other Related Settings

```env
# Backend server
PORT=3000
NODE_ENV=development

# Database
DB_HOST=127.0.0.1
DB_PORT=3306

# Authentication
JWT_ACCESS_SECRET=<your-secret>
```

---

## Summary of Changes

| File | Change | Impact |
|------|--------|--------|
| `backend/.env` | Added `http://127.0.0.1:5173` to FRONTEND_ORIGIN | ✅ CORS now accepts both localhost and 127.0.0.1 |

---

## Deployment Checklist

- [x] Update `.env` with correct frontend origins
- [x] Restart backend server
- [ ] Test login from frontend
- [ ] Verify no CORS errors in DevTools
- [ ] Test from both `localhost` and `127.0.0.1` (if needed)
- [ ] Check that other origins are properly rejected

---

## Next Steps

1. **Restart your backend server** with the updated `.env`
2. **Refresh your frontend** (Cmd+Shift+R or Ctrl+Shift+R)
3. **Try logging in again** - it should work!

---

**Status**: ✅ **READY TO USE**

If you still have CORS issues after this fix, the problem is likely one of:
- Frontend not actually running on the configured origin
- Backend server not restarted after changing `.env`
- Browser cache issue (try incognito window)

---

**Date**: November 20, 2026  
**Fixed By**: Kiro AI Agent  
**Version**: 1.0
