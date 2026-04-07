# AI Cost Calculator — VM Installation Guide

Direct install on a fresh **Ubuntu 22.04+** IaaS VM. No Docker required.

---

## Prerequisites

- Ubuntu 22.04 LTS (or 24.04)
- 2+ vCPUs, 4 GB RAM minimum (8 GB recommended)
- 20 GB disk
- Ports 80/443 open (Nginx), 22 open (SSH)

---

## 1. Base Packages & PPAs

Install base tools first, then add the official PPAs for Python 3.12 and PostgreSQL 16 — neither is available in Ubuntu's default repos.

```bash
sudo apt update && sudo apt upgrade -y

# Base tools needed to add PPAs
sudo apt install -y curl ca-certificates gnupg software-properties-common \
  git build-essential libffi-dev libssl-dev
```

### Python 3.12 (via deadsnakes PPA)

```bash
sudo add-apt-repository ppa:deadsnakes/ppa -y
sudo apt update
sudo apt install -y python3.12 python3.12-venv python3.12-dev

# Verify
python3.12 --version   # Python 3.12.x
```

### PostgreSQL 16 (via official PostgreSQL apt repo)

```bash
# Add PostgreSQL signing key and repository
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /usr/share/keyrings/postgresql.gpg

echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] \
  https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt update
sudo apt install -y postgresql-16 libpq-dev

# Verify
psql --version   # psql (PostgreSQL) 16.x
```

### Remaining packages

```bash
sudo apt install -y \
  redis-server \
  nginx certbot python3-certbot-nginx
```

### WeasyPrint system libraries

WeasyPrint (used for PDF export) requires Pango, Cairo, and GDK-Pixbuf shared libraries that are **not** pulled in automatically by pip.

```bash
sudo apt install -y \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libpangoft2-1.0-0 \
  libcairo2 \
  libgdk-pixbuf2.0-0 \
  libffi-dev \
  shared-mime-info \
  fonts-liberation \
  fonts-dejavu-core

# Verify Pango is visible
python3.12 -c "import ctypes; ctypes.CDLL('libpango-1.0.so.0'); print('pango OK')"
```

> If the verify step fails, run `ldconfig` to refresh the dynamic linker cache:
> ```bash
> sudo ldconfig
> ```

---

## 2. Node.js & npm (via NodeSource — installs Node 22 LTS)

> The `nodejs` package in Ubuntu's default repos is outdated (Node 12/18). Install the current LTS via NodeSource instead.

```bash
# Add NodeSource repository for Node.js 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -

# Install Node.js (includes npm)
sudo apt install -y nodejs

# Verify
node --version   # should print v22.x.x
npm --version    # should print 10.x.x
```

---

## 3. PostgreSQL Setup

```bash
# Start PostgreSQL
sudo systemctl enable --now postgresql

# Create user and database
sudo -u postgres psql <<'SQL'
CREATE USER aicost WITH PASSWORD 'changeme';
CREATE DATABASE aicost_db OWNER aicost;
GRANT ALL PRIVILEGES ON DATABASE aicost_db TO aicost;
SQL
```

> Change `changeme` to a strong password. Update `DATABASE_URL` in `.env` accordingly.

---

## 4. Redis Setup

```bash
sudo systemctl enable --now redis-server
# Verify
redis-cli ping  # should print PONG
```

---

## 5. Application Directory

```bash
sudo mkdir -p /opt/ai-cost-calculator
sudo chown $USER:$USER /opt/ai-cost-calculator

# Clone or copy repository
git clone <your-repo-url> /opt/ai-cost-calculator
# or: scp -r . user@vm:/opt/ai-cost-calculator
```

---

## 6. Backend Setup

```bash
cd /opt/ai-cost-calculator/backend

# Create virtual environment
python3.12 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -e ".[dev]"

# Configure environment
cp ../.env.example .env
# Edit .env — set DATABASE_URL, SECRET_KEY, and other values
nano .env

# Run database migrations
alembic upgrade head

# Seed with fictional data
python -m app.seed.seed_data --mode=fictional
```

> **Default login credentials** (created by the seed script):
> | Field | Value |
> |---|---|
> | Email | `admin@example.com` |
> | Password | `admin1234` |
> | Role | `admin` |
>
> Change the password after first login.

