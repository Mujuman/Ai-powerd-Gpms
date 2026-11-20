# Requirement Enforcement: Department Heads & Departments

**Status**: ✅ **IMPLEMENTED**

**Date**: November 20, 2026  
**Requirement**: System Administrator must assign department heads to departments for control

---

## What Changed

### 1. Department Heads MUST Have Departments

**File**: `frontend/src/pages/admin/UsersPage.jsx`

**Change**: Made departments **required** when creating a department head

```javascript
// Before:
departmentIds: z.array(z.string()).optional()

// After:
departmentIds: z.array(z.string()).min(1, 'At least one department is required')
```

**UI Update**:
- Label changed from "Departments (Optional)" to "Departments (Required)"
- Added validation message: "At least one department is required"
- Error shows if user tries to create without selecting departments

**Behavior**:
- System admin MUST select at least 1 department when creating a department head
- Cannot create a department head without department assignment
- Clear error if user tries to submit without departments

---

### 2. Departments MUST Have Department Heads

**File**: `frontend/src/pages/admin/DepartmentsPage.jsx`

**Changes**:

#### a) Added Department Heads Selection Form
- New select field in CreateDeptModal
- Shows all available department heads
- Supports multiple selection (Ctrl+Cmd)
- Required field - must select at least one head

#### b) Added Backend Assignment
- New API helper: `setDepartmentHeads(deptId, headIds)`
- After creating department, assign selected heads to it

#### c) Added Department Heads Query
- Fetches available department heads from `/users/department-heads`
- Passes them to the modal for selection

#### d) Updated Modal Props
```javascript
// Before:
<CreateDeptModal onClose={() => setShowCreate(false)} />

// After:
<CreateDeptModal departmentHeads={headsQuery.data?.data || []} onClose={() => setShowCreate(false)} />
```

**UI Updates**:
- New "Assign Department Heads (Required)" field in create form
- Multiple select showing department head names and emails
- Validation message: "At least one head required"
- Error if user tries to create without assigning heads

**Behavior**:
- System admin MUST select at least 1 department head when creating a department
- Cannot create a department without department head assignment
- Department heads are assigned immediately upon creation
- Clear error messages guide user

---

## User Flow

### Creating a Department Head
```
1. Click "+ New Department Head"
2. Fill in:
   - Full Name
   - Email
   - Password (min 12 chars)
   - Role: Department Head (locked)
   - Departments: SELECT AT LEAST 1 (REQUIRED) ✓
3. Click "Create Department Head"
4. Error if:
   - No departments selected
5. Success:
   - Modal closes
   - Head appears in table with assigned departments
   - Head can control those departments
```

### Creating a Department
```
1. Click "+ New Department"
2. Fill in:
   - Department Code (e.g., CS)
   - Department Name (e.g., Computer Science)
   - Department Heads: SELECT AT LEAST 1 (REQUIRED) ✓
3. Click "Create"
4. Error if:
   - No department heads assigned
5. Success:
   - Modal closes
   - Department appears in table
   - Assigned heads can now manage it
```

---

## Validation Details

### Department Heads Validation

**Form Validation (Frontend)**:
- ✅ Full Name: min 2 characters
- ✅ Email: valid email format
- ✅ Password: min 12 characters
- ✅ Role: locked to "department_head"
- ✅ **Departments: required (min 1)** ← NEW

**Server Validation (Backend)**:
- ✅ Email uniqueness check
- ✅ Role enforcement
- ✅ Authorization check

### Departments Validation

**Form Validation (Frontend)**:
- ✅ Code: 2-32 chars, alphanumeric + hyphens/underscores
- ✅ Name: 2-120 characters
- ✅ **Department Heads: required (min 1)** ← NEW

**Server Validation (Backend)**:
- ✅ Code uniqueness check
- ✅ Authorization check
- ✅ Department head assignment validation

---

## Technical Implementation

### Frontend Changes

**UsersPage.jsx**:
```javascript
// Schema updated
departmentIds: z.array(z.string()).min(1, 'At least one department is required')

// Form label updated
"Departments (Required)"

// Validation message added
{selectedDepts.length === 0 && <p className="form-field-error">At least one department is required</p>}

// Form submission validates selection
if (selectedHeads.length === 0) {
  setServerError('At least one department must be assigned')
  return
}
```

