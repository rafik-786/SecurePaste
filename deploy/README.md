# Deploying SecurePaste

The whole system runs on one Linux virtual machine (VM) with Docker Compose.
Three containers run there: Caddy (the web server, which also gets the HTTPS
certificate), the API, and PostgreSQL. The images are built on the VM itself,
so no image registry is needed.

## What you need

- A VM with Ubuntu 24.04 LTS and ports 80 and 443 open. A Google Cloud
  e2-micro on the free tier is enough: create it in `us-central1`,
  `us-west1` or `us-east1`, with a standard persistent disk of up to 30 GB,
  and tick "Allow HTTP traffic" and "Allow HTTPS traffic".
- A hostname that points at the VM's external IP address, for example a free
  `yourname.duckdns.org` name. HTTPS is required: browsers only allow the
  encryption API on secure pages.

## First deploy

Connect to the VM over SSH, then run:

```bash
git clone https://github.com/rafik-786/SecurePaste.git
cd SecurePaste/deploy
sudo bash setup-vm.sh
```

`setup-vm.sh` adds 2 GB of swap (disk space used as extra memory, which the
builds need) and installs Docker. Log out and back in, then run:

```bash
cd SecurePaste/deploy
cp .env.example .env
nano .env
bash deploy.sh
```

In `.env`, set `DOMAIN` to your hostname, and `POSTGRES_PASSWORD` to the
output of `openssl rand -hex 24`. The first build takes a while on an
e2-micro. Caddy gets the certificate when the site starts.

## Update

```bash
bash ~/SecurePaste/deploy/deploy.sh
```

It pulls the checked-out branch, rebuilds the images one at a time, applies
any new database migrations and restarts what changed.

## Notes

- Nothing is backed up, on purpose. A paste lives 7 days at most, and a
  backup would keep it longer than its expiry promises.
- Only Caddy is reachable from outside. The API, the database and the health
  endpoints are not.
- If you stop and start the VM, its external IP address can change. Update
  the DNS record when that happens.
