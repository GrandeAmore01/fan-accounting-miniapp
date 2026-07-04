# Fan Accounting Server

Node.js + Express + MySQL backend for the WeChat mini program.

## Tech Stack

- Node.js
- Express
- MySQL
- mysql2

## Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Create `.env` from `.env.example` and update database credentials:

```bash
copy .env.example .env
```

3. Initialize MySQL schema:

```bash
mysql -u root -p < sql/schema.sql
```

For local coursework testing, this repo can also use a project-local MySQL data
directory:

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --initialize-insecure --basedir="C:\Program Files\MySQL\MySQL Server 8.4" --datadir="D:\fan-accounting-miniapp\server\mysql-data" --console

& "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --basedir="C:\Program Files\MySQL\MySQL Server 8.4" --datadir="D:\fan-accounting-miniapp\server\mysql-data" --port=3306 --console
```

Then import the schema in another terminal:

```powershell
Get-Content "D:\fan-accounting-miniapp\server\sql\schema.sql" | & "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysql.exe" -u root --default-character-set=utf8mb4
```

4. Start server:

```bash
npm run dev
```

The default API base URL is:

```text
http://localhost:3000/api
```

## Health Check

```bash
curl http://localhost:3000/api/health
```

## Expense APIs

List expenses:

```http
GET /api/expenses?userId=local-user
```

Create expense:

```http
POST /api/expenses
Content-Type: application/json

{
  "userId": "local-user",
  "category": "meet",
  "subType": "concert",
  "itemName": "演唱会门票",
  "amount": 680,
  "quantity": 1,
  "date": "2026-07-04",
  "paymentMethod": "微信支付",
  "fees": {
    "premium": 100,
    "travel": 20,
    "hotel": 0,
    "rental": 0,
    "other": 0,
    "shipping": 0
  },
  "outfieldOnly": false,
  "includeInTotal": true
}
```

Update expense:

```http
PUT /api/expenses/:expenseId
```

Delete expense:

```http
DELETE /api/expenses/:expenseId?userId=local-user
```

## Mini Program Integration Plan

The current mini program still uses local storage. The next step is to add a small API client in the mini program and gradually replace local expense storage with these REST APIs.
