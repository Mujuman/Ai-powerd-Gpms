# CRUD Testing Checklist - Print & Use

**Status**: ✅ **READY FOR TESTING**

**Date**: November 20, 2026  
**Time Estimate**: 20-30 minutes

---

## Pre-Test Checklist

### Environment Setup
- [ ] Backend running (`npm run dev` in `/backend`)
- [ ] Frontend running (`npm run dev` in `/frontend`)
- [ ] Browser: http://127.0.0.1:5173
- [ ] Logged in as: admin@ai-gpms.local
- [ ] Password: Admin@gpms2024!
- [ ] DevTools open: F12 (check Console tab)
- [ ] No console errors at startup

---

## PART 1: DEPARTMENT HEADS TESTING

### ✅ Test 1.1: CREATE Department Head

**Test Data**:
```
Name:       Alice Johnson
Email:      alice@university.edu
Password:   SecurePass123!
Role:       Department Head (locked)
Depts:      Select any 2
```

**Steps**:
- [ ] Click "+ New Department Head"
- [ ] Fill all fields
- [ ] Click "Create Department Head"

**Verify** ✅:
- [ ] Modal closes
- [ ] New row appears in table
- [ ] Full Name shows: "Alice Johnson"
- [ ] Email shows: "alice@university.edu"
- [ ] Role shows: "Department Head"
- [ ] Status shows: "Active"
- [ ] Departments show correct selections
- [ ] No console errors

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 1.2: READ Department Heads

**Steps**:
- [ ] Observe all department heads in table
- [ ] Count total records

**Search Test**:
- [ ] Type "alice" in search box
- [ ] List filters to show alice only
- [ ] Clear search
- [ ] List shows all records again

**Verify** ✅:
- [ ] Alice appears in list
- [ ] Search works on name
- [ ] Search works on email
- [ ] Pagination buttons visible
- [ ] All columns display correctly

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 1.3: UPDATE Department Head

**Steps**:
- [ ] Find Alice Johnson row
- [ ] Click pencil icon [✎]
- [ ] Edit form opens

**Changes**:
- [ ] Change name to: "Alice J. Smith"
- [ ] Toggle "Active account" checkbox (deactivate)
- [ ] Add/remove a department

**Save**:
- [ ] Click "Save changes"

**Verify** ✅:
- [ ] Modal closes
- [ ] Table refreshes
- [ ] Full Name updated: "Alice J. Smith"
- [ ] Status shows: "Inactive" (grey)
- [ ] Departments updated
- [ ] Email unchanged
- [ ] No console errors

**Verify Persistence**:
- [ ] Press F5 (refresh page)
- [ ] Changes still there: "Alice J. Smith", "Inactive"

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 1.4: TOGGLE Department Head

**Steps**:
- [ ] Find Alice row (shows "Inactive" from previous test)
- [ ] Click green/grey toggle [⊕]

**Verify** ✅:
- [ ] Status changes to: "Active"
- [ ] Toggle icon turns green
- [ ] Row still visible in table

**Toggle Again**:
- [ ] Click toggle again
- [ ] Status back to: "Inactive"
- [ ] Icon turns grey

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 1.5: DELETE Department Head

**Steps**:
- [ ] Find Alice row
- [ ] Click red trash icon [🗑]

**Confirm**:
- [ ] Dialog appears: "Are you sure you want to delete Alice J. Smith?"
- [ ] Click "OK"

**Verify** ✅:
- [ ] Dialog shows correct name
- [ ] Alice removed from table
- [ ] Table refreshes
- [ ] Search for "alice" shows no results
- [ ] No console errors

**Verify Soft Delete**:
- [ ] Database still has record (isActive = false)

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 1.6: Department Heads - Error Handling

**Try Invalid Email**:
- [ ] Click "+ New Department Head"
- [ ] Fill name, leave email empty
- [ ] Try to submit

**Verify**:
- [ ] Error message shown
- [ ] Cannot submit

**Try Duplicate Email**:
- [ ] Create new head with email: admin@ai-gpms.local (exists)
- [ ] Try to submit

**Verify**:
- [ ] Error: "already exists" or similar
- [ ] Cannot create duplicate

**Result**: ✅ PASS / ❌ FAIL

---

## PART 2: DEPARTMENTS TESTING

### ✅ Test 2.1: CREATE Department

**Navigate**:
- [ ] Click sidebar "Departments"

**Test Data**:
```
Code:  CS
Name:  Computer Science
```

**Steps**:
- [ ] Click "+ New Department"
- [ ] Fill code: "cs" (will be uppercase)
- [ ] Fill name: "Computer Science"
- [ ] Click "Create"

**Verify** ✅:
- [ ] Modal closes
- [ ] New row appears
- [ ] Code shows: "CS" (uppercase)
- [ ] Name shows: "Computer Science"
- [ ] Status shows: "Active"
- [ ] No console errors

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 2.2: READ Departments

**Steps**:
- [ ] Observe all departments in table

**Verify** ✅:
- [ ] CS appears in list
- [ ] All columns display: Code, Name, Status, Actions
- [ ] CS shows uppercase

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 2.3: UPDATE Department

**Steps**:
- [ ] Find CS row
- [ ] Click pencil icon [✎]

**Changes**:
- [ ] Change name to: "Computer Science & IT"
- [ ] Verify Code is disabled (read-only)

**Save**:
- [ ] Click "Save changes"

**Verify** ✅:
- [ ] Modal closes
- [ ] Table refreshes
- [ ] Name updated: "Computer Science & IT"
- [ ] Code unchanged: "CS"

**Verify Persistence**:
- [ ] Press F5
- [ ] Changes still there

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 2.4: TOGGLE Department

**Steps**:
- [ ] Find CS row
- [ ] Click toggle [⊕]

