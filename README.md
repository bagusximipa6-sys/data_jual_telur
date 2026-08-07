# Buku Keuangan Usaha (Business Finance Book)

A web-based application to track the finances of a small business, specifically for egg sales.

## Features

- **Dashboard:** A summary of key financial metrics like capital, sales, net profit, and receivables.
- **Sales Records:** Input daily sales data, including capital, quantity, and total sales, to automatically calculate profit.
- **Customer Accounts (Bakul):** Track bills, payments, and outstanding balances for each customer.
- **Operational Expenses:** Log various operational costs like fuel, parking, etc.
- **Reports:** View consolidated reports for sales, operations, and customer accounts.
- **Master Data:** See aggregated data for customers and expense categories.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **UI Components:** [@heroui/react](https://heroui.com/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Animation:** [Framer Motion](https://www.framer.com/motion/)
- **Icons:** [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js version 20 or higher.
- `npm` or another package manager.

### Running Locally

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:3000`.

## How It Works

The application stores all data in a **Vercel Postgres** database, synced via API routes (`/api/data`). It operates in two modes:

- **User Mode:** A read-only view of all financial data.
- **Admin Mode:** Allows for adding, editing, and deleting records. This mode is protected by a password.

## Deploying to Vercel

### 1. Prerequisites (Environment Variables)

Set these in your Vercel project **Settings → Environment Variables**:

| Variable | Description |
| --- | --- |
| `POSTGRES_URL` | Automatically set when you connect a **Vercel Postgres** database to your project. |
| `ADMIN_PASSWORD` | Your admin password for unlocking Admin Mode. |

### 2. Auto-Migration

The database tables are created automatically. On each request, the server ensures the schema exists (`lib/migrate.ts`) before reading or writing data. **No manual migration step is required.**

After deploying, simply open the app URL. The tables will be created on first load and the sync status will show **"Tersimpan"** (saved) instead of **"Offline"**.

### 3. Manual Migration (Optional)

If you prefer to run the schema manually against your database, you can use the in-app migration API:

```bash
# Run against a locally running dev server
npm run dev
npx tsx scripts/migrate.ts
# Or target the deployed URL
MIGRATE_API_URL="https://your-app.vercel.app" npx tsx scripts/migrate.ts
```

> **Note:** The `/api/migrate` endpoint requires an active admin session cookie.
