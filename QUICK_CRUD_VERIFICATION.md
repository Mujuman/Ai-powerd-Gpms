# Quick CRUD Verification - Step-by-Step

**Purpose**: Rapidly verify all CRUD operations are working  
**Time Required**: ~15-20 minutes  
**Status**: ✅ Ready to execute

---

## Pre-Test Setup

### Step 0: Prepare Environment
```
1. Open browser DevTools: F12
2. Go to: http://127.0.0.1:5173 (or your frontend URL)
3. Login as: admin@ai-gpms.local / Admin@gpms2024!
4. Navigate to: Users page (Department Heads)
```

---

## PART 1: DEPARTMENT HEADS CRUD (5-10 minutes)

### ✅ Test 1.1: CREATE Department Head

**Form Data**:
```
Full Name:    Alice Johnson
Email:        alice@university.edu
Password:     SecurePass123!
Role:         Department Head (locked)
Departments:  Select CS, ISS (or any 2)
```

**Action**:
1. Click "+ New Department Head"
2. Fill in all fields ↑
3. Click "Create Department Head"

**Verify** ✅:
- [ ] Modal closes
- [ ] New row appears in table
- [ ] Full Name: "Alice Johnson"
- [ ] Email: "alice@university.edu"
- [ ] Role: "Department Head"
- [ ] Departments: Show selected departments
- [ ] Status: "Active" (green)

**If Failed** ❌:
- Check browser console (F12)
- Look for error message in modal
- See: FIX_CREATE_DEPARTMENT_HEAD.md

---

### ✅ Test 1.2: READ Department Heads

**List**:
1. Stay on Users page
2. Observe table loads all department heads

**Verify** ✅:
- [ ] Alice Johnson appears in list
- [ ] Table shows: Name, Email, Role, Departments, Status, Actions
- [ ] All records visible

**Search**:
1. Type "alice" in search box
2. Table filters in real-time

**Verify** ✅:
- [ ] Results filtered to alice only
- [ ] Search works on email: "alice@"
- [ ] Clear search: all records return

---

### ✅ Test 1.3: UPDATE Department Head

**Edit**:
1. Find Alice Johnson row
2. Click pencil icon [✎]
3. Edit form opens

**Changes**:
```
Full Name:    Alice J. Smith (changed)
Departments:  Remove one, add another
Status:       Toggle "Active account" checkbox
```

**Action**:
1. Make changes ↑
2. Click "Save changes"

**Verify** ✅:
- [ ] Modal closes
- [ ] Table refreshes
- [ ] Full Name updated: "Alice J. Smith"
- [ ] Departments updated
- [ ] Status toggled (if changed)
- [ ] Changes persist on page refresh (F5)

---

### ✅ Test 1.4: TOGGLE Department Head

**Toggle Status**:
1. Find Alice row
2. Click green toggle button [⊕]

**Verify** ✅:
- [ ] Status changes to "Inactive"
- [ ] Toggle icon turns grey
- [ ] Row still visible (not deleted)

**Toggle Again**:
1. Click toggle again

**Verify** ✅:
- [ ] Status back to "Active"
- [ ] Toggle icon turns green

---

### ✅ Test 1.5: DELETE Department Head

**Delete**:
1. Find Alice row
2. Click red trash icon [🗑]

**Confirm**:
- Dialog appears: "Are you sure you want to delete Alice J. Smith?"
- Click "OK"

**Verify** ✅:
- [ ] Dialog shows correct name
- [ ] Alice removed from table
- [ ] Table refreshes
- [ ] No error message
- [ ] Cannot find Alice in search

---

## PART 2: DEPARTMENTS CRUD (5-10 minutes)

### ✅ Test 2.1: CREATE Department

**Navigate**:
1. Click sidebar "Departments"
2. Go to Departments page

**Form Data**:
```
Code:  ENG
Name:  Engineering
```

**Action**:
1. Click "+ New Department"
2. Fill form ↑
3. Click "Create"

**Verify** ✅:
- [ ] Modal closes
- [ ] New row appears
- [ ] Code: "ENG" (uppercase)
- [ ] Name: "Engineering"
- [ ] Status: "Active"

---

### ✅ Test 2.2: READ Departments

**List**:
1. View Departments page
2. Observe all departments

**Verify** ✅:
- [ ] All departments visible
- [ ] ENG appears in list
- [ ] Table shows: Code, Name, Status, Actions

---

### ✅ Test 2.3: UPDATE Department

**Edit**:
1. Find ENG row
2. Click pencil icon [✎]

**Changes**:
```
Name:  Engineering & Technology (changed)
Code:  ENG (read-only - cannot change)
```

**Action**:
1. Change Name
2. Verify Code is disabled
3. Click "Save changes"

**Verify** ✅:
- [ ] Modal closes
- [ ] Table refreshes
- [ ] Name updated: "Engineering & Technology"
- [ ] Code unchanged: "ENG"
- [ ] Changes persist on refresh

---

### ✅ Test 2.4: TOGGLE Department

**Toggle**:
1. Find ENG row
2. Click toggle [⊕]

**Verify** ✅:
- [ ] Status: "Inactive"
- [ ] Toggle icon: grey
- [ ] Row still visible