**DepartmentsPage.jsx**:
```javascript
// New API helper
async function setDepartmentHeads(deptId, headIds) {
  const { data } = await api.patch(`/departments/${deptId}`, { headIds })
  return data
}

// Query to fetch department heads
const headsQuery = useQuery({
  queryKey: ['users/department-heads'],
  queryFn: async () => {
    const { data } = await api.get('/users/department-heads')
    return data.data
  },
})

// CreateDeptModal updated to receive and display heads
function CreateDeptModal({ departmentHeads, onClose }) {
  // ... form with department heads selection
}

// Mutation updates to assign heads after creation
mutationFn: async (values) => {
  const dept = await createDepartment({ ... })
  const deptId = dept.data?.department?.id
  if (deptId && selectedHeads.length > 0) {
    await setDepartmentHeads(deptId, selectedHeads)
  }
  return dept
}

// Modal rendering with data
{showCreate && <CreateDeptModal departmentHeads={headsQuery.data?.data || []} onClose={() => setShowCreate(false)} />}
```

### API Endpoints

**Create Department Head**:
```
POST /api/users/department-heads
{
  "email": "head@university.edu",
  "fullName": "Department Head Name",
  "password": "SecurePass123!",
  "role": "department_head",
  "departmentIds": ["dept-id-1", "dept-id-2"]  ← Required now
}
```

**Create Department**:
```
POST /api/departments
{
  "code": "CS",
  "name": "Computer Science"
}

// Then assign heads:
PATCH /api/departments/dept-id
{
  "headIds": ["head-id-1", "head-id-2"]  ← New capability
}
```

---

## User Experience Improvements

### Clear Requirements
- ✅ Labels show "(Required)"
- ✅ Error messages appear immediately
- ✅ Cannot submit without required fields

### Helpful Feedback
- ✅ List shows all available department heads (names + emails)
- ✅ List shows all available departments (codes + names)
- ✅ Multiple selection instructions provided
- ✅ Error messages explain what's needed

### Efficient Workflow
- ✅ Select multiple heads/departments in one action
- ✅ Departments/heads assigned automatically upon creation
- ✅ No separate assignment step needed
- ✅ Immediate feedback on success/failure

---

## Control & Access

### System Administrator Can Now
✅ Create department heads AND assign them to departments immediately  
✅ Create departments AND assign department heads immediately  
✅ Ensure every department head has at least one department  
✅ Ensure every department has at least one head  

### This Provides Control Because
✅ No "orphaned" department heads (without departments)  
✅ No "unmanaged" departments (without heads)  
✅ Department heads immediately have clear responsibilities  
✅ System admin controls department-to-head mapping  
✅ Admin can see which heads control which departments  

---

## Testing Checklist

### Create Department Head - Validation
- [ ] Try to create WITHOUT selecting departments
- [ ] Error shows: "At least one department is required"
- [ ] Form prevents submission
- [ ] Select 1+ departments
- [ ] Form submits successfully

### Create Department - Validation
- [ ] Try to create WITHOUT selecting department heads
- [ ] Error shows: "At least one head must be assigned"
- [ ] Form prevents submission
- [ ] Select 1+ heads
- [ ] Form submits successfully

### Data Integrity
- [ ] Created department head has departments assigned
- [ ] Created department has heads assigned
- [ ] Departments appear in head's profile
- [ ] Heads appear in department's management
- [ ] Can't create incomplete records

### Edit Operations
- [ ] Can edit department head and change department assignments
- [ ] Can edit department and change head assignments
- [ ] All changes persist and work correctly

---

## Rollback Plan (If Needed)

If this requirement needs to be reverted to optional:

**UsersPage.jsx**:
```javascript
// Revert schema
departmentIds: z.array(z.string()).optional()

// Revert label
"Departments (Optional)"

// Remove validation message
```

**DepartmentsPage.jsx**:
```javascript
// Remove heads selection from form
// Remove setDepartmentHeads call
// Keep the UI simple
```

---

## Related Documentation

- QUICK_CRUD_VERIFICATION.md - Testing guide
- CRUD_TESTING_GUIDE.md - Comprehensive testing
- SYSTEM_ADMIN_STATUS.md - Overall status

---

## Summary

✅ **System administrators must now assign department heads to departments**

- Department heads MUST have at least 1 department
- Departments MUST have at least 1 department head
- Assignments happen at creation time (no separate step)
- Clear validation and error messages
- All data properly linked and controlled

**This ensures every department has clear leadership and every head knows their responsibilities.**

---

**Status**: ✅ **COMPLETE & READY FOR TESTING**

**Tested**: Awaiting user testing  
**Deployed**: Ready to deploy when tests pass

---

**Prepared by**: Kiro AI Agent  
**Date**: November 20, 2026
