# Production deployment

Production is deployed from `main` by GitHub Actions.

The server keeps these files outside Git:

- `.env` with `STRUSNIK_PUBLIC_ORIGIN` and deployment state inputs
- `backend/.env` with database credentials and `SECRET_KEY`

`deploy.sh` builds images on EC2, tags them with the deployed commit SHA, waits for MySQL, Flask and Next.js health checks, and rolls back to the previous image if the checks fail. It retains the three newest image tags.

The existing GymSoftware reverse proxy is infrastructure owned by that project. The versioned proxy configuration is kept in `nginx-strusnik.conf`; CI/CD does not restart GymSoftware.
