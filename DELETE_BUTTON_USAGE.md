# Delete Button - Quick Usage Guide

## 🎯 What's New

A **red trash icon button** now appears in the Actions column of the Department Heads table.

---

## 📍 Where to Find It

**Page**: Department Heads (Users page)  
**Column**: Actions (rightmost column)  
**Position**: After the toggle button  

```
ACTIONS
  [✎ Edit] [⊕ Toggle] [🗑 Delete] ← NEW
```

---

## 🔴 How to Use

### Step 1: Click the Delete Button
Locate the red trash icon in the Actions column and click it.

```
Demo Department Head | head.demo@example.test | Department Head | DEMO | Active | [✎] [⊕] [🗑] ← Click here
```

### Step 2: Confirm Deletion
A dialog will appear asking you to confirm:

```
Are you sure you want to delete Demo Department Head?
This action cannot be undone.

[Cancel] [OK]
```

### Step 3: Confirm or Cancel
- **Click OK**: Department head is deleted
- **Click Cancel**: Nothing happens

### Step 4: Auto-Refresh
After successful deletion, the table automatically refreshes and the department head disappears from the list.

---

## ⚠️ Important Notes

### This Action is PERMANENT
- Once deleted, the department head account is deactivated
- This is a **soft delete** (data is kept but hidden)
- Cannot be undone through the UI
- Departments still exist (only the head is removed)

### Confirmation Required
- Always shows a confirmation dialog
- Prevents accidental deletions
- You must click OK to proceed

### Red Color Means Danger
- Red trash icon indicates destructive action
- Be careful and deliberate when clicking
- Double-check the name in the confirmation dialog

---

## ✅ When to Use Delete

### Delete a Department Head When:
- ✅ Head is no longer with the department
- ✅ Need to remove an inactive account
- ✅ Mistakenly created the wrong person
- ✅ Department restructuring

### Don't Delete When:
- ❌ Want to temporarily disable → Use the toggle button instead
- ❌ Want to change their information → Use the edit button instead
- ❌ Unsure about the deletion

---

## 🔄 Alternative: Deactivate Instead

**If you want to keep the account but disable it:**
1. Click the toggle button (next to trash icon)
2. Department head becomes inactive
3. Can be reactivated later
4. Safer than delete if you're unsure

---

## 🛠️ What Happens Behind the Scenes

### On Your Computer
1. Button click triggers confirmation dialog
2. You click OK
3. Request sent to backend
4. Button shows loading state (disabled)
5. Table refreshes
6. Department head removed from list

### On the Backend
- Department head account is soft-deleted
- Status set to inactive
- Data preserved in database
- Audit log recorded
- Departments still associated

---

## 📋 Affected Data

### What Gets Deleted
- ✅ Department head account

### What Stays Intact
- ✅ Departments they managed (department still exists)
- ✅ Project data
- ✅ Student data
- ✅ Audit logs (records the deletion)

---

## 🆘 Troubleshooting

### Button is Disabled/Greyed Out
- Might be deleting another account
- Wait for the operation to complete

### Getting Error After Clicking Delete
- Network issue
- Check browser console (F12)
- Try again

### Department Head Still Shows After Deletion
- Refresh the page (F5)
- Click "Next" → "Previous" in pagination

---

## 📞 Getting Help

### Check These Docs
- `DELETE_BUTTON_FEATURE.md` - Technical details
- Backend API docs - For admin developers

### If Something Goes Wrong
1. Check browser console (F12) for errors
2. Refresh the page
3. Try again
4. Contact support if issue persists

---

## ✨ Summary

| Action | Button | Result |
|--------|--------|--------|
| **Edit** | [✎] | Update name/departments |
| **Toggle** | [⊕] | Activate/Deactivate |
| **Delete** | [🗑] | **Permanently deactivate** |

---

**Remember**: The red trash button means permanent deletion. Use with care! 🗑️

---

**Last Updated**: November 20, 2026
