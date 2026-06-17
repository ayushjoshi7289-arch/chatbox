# HTTPS Setup Guide for Chatbox Application

## 🔒 Complete HTTPS Configuration

### 1. **Environment Variables Setup**

Create/update your `.env` files:

#### Server `.env` (end/server/.env):
```env
# Database
MONGODB_URI=mongodb://localhost:27017/chatbox

# Session Secret
SESSION_SECRET=your-super-secret-session-key-here-change-this-in-production

# Server Configuration
PORT=3000
HOST=0.0.0.0
CLIENT_URL=https://your-domain.com:5173
CLIENT_PORT=5173

# HTTPS Configuration
SSL_KEY_PATH=/path/to/your/private.key
SSL_CERT_PATH=/path/to/your/certificate.crt
```

#### Client `.env` (end/client/.env):
```env
# API Configuration
VITE_API_URL=https://your-domain.com:3000
```

### 2. **SSL Certificate Setup Options**

#### Option A: Self-Signed Certificate (Development)
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout private.key -out certificate.crt -days 365 -nodes

# Place files in server directory
mv private.key end/server/
mv certificate.crt end/server/
```

#### Option B: Let's Encrypt (Production)
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Certificate files will be in /etc/letsencrypt/live/your-domain.com/
```

### 3. **Server HTTPS Configuration**

Update `end/server/server.js` to support HTTPS:

```javascript
const https = require('https');
const fs = require('fs');

// Load SSL certificates
const sslOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH || './private.key'),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH || './certificate.crt')
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);

// Socket.io with HTTPS
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "https://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Start HTTPS server
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "0.0.0.0";
server.listen(PORT, HOST, () => {
  console.log(`🚀 HTTPS Server running at https://${HOST}:${PORT}`);
});
```

### 4. **Client HTTPS Configuration**

#### Vite HTTPS Development Server
Update `end/client/vite.config.js`:

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    https: true,
    port: 5173,
    host: true
  }
})
```

### 5. **Browser Certificate Trust**

#### For Self-Signed Certificates:
1. Navigate to `https://your-domain.com:3000` in browser
2. Click "Advanced" → "Proceed to your-domain.com (unsafe)"
3. Do the same for the client at `https://your-domain.com:5173`

#### For Production Certificates:
- Let's Encrypt certificates are automatically trusted
- No browser warnings should appear

### 6. **Production Deployment**

#### Using PM2 with HTTPS:
```bash
# Install PM2
npm install -g pm2

# Create ecosystem file (ecosystem.config.js)
module.exports = {
  apps: [{
    name: 'chatbox-server',
    script: 'server.js',
    cwd: './end/server',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      CLIENT_URL: 'https://your-domain.com:5173'
    }
  }]
};

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### 7. **Firewall Configuration**

```bash
# Allow HTTPS ports
sudo ufw allow 3000/tcp
sudo ufw allow 5173/tcp

# If using Nginx reverse proxy
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### 8. **Nginx Reverse Proxy (Optional)**

Create `/etc/nginx/sites-available/chatbox`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location /api {
        proxy_pass https://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io {
        proxy_pass https://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location / {
        proxy_pass https://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 9. **Testing HTTPS Setup**

```bash
# Test server HTTPS
curl -k https://localhost:3000/api/auth/me

# Test client HTTPS
curl -k https://localhost:5173

# Check SSL certificate
openssl s_client -connect your-domain.com:3000 -servername your-domain.com
```

### 10. **Security Headers (Recommended)**

Add to your server configuration:

```javascript
// Security headers
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

## ✅ Verification Checklist

- [ ] SSL certificates installed and working
- [ ] Server running on HTTPS port 3000
- [ ] Client running on HTTPS port 5173
- [ ] Environment variables configured
- [ ] Browser accepts certificates
- [ ] Socket.io connections working over HTTPS
- [ ] API calls working over HTTPS
- [ ] No mixed content warnings
- [ ] Security headers implemented

## 🚨 Common Issues & Solutions

### Issue: "Mixed Content" Errors
**Solution**: Ensure all URLs use HTTPS (already fixed in code)

### Issue: Certificate Trust Errors
**Solution**: Add certificate to browser's trusted certificates or use Let's Encrypt

### Issue: CORS Errors
**Solution**: Update CORS origins to use HTTPS URLs

### Issue: Socket.io Connection Fails
**Solution**: Ensure Socket.io server is configured for HTTPS and certificates are valid

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify certificate validity
3. Ensure all URLs use HTTPS
4. Check firewall settings
5. Verify environment variables

Your chatbox application is now configured for secure HTTPS communication! 🔒
