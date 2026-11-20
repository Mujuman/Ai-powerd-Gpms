# System Administrator Scope - Werabe University GPMS

## Overview
The System Administrator role in Werabe University's Graduate Project Management System (GPMS) has been refactored to focus exclusively on two core responsibilities:

### 1. Department Head Account Management
**Role**: `department_head`

#### Permitted Operations:

**Create Department Head Account**
- Endpoint: `POST /api/users/department-heads`
- Request Body:
  ```json
  {
    "email": "string (unique)",
    "fullName": "string",
    "password": "string (min 8 chars)",
    "role": "department_head",
    "departmentIds": ["uuid"] (optional)
  }
  ```
- Response: Returns created department head user object with ID

**List All Department Heads**
- Endpoint: `GET /api/users/department-heads`
- Query Parameters: Pagination filters
- Response: Returns paginated list of all department heads

**Get Specific Department Head**
- Endpoint: `GET /api/users/department-heads/:id`
- Response: Returns department head user object

**Update Department Head**
- Endpoint: `PATCH /api/users/department-heads/:id`
- Request Body:
  ```json
  {
    "fullName": "string (optional)",
    "isActive": "boolean (optional)",
    "departmentIds": ["uuid"] (optional)
  }
  ```
- Response: Returns updated department head object

**Delete Department Head**
- Endpoint: `DELETE /api/users/department-heads/:id`
- Operation: Soft-delete (sets `isActive` to false)
- Response: 204 No Content

---

### 2. Department Management
**Entities**: Departments within Werabe University

#### Permitted Operations:

**Create Department**
- Endpoint: `POST /api/departments`
- Request Body:
  ```json
  {
    "code": "string (unique)",
    "name": "string",
    "description": "string (optional)"
  }
  ```
- Response: Returns created department object with ID

**List All Departments**
- Endpoint: `GET /api/departments`
- Access: All authenticated users can list
- Query Parameters: Search/filter options
- Response: Returns list of departments

**Get Specific Department**
- Endpoint: `GET /api/departments/:id`
- Access: All authenticated users can view
- Response: Returns department object with details

**Update Department**
- Endpoint: `PATCH /api/departments/:id`
- Request Body:
  ```json
  {
    "code": "string (optional)",
    "name": "string (optional)",
    "description": "string (optional)"
  }
  ```
- Response: Returns updated department object

**Delete Department**
- Endpoint: `DELETE /api/departments/:id`
- Operation: Soft-delete
- Response: 204 No Content

---

## Removed Admin Responsibilities

The following administrative functions have been **removed** from the System Administrator scope:

### Academic Calendar Management ❌
- Year creation and activation/deactivation
- Semester management and status updates

### Student Management ❌
- Student registration and bulk imports
- Student group creation and management
- Eligibility evaluation and rules configuration

### Project Lifecycle Management ❌
- Project group management
- Project submission review
- Staff (advisor/examiner) assignment and management
- Defense scheduling and management
- Assessment and similarity analysis

### User Role Summaries ❌
- Role statistics and user counts

---

## Related Endpoints (Not Admin Responsibility)

### Department Head Operations
Department heads retain their departmental operations:
- Staff management (advisors/examiners)
- Student eligibility rules (for their department)
- Project supervision within their department

### Student Operations
- Student self-profile update
- Project submission and tracking
- Eligibility checking

### User Self-Service
- Any user can view/update their own profile
- Users can access account-level information

---

## Implementation Notes

1. **Authentication**: All endpoints require authentication token (JWT)
2. **Authorization**: Only `system_administrator` role can perform these operations
3. **Audit Logging**: All admin operations are logged for compliance and traceability
4. **Data Integrity**: Department assignments are tracked and audited
5. **Soft Deletes**: Deletions preserve data history for reporting purposes

---

## Database Constraints

- Departments and department heads are required for proper system operation
- Users can be assigned to multiple departments
- Department heads must have active status to perform their duties
- Email uniqueness is enforced at database level

---

## Migration Notes

If you had users or functionality in the removed areas, consider:
- Archiving historical academic year/semester data if needed
- Migrating any stored student rules to version control or documentation
- Documenting any custom project workflows that existed

---

**Last Updated**: November 2026
**System**: Werabe University Graduate Project Management System (GPMS)