**Verify** ✅:
- [ ] Status changes to: "Inactive"
- [ ] Icon turns grey

**Toggle Again**:
- [ ] Click toggle
- [ ] Status back to: "Active"

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 2.5: DELETE Department

**Steps**:
- [ ] Click trash icon [🗑]

**Confirm**:
- [ ] Dialog: "Are you sure you want to delete Computer Science & IT?"
- [ ] Click "OK"

**Verify** ✅:
- [ ] CS removed from table
- [ ] No search results for "CS"
- [ ] No console errors

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 2.6: Departments - Error Handling

**Try Invalid Code**:
- [ ] Click "+ New Department"
- [ ] Code: "test@" (invalid special char)
- [ ] Try to submit

**Verify**:
- [ ] Error shown
- [ ] Cannot submit

**Try Duplicate Code**:
- [ ] Create dept with code existing in DB
- [ ] Try to submit

**Verify**:
- [ ] Error: "already exists"
- [ ] Cannot create duplicate

**Result**: ✅ PASS / ❌ FAIL

---

## PART 3: CROSS-FEATURE & PERFORMANCE

### ✅ Test 3.1: Department Assignment to Head

**Steps**:
- [ ] Create new department head
- [ ] Select multiple departments
- [ ] Submit

**Verify**:
- [ ] Departments appear in table for that head
- [ ] Edit: departments show correctly
- [ ] Departments persist after refresh

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 3.2: Auto-Refresh

**After CREATE**:
- [ ] Table updates automatically (no manual refresh needed)

**After UPDATE**:
- [ ] Changes appear immediately

**After DELETE**:
- [ ] Record removed immediately

**After TOGGLE**:
- [ ] Status updates immediately

**Result**: ✅ PASS / ❌ FAIL

---

### ✅ Test 3.3: Performance

**Response Times**:
- [ ] Create: < 2 seconds
- [ ] Update: < 1 second
- [ ] Delete: < 1 second
- [ ] Search: instant (< 500ms)

**Result**: ✅ PASS / ❌ FAIL

---

## Browser Console Check

**Open DevTools**: F12  
**Go to Console tab**

- [ ] **ZERO console errors** at startup
- [ ] **ZERO console errors** after create
- [ ] **ZERO console errors** after update
- [ ] **ZERO console errors** after delete
- [ ] **ZERO console errors** after toggle

---

## Summary Checklist

### Department Heads Management
- [ ] CREATE works - new head appears
- [ ] READ works - can search and list
- [ ] UPDATE works - changes persist
- [ ] DELETE works - soft deleted
- [ ] TOGGLE works - status changes
- [ ] Errors handled - validation shown
- [ ] Auto-refresh works - no manual F5 needed
- [ ] Persistence works - F5 doesn't lose changes

### Departments Management
- [ ] CREATE works - new dept appears
- [ ] READ works - all visible
- [ ] UPDATE works - changes persist
- [ ] DELETE works - soft deleted
- [ ] TOGGLE works - status changes
- [ ] Errors handled - validation shown
- [ ] Auto-refresh works
- [ ] Persistence works

### Cross-Features
- [ ] Department assignment works
- [ ] Auto-refresh after all operations
- [ ] Performance acceptable
- [ ] No console errors
- [ ] No network errors

---

## Final Results

| Feature | Status |
|---------|--------|
| **Department Heads CRUD** | ✅ / ❌ |
| **Departments CRUD** | ✅ / ❌ |
| **Error Handling** | ✅ / ❌ |
| **Performance** | ✅ / ❌ |
| **No Console Errors** | ✅ / ❌ |

### Overall Status
```
[ ] ALL TESTS PASSED ✅ → READY FOR PRODUCTION
[ ] SOME TESTS FAILED ❌ → NEEDS FIXES
```

---

## If Tests Fail

### Common Issues:

**Create doesn't work**:
- Check email format
- Check password length (min 12)
- Look for error message in form
- Check browser console (F12)

**API 404 errors**:
- Is backend running?
- Port 3000 is correct?
- Check network tab (F12 > Network)

**CORS errors**:
- Check backend .env
- FRONTEND_ORIGIN should include http://127.0.0.1:5173

**Changes don't persist**:
- Refresh page (F5)
- Check network errors (F12 > Network)

---

## Time Tracking

```
Start Time:     _________
Test 1.1 (CREATE):      ✓ _________ minutes
Test 1.2 (READ):        ✓ _________ minutes
Test 1.3 (UPDATE):      ✓ _________ minutes
Test 1.4 (TOGGLE):      ✓ _________ minutes
Test 1.5 (DELETE):      ✓ _________ minutes
Test 1.6 (ERRORS):      ✓ _________ minutes

Test 2.1 (CREATE):      ✓ _________ minutes
Test 2.2 (READ):        ✓ _________ minutes
Test 2.3 (UPDATE):      ✓ _________ minutes
Test 2.4 (TOGGLE):      ✓ _________ minutes
Test 2.5 (DELETE):      ✓ _________ minutes
Test 2.6 (ERRORS):      ✓ _________ minutes

Part 3 (Cross-features): ✓ _________ minutes

End Time:       _________
TOTAL TIME:     _________ minutes
```

---

## Tester Notes

```
[Space for notes during testing]

__________________________________________________________

__________________________________________________________

__________________________________________________________

__________________________________________________________

__________________________________________________________

__________________________________________________________

__________________________________________________________

```

---

## Sign-Off

**Tester Name**: _______________________  
**Date**: _______________________  
**Result**: ✅ ALL PASS / ❌ NEEDS FIXES  
**Signature**: _______________________  

---

**Status**: ✅ **READY FOR TESTING**

Print this checklist and complete as you test! ✓

---

**Date**: November 20, 2026  
**Version**: 1.0
