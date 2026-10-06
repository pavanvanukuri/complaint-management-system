# Complaint Management System

A local web application for a B.Tech CSE DBMS project. This project uses a Node.js + Express backend, vanilla HTML/CSS/JavaScript frontend, and the existing Oracle AI Database 26ai with the CMSUSER schema.

## Overview

The application allows:

- Student users to log in using their registration number
- Submit new complaints
- View personal complaint history
- Track complaint status
- View notifications
- Staff/admin users to view all complaints, assign complaints, update statuses, and add comments

## Technology Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: Oracle 26ai via `oracledb`

## Folder Structure

- `backend/` — database connection and API routes
- `frontend/` — UI pages and static assets
- `.env` — Oracle database configuration
- `.gitignore` — ignores environment file and dependencies
- `package.json` — Node project configuration

## Prerequisites

- Node.js installed
- Oracle Instant Client libraries available for `oracledb`
- Oracle database running locally on `localhost:1521`
- Existing PDB `FREEPDB1`
- Existing schema `CMSUSER`

## Installation

From the project folder:

```powershell
npm install
```

## Environment Setup

Update the `.env` file with the actual Oracle password for the existing user:

```env
DB_USER=CMSUSER
DB_PASSWORD=YOUR_ACTUAL_PASSWORD
DB_CONNECT_STRING=localhost:1521/FREEPDB1
PORT=3000
SESSION_SECRET=GENERATE_A_LONG_RANDOM_SECRET
```

Important:

- Do not put the password in JavaScript files
- Do not commit `.env` to Git
- The password must be the real Oracle password for CMSUSER
- Set `SESSION_SECRET` to a long random value in every deployed environment. Local development generates a process-only fallback if it is omitted.

## Start the Backend

```powershell
npm start
```

Open the browser at:

```text
http://localhost:3000/
```

## Login Test

Use the known registration number:

```json
{
  "registration_no": "REG2024CSE003"
}
```

On success the API returns the user record from `USERS`.

## API Routes

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/departments`
- `GET /api/categories`
- `GET /api/statuses`
- `GET /api/priorities`
- `GET /api/staff`
- `GET /api/users`
- `GET /api/complaints`
- `GET /api/complaints/:id`
- `GET /api/users/:id/complaints`
- `GET /api/staff/:id/complaints`
- `POST /api/complaints`
- `PUT /api/complaints/:id/status`
- `PUT /api/complaints/:id/assign`
- `GET /api/complaints/:id/comments`
- `POST /api/complaints/:id/comments`
- `GET /api/users/:id/notifications`
- `PUT /api/notifications/:id/read`

## Frontend to Backend

The frontend uses `fetch()` to call the Express API endpoints. The browser never connects directly to Oracle.

## Backend to Oracle

The backend creates an Oracle connection pool using `oracledb.createPool()` defined in `backend/db.js` and uses bind variables for user input. All SQL is executed against the existing `CMSUSER` schema.

## Demonstration Flow

1. User logs in using registration number
2. Dashboard loads complaint counts
3. User submits complaint
4. Staff/admin sees complaint
5. Staff assigns the complaint to a valid department staff member
6. Staff updates complaint status
7. Staff adds a comment
8. Notification appears for the user
9. User tracks the complaint
10. Complaint can be resolved or closed

## Important Note

The app is designed to work against the real Oracle tables already present in the database. If Oracle returns `ORA-28000`, the account `CMSUSER` is locked. Unlock the Oracle user first, then restart the app and retry the login.

## Deployment Gate

Login currently looks up users by registration number only because the existing `USERS` table has no password field. This is suitable only for a controlled classroom demonstration; a registration number is not an authentication secret. Before public deployment, integrate a trusted university identity provider or another approved authentication mechanism without changing the Oracle schema. Also configure the backend with a network-reachable Oracle service: `localhost` in the developer's `.env` refers to that developer's machine and is not reachable from a cloud host.

The current Oracle data also has no email match between `USERS` faculty and `STAFF` rows. Faculty complaint access is therefore scoped to the faculty member's department; a per-faculty assigned queue cannot be reliably identified from the existing columns and is not represented as a personal queue in the UI.
