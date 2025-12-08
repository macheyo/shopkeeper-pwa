# Setting up HTTPS for CouchDB on GCP

Since your app is served over HTTPS (Vercel) and CouchDB is on HTTP (`http://34.32.91.162:5984`), you need to enable HTTPS for CouchDB to avoid mixed content errors.

## Option 1: GCP Load Balancer with SSL (Recommended)

### Step 1: Create a Static IP Address
```bash
gcloud compute addresses create couchdb-https-ip --global
gcloud compute addresses describe couchdb-https-ip --global
```

### Step 2: Create SSL Certificate
```bash
# Option A: Use Google-managed SSL certificate (easiest)
gcloud compute ssl-certificates create couchdb-ssl-cert \
  --domains=couchdb.yourdomain.com \
  --global

# Option B: Upload your own certificate
gcloud compute ssl-certificates create couchdb-ssl-cert \
  --certificate=path/to/cert.pem \
  --private-key=path/to/key.pem \
  --global
```

### Step 3: Create Backend Service
```bash
# Create instance group (if not exists)
gcloud compute instance-groups unmanaged create couchdb-instance-group \
  --zone=us-central1-a

# Add your CouchDB VM to the instance group
gcloud compute instance-groups unmanaged add-instances couchdb-instance-group \
  --instances=your-couchdb-vm-name \
  --zone=us-central1-a

# Create backend service
gcloud compute backend-services create couchdb-backend \
  --protocol=HTTP \
  --health-checks=couchdb-health-check \
  --global

# Add instance group to backend service
gcloud compute backend-services add-backend couchdb-backend \
  --instance-group=couchdb-instance-group \
  --instance-group-zone=us-central1-a \
  --global
```

### Step 4: Create Health Check
```bash
gcloud compute health-checks create http couchdb-health-check \
  --port=5984 \
  --request-path=/
```

### Step 5: Create URL Map
```bash
gcloud compute url-maps create couchdb-url-map \
  --default-service=couchdb-backend
```

### Step 6: Create Target HTTPS Proxy
```bash
gcloud compute target-https-proxies create couchdb-https-proxy \
  --url-map=couchdb-url-map \
  --ssl-certificates=couchdb-ssl-cert
```

### Step 7: Create Forwarding Rule
```bash
gcloud compute forwarding-rules create couchdb-https-forwarding-rule \
  --address=couchdb-https-ip \
  --target-https-proxy=couchdb-https-proxy \
  --ports=443 \
  --global
```

### Step 8: Update CouchDB URL
Update your environment variable:
```bash
NEXT_PUBLIC_COUCHDB_URL=https://couchdb.yourdomain.com
```

## Option 2: Nginx Reverse Proxy (Simpler, for single VM)

### Step 1: Install Nginx on your CouchDB VM
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

### Step 2: Configure Nginx
Create `/etc/nginx/sites-available/couchdb`:
```nginx
server {
    listen 443 ssl http2;
    server_name couchdb.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/couchdb.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/couchdb.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5984;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CouchDB specific headers
        proxy_buffering off;
        proxy_redirect off;
    }
}
```

### Step 3: Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/couchdb /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Get SSL Certificate
```bash
sudo certbot --nginx -d couchdb.yourdomain.com
```

### Step 5: Update CouchDB URL
```bash
NEXT_PUBLIC_COUCHDB_URL=https://couchdb.yourdomain.com
```

## Option 3: Cloud Endpoints (API Gateway)

If you want a fully managed solution, use Cloud Endpoints with API Gateway.

## Quick Test

After setup, test the connection:
```bash
curl https://couchdb.yourdomain.com/
```

You should see CouchDB's welcome message.

## Update Environment Variables

Once HTTPS is set up, update your Vercel environment variables:
- `NEXT_PUBLIC_COUCHDB_URL=https://couchdb.yourdomain.com`
- Keep `NEXT_PUBLIC_COUCHDB_USERNAME` and `NEXT_PUBLIC_COUCHDB_PASSWORD` the same

## Firewall Rules

Make sure your GCP firewall allows:
- Port 443 (HTTPS) from internet
- Port 5984 (CouchDB) only from localhost/nginx (if using reverse proxy)

```bash
# Allow HTTPS
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --source-ranges 0.0.0.0/0 \
  --target-tags couchdb-server

# Allow CouchDB only from localhost (if using nginx)
gcloud compute firewall-rules create allow-couchdb-local \
  --allow tcp:5984 \
  --source-ranges 127.0.0.1/32 \
  --target-tags couchdb-server
```

