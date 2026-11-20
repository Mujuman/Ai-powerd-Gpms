# Complete CRUD Testing Guide - Department Heads & Departments

**Status**: ✅ **COMPREHENSIVE TESTING GUIDE**

---

## Overview

This guide covers all CRUD operations (Create, Read, Update, Delete) for both:
1. **Department Heads Management** (Users page)
2. **Departments Management** (Departments page)

Each operation includes step-by-step instructions and expected results.

---

## Part 1: Department Heads Management

### 1.1 CREATE - New Department Head

#### Steps:
1. Navigate to **Users** page (sidebar → Users)
2. Click **"+ New Department Head"** button
3. Fill the form:
   - **Full Name**: `John Doe` (or any name)
   - **Email**: `john@university.edu` (unique email)
   - **Password**: `SecurePass123!` (min 12 chars)
   - **Role**: Should be **locked to "Department Head"**
   - **Departments**: Select 1-2 departments (optional)
4. Click **"Create Department Head"** button

#### Expected Results:
- ✅ Modal closes
- ✅ New department head appears in table
- ✅ Email column shows: `john@university.edu`
- ✅ Role badge shows: `Department Head`
- ✅ Status shows: `Active`
- ✅ Departments column shows selected departments (if any)

#### Error Cases to Test:
- ❌ **Empty email**: Should show validation error
- ❌ **Invalid email**: Should show validation error
- ❌ **Short password** (< 12 chars): Should show error
- ❌ **Duplicate email**: Should show "already exists" error
- ❌ **Empty name**: Should show validation error

#### Success Indicators:
```
✓ Record appears in table immediately
✓ Can search for the new head
✓ Departments are assigned correctly
✓ Status is Active
```

---

### 1.2 READ - List & Search Department Heads

#### Steps:

**List All**:
1. Go to **Users** page
2. Observe the table loads with all department heads

**Search**:
1. Type in search box: `john` (part of name or email)
2. List filters in real-time

#### Expected Results:
- ✅ Table displays all department heads
- ✅ Each row shows: Full Name, Email, Role, Departments, Status, Actions
- ✅ Search filters results as you type
- ✅ Search works for both names and emails
- ✅ Pagination works (if 20+ records)

#### Verify:
- ✅ All created department heads are visible
- ✅ Search is case-insensitive
- ✅ Departments column shows assigned departments
- ✅ Status column is colored (green for Active, grey for Inactive)

---

### 1.3 UPDATE - Edit Department Head

#### Steps:
1. Go to **Users** page
2. Find the department head to edit
3. Click **pencil icon** [✎] in Actions column
4. Edit form appears with current values
5. Change fields:
   - Full Name: `Jane Doe`
   - Departments: Add/remove departments
   - Status: Toggle "Active account" checkbox
6. Click **"Save changes"** button

#### Expected Results:
- ✅ Modal closes
- ✅ Table refreshes immediately
- ✅ Changes are reflected in the table
- ✅ Name is updated
- ✅ Departments are updated
- ✅ Status is updated if changed

#### Verify:
- ✅ Full name updated in table
- ✅ Departments column updated
- ✅ Changes persisted (refresh page - changes remain)
- ✅ Cannot edit email (field is read-only during edit)

---

### 1.4 DELETE - Remove Department Head

#### Steps:
1. Go to **Users** page
2. Find the department head to delete
3. Click **red trash icon** [🗑] in Actions column
4. Confirmation dialog appears:
   ```
   Are you sure you want to delete [Name]?
   This action cannot be undone.
   ```
5. Click **OK** to confirm (or Cancel to abort)

#### Expected Results:
- ✅ Dialog shows correct department head name
- ✅ Department head removed from table
- ✅ Table refreshes automatically
- ✅ Button shows loading state during deletion
- ✅ No error message if successful

