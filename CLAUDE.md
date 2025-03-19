# CLAUDE.md - Project Information

## Project Overview
This project is a web application that analyzes and displays expense data from Brazilian deputies (members of parliament). It consists of:

1. A backend scraper that collects data from the official Brazilian Chamber of Deputies API
2. An Express.js server that exposes API endpoints for the frontend
3. A Vue.js frontend that visualizes the expense data

## Backend

### Scraper (`src/scrapper.js`)
- Collects deputy and expense data from the Brazilian Chamber of Deputies API
- Saves data to a SQLite database (`deputies.db`)
- Creates tables for deputies, expenses, and process logs
- Processes deputies in batches to avoid overwhelming the API

### Server (`src/server/index.js`)
- Express.js server exposing API endpoints
- Connects to the SQLite database
- Provides endpoints for:
  - `/api/expense-types` - List all expense types
  - `/api/deputies` - List all deputies
  - `/api/expenses/analysis` - Analyze expenses by deputy
  - `/api/expenses/party-analysis` - Analyze expenses by party
  - `/api/expenses/state-analysis` - Analyze expenses by state
- Runs on port 3002 by default

## Frontend

### Technologies
- Vue.js 3 with Composition API
- Vue Router for routing
- Tailwind CSS for styling
- Shadcn/Vue UI components

### Structure
- Single page application with dynamic views
- Main view: `ExpenseAnalysis.vue`
- Supports three analysis views:
  - By Deputy
  - By Party
  - By State
- Filters by expense type and year
- Search functionality for each view

### Components
- Uses Shadcn UI components (Button, Card, Table, etc.)
- Custom utility functions for formatting and data display

## Commands

### Backend
```bash
# Start the backend server
node src/server/index.js

# Run the scraper to collect data
node src/scrapper.js
```

### Frontend
```bash
# Install dependencies
cd frontend
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

## API Endpoints

- `GET /api/expense-types` - Get all expense types
- `GET /api/deputies` - Get all deputies
- `GET /api/expenses/analysis?expenseType=X&year=Y` - Get expense analysis by deputy
- `GET /api/expenses/party-analysis?expenseType=X&year=Y` - Get expense analysis by party
- `GET /api/expenses/state-analysis?expenseType=X&year=Y` - Get expense analysis by state

## Database Structure

### Deputies Table
- `id`: Primary key
- `name`: Deputy name
- `party`: Political party
- `state`: State represented
- `legislature`: Legislature number
- `photo_url`: URL to deputy photo
- `email`: Deputy email

### Expenses Table
- `id`: Primary key
- `deputy_id`: Foreign key to deputies
- `year`, `month`: Expense date
- `expense_type`: Type of expense
- `document_id`, `document_type`, `document_date`, `document_number`: Document info
- `document_value`: Original value
- `net_value`: Net value after any discounts
- Various other expense metadata

### Process Log Table
- Tracks scraper progress
- Stores last processed page for each deputy

## Notes
- The application uses a SQLite database stored in the project root
- The frontend uses URL parameters to maintain state (view, expense type, search queries, etc.)
- The project uses Brazilian Portuguese for user-facing text