# Quick Start - After CORS Fix

## ⚡ TL;DR

Your CORS error is fixed! Here's what to do:

### Step 1: Restart Backend
```bash
# Stop current backend if running
# Then restart with:
npm run dev
# (from backend directory)
```

### Step 2: Refresh Frontend
```
Press: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
This does a HARD refresh (clears cache)
```

### Step 3: Login
- **URL**: `http://127.0.0.1:5173` (or `http://localhost:5173`)
- **Email**: `admin@ai-gpms.local`
- **Password**: `Admin@gpms2024!`

✅ **You should now login successfully!**

---

## What Was Fixed

### The Issue
```
Origin is not allowed by CORS
```

### Why It Happened
Your frontend Vite server was running on `http://127.0.0.1:5173` (IP address)
But backend only accepted `http://localhost:5173` (DNS name)

These are **different CORS origins**.

### The Fix
Updated `backend/.env`:
```diff
- FRONTEND_ORIGIN=http://localhost:5173
+ FRONTEND_ORIGIN=http://localhost:5173,http://127.0.0.1:5173
```

Now the backend accepts both!

---

## Verify It's Working

### In Browser DevTools
1. Open **F12** (or right-click → Inspect)
2. Click **Network** tab
3. Try to login
4. Find the **login** request
5. Check **Response Headers**:
   - ✅ `access-control-allow-origin: http://127.0.0.1:5173`
   - ✅ Status code: `200` (not 403)

---

## If You Get a Different Error

### Still Getting 403?
- ✅ Restarted backend server? (Important!)
- ✅ Did hard refresh (Ctrl+Shift+R)? (Not just F5)
- ✅ Try incognito/private window (clears cache)

### Getting 401 (Unauthorized)?
- This is GOOD! CORS is fixed
- It means credentials are wrong or expired
- Use: `admin@ai-gpms.local` / `Admin@gpms2024!`

### Getting 404?
- Backend server might not be running
- Check: `npm run dev` from backend directory

---

## Next: System Admin Features

Once logged in as system admin, you can:

✅ **Create department heads**
```
POST /api/users/department-heads
- Email
- Full Name
- Password
- Departments (optional)
```

✅ **Manage departments**
```
POST /api/departments
- Code (e.g., "CS")
- Name (e.g., "Computer Science")
```

See `backend/ADMIN_SCOPE.md` for full admin features!

---

**Status**: ✅ Ready to go!