#### Verify:
- ✅ Deleted record no longer in list
- ✅ Can search for it - no results
- ✅ Status was soft-deleted (can verify in database: `isActive = false`)
- ✅ If you cancel dialog - nothing happens

---

### 1.5 TOGGLE - Activate/Deactivate

#### Steps:
1. Go to **Users** page
2. Find a department head
3. Click **toggle button** [⊕] in Actions column
   - **Green toggle** = Active
   - **Grey toggle** = Inactive
4. Button updates immediately

#### Expected Results:
- ✅ Status column changes: `Active` → `Inactive` or vice versa
- ✅ Toggle icon changes color (green ↔ grey)
- ✅ Table refreshes
- ✅ No dialog or confirmation needed

#### Verify:
- ✅ Can toggle multiple times
- ✅ Inactive department heads still appear in list (not deleted)
- ✅ Toggling again reactivates them
- ✅ Status persisted (refresh page - status remains)

---

## Part 2: Departments Management

### 2.1 CREATE - New Department

#### Steps:
1. Navigate to **Departments** page (sidebar → Departments)
2. Click **"+ New Department"** button
3. Fill the form:
   - **Department Code**: `CS` or `MATH` (unique, 2-32 chars, letters/digits/hyphens/underscores)
   - **Department Name**: `Computer Science` (2-120 chars)
4. Click **"Create"** button

#### Expected Results:
- ✅ Modal closes
- ✅ New department appears in table
- ✅ Code column shows: `CS` (uppercase)
- ✅ Name column shows: `Computer Science`
- ✅ Status shows: `Active`

#### Error Cases to Test:
- ❌ **Empty code**: Show validation error
- ❌ **Code too short** (< 2 chars): Show error
- ❌ **Invalid code** (special chars): Show error
- ❌ **Duplicate code**: Show "already exists" error
- ❌ **Empty name**: Show validation error
- ❌ **Name too long**: Show error

#### Success Indicators:
```
✓ Record appears immediately
✓ Code is uppercase
✓ Can search for it
✓ Status is Active
```

---

### 2.2 READ - List & View Departments

#### Steps:

**List All**:
1. Go to **Departments** page
2. Observe table with all departments

**View Details**:
- All info is in the table (Code, Name, Status, Actions)

#### Expected Results:
- ✅ Table shows all departments
- ✅ Columns: Code, Name, Status, Actions
- ✅ Each row is distinct
- ✅ Status colored appropriately

#### Verify:
- ✅ All created departments visible
- ✅ Codes are uppercase
- ✅ Names display correctly
- ✅ Status badges are styled

---

### 2.3 UPDATE - Edit Department

#### Steps:
1. Go to **Departments** page
2. Find department to edit
3. Click **pencil icon** [✎] in Actions column
4. Edit form appears:
   - **Code**: Read-only (cannot change)
   - **Name**: Editable
5. Change the name: `Computer Science & IT`
6. Click **"Save changes"** button

#### Expected Results:
- ✅ Modal closes
- ✅ Table refreshes
- ✅ Name is updated in table
- ✅ Code remains unchanged (read-only)
- ✅ Status unchanged (not in edit form)

#### Verify:
- ✅ Department name updated
- ✅ Code unchanged
- ✅ Changes persisted (refresh page - changes remain)
- ✅ Can edit same department multiple times

---

### 2.4 DELETE - Remove Department

#### Steps:
1. Go to **Departments** page
2. Find department to delete
3. Click **red trash icon** [🗑] in Actions column
4. Confirmation dialog appears:
   ```
   Are you sure you want to delete [Department Name]?
   This action cannot be undone.
   ```
5. Click **OK** to confirm

#### Expected Results:
- ✅ Dialog shows correct department name
- ✅ Department removed from table
- ✅ Table refreshes automatically
- ✅ Button shows loading state
- ✅ No error if successful

#### Verify:
- ✅ Deleted department no longer in list
- ✅ Cannot find it with search
- ✅ Soft-deleted (data preserved in DB: `isActive = false`)
- ✅ Cancel button prevents deletion

