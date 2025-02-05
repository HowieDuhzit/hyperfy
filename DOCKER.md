# 🐳 Docker Deployment

The project can be run using Docker. Make sure you have Docker and Docker Compose installed on your system.

## Using Docker Compose (Recommended)

1. Create a `.env` file with your configuration:
```bash
DOMAIN=demo.hyperfy.host
PORT=3000
PUBLIC_WS_URL=https://demo.hyperfy.host/ws
PUBLIC_API_URL=https://demo.hyperfy.host/api
PUBLIC_ASSETS_URL=https://demo.hyperfy.host/assets
```

2. Start the container:
```bash
docker compose up -d
```

This will:
- Build the Docker image
- Mount local src/, world/ directories and .env file into the container
- Expose port 3000
- Set up required environment variables
- Run the container in detached mode (-d)

## Manual Docker Build (Alternative)

You can also build and run manually:

```bash
docker build -t hyperfydemo . && docker run -d -p 3000:3000 \
  -v "$(pwd)/src:/app/src" \
  -v "$(pwd)/world:/app/world" \
  -v "$(pwd)/.env:/app/.env" \
  -e DOMAIN=demo.hyperfy.host \
  -e PORT=3000 \
  -e ASSETS_DIR=/world/assets \
  -e PUBLIC_WS_URL=https://demo.hyperfy.host/ws \
  -e PUBLIC_API_URL=https://demo.hyperfy.host/api \
  -e PUBLIC_ASSETS_URL=https://demo.hyperfy.host/assets \
  hyperfydemo
```

Note: Adjust the URLs and domain according to your specific setup.

## Coolify Deployment

This setup is compatible with Coolify. When deploying:
1. Make sure to set the required environment variables in Coolify
2. The volumes will be automatically mounted
3. The healthcheck will ensure the container is running properly