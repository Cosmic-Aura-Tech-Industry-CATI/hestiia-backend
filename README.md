# HESTIIA RESTAURANT — BACKEND REST API
**Client:** DIMISI Technologies  
**Project:** Hestiia Restaurant Administration System Backend

---

## 🌟 Overview
Standalone Node.js + Express.js + TypeScript REST API engine with MongoDB Atlas integration and resilient persistent JSON storage.

### Key Features:
- **JWT Authentication & RBAC**: Dual-role authorization (`superadmin` & `manager`) with 7-day signed tokens.
- **Brute-Force Shield**: Automatic IP lock for 15 minutes after 5 consecutive failed attempts.
- **Fail-Safe Database**: Seamlessly switches between MongoDB Atlas and local `data/db.json` storage.
- **Multer File Upload**: Image upload endpoint with 5MB cap and MIME filtering.
- **Audit Logging**: Comprehensive system log of every login, failed attempt, and state change.

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run test suite (22 tests)
npm test

# 3. Start development server (Port 5000)
npm run dev
```

The API healthcheck will be available at:
👉 **[http://localhost:5000/api/health](http://localhost:5000/api/health)**