---

### 2.5 TOGGLE - Activate/Deactivate

#### Steps:
1. Go to **Departments** page
2. Find a department
3. Click **toggle button** [⊕] in Actions column

#### Expected Results:
- ✅ Status column changes: `Active` → `Inactive` or vice versa
- ✅ Toggle icon changes color
- ✅ Table refreshes immediately
- ✅ No confirmation needed

#### Verify:
- ✅ Toggle works multiple times
- ✅ Inactive departments stay in list (not deleted)
- ✅ Reactivation works
- ✅ Status persisted (refresh page)

---

## Part 3: Cross-Feature Testing

### 3.1 Department Assignment

#### Scenario: Create head and assign departments

**Steps**:
1. Create a **new department head**
2. Select multiple departments (e.g., CS, MATH, ISS)
3. Submit form
4. Edit the department head
5. Verify departments are assigned

#### Expected Results:
- ✅ Departments appear in table
- ✅ Can add more departments
- ✅ Can remove departments
- ✅ Saved correctly

---

### 3.2 Department Deletion Impact

#### Scenario: Delete department that's assigned to a head

**Steps**:
1. Create department head assigned to "CS"
2. Go to Departments page
3. Delete the "CS" department
4. Go back to Users page
5. Check the department head

#### Expected Results:
- ✅ Department is removed (soft-delete)
- ✅ Department head still exists
- ✅ Department no longer appears in head's departments
- ✅ No errors

---

### 3.3 Deactivation Behavior

#### Scenario: Deactivate department head

**Steps**:
1. Create department head
2. Toggle to deactivate (inactive)
3. Try to view (should still be visible)
4. Toggle to reactivate
5. Verify it's active again

#### Expected Results:
- ✅ Can see inactive heads in list
- ✅ Status shows "Inactive" (grey)
- ✅ Can reactivate by toggling
- ✅ Deactivation doesn't delete

---

## Part 4: Error Handling & Edge Cases

### 4.1 Network Errors

#### Test:
1. Create a record
2. Close browser console and reopen while operation is in progress
3. Check error handling

#### Expected:
- ✅ Error message displayed
- ✅ Can retry
- ✅ Button re-enabled
- ✅ No orphaned state

---

### 4.2 Validation Errors

#### Test All Invalid Inputs:
- Empty required fields
- Invalid email format
- Too short/long values
- Duplicate unique values (email, code)
- Invalid special characters

#### Expected:
- ✅ Error messages appear
- ✅ Form highlights invalid fields
- ✅ Submit button disabled
- ✅ Can correct and retry

---

### 4.3 Auto-Refresh

#### Test After Each Operation:
1. Create a record
2. Verify table updates without manual refresh
3. Edit a record
4. Verify table updates automatically
5. Delete a record
6. Verify removed from table

#### Expected:
- ✅ All operations auto-refresh
- ✅ No manual page refresh needed
- ✅ Data always current

---

## Part 5: Performance Testing

### 5.1 Search Performance

#### Test:
1. Create 10+ department heads
2. Search with different terms
3. Note response time

#### Expected:
- ✅ Search results appear immediately
- ✅ No noticeable lag
- ✅ Works with partial text

---

### 5.2 Large Lists

#### Test:
1. Load page with many records (20+)
2. Check pagination
3. Navigate between pages

#### Expected:
- ✅ Pagination works correctly
- ✅ Shows correct record count
- ✅ Previous/Next buttons functional

---

## Part 6: Data Persistence

### 6.1 Refresh After Operations

#### Test:
1. Create a record
2. **Refresh page** (F5)
3. Verify record still exists

#### Expected:
- ✅ Record persists after refresh
- ✅ Changes are saved in database
- ✅ No data loss

---

### 6.2 Multiple Browser Tabs

#### Test:
1. Open page in Tab 1
2. Open same page in Tab 2
3. Create record in Tab 1
4. Refresh Tab 2
5. Check if new record appears

