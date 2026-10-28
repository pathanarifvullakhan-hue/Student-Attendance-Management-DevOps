# Student Attendance Management System Using DevOps Tools

A beginner-friendly implementation of the uploaded project specification.

## Included modules

- Student management: add, list, edit, and validate unique roll numbers.
- Daily attendance: date-wise attendance for seven periods, Mark All Present/Absent, save, retrieve, and correct.
- Attendance record management: persistent storage, duplicate prevention using a database uniqueness constraint, and transactional corrections.
- Monthly calculation: saved working dates × seven periods, attended/absent totals, percentage, and configurable low-attendance threshold (default 75%).
- Reports: individual student rows, class-wise summary, daily history, monthly CSV and daily CSV.
- DevOps: Git/GitHub, Jenkinsfile, Dockerfile/Compose, Kubernetes Deployment/Service/PVC, Selenium test script, and API tests.

## Requirements

- Node.js 20 or newer recommended
- npm
- Git
- Docker Desktop (for container steps)
- Google Chrome (for Selenium)
- Jenkins with NodeJS tool configured as `Node20` and access to Docker (for Jenkins pipeline)
- Kubernetes enabled in Docker Desktop (for local Kubernetes steps)

## 1. Run locally on macOS

Open Terminal and go to the folder where you extracted this project.

```bash
npm install
npm start
```

Open http://localhost:3000 in your browser. Keep Terminal running while using the site.

The SQLite database is created automatically at `database/attendance.db` when run locally. Do not delete it if you want to keep records.

For development with auto-restart:

```bash
npm run dev
```

## 2. Recommended manual walkthrough

1. Open Students and add at least two sample students.
2. Open Daily Attendance and choose a date.
3. Use Mark All Present, then change a few period statuses to Absent.
4. Save attendance.
5. Change the date and save another day.
6. Open Monthly Reports, choose the matching month, and Generate report.
7. Change the low-attendance threshold if desired.
8. Click Export CSV.
9. Open Daily History and load the month; export a daily CSV.
10. Refresh the browser and verify students and saved attendance remain.

## 3. Automated API tests

```bash
npm test
```

The tests use a temporary database and verify health, required-field validation, duplicate roll numbers, seven-period saving/retrieval, monthly math, low-attendance threshold, and CSV export.

## 4. Git and GitHub

```bash
git init
git add .
git commit -m "Build Student Attendance Management System"
```

Create an empty repository on GitHub, then follow GitHub's instructions to connect it as `origin` and push your code. Never commit passwords, access tokens, or a real database containing personal student data.

## 5. Docker

Build and start the app from the project root:

```bash
docker compose up --build -d
docker compose logs -f
```

Open http://localhost:3000. Stop with `Ctrl+C` in the logs view, then run:

```bash
docker compose down
```

The named Docker volume `attendance-data` retains the SQLite database across container restarts. `docker compose down -v` deletes that volume and its data; avoid it when you need to keep records.

## 6. Jenkins

1. Install/configure Jenkins and the NodeJS plugin.
2. In Manage Jenkins → Tools, configure a NodeJS installation named exactly `Node20`.
3. Ensure the Jenkins agent has Docker installed and permission to access its daemon.
4. Push the repository to GitHub.
5. Create a Pipeline job and configure it to use the repository's `Jenkinsfile`.
6. Run Build Now and inspect Checkout, Install dependencies, Syntax validation, Automated API tests, and Build Docker image stages.

If Docker is not available to the Jenkins agent, the Docker build stage will fail until the agent is configured. Do not expose the Docker daemon to untrusted builds.

## 7. Kubernetes with Docker Desktop

1. Open Docker Desktop Settings and enable Kubernetes (if your version provides it).
2. Wait until Kubernetes is running.
3. Build the image locally:

```bash
docker build -t student-attendance-devops:1.0 .
```

4. Apply the Kubernetes manifest:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl get pods
kubectl get services
```

5. Open http://localhost:30300. If the NodePort is not reachable in your Kubernetes setup, use:

```bash
kubectl port-forward service/student-attendance-service 3000:3000
```

Then open http://localhost:3000.

The manifest uses one replica and a persistent volume claim for SQLite. This is appropriate for a local demonstration, not a multi-replica production deployment. For production or multiple replicas, use a managed database and add authentication, authorization, backups, TLS, and operational monitoring.

## 8. Selenium browser tests

Install dependencies first, start the application in one Terminal window, then in another:

```bash
npm run test:e2e
```

The Selenium script expects Chrome and the app at `http://localhost:3000`. Set `APP_URL` to test a different URL. The script uses Selenium Manager to locate a compatible browser driver where supported.

The Selenium script is a smoke-test starting point. The ten requirements in the project document should also be verified explicitly during demonstration; extend the script as needed for your exact Chrome and test environment.

## API endpoints

- `GET /api/health`
- `GET /api/students`
- `POST /api/students`
- `PUT /api/students/:id`
- `GET /api/attendance?date=YYYY-MM-DD`
- `POST /api/attendance`
- `GET /api/attendance/history?month=YYYY-MM`
- `GET /api/reports/monthly?month=YYYY-MM&threshold=75`
- `GET /api/reports/monthly.csv?month=YYYY-MM&threshold=75`
- `GET /api/reports/daily.csv?date=YYYY-MM-DD`

## Attendance calculation rule

The project specification says to calculate monthly working periods. This implementation treats each date saved in attendance as a working day and multiplies the number of saved dates by seven. Therefore, save a date only when it represents a real working day. The percentage is attended periods divided by working periods × 100. The low-attendance default is 75%, configurable on the report screen.

## Important project limitations

- This educational version does not implement login or role-based authorization. Do not expose it publicly with real student information.
- Editing is provided for student details and attendance corrections. Student deletion is not included to avoid accidental loss of attendance history.
- The API requires complete seven-period records for all registered students when saving a day.
- Kubernetes image availability and persistent-volume behavior depend on your local cluster configuration.
