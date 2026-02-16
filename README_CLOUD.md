# ZType IL - Cloud Deployment (Google Cloud Run / Heroku / etc.)

The project is now configured to support both local development (SQLite) and cloud deployment (PostgreSQL).

## Cloud Run & Database Setup

Cloud Run is stateless, meaning files like `users.db` will be wiped on every restart. Therefore, you **must use an external database** like PostgreSQL (Cloud SQL, Neon, Supabase, etc.) for persistent user data.

### 1. Set Environment Variables

When deploying to Cloud Run (or any hosting platform), set the following environment variables:

- `DATABASE_URL`: The connection string for your PostgreSQL database.
  - Example: `postgres://user:password@host.com:5432/dbname`
- `JWT_SECRET`: A long, random string for securing sessions.
- `NODE_ENV`: Set to `production`.

### 2. Local Development

You can still develop locally without any changes. If `DATABASE_URL` is not set, the app defaults to using `users.db` (SQLite).

### 3. Deploying to Google Cloud Run

1.  **Build & Push Container**:

    ```bash
    gcloud builds submit --tag gcr.io/[PROJECT-ID]/ztype-heb
    ```

2.  **Deploy**:
    ```bash
    gcloud run deploy ztype-heb \
      --image gcr.io/[PROJECT-ID]/ztype-heb \
      --platform managed \
      --allow-unauthenticated \
      --set-env-vars="JWT_SECRET=your-secret,DATABASE_URL=postgres://..."
    ```

### Note on Database Schema

The application will automatically create the `users` table if it doesn't exist when it connects to the PostgreSQL database for the first time.
