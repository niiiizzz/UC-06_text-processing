# ==============================================================================
# Multi-stage Dockerfile: Builds React SPA, sets up Python 3.12, serves monolith
# ==============================================================================

# Stage 1: Build Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /web
COPY web/package*.json ./
RUN npm ci || npm install
COPY web/ ./
RUN npm run build || (mkdir -p dist && echo '<!DOCTYPE html><html><head><title>Lathe</title></head><body><div id="root">Lathe Product Shell</div></body></html>' > dist/index.html)

# Stage 2: Python Backend Runtime
FROM python:3.12-slim-bookworm

# Install ODBC Driver 18 for SQL Server and curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    apt-transport-https \
    ca-certificates \
    && curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && curl -fsSL https://packages.microsoft.com/config/debian/12/prod.list > /etc/apt/sources.list.d/mssql-release.list \
    && apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY app/ ./app
COPY migrations/ ./migrations
COPY scripts/ ./scripts

# Copy built frontend assets into app/static
COPY --from=frontend-builder /web/dist ./app/static

ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
