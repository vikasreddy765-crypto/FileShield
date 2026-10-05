# FileShield Final — Digital Attendance File Integrity Auditor

## What this version includes

- Professional responsive public landing page
- Lecturer registration and login
- Secure password hashing with bcrypt
- JWT authentication with role support
- Lecturer dashboard
- Admin role and admin user list
- Original attendance-file registration
- CRC-32 fingerprints
- Existing-file verification
- Verified vs modified detection
- Verification history
- Registered-file deletion
- Browser verification report with Print / Save as PDF
- CSV, XLSX, XLS and PDF support
- 10 MB default upload limit
- Verification uploads deleted after hashing
- MongoDB persistence
- Environment-variable configuration
- Responsive mobile UI
- Production hardening checklist

## 1. Install Node.js

Use Node.js 18 or newer.

## 2. Install dependencies

From the FileShield_Final folder:

```bash
npm install
```

## 3. Create your environment file

Copy:

```text
.env.example
```

to:

```text
.env
```

Then set:

```text
PORT=3000
JWT_SECRET=use-a-long-random-secret
MONGODB_URI=your-mongodb-atlas-connection-string
MAX_FILE_SIZE_MB=10
ADMIN_EMAIL=your-admin-email
ADMIN_PASSWORD=your-admin-password
```

Do not commit `.env`.

## 4. Create MongoDB Atlas database

Create a MongoDB Atlas cluster and database named `fileshield`.

Create a database user and copy its connection string into `MONGODB_URI`.

For local development, make sure your IP is allowed by Atlas network access. For production, use the narrowest practical network configuration and secure credentials.

## 5. Run locally

```bash
npm start
```

Open:

```text
http://localhost:3000
```

The first startup creates the admin account from `ADMIN_EMAIL` and `ADMIN_PASSWORD` if it does not already exist.

## 6. Test

### Lecturer

1. Open Lecturer Portal.
2. Create a lecturer account.
3. Login.
4. Register `attendance_original.csv`.
5. Verify the same file.
6. Confirm `VERIFIED`.
7. Verify a modified copy.
8. Confirm `MODIFIED`.
9. Check verification history.
10. Open the generated report and use Print / Save as PDF.

### Admin

Login using the configured admin credentials. Admin accounts can see the admin user-management section and all records.

## 7. GitHub

Before pushing to GitHub, confirm that `.env`, real attendance files, and credentials are not included.

Recommended:

```bash
git init
git add .
git commit -m "Initial FileShield release"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 8. Deploy

A Node/Express host such as Render can deploy this repository.

Typical settings:

```text
Build command: npm install
Start command: npm start
```

Add the same environment variables in the hosting provider's environment settings.

For production, use a persistent storage/database strategy. The current app keeps registered original files in local disk storage; many cloud hosts use ephemeral filesystems. For a serious deployment, move original-file storage to a managed object-storage service and store only the storage key in MongoDB.

## 9. Production security checklist

Before real institutional use:

- HTTPS only
- Strong random JWT secret
- Secure MongoDB credentials
- Authentication and role-based authorization
- Malware scanning for uploads
- File-content validation in addition to extension/MIME validation
- Rate limiting on authentication and upload endpoints
- Login brute-force protection
- Audit logging
- Managed object storage for originals
- Encryption at rest
- Backups
- Data retention/deletion policy
- Institution-approved privacy policy
- Security review before handling real student records
- Restrict CORS if the frontend/backend are separated
- Add CSRF protection if authentication is moved to cookies
- Rotate secrets and credentials regularly

## Integrity limitation

A CRC-32 comparison establishes that the current file bytes match the registered fingerprint. It does not independently prove who created the original or that the registration event itself was trustworthy. Protect the registration account and audit trail.

## Project structure

```text
FileShield_Final/
├── data/
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── uploads/
│   └── .gitkeep
├── .env.example
├── .gitignore
├── models.js
├── package.json
├── README.md
└── server.js
```
