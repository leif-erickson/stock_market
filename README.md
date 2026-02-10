# Getting Started
`docker-compose up -d`

Open http://localhost:8080, with admin@example.com/admin
..add server with host db, user user, password password, db portfolio_db.
Start backend: `cd backend && npm start`
Start frontend: `cd frontend && npm start` (runs on http://localhost:3000)

# Notes
This app provides basic CRUD for portfolio items, fetches real-time prices from Alpaca (stocks) and CCXT (crypto via Binance), and calculates values/profits. Enhance as needed for error handling, authentication, etc. For production, secure API keys and use environment variables properly. If running backend in Docker, update DB host to 'db'.
