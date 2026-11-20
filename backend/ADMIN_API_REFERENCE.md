# System Administrator API Reference

## Quick Start

All endpoints require:
- Authentication token in `Authorization: Bearer <token>` header
- User must have `system_administrator` role

Base URL: `/api`

---

## Department Head Management

### 1. Create Department Head
```
POST /users/department-heads
Authorization: Bearer <token>

{
  "email": "depthead@university.edu",
  "fullName": "John Doe",
  "password": "SecurePass123!",
  "role": "department_head",
  "departmentIds": ["dept-uuid-1", "dept-uuid-2"]
}

Response (201):
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "depthead@university.edu",
      "fullName": "John Doe",
      "role": "department_head",
      "isActive": true,
      "departments": [...]
    }
  }
}
```

### 2. List All Department Heads
```
GET /users/department-heads
Authorization: Bearer <token>

Query Parameters:
  - page: number
  - limit: number
  - search: string (searches name/email)

Response (200):
{
  "success": true,
  "data": {
    "items": [...],
    "total": 5,
    "page": 1,
    "limit": 10
  }
}
```

### 3. Get Department Head Details
```
GET /users/department-heads/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "depthead@university.edu",
      "fullName": "John Doe",
      "role": "department_head",
      "isActive": true,
      "departments": [...]
    }
  }
}
```

### 4. Update Department Head
```
PATCH /users/department-heads/:id
Authorization: Bearer <token>

{
  "fullName": "Jane Doe",
  "isActive": true,
  "departmentIds": ["dept-uuid-1"]
}

Response (200):
{
  "success": true,
  "data": {
    "user": { ... }
  }
}
```

### 5. Delete Department Head
```
DELETE /users/department-heads/:id
Authorization: Bearer <token>

Response (204): No Content
```

---

## Department Management

### 1. Create Department
```
POST /departments
Authorization: Bearer <token>

{
  "code": "CS",
  "name": "Computer Science",
  "description": "Department of Computer Science and Engineering"
}

Response (201):
{
  "success": true,
  "data": {
    "department": {
      "id": "dept-uuid",
      "code": "CS",
      "name": "Computer Science",
      "description": "...",
      "isActive": true,
      "createdAt": "2026-11-20T10:00:00Z"
    }
  }
}
```

### 2. List All Departments
```
GET /departments
Authorization: Bearer <token>

Query Parameters:
  - search: string
  - page: number
  - limit: number

Response (200):
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "dept-uuid",
        "code": "CS",
        "name": "Computer Science",
        "description": "...",
        "isActive": true
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 10
  }
}
```

### 3. Get Department Details
```
GET /departments/:id
Authorization: Bearer <token>

Response (200):
{
  "success": true,
  "data": {
    "department": {
      "id": "dept-uuid",
      "code": "CS",
      "name": "Computer Science",
      "description": "...",
      "isActive": true,
      "headCount": 5
    }
  }
}
```

### 4. Update Department
```
PATCH /departments/:id
Authorization: Bearer <token>

{
  "code": "CIS",
  "name": "Computer Science & IT",
  "description": "Updated description"
}

Response (200):
{
  "success": true,
  "data": {
    "department": { ... }
  }
}
```

### 5. Delete Department
```
DELETE /departments/:id
Authorization: Bearer <token>

Response (204): No Content
```

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "message": "Error description",
  "errors": [
    {
      "path": "fieldName",
      "message": "Validation message"
    }
  ]
}
```

### Common Status Codes

| Code | Meaning |
|------|---------|
| 201 | Created successfully |
| 204 | Deleted successfully (no content) |
| 400 | Validation error / Bad request |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Server error |

---

## Validation Rules

### Department Head Creation
- `email`: Must be valid email format, unique in system
- `fullName`: Required, 2-100 characters
- `password`: Required, minimum 8 characters
- `role`: Must be exactly "department_head"
- `departmentIds`: Optional array of valid department UUIDs

### Department Creation
- `code`: Required, 1-10 characters, unique
- `name`: Required, 2-100 characters
- `description`: Optional, max 500 characters

---

## Audit Trail

All operations are logged with:
- Actor ID (admin who performed action)
- Action type (create, update, delete)
- Target type and ID
- Timestamp
- Remote address
- Metadata (what changed)

Access audit logs through your monitoring/logging system.

---

## Best Practices

1. **Always validate email addresses** before creating department heads
2. **Set initial departments** when creating a department head
3. **Keep department codes unique** and meaningful (e.g., CS, ENG, MATH)
4. **Soft deletes preserve history** - deleted records remain in system but inactive
5. **Review audit logs regularly** for security compliance
6. **Use strong passwords** for all new accounts (enforce in frontend)

---

## Troubleshooting

### Department head creation fails with 409
- Email already exists
- Solution: Use unique email or check existing records

### Cannot delete department
- Department may have active head assignments or other references
- Solution: Ensure department is inactive and all heads are reassigned

### Update operations return 403
- User is not system_administrator
- Solution: Verify token contains correct role

---

**Last Updated**: November 2026
