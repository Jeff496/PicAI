# PicAI PKI Infrastructure

**Purpose:** Certificate-based authentication for AWS IAM Roles Anywhere
**Created:** December 2025

---

## Overview

This directory contains a self-signed Public Key Infrastructure (PKI) used to authenticate the PicAI backend with AWS services via IAM Roles Anywhere. Instead of storing static AWS credentials, the backend presents an X.509 certificate signed by our Certificate Authority (CA).

**Security Model:**
```
PicAI Backend → Certificate → AWS IAM Roles Anywhere → Temporary AWS Credentials
```

---

## Directory Structure

```
pki/
├── ca/                         # Certificate Authority files
│   ├── ca.key                  # CA private key (4096-bit RSA) - PROTECT THIS!
│   ├── ca.crt                  # CA certificate (uploaded to AWS trust anchor)
│   ├── ca.srl                  # Serial number tracker for issued certificates
│   └── openssl-ca.cnf          # OpenSSL configuration for CA operations
└── certs/                      # Issued certificates
    ├── picai-backend.key       # Backend private key (2048-bit RSA)
    ├── picai-backend.csr       # Certificate Signing Request (intermediate)
    └── picai-backend.crt       # Signed certificate (1-year validity)
```

---

## File Purposes

### CA Directory

| File | Purpose | Security Level |
|------|---------|----------------|
| `ca.key` | CA private key - signs all certificates | **TOP SECRET** - Never share, never commit to git |
| `ca.crt` | CA certificate - public, uploaded to AWS trust anchor | Public - can be shared |
| `ca.srl` | Serial number tracker for issued certificates | Internal - auto-generated |
| `openssl-ca.cnf` | OpenSSL configuration for CA operations | Configuration - can be versioned |

### Certs Directory

| File | Purpose | Security Level |
|------|---------|----------------|
| `picai-backend.key` | Backend private key - used by AWS signing helper | **SECRET** - Never share, never commit to git |
| `picai-backend.csr` | Certificate Signing Request | Intermediate - can be deleted after signing |
| `picai-backend.crt` | Signed certificate - sent to AWS during authentication | Semi-public - used in credential process |

---

## Certificate Details

### CA Certificate

```
Subject: C=US, ST=California, L=Fullerton, O=PicAI, OU=Certificate Authority, CN=PicAI Root CA
Validity: 10 years (3650 days)
Key Size: 4096-bit RSA
Signature: SHA-256
```

### Backend Certificate

```
Subject: C=US, ST=California, L=Fullerton, O=PicAI, OU=Backend API, CN=picai-backend
Validity: 1 year (365 days)
Key Size: 2048-bit RSA
Signature: SHA-256
Key Usage: Digital Signature
Extended Key Usage: Client Authentication
```

---

## Verification Commands

```bash
# Verify certificate chain
openssl verify -CAfile ca/ca.crt certs/picai-backend.crt
# Expected output: certs/picai-backend.crt: OK

# View CA certificate details
openssl x509 -in ca/ca.crt -noout -text

# View backend certificate details
openssl x509 -in certs/picai-backend.crt -noout -text

# Check certificate expiration date
openssl x509 -in certs/picai-backend.crt -noout -enddate

# Verify key matches certificate (modulus should match)
openssl x509 -noout -modulus -in certs/picai-backend.crt | openssl md5
openssl rsa -noout -modulus -in certs/picai-backend.key | openssl md5
# Both MD5 hashes should be identical
```

---

## Certificate Renewal

The backend certificate expires after 1 year. To renew:

### Step 1: Generate new CSR (optional - can reuse existing key)

```bash
cd ~/PicAI/backend/pki

# Option A: Keep existing key, generate new CSR
openssl req -new -key certs/picai-backend.key -out certs/picai-backend.csr \
  -subj "/C=US/ST=California/L=Fullerton/O=PicAI/OU=Backend API/CN=picai-backend"

# Option B: Generate new key and CSR (more secure)
openssl genrsa -out certs/picai-backend.key 2048
chmod 400 certs/picai-backend.key
openssl req -new -key certs/picai-backend.key -out certs/picai-backend.csr \
  -subj "/C=US/ST=California/L=Fullerton/O=PicAI/OU=Backend API/CN=picai-backend"
```