**Toggle Again**:
1. Click toggle
2. Status: "Active", icon: green

---

### ✅ Test 2.5: DELETE Department

**Delete**:
1. Click trash icon [🗑]

**Confirm**:
- Dialog: "Are you sure you want to delete Engineering & Technology?"
- Click "OK"

**Verify** ✅:
- [ ] Dialog shows correct name
- [ ] ENG removed from table
- [ ] No search results for "ENG"
- [ ] Table refreshes automatically

---

## PART 3: ERROR HANDLING (2-3 minutes)

### ✅ Test 3.1: Validation Errors

**Create with Invalid Data**:
1. Click "+ New Department Head"
2. Leave "Full Name" empty
3. Click "Create"

**Verify** ✅:
- [ ] Error message appears
- [ ] Full Name field highlighted red
- [ ] Cannot submit

**Fix & Try Again**:
1. Fill Full Name
2. Clear invalid email
3. Type "invalid-email"
4. Try to create

**Verify** ✅:
- [ ] Email validation error
- [ ] Cannot submit

---

### ✅ Test 3.2: Duplicate Email

**Try Duplicate**:
1. Try to create with: alice@university.edu (already exists)
2. Click "Create"

**Verify** ✅:
- [ ] Error: "Email already exists" or similar
- [ ] Record not created
- [ ] Can retry with different email

---

### ✅ Test 3.3: Auto-Refresh

**Test After CREATE**:
- [ ] Table updates without refresh

**Test After UPDATE**:
- [ ] Changes appear immediately

**Test After DELETE**:
- [ ] Record removed immediately

---

## PART 4: DATA PERSISTENCE (2 minutes)

### ✅ Test 4.1: Page Refresh

**Create a Record**:
1. Create department head: "Bob Wilson"
2. Press **F5** (refresh page)

**Verify** ✅:
- [ ] Bob Wilson still in list
- [ ] All changes persisted
- [ ] No data loss

---

## VERIFICATION SUMMARY

### Quick Check Matrix

| Operation | Department Heads | Departments | Result |
|-----------|-----------------|-------------|--------|
| CREATE | Create Alice | Create ENG | ✅/❌ |
| READ | List + Search | List Alice | ✅/❌ |
| UPDATE | Edit Alice | Edit ENG | ✅/❌ |
| DELETE | Delete Alice | Delete ENG | ✅/❌ |
| TOGGLE | Activate/Deactivate | Activate/Deactivate | ✅/❌ |

---

## Testing Timeline

```
Total Time: ~20 minutes

0:00-0:05  → Department Heads CREATE
0:05-0:08  → Department Heads READ
0:08-0:12  → Department Heads UPDATE
0:12-0:15  → Department Heads DELETE & TOGGLE
0:15-0:18  → Departments CREATE-DELETE
0:18-0:20  → Error handling & persistence
```

---

## Expected Results Summary

### ✅ All Should Pass:
- CREATE: Records added to table immediately
- READ: All records visible, search works
- UPDATE: Changes reflected, persisted
- DELETE: Confirmation works, soft-deleted
- TOGGLE: Status changes, works repeatedly
- ERROR: Messages shown, validation works
- PERSIST: Changes survive refresh

### ❌ If Any Fail:
1. Check browser console for errors (F12)
2. Read error message in UI
3. Refer to corresponding fix documentation:
   - CREATE: `FIX_CREATE_DEPARTMENT_HEAD.md`
   - API: `FIX_USERS_API_404.md`
   - CORS: `CORS_FIX_GUIDE.md`

---

## Results Checklist

### Department Heads Management
```
[ ] CREATE - New head account added ✅/❌
[ ] READ   - Lists and searches work ✅/❌
[ ] UPDATE - Changes saved and visible ✅/❌
[ ] DELETE - Soft-deleted with confirmation ✅/❌
[ ] TOGGLE - Activate/Deactivate works ✅/❌
[ ] ERRORS - Validation messages shown ✅/❌
[ ] PERSIST- Changes survive refresh ✅/❌
```

### Departments Management
```
[ ] CREATE - New department added ✅/❌
[ ] READ   - All visible ✅/❌
[ ] UPDATE - Name changes saved ✅/❌
[ ] DELETE - Soft-deleted with confirmation ✅/❌
[ ] TOGGLE - Status changes work ✅/❌
[ ] ERRORS - Validation messages shown ✅/❌
[ ] PERSIST- Changes survive refresh ✅/❌
```

### Overall Status
```
[ ] ALL TESTS PASSED ✅
[ ] SOME TESTS FAILED ❌
```

---

## Troubleshooting Quick Links

| Issue | Solution |
|-------|----------|
| Create fails | See: FIX_CREATE_DEPARTMENT_HEAD.md |
| 404 errors | See: FIX_USERS_API_404.md |
| CORS error | See: CORS_FIX_GUIDE.md |
| Form not submitting | Check browser console (F12) |
| Changes not persisting | Verify network tab - no 500 errors |
| Delete doesn't work | Ensure you click OK in confirmation |
| Search not working | Ensure departments loaded first |

---

**Status**: ✅ **READY TO TEST**

Start with Test 1.1 and work through systematically!

---

**Date**: November 20, 2026  
**Version**: 1.0
