# SpendSmart — AI-Powered Expense Tracker

A production-ready full-stack expense tracker with AI-powered smart categorization, spending insights, budget management, and trend analysis.

---

## Architecture

```
Browser  ──►  React + Tailwind (port 3000)
                │
                ▼  REST/JSON
           Node.js + Express (port 5000)
           ├── JWT Auth
           ├── CRUD Expenses
           ├── Budget management
           ├── Insights aggregation
           │
           ├──► MongoDB (port 27017)
           │    └── users, expenses, budgets
           │
           └──► Python FastAPI AI Service (port 8000)
                ├── POST /categorize  → TF-IDF + LinearSVC
                ├── POST /predict     → Holt's exponential smoothing
                ├── POST /feedback    → Feedback loop retraining
                └── POST /insights   → NLP-driven insights
```

---

## Tech Stack

| Layer      | Technology                              |
|------------|------------------------------------------|
| Frontend   | React 18, Tailwind CSS, Recharts, Zustand |
| Backend    | Node.js, Express 4, Mongoose             |
| Database   | MongoDB 7                                |
| AI Service | Python 3.11, FastAPI, scikit-learn       |
| ML Model   | TF-IDF vectorizer + LinearSVC (calibrated) |
| Auth       | JWT (jsonwebtoken + bcryptjs)            |
| DevOps     | Docker Compose, Nginx                    |

---

## Project Structure

```
expense-tracker/
├── backend/
│   ├── src/
│   │   ├── server.js              # Express app entry point
│   │   ├── config/database.js     # MongoDB connection
│   │   ├── controllers/
│   │   │   ├── authController.js  # Register, login, profile
│   │   │   └── expenseController.js # CRUD + analytics
│   │   ├── models/
│   │   │   ├── User.js            # User schema (bcrypt hashing)
│   │   │   ├── Expense.js         # Expense schema + AI fields
│   │   │   └── Budget.js          # Monthly budget schema
│   │   ├── routes/
│   │   │   ├── auth.js            # /api/auth/*
│   │   │   ├── expenses.js        # /api/expenses/*
│   │   │   ├── budgets.js         # /api/budgets/*
│   │   │   ├── insights.js        # /api/insights
│   │   │   └── categories.js      # /api/categories
│   │   ├── middleware/
│   │   │   ├── auth.js            # JWT protect middleware
│   │   │   └── errorHandler.js    # Centralized error handling
│   │   ├── utils/
│   │   │   ├── aiService.js       # HTTP client for AI microservice
│   │   │   └── logger.js          # Winston structured logging
│   │   └── tests/auth.test.js     # Jest + Supertest API tests
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── public/index.html
│   └── src/
│       ├── App.jsx                # Router + auth guards
│       ├── index.js
│       ├── index.css              # Tailwind + global styles
│       ├── store/index.js         # Zustand (auth + theme state)
│       ├── services/api.js        # Axios client + all API calls
│       ├── pages/
│       │   ├── LoginPage.jsx
│       │   ├── RegisterPage.jsx
│       │   ├── DashboardPage.jsx  # Charts, summary, recent
│       │   ├── ExpensesPage.jsx   # List, filter, CRUD, export
│       │   ├── BudgetPage.jsx     # Budget management + alerts
│       │   ├── InsightsPage.jsx   # AI insights + predictions
│       │   └── ProfilePage.jsx    # Profile, preferences, security
│       └── components/
│           ├── common/Layout.jsx  # Sidebar, topbar, dark mode
│           └── expenses/
│               └── AddExpenseModal.jsx  # Add/edit + AI preview
│
├── ai-service/
│   ├── main.py                    # FastAPI app + endpoints
│   ├── models/
│   │   ├── categorizer.py         # TF-IDF + LinearSVC + feedback
│   │   └── predictor.py           # Holt's exponential smoothing
│   ├── data/
│   │   ├── training_data.json     # 150+ labeled expense examples
│   │   └── feedback.jsonl         # User correction accumulator
│   ├── tests/test_categorizer.py  # pytest unit tests
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start (Local Development)

### Prerequisites
- Node.js 20+
- Python 3.11+
- MongoDB 7 (local or Atlas)
- Git

### 1. Clone and setup

```bash
git clone https://github.com/youruser/expense-tracker.git
cd expense-tracker
```

### 2. Backend

```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — set MONGODB_URI and JWT_SECRET

# Create uploads and logs directories
mkdir -p uploads logs

# Start development server
npm run dev
# → http://localhost:5000
```

### 3. AI Microservice

```bash
cd ai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env

# Start service (model trains automatically on first run)
uvicorn main:app --reload --port 8000
# → http://localhost:8000
# → Swagger docs: http://localhost:8000/docs
```

### 4. Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
# → http://localhost:3000
```

