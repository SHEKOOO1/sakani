# SECURITY CONSTITUTION — NON-NEGOTIABLE RULES

Treat security as a first-class architectural requirement, not as a UI feature.

The application contains multiple roles, permissions, residences, users, resources, and administrative areas. Security MUST be enforced primarily on the server/backend.

## 1. NEVER TRUST THE CLIENT

Never trust:

* Frontend route protection
* Hidden UI elements
* Client-side permissions
* User-supplied UserId
* User-supplied RoleId
* User-supplied PermissionId
* User-supplied ResidenceId/TenantId
* User-supplied ownership information
* Client-side validation

The frontend is NOT a security boundary.

Every sensitive operation MUST be authorized on the server.

## 2. SERVER-SIDE AUTHORIZATION

Every API endpoint that reads, creates, updates, deletes, exports, downloads, searches, or performs an action on data MUST enforce authorization.

Never rely only on frontend route guards.

Use:

* Authentication
* Role-based authorization
* Permission-based authorization
* Resource/object-level authorization
* Residence/tenant-level authorization

## 3. LEAST PRIVILEGE

Every role must receive only the minimum permissions required.

Never grant broad permissions when a narrower permission is sufficient.

Permissions should be action-specific, for example:

Students.View
Students.Create
Students.Edit
Students.Delete
Students.Export

Finance.View
Finance.Create
Finance.Edit
Finance.Delete
Finance.Export

Attendance.View
Attendance.Manage

Laundry.View
Laundry.Manage

## 4. RESOURCE-LEVEL AUTHORIZATION

Having a permission does NOT automatically mean the user can access every object.

For every resource, verify:

1. Is the user authenticated?
2. Does the user have the required permission?
3. Is the resource within the user's authorized residence/scope?
4. Is the user allowed to access this specific object?
5. Is the requested action allowed?

Protect against:

* IDOR
* BOLA
* Horizontal privilege escalation
* Vertical privilege escalation

## 5. RESIDENCE / TENANT ISOLATION

A user assigned to Residence A MUST NOT be able to access, modify, search, export, aggregate, or infer data belonging to Residence B unless explicitly authorized.

This rule applies to:

* APIs
* Database queries
* Reports
* Dashboards
* Search
* Statistics
* Exports
* Downloads
* Notifications
* Background jobs
* Scheduled jobs
* Mobile
* Web
* Desktop

Never trust ResidenceId/TenantId supplied by the client.

Determine the user's authorized scope from the authenticated server-side identity and database.

## 6. FRONTEND ROUTE GUARDS

Implement frontend route guards and permission-aware navigation for usability and defense-in-depth.

However:

Frontend route protection MUST NEVER be considered sufficient security.

A user who bypasses the frontend MUST still be denied by the backend.

## 7. PRIVILEGE ESCALATION

Users MUST NOT be able to:

* Change their own role
* Grant themselves permissions
* Change their own residence scope
* Access another user's administrative functions
* Modify another user's permissions
* Elevate another user's privileges without proper authorization

Protect against both horizontal and vertical privilege escalation.

## 8. DTO AND MASS ASSIGNMENT PROTECTION

Never bind untrusted client request bodies directly to database entities.

Use explicit DTOs and allowlist writable fields.

Security-sensitive fields such as:

* Role
* Permissions
* UserId
* ResidenceId
* Ownership
* IsAdmin
* IsActive
* Financial privileges

MUST NOT be writable unless explicitly authorized through a dedicated operation.

## 9. AUTHENTICATION

Use secure authentication practices:

* Strong password hashing
* Password policy
* Account lockout / throttling
* Login rate limiting
* Secure JWT validation
* Issuer validation
* Audience validation
* Signature validation
* Expiration validation
* Short-lived access tokens
* Secure refresh tokens
* Refresh token rotation
* Refresh token revocation
* Refresh token reuse detection
* Session/device tracking where appropriate

Never store plaintext passwords.

Never store secrets in source code.

## 10. API SECURITY

Every API endpoint must have an explicit security decision.

For every endpoint document:

* Authentication requirement
* Required permission
* Allowed roles
* Residence scope
* Resource ownership rules
* Allowed operations

Avoid accidentally creating anonymous or unprotected endpoints.

## 11. DATABASE SECURITY

Use:

* Parameterized queries
* EF Core safely
* Proper constraints
* Foreign keys
* Unique constraints
* Transactions where required
* Optimistic concurrency where appropriate

Never construct SQL queries using untrusted string concatenation.

## 12. INPUT VALIDATION

Validate all untrusted input on the server.

Do not rely only on frontend validation.

Validate:

