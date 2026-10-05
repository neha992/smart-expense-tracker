# Smart Expense Tracker API

A production-style, modular RESTful backend API for a Personal Income and Expense Management System built with **Node.js**, **Express.js**, **MongoDB**, and **Mongoose**.

Located at: `D:\projects\Expense tracker\backend`

Featuring secure JWT authentication, multi-criteria filtering, financial analytics aggregations, strict cross-user data isolation, and a custom **Smart Financial Insight Engine**.

---

## 🚀 Features

1. **User Authentication & Security**
   - User registration with unique email validation and input sanitization.
   - Password hashing using `bcryptjs` (salt factor 10).
   - Stateless JWT authorization via `Authorization: Bearer <token>` header.
   - Strict data isolation ensuring users can only view, edit, or delete their own transactions.

2. **Transaction Management (CRUD)**
   - Create income and expense transactions.
   - Retrieve paginated transaction records.
   - Filter transactions dynamically by `category`, `type` (`income` | `expense`), and date ranges (`startDate`, `endDate`).
   - Get, update, and delete individual transactions with ownership authorization.

3. **Financial Analytics & Summaries**
   - Real-time overall summary (`totalIncome`, `totalExpenses`, `balance`).
   - Monthly analytics breakdown with historical monthly spending trends.
   - Category-wise expense aggregations ready for visual dashboard rendering.

4. **Smart Financial Insight Engine 🧠**
   - **Spending Anomaly Detection**: Statistical evaluation comparing current month category expenses against historical baseline averages. Flags anomalies if category spending exceeds average by >= 30%.
   - **Monthly Spending Forecast**: Projects end-of-month expense totals based on daily spending velocity.
   - **Smart Recommendations**: Data-driven, dynamic advice highlighting top spending categories, budget spikes, and savings ratios.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v26+)
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Token (`jsonwebtoken`), `bcryptjs`
- **Validation**: `express-validator`
- **CORS & Environment**: `cors`, `dotenv`
- **Development & Testing**: `nodemon`, `mongodb-memory-server`

---

## 📁 Project Architecture

```
D:\projects\Expense tracker\backend/
├── src/
│   ├── config/
│   │   └── db.js                  # Mongoose MongoDB connection config
│   ├── controllers/
│   │   ├── authController.js        # Register, Login, Get Profile
│   │   ├── transactionController.js # Transaction CRUD, Filtering & Pagination
│   │   ├── analyticsController.js   # Summary, Monthly & Category Analytics
│   │   └── insightController.js     # Insight Engine endpoints
│   ├── middleware/
│   │   ├── authMiddleware.js        # JWT verify & req.user attachment
│   │   ├── errorMiddleware.js       # Centralized 404 & error handlers
│   │   └── validationMiddleware.js  # express-validator request validation
│   ├── models/
│   │   ├── User.js                  # User Mongoose Schema & methods
│   │   └── Transaction.js           # Transaction Mongoose Schema & indexes
│   ├── routes/
│   │   ├── authRoutes.js            # /api/auth routes
│   │   ├── transactionRoutes.js     # /api/transactions routes
│   │   ├── analyticsRoutes.js       # /api/analytics routes
│   │   └── insightRoutes.js         # /api/insights routes
│   ├── services/
│   │   ├── analyticsService.js      # MongoDB Aggregation pipelines
│   │   └── insightService.js        # Smart Financial Insight Engine logic
│   └── utils/
│       └── generateToken.js         # JWT signing helper
├── app.js                           # Express application setup
├── server.js                        # Server initialization entry point
├── seed.js                          # Database seeding script
├── tests/api.test.js                # Full integration test suite
├── postman_collection.json          # Complete Postman API Collection
├── .env.example                     # Environment template
└── .gitignore                       # Git ignore file
```

---

## 🏁 Quick Start & Running Locally

Navigate to the project folder in your terminal:
```bash
cd "D:\projects\Expense tracker\backend"
```

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Automated Integration Tests
```bash
npm test
```

### 3. Seed Demo Data
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```
The API will be available at `http://localhost:5000`.

---

## 📡 API Endpoints Overview

### Health Check
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service and database status | No |

### Authentication
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register new user | No |
| `POST` | `/api/auth/login` | Login user & get JWT | No |
| `GET` | `/api/auth/me` | Get current user profile | Yes |

### Transactions
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/transactions` | Create a transaction | Yes |
| `GET` | `/api/transactions` | Get paginated transactions (filters: `category`, `type`, `startDate`, `endDate`, `page`, `limit`) | Yes |
| `GET` | `/api/transactions/:id` | Get single transaction by ID | Yes |
| `PUT` | `/api/transactions/:id` | Update transaction | Yes |
| `DELETE` | `/api/transactions/:id` | Delete transaction | Yes |

### Financial Analytics
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics/summary` | Get `totalIncome`, `totalExpenses`, `balance` | Yes |
| `GET` | `/api/analytics/monthly` | Get monthly totals & spending trends | Yes |
| `GET` | `/api/analytics/categories` | Get category spending breakdown | Yes |

### Smart Financial Insight Engine
| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/insights` | Combined insight overview | Yes |
| `GET` | `/api/insights/anomalies` | Detected spending anomalies (>30% spike) | Yes |
| `GET` | `/api/insights/forecast` | Projected monthly expense forecast | Yes |
| `GET` | `/api/insights/recommendations` | Data-driven actionable advice | Yes |