### Step 2: Sign new certificate with CA

```bash
openssl x509 -req -in certs/picai-backend.csr \
  -CA ca/ca.crt -CAkey ca/ca.key \
  -out certs/picai-backend.crt -days 365 \
  -extfile ca/openssl-ca.cnf -extensions v3_end_entity
```

### Step 3: Verify new certificate

```bash
openssl verify -CAfile ca/ca.crt certs/picai-backend.crt
```

### Step 4: Restart backend (if running)

The AWS signing helper will automatically use the new certificate on next credential request.

---

## CA Certificate Renewal

The CA certificate expires after 10 years. If you need to renew it:

**Warning:** Renewing the CA certificate requires:
1. Generating new CA key and certificate
2. Uploading new CA certificate to AWS trust anchor
3. Re-signing all backend certificates
4. Updating AWS IAM Roles Anywhere trust anchor

```bash
# Generate new CA (rarely needed)
openssl genrsa -out ca/ca.key 4096
chmod 400 ca/ca.key
openssl req -new -x509 -key ca/ca.key -out ca/ca.crt \
  -days 3650 -config ca/openssl-ca.cnf

# Then re-sign backend certificate and update AWS trust anchor
```

---

## Security Best Practices

### File Permissions

```bash
# Set restrictive permissions
chmod 400 ca/ca.key              # Only owner can read
chmod 400 certs/picai-backend.key
chmod 644 ca/ca.crt              # World-readable
chmod 644 certs/picai-backend.crt
```

### What to Backup

| File | Backup? | Notes |
|------|---------|-------|
| `ca/ca.key` | **YES - CRITICAL** | Losing this means regenerating entire PKI |
| `ca/ca.crt` | YES | Needed for trust anchor, but can be regenerated if you have ca.key |
| `certs/picai-backend.key` | YES | Can be regenerated but requires new cert |
| `certs/picai-backend.crt` | Optional | Can be regenerated if you have CA |

### What's in .gitignore

The following files should **NEVER** be committed to git:

```
backend/pki/ca/ca.key
backend/pki/certs/*.key
```

### Incident Response

If private keys are compromised:

1. **Backend key compromised:**
   - Generate new key: `openssl genrsa -out certs/picai-backend.key 2048`
   - Sign new certificate (see renewal steps)
   - Old certificate remains valid until expiration (no revocation mechanism)

2. **CA key compromised:**
   - Entire PKI is compromised
   - Remove trust anchor from AWS IAM Roles Anywhere immediately
   - Generate new CA and all certificates
   - Create new AWS trust anchor
   - Update all configurations

---

## AWS Integration

This PKI is used with AWS IAM Roles Anywhere:

1. **CA Certificate (ca.crt)** → Uploaded to AWS as Trust Anchor
2. **Backend Certificate (picai-backend.crt)** → Presented during authentication
3. **Backend Key (picai-backend.key)** → Used by AWS signing helper to sign requests

See `docs/AWS_REKOGNITION_SETUP.md` for AWS configuration details.

---

## Troubleshooting

### Certificate expired

```bash
# Check expiration
openssl x509 -in certs/picai-backend.crt -noout -enddate

# If expired, follow renewal steps above
```

### AWS authentication failing

```bash
# Verify certificate is valid
openssl verify -CAfile ca/ca.crt certs/picai-backend.crt

# Verify key matches certificate
openssl x509 -noout -modulus -in certs/picai-backend.crt | openssl md5
openssl rsa -noout -modulus -in certs/picai-backend.key | openssl md5
# Both should match

# Test AWS authentication manually
aws_signing_helper credential-process \
  --certificate /home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.crt \
  --private-key /home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.key \
  --trust-anchor-arn arn:aws:rolesanywhere:REGION:ACCOUNT:trust-anchor/ID \
  --profile-arn arn:aws:rolesanywhere:REGION:ACCOUNT:profile/ID \
  --role-arn arn:aws:iam::ACCOUNT:role/PicAI-RekognitionAccess
```

### Permission denied errors

```bash
# Fix file permissions
chmod 400 ca/ca.key certs/picai-backend.key
chmod 644 ca/ca.crt certs/picai-backend.crt
```

---

**Last Updated:** December 2025