* IDs
* Strings
* Numbers
* Dates
* Enums
* File uploads
* Pagination
* Sorting
* Filtering
* Search parameters

Use sensible maximum lengths and limits.

## 13. OUTPUT AND DATA EXPOSURE

Return only the fields the caller is authorized to see.

Do not expose:

* Password hashes
* Refresh tokens
* Internal secrets
* Security-sensitive claims
* Internal stack traces
* Database connection information
* Infrastructure details

Use dedicated response DTOs.

## 14. ERROR HANDLING

Never expose sensitive implementation details to clients.

Production errors should not reveal:

* SQL errors
* Stack traces
* Connection strings
* File paths
* Internal service details
* Authentication internals

Log technical details securely on the server.

## 15. AUDIT LOGGING

Create tamper-resistant audit logs for sensitive operations.

Record where appropriate:

* User
* Action
* Resource
* Resource ID
* Residence
* Timestamp
* Result
* Relevant before/after values
* IP/device/session metadata where appropriate

NEVER log passwords, access tokens, refresh tokens, or secrets.

Audit:

* Login
* Logout
* Failed login
* Role changes
* Permission changes
* User creation/deactivation
* Residence assignment changes
* Sensitive data changes
* Financial operations
* Exports
* Downloads
* Administrative actions
* Authorization failures

## 16. EXPORT SECURITY

Export permissions MUST be separate from view permissions.

For example:

Students.View
Students.Export

Finance.View
Finance.Export

Every export endpoint must enforce authorization and residence scope.

## 17. FILE SECURITY

For uploaded files:

* Validate file size
* Validate allowed file types
* Validate MIME type
* Generate safe random filenames
* Store files outside executable/web-accessible locations where appropriate
* Prevent path traversal
* Authorize every download
* Never trust the original filename

## 18. RATE LIMITING AND ABUSE PROTECTION

Apply rate limiting to sensitive and expensive operations including:

* Login
* Password reset
* Token refresh
* OTP
* Search
* Export
* File upload
* Expensive reports

## 19. CORS AND SECURITY HEADERS

Use restrictive production CORS configuration.

Never use unrestricted CORS such as:

AllowAnyOrigin

unless there is a documented and justified reason.

Use appropriate security headers and secure cookie settings where applicable.

## 20. CONCURRENCY AND BUSINESS LOGIC

Authorization MUST also protect business rules.

Do not assume that because a user was authorized at the beginning of a request, all subsequent operations are automatically safe.

Use transactions and concurrency controls where needed.

## 21. BACKGROUND JOBS

Background jobs MUST NOT bypass authorization/business rules simply because they run internally.

They must operate only within explicitly defined authorized/system scopes.

## 22. SECURITY TESTING

For every feature, test at minimum:

* Unauthenticated access
* Correct role
* Incorrect role
* Missing permission
* Correct residence
* Wrong residence
* Correct resource owner
* Wrong resource owner
* Modified object IDs
* Modified ResidenceId
* Modified UserId
* Modified RoleId
* Modified PermissionId
* Privilege escalation attempts
* IDOR/BOLA
* Mass assignment
* Injection
* XSS where applicable
* Rate limiting
* Information disclosure

## 23. ADVERSARIAL SECURITY REVIEW

After implementing every major feature, act as an attacker.

Assume the attacker has:

* A valid low-privileged account
* Knowledge of the application
* Ability to manipulate URLs
* Ability to modify API requests
* Ability to modify JSON bodies
* Ability to change IDs
* Ability to inspect frontend code
* Ability to replay requests
* Ability to call APIs directly

Attempt to bypass authorization and access data belonging to other users, roles, or residences.

Find vulnerabilities.

Fix them.

Then perform a second security review.

## 24. SECURITY REGRESSION PROTECTION

Every security vulnerability discovered and fixed MUST result in an automated test where practical.

Never fix a security bug without considering how to prevent its regression.

## 25. SECURITY-FIRST DEVELOPMENT RULE

Before implementing any new feature:

1. Identify the data involved.
2. Identify who owns the data.
3. Identify which roles can access it.
4. Identify which permissions are required.
5. Identify residence/tenant scope.
6. Define allowed actions.
7. Implement backend authorization.
8. Implement frontend route/UI restrictions.
9. Add audit logging if sensitive.
10. Add security tests.
11. Perform adversarial review.

If there is any conflict between convenience and security, prefer the secure design and explain the trade-off before weakening the security model.

IMPORTANT:

Never claim that the application is secure merely because authentication, JWT, or frontend route guards exist.

Security must be enforced through defense in depth with authentication, authorization, resource-level authorization, residence isolation, input validation, secure data access, audit logging, rate limiting, secure configuration, and automated security testing.