---

## Docker (Full Stack)

```bash
# Copy and configure environment
cp backend/.env.example .env

# Build and start all services
docker-compose up --build

# Services:
# Frontend  → http://localhost:3000
# Backend   → http://localhost:5000
# AI Service→ http://localhost:8000
# MongoDB   → mongodb://localhost:27017
```

---

## API Reference

### Authentication

All protected routes require: `Authorization: Bearer <jwt_token>`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login, returns JWT | No |
| GET | `/api/auth/me` | Get current user | Yes |
| PUT | `/api/auth/me` | Update profile | Yes |
| PUT | `/api/auth/change-password` | Change password | Yes |

**Register request:**
```json
{ "name": "John Doe", "email": "john@example.com", "password": "SecurePass123" }
```

**Login response:**
```json
{ "token": "eyJhb...", "user": { "_id": "...", "name": "John", "email": "..." } }
```

---

### Expenses

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/expenses` | Create expense (AI categorize if no category) | Yes |
| GET | `/api/expenses` | List with filters + pagination | Yes |
| GET | `/api/expenses/:id` | Get single expense | Yes |
| PUT | `/api/expenses/:id` | Update (tracks AI feedback if category corrected) | Yes |
| DELETE | `/api/expenses/:id` | Delete | Yes |
| POST | `/api/expenses/categorize` | Preview AI categorization | Yes |
| GET | `/api/expenses/summary/monthly` | Monthly aggregation | Yes |
| GET | `/api/expenses/summary/categories` | Category breakdown | Yes |

**Create expense (auto-categorize):**
```json
POST /api/expenses
{ "amount": 250, "description": "Uber ride to airport" }

Response:
{
  "expense": {
    "category": "Transport",
    "aiCategory": "Transport",
    "aiConfidence": 0.94,
    "categorySource": "ai",
    ...
  }
}
```

**List expenses — query params:**
```
?page=1&limit=20
&category=Food+%26+Dining
&startDate=2025-01-01&endDate=2025-01-31
&search=coffee
&minAmount=10&maxAmount=500
&sortBy=amount&sortOrder=desc
```

**Preview categorization:**
```json
POST /api/expenses/categorize
{ "description": "Netflix monthly plan", "amount": 649 }

Response:
{ "category": "Entertainment", "confidence": 0.97, "alternatives": [...] }
```

---

### Budgets

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets?month=1&year=2025` | Get budgets with spending |
| POST | `/api/budgets` | Create/update budget |
| DELETE | `/api/budgets/:id` | Delete budget |

**Create budget:**
```json
{ "category": "Food & Dining", "amount": 500, "month": 1, "year": 2025, "alertThreshold": 80 }
```

**Budget response includes real-time spending:**
```json
{
  "category": "Food & Dining",
  "amount": 500,
  "spent": 387.50,
  "remaining": 112.50,
  "percentage": 77.5
}
```

---

### Insights

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/insights` | AI insights + spending prediction |

**Response:**
```json
{
  "insights": [
    {
      "type": "increase",
      "category": "Food & Dining",
      "change": 23,
      "message": "You spent 23% more on Food & Dining compared to last month."
    }
  ],
  "prediction": {
    "predicted": 3240.50,
    "trend": "increasing",
    "trendPercent": 8.3,
    "confidence": "high",
    "message": "Your spending is trending up. Predicted next month: $3240.50."
  }
}
```

---

### AI Microservice Endpoints

Base URL: `http://localhost:8000`
Auth: `X-API-Key: internal-key` header

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| POST | `/categorize` | Categorize expense text |
| POST | `/feedback` | Submit category correction |
| POST | `/predict` | Predict next month spending |
| POST | `/insights` | Generate spending insights |
| POST | `/retrain` | Manually trigger model retraining |
| GET | `/docs` | Swagger UI |

**Categorize:**
```bash
curl -X POST http://localhost:8000/categorize \
  -H "X-API-Key: internal-key" \
  -H "Content-Type: application/json" \
  -d '{"description": "Uber ride 250", "amount": 250}'

# Response:
{
  "category": "Transport",
  "confidence": 0.942,
  "alternatives": [
    {"category": "Travel", "confidence": 0.031},
    {"category": "Other", "confidence": 0.012}
  ]
}
```

**Submit feedback (triggers model improvement):**
```bash
curl -X POST http://localhost:8000/feedback \
  -H "X-API-Key: internal-key" \
  -d '{"description": "Gym membership", "predicted": "Shopping", "correct": "Sports & Fitness"}'
```

---

## Database Schema

### User
```
_id, name, email (unique), password (hashed), avatar,
preferences: { currency, theme, notifications },
lastLogin, createdAt, updatedAt
```

