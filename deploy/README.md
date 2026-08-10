# Production deployment

Production is deployed from `main` by GitHub Actions.

The server keeps these files outside Git:

- `.env` with `STRUSNIK_PUBLIC_ORIGIN` and deployment state inputs
- `backend/.env` with database credentials, `SECRET_KEY`, `SESSION_COOKIE_SECURE=true`, and the Google OAuth client credentials

For production Google OAuth, set `GOOGLE_REDIRECT_URI=https://strusnik.pl/api/auth/google/callback` and register the same URI in the Google Cloud Web application client. Keep `GOOGLE_CLIENT_SECRET` only in the backend environment.

`deploy.sh` builds images on EC2, tags them with the deployed commit SHA, waits for MySQL, Flask and Next.js health checks, and rolls back to the previous image if the checks fail. It retains the three newest image tags.

The existing GymSoftware reverse proxy is infrastructure owned by that project. The versioned proxy configuration is kept in `nginx-strusnik.conf`; CI/CD does not restart GymSoftware.