#### Expected:
- ✅ Changes visible in other tabs (after refresh)
- ✅ No conflicts
- ✅ Data consistent

---

## Part 7: Accessibility Testing

### 7.1 Keyboard Navigation

#### Test:
1. Use **Tab** key to navigate form
2. Use **Enter** to submit
3. Use **Escape** to close modals

#### Expected:
- ✅ All interactive elements reachable
- ✅ Keyboard shortcuts work
- ✅ No trapping of focus

---

### 7.2 Screen Reader

#### Test (with screen reader):
1. Navigate to form
2. Read form labels
3. Navigate buttons
4. Read error messages

#### Expected:
- ✅ Labels announced
- ✅ Buttons described
- ✅ Errors announced
- ✅ All content accessible

---

## Complete Test Checklist

### Department Heads
- [ ] CREATE: Form accepts all fields, record added, appears in list
- [ ] READ: All records visible, search works, pagination works
- [ ] UPDATE: Can edit name, departments, status; changes persist
- [ ] DELETE: Confirmation works, record removed, soft-deleted
- [ ] TOGGLE: Status changes, persists, works multiple times
- [ ] Validation: All error cases handled
- [ ] Auto-refresh: Works after all operations
- [ ] Persistence: Changes survive page refresh

### Departments
- [ ] CREATE: Form accepts fields, record added, code uppercase
- [ ] READ: All visible, correctly displayed
- [ ] UPDATE: Can edit name, code read-only, changes persist
- [ ] DELETE: Confirmation works, removed, soft-deleted
- [ ] TOGGLE: Status changes, persists
- [ ] Validation: All errors handled
- [ ] Auto-refresh: Works after operations
- [ ] Persistence: Changes survive refresh

### Cross-Feature
- [ ] Department assignment works
- [ ] Department deletion doesn't break heads
- [ ] Deactivation doesn't delete
- [ ] Error handling works
- [ ] Network errors handled
- [ ] Performance acceptable
- [ ] Accessibility features work

---

## Quick Test Summary

| Operation | Department Heads | Departments | Status |
|-----------|-----------------|-------------|--------|
| **CREATE** | ✅ Form modal | ✅ Form modal | Ready |
| **READ** | ✅ List + search | ✅ List | Ready |
| **UPDATE** | ✅ Edit modal | ✅ Edit modal | Ready |
| **DELETE** | ✅ With confirm | ✅ With confirm | Ready |
| **TOGGLE** | ✅ Activate/Deactivate | ✅ Activate/Deactivate | Ready |

---

## Running Tests

### Step 1: Prepare
1. Login as system admin
2. Open browser DevTools (F12)
3. Go to Department Heads page

### Step 2: Create Test Data
- Create 3-5 department heads
- Create 3-5 departments
- Assign departments to heads

### Step 3: Test Each Operation
- Follow steps in sections 1-2 above
- Verify each expected result
- Check error cases

### Step 4: Cross-Feature Tests
- Test interactions between features
- Verify data consistency
- Check edge cases

### Step 5: Performance & Accessibility
- Check response times
- Test keyboard navigation
- Test with screen reader

---

## Troubleshooting

### Issue: Record not appearing after creation
- **Check**: Did modal close? Did you see success?
- **Fix**: Refresh page manually (F5)

### Issue: Search not working
- **Check**: Did you type in search box?
- **Fix**: Clear search, try again

### Issue: Delete doesn't work
- **Check**: Did confirmation dialog appear?
- **Fix**: Click OK button (not Cancel)

### Issue: Edit won't save
- **Check**: Are all fields valid?
- **Fix**: Check error messages, correct fields

---

**Status**: ✅ **READY FOR TESTING**

Use this guide to verify all CRUD operations are working correctly!

---

**Date**: November 20, 2026  
**Last Updated**: This session  
**Version**: 1.0