---

## 7. Frontend Build

```bash
cd /opt/ai-cost-calculator/frontend

# Install all Node dependencies (reads package.json)
npm install

# Set the API URL so the frontend knows where the backend is.
# If running behind Nginx on the same host, use a relative path:
echo "VITE_API_URL=" > .env
# If the backend is on a different host or port:
# echo "VITE_API_URL=http://your.domain.com" > .env

# Build for production (output goes to frontend/dist/)
npm run build
```

> **Troubleshooting npm install failures**
> - `EACCES` permission errors → never run `npm install` as root; run as your normal user
> - `python3` missing during native module builds → `sudo apt install -y python3`
> - `gyp` / node-gyp errors → `sudo apt install -y build-essential`

---

## 8. systemd Service (Backend)

```bash
sudo nano /etc/systemd/system/aicost-backend.service
```

Paste:

```ini
[Unit]
Description=AI Cost Calculator Backend
After=network.target postgresql.service redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/ai-cost-calculator/backend
Environment="PATH=/opt/ai-cost-calculator/backend/.venv/bin"
EnvironmentFile=/opt/ai-cost-calculator/backend/.env
ExecStart=/opt/ai-cost-calculator/backend/.venv/bin/uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --workers 2 \
    --log-level info
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Fix permissions so www-data can read the app
sudo chown -R www-data:www-data /opt/ai-cost-calculator

sudo systemctl daemon-reload
sudo systemctl enable --now aicost-backend

# Check status
sudo systemctl status aicost-backend
sudo journalctl -u aicost-backend -f
```

---

## 9. systemd Service (ARQ Worker — for background analyses)

```bash
sudo nano /etc/systemd/system/aicost-worker.service
```

Paste:

```ini
[Unit]
Description=AI Cost Calculator Background Worker
After=network.target redis.service

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/ai-cost-calculator/backend
Environment="PATH=/opt/ai-cost-calculator/backend/.venv/bin"
EnvironmentFile=/opt/ai-cost-calculator/backend/.env
ExecStart=/opt/ai-cost-calculator/backend/.venv/bin/arq app.workers.worker.WorkerSettings
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now aicost-worker
```

---

## 10. Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/aicost
```

Paste (replace `your.domain.com` with your actual domain or VM IP):

```nginx
server {
    listen 80;
    server_name your.domain.com;

    # Frontend static files
    root /opt/ai-cost-calculator/frontend/dist;
    index index.html;

    # SPA routing — serve index.html for all frontend routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket proxy (for chat streaming)
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }
}
```

```bash
# Enable site
sudo ln -sf /etc/nginx/sites-available/aicost /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 11. SSL (Optional — for HTTPS)

```bash
# Requires a real domain pointed at this VM
sudo certbot --nginx -d your.domain.com
# Auto-renewal
sudo systemctl enable --now certbot.timer
```

---

## 12. Verify

```bash
# Backend health check
curl http://localhost:8000/health
# → {"status":"ok","version":"0.1.0"}

# Frontend (via Nginx)
curl http://your.domain.com
# → HTML of the React app
```

---

## Updating the Application

```bash
cd /opt/ai-cost-calculator
git pull

# Backend
cd backend
source .venv/bin/activate
pip install -e .
alembic upgrade head
sudo systemctl restart aicost-backend aicost-worker

# Frontend
cd ../frontend
npm install
npm run build
# Nginx serves the new build immediately
```

---

## Environment Variables Reference

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql+asyncpg://…` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `SECRET_KEY` | *(required)* | JWT signing key — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `LLM_BACKEND` | `mock` | `mock` \| `ollama` \| `lmstudio` \| `openai_compat` |
| `LLM_BASE_URL` | `http://localhost:11434` | Local LLM endpoint |
| `LLM_MODEL` | `llama3.1:8b` | Model name |
| `LLM_API_KEY` | *(empty)* | API key if required |
| `REFRESH_INTERVAL` | `daily` | `daily` \| `weekly` \| `manual` |
| `BATCH_THRESHOLD_SECONDS` | `120` | Analyses exceeding this go to background |
| `DEBUG` | `false` | Enable SQLAlchemy query logging |
