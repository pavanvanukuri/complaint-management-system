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

- Frontend: HTML5, CSS3, Vanilla JavaScript
- Backend: Node.js, Express.js
- Database: PostgreSQL (Render Cloud DB), SQLite (Embedded Fallback), and Oracle 26ai (Local Development)

## Folder Structure

- `backend/` — database connection, schema initialization, seed data, and API routes
- `backend/initDb.js` — automatic database schema creation and seeding
- `backend/seedData.json` — complete seed dataset (departments, users, staff, complaints, comments, notifications)
- `frontend/` — UI pages and static assets
- `render.yaml` — Render Blueprint configuration for 1-click cloud deployment with PostgreSQL
- `.env.example` — environment configuration examples
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

## Render Cloud Deployment

You can deploy this project to [Render](https://render.com) so anyone with the link can immediately access and use it.

### Method 1: 1-Click Blueprint Deploy (Recommended - with PostgreSQL)

1. Push your repository to GitHub: `https://github.com/pavanvanukuri/complaint-management-system`.
2. Go to the [Render Dashboard](https://dashboard.render.com).
3. Click **New +** and select **Blueprint**.
4. Connect your GitHub repository.
5. Render will automatically detect `render.yaml` and configure:
   - **cms-postgres** — Free managed PostgreSQL database.
   - **complaint-management-system** — Free Web Service running Node.js.
   - `DATABASE_URL` linked directly between the database and the web service.
   - `SESSION_SECRET` generated automatically.
6. Click **Apply**.
7. Render will build and deploy the app. On first startup, the database tables and all seed data (departments, categories, users, complaints, comments, notifications) are populated automatically!
8. When the deployment finishes, Render gives you a public link (e.g. `https://complaint-management-system-xxxx.onrender.com`).

### Method 2: Manual Web Service Deploy (Zero Setup - Embedded Database)

If you don't want to create a separate managed database service on Render:

1. Click **New +** and select **Web Service**.
2. Connect your GitHub repository.
3. Configure the settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
4. Click **Deploy Web Service**.
5. The application will automatically initialize its embedded SQLite database pre-loaded with all sample users and complaints!

### Live Testing on the Deployed Link

Anyone visiting your deployed link can test the platform immediately:
- The login page includes **Quick Demo Login** buttons for instant access.
- Or log in manually using sample registration numbers:
  - **Student (CSE):** `REG2024CSE003` (Karan Mehta)
  - **Student (ECE):** `REG2024ECE001` (Rohan Kapur)
  - **Faculty (CSE):** `FAC2021CSE01` (Dr. Tarun Mathur)
  - **Faculty (ECE):** `FAC2020ECE02` (Dr. Shalini Misra)
- Test complaint submission, staff assignment, status updates, commenting, and real-time notifications.