### Expense
```
_id, user (ref), amount, currency, description, date,
category (enum), aiCategory, aiConfidence, categorySource (ai|manual|corrected),
userFeedback: { correctedFrom, correctedAt },
receipt: { filename, url, ... },
notes, tags[], isRecurring, createdAt, updatedAt
```

### Budget
```
_id, user (ref), category (enum), amount, currency,
month, year, alertThreshold, alertSent, createdAt
```

**Indexes:**
- `Expense`: `{ user, date }`, `{ user, category, date }` (compound)
- `Budget`: `{ user, category, month, year }` (unique)

---

## AI Model Details

### Categorization Model
- **Algorithm**: TF-IDF Vectorizer + LinearSVC (with Platt scaling for probabilities)
- **Features**: Bigrams (1-2 grams), keyword injection, amount bucket signals
- **Categories**: 14 (Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Medical, Travel, Education, Housing, Personal Care, Sports & Fitness, Gifts & Donations, Investments, Other)
- **Training data**: 150+ labeled examples (see `data/training_data.json`)
- **Feedback loop**: User corrections stored in `data/feedback.jsonl`, weighted 3× in retraining. Auto-retrains every 50 corrections.

### Prediction Model
- **Algorithm**: Holt's double exponential smoothing
- **Input**: 2–12 months of historical spending totals
- **Output**: Next month prediction + trend (increasing/decreasing/stable) + confidence level
- **Parameters**: α=0.4 (level), β=0.2 (trend)

---

## Running Tests

**Backend:**
```bash
cd backend
npm test
# Coverage report generated in /coverage
```

**AI Service:**
```bash
cd ai-service
source venv/bin/activate
pytest tests/ -v --tb=short
```

---

## Deployment

### Render.com (Backend + AI Service)

1. Push to GitHub
2. Create **Web Service** for backend:
   - Build: `npm install`
   - Start: `node src/server.js`
   - Add env vars from `.env.example`
3. Create **Web Service** for AI service:
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Set `AI_SERVICE_URL` in backend to the AI service Render URL

### Vercel (Frontend)

```bash
cd frontend
npm install -g vercel
vercel --prod
# Set REACT_APP_API_URL=https://your-backend.onrender.com/api
```

### Fly.io (Full Stack with Docker)

```bash
# Install flyctl: https://fly.io/docs/hands-on/install-flyctl/

# Deploy backend
cd backend
fly launch
fly secrets set JWT_SECRET=... MONGODB_URI=...
fly deploy

# Deploy AI service
cd ../ai-service
fly launch
fly deploy

# Deploy frontend
cd ../frontend
fly launch
fly deploy
```

### MongoDB Atlas (Production Database)

1. Create cluster at mongodb.com/atlas
2. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/expense_tracker`
3. Set as `MONGODB_URI` in backend env vars
4. Whitelist your server IPs in Atlas Network Access

---

## Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://localhost:27017/expense_tracker
JWT_SECRET=min-32-char-secret-key
JWT_EXPIRE=7d
AI_SERVICE_URL=http://localhost:8000
AI_SERVICE_KEY=internal-key
CLIENT_URL=http://localhost:3000
LOG_LEVEL=info
```

### AI Service (.env)
```env
AI_SERVICE_KEY=internal-key
PORT=8000
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

---

## Expense Categories

```
Food & Dining | Transport | Shopping | Entertainment
Bills & Utilities | Health & Medical | Travel | Education
Housing | Personal Care | Sports & Fitness
Gifts & Donations | Investments | Other
```

---

## Features Checklist

- ✅ JWT-based auth (register, login, protected routes)
- ✅ Password hashing with bcryptjs (12 rounds)
- ✅ Full expense CRUD with pagination + filtering
- ✅ AI auto-categorization (TF-IDF + LinearSVC)
- ✅ Confidence scores + alternative suggestions
- ✅ User feedback loop → model auto-retraining
- ✅ Dashboard with pie chart + line chart
- ✅ Monthly trend analysis (6-month view)
- ✅ Budget management with real-time alerts
- ✅ Budget threshold notifications
- ✅ AI spending predictions (Holt's smoothing)
- ✅ Month-over-month insight comparisons
- ✅ Cost-saving tips engine
- ✅ Receipt image upload (multer)
- ✅ CSV export with AI metadata
- ✅ Voice input (Web Speech API)
- ✅ Dark/light/system theme toggle
- ✅ Fully responsive mobile layout
- ✅ Rate limiting + helmet security headers
- ✅ Centralized error handling + Winston logging
- ✅ Docker Compose full stack
- ✅ Nginx reverse proxy for frontend
- ✅ Backend unit tests (Jest + Supertest)
- ✅ AI model unit tests (pytest)

---

## License

MIT
