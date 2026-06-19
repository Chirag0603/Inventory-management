# Inventory & Order Management System

A production-ready assessment project with a React frontend, FastAPI backend API, PostgreSQL persistence, and Docker Compose orchestration.

## Features

- Product CRUD with unique SKU validation and non-negative stock.
- Customer create/list/read/delete with unique email validation.
- Order create/list/read/delete with automatic total calculation.
- Inventory validation prevents orders when stock is insufficient.
- Successful order creation reduces stock; canceling an order restores stock.
- Responsive dashboard with totals and low-stock count.
- Environment-based configuration with no hardcoded production credentials.

## Tech Stack

- Frontend: React + Vite
- Backend: Python + FastAPI + SQLAlchemy
- Database: PostgreSQL
- Containerization: Docker + Docker Compose

## Local Development

```bash
docker compose up --build
```

Frontend: http://localhost:8080

Backend API: http://localhost:8000

API docs: http://localhost:8000/docs

## Run Without Docker

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Frontend:

```bash
npm install
npm run dev
```

## Environment Variables

Backend:

- `DATABASE_URL`: SQLAlchemy PostgreSQL URL.
- `CORS_ORIGINS`: Comma-separated allowed frontend origins.

Frontend:

- `VITE_API_URL`: Public backend API URL.

Docker Compose also supports:

- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

## API Summary

Products:

- `POST /products`
- `GET /products`
- `GET /products/{id}`
- `PUT /products/{id}`
- `DELETE /products/{id}`

Customers:

- `POST /customers`
- `GET /customers`
- `GET /customers/{id}`
- `DELETE /customers/{id}`

Orders:

- `POST /orders`
- `GET /orders`
- `GET /orders/{id}`
- `DELETE /orders/{id}`

## Deployment Notes

Suggested free deployment path:

- Backend: Render, Railway, or Fly.io.
- Frontend: Vercel or Netlify.
- Database: Render PostgreSQL, Railway PostgreSQL, Neon, or Supabase.
- Docker image: build and push `backend/Dockerfile` to Docker Hub.

Set `DATABASE_URL` and `CORS_ORIGINS` in the backend host. Set `VITE_API_URL` in the frontend host to the deployed backend API URL.

## Submission Checklist

- GitHub repository link.
- Docker Hub backend image link.
- Live frontend URL.
- Live backend API URL.

