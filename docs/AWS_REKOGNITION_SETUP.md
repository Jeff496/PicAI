# AWS Rekognition Setup with IAM Roles Anywhere

**Purpose:** Face collection management for PicAI
**Authentication:** X.509 certificate-based (IAM Roles Anywhere)
**Region:** us-east-1

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [IAM Role Setup](#iam-role-setup)
4. [Trust Anchor Setup](#trust-anchor-setup)
5. [Profile Setup](#profile-setup)
6. [Signing Helper Installation](#signing-helper-installation)
7. [AWS CLI Configuration](#aws-cli-configuration)
8. [Testing](#testing)
9. [Cost Management](#cost-management)
10. [Troubleshooting](#troubleshooting)

---

## Overview

PicAI uses AWS Rekognition for face detection and recognition. Instead of static IAM credentials, we use **IAM Roles Anywhere** with X.509 certificates for secure authentication.

**Authentication Flow:**
```
Backend Request
    ↓
AWS Signing Helper (credential-process)
    ↓
Reads certificate + private key
    ↓
AWS IAM Roles Anywhere verifies certificate against Trust Anchor
    ↓
Returns temporary STS credentials (1 hour TTL)
    ↓
AWS SDK uses credentials to call Rekognition API
```

**Benefits:**
- No static credentials to rotate
- Certificate-based authentication (more secure)
- Automatic credential refresh
- Audit trail via CloudTrail

---

## Prerequisites

Before starting, ensure you have:

- [x] AWS account with access to IAM and Rekognition
- [x] PKI infrastructure set up (see `backend/pki/README.md`)
- [x] CA certificate file: `backend/pki/ca/ca.crt`
- [ ] AWS CLI installed (for testing)

---

## IAM Role Setup

### Step 1: Create IAM Policy

1. Go to **IAM → Policies → Create policy**
2. Select **JSON** tab
3. Paste this policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RekognitionFaceCollections",
      "Effect": "Allow",
      "Action": [
        "rekognition:CreateCollection",
        "rekognition:DeleteCollection",
        "rekognition:ListCollections",
        "rekognition:DescribeCollection",
        "rekognition:IndexFaces",
        "rekognition:DeleteFaces",
        "rekognition:ListFaces",
        "rekognition:SearchFaces",
        "rekognition:SearchFacesByImage",
        "rekognition:DetectFaces"
      ],
      "Resource": "*"
    }
  ]
}
```

4. Click **Next**
5. **Name:** `PicAI-RekognitionPolicy`
6. **Description:** Allows PicAI backend to manage face collections
7. Click **Create policy**

### Step 2: Create IAM Role

1. Go to **IAM → Roles → Create role**
2. **Trusted entity type:** Custom trust policy
3. Paste this trust policy (we'll update it after creating the trust anchor):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "rolesanywhere.amazonaws.com"
      },
      "Action": [
        "sts:AssumeRole",
        "sts:TagSession",
        "sts:SetSourceIdentity"
      ]
    }
  ]
}
```

4. Click **Next**
5. Search for and select `PicAI-RekognitionPolicy`
6. Click **Next**
7. **Role name:** `PicAI-RekognitionAccess`
8. **Description:** IAM Roles Anywhere role for PicAI backend
9. Click **Create role**
10. **Copy the Role ARN** (e.g., `arn:aws:iam::123456789012:role/PicAI-RekognitionAccess`)

---

## Trust Anchor Setup

A Trust Anchor tells AWS to trust certificates signed by your CA.

### Step 1: Create Trust Anchor

1. Go to **IAM → Roles Anywhere** (search in console)
2. Click **Create trust anchor**
3. Configure:
   - **Name:** `PicAI-CA`
   - **Source:** External certificate bundle
   - **Certificate bundle:** Paste contents of `backend/pki/ca/ca.crt`

   To get the certificate content:
   ```bash
   cat ~/PicAI/backend/pki/ca/ca.crt
   ```

4. Click **Create trust anchor**
5. **Copy the Trust Anchor ARN** (e.g., `arn:aws:rolesanywhere:us-east-1:123456789012:trust-anchor/abc123-...`)

### Step 2: Update Role Trust Policy

Now update the role's trust policy to only accept certificates from your trust anchor:

1. Go to **IAM → Roles → PicAI-RekognitionAccess**
2. Click **Trust relationships** tab
3. Click **Edit trust policy**
4. Replace with this policy (update the ARN with your trust anchor ARN):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "rolesanywhere.amazonaws.com"
      },
      "Action": [
        "sts:AssumeRole",
        "sts:TagSession",
        "sts:SetSourceIdentity"
      ],
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "arn:aws:rolesanywhere:us-east-1:ACCOUNT_ID:trust-anchor/TRUST_ANCHOR_ID"
        }
      }
    }
  ]
}
```

5. Click **Update policy**

---

## Profile Setup

A Profile links the trust anchor to IAM roles.

### Step 1: Create Profile

1. Go to **IAM → Roles Anywhere → Profiles**
2. Click **Create profile**
3. Configure:
   - **Name:** `PicAI-Backend-Profile`
   - **Roles:** Select `PicAI-RekognitionAccess`
   - **Session policy:** Leave empty (uses role's permissions)
   - **Session duration:** 3600 seconds (1 hour)
4. Click **Create profile**
5. **Copy the Profile ARN** (e.g., `arn:aws:rolesanywhere:us-east-1:123456789012:profile/xyz789-...`)

---

## Signing Helper Installation

The AWS Signing Helper is a binary that signs requests using your certificate.

### For Raspberry Pi (arm64/aarch64)

```bash
# Create directory for AWS tools
mkdir -p ~/aws-tools
cd ~/aws-tools

# Download latest signing helper for Linux arm64
# Check https://docs.aws.amazon.com/rolesanywhere/latest/userguide/credential-helper.html for latest version
curl -Lo aws_signing_helper \
  "https://rolesanywhere.amazonaws.com/releases/1.4.0/X86_64/Linux/aws_signing_helper"

# For ARM64 (Raspberry Pi 4/5):
curl -Lo aws_signing_helper \
  "https://rolesanywhere.amazonaws.com/releases/1.4.0/Aarch64/Linux/aws_signing_helper"

# Make executable
chmod +x aws_signing_helper

# Move to PATH
sudo mv aws_signing_helper /usr/local/bin/

# Verify installation
aws_signing_helper version
```

**Note:** If the ARM64 URL doesn't work, check the [AWS documentation](https://docs.aws.amazon.com/rolesanywhere/latest/userguide/credential-helper.html) for the correct download link.

---

## AWS CLI Configuration

### Step 1: Create AWS Profile

Create or edit `~/.aws/config`:

```ini
[profile picai-rekognition]
credential_process = /usr/local/bin/aws_signing_helper credential-process \
  --certificate /home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.crt \
  --private-key /home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.key \
  --trust-anchor-arn arn:aws:rolesanywhere:us-east-1:ACCOUNT_ID:trust-anchor/TRUST_ANCHOR_ID \
  --profile-arn arn:aws:rolesanywhere:us-east-1:ACCOUNT_ID:profile/PROFILE_ID \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/PicAI-RekognitionAccess
region = us-east-1
```

**Important:** Replace:
- `ACCOUNT_ID` with your AWS account ID (12-digit number)
- `TRUST_ANCHOR_ID` with your trust anchor UUID
- `PROFILE_ID` with your profile UUID

### Step 2: Set File Permissions

```bash
chmod 600 ~/.aws/config
```

---

## Testing

### Test 1: Verify Identity

```bash
AWS_PROFILE=picai-rekognition aws sts get-caller-identity
```

**Expected output:**
```json
{
    "UserId": "AROAXXXXXXXXXXXXXXXXX:session-name",
    "Account": "123456789012",
    "Arn": "arn:aws:sts::123456789012:assumed-role/PicAI-RekognitionAccess/session-name"
}
```

### Test 2: List Collections (should be empty initially)

```bash
AWS_PROFILE=picai-rekognition aws rekognition list-collections
```

**Expected output:**
```json
{
    "CollectionIds": [],
    "FaceModelVersions": []
}
```

### Test 3: Create Test Collection

```bash
# Create a test collection
AWS_PROFILE=picai-rekognition aws rekognition create-collection \
  --collection-id test-collection

# List collections (should show test-collection)
AWS_PROFILE=picai-rekognition aws rekognition list-collections

# Delete test collection
AWS_PROFILE=picai-rekognition aws rekognition delete-collection \
  --collection-id test-collection
```

### Test 4: Detect Faces in Image

```bash
# Detect faces in an image from URL
AWS_PROFILE=picai-rekognition aws rekognition detect-faces \
  --image '{"S3Object":{"Bucket":"your-bucket","Name":"photo.jpg"}}' \
  --attributes ALL

# Or using a local file (base64 encoded)
base64 -i photo.jpg > /tmp/photo.b64
AWS_PROFILE=picai-rekognition aws rekognition detect-faces \
  --image-bytes "fileb:///tmp/photo.b64" \
  --attributes DEFAULT
```

---

## Cost Management

### Free Tier (First 12 Months)

| Feature | Free Amount | After Free Tier |
|---------|-------------|-----------------|
| Image Analysis (DetectFaces) | 5,000/month | $1.00/1,000 images |
| Face Indexing (IndexFaces) | 1,000/month | $1.00/1,000 faces |
| Face Search (SearchFaces) | Unlimited searches on indexed faces | $0.40/1,000 searches |
| Face Storage | 1,000 faces/month | $0.01/1,000 faces/month |

### Expected Monthly Usage (15-25 Users)

| Operation | Estimated Volume | Cost (Free Tier) |
|-----------|-----------------|------------------|
| DetectFaces (per upload) | 100-500 | $0 |
| IndexFaces (user confirms) | 50-200 | $0 |
| SearchFaces (matching) | 100-500 | $0 |
| Face Storage | 100-500 faces | $0 |

**Total:** $0/month during free tier period

### Cost Alerts

Set up AWS Budgets to monitor costs:

1. Go to **AWS Budgets** in console
2. Click **Create budget**
3. Configure:
   - **Type:** Cost budget
   - **Name:** PicAI-Rekognition-Budget
   - **Amount:** $5/month
   - **Alert threshold:** 80% ($4)
   - **Email:** your-email@example.com

---

## Troubleshooting

### Error: "Access Denied"

**Possible causes:**
1. Trust anchor not linked to profile
2. Role trust policy missing condition
3. Certificate not signed by trusted CA

**Debug steps:**
```bash
# Verify certificate chain
openssl verify -CAfile ~/PicAI/backend/pki/ca/ca.crt \
  ~/PicAI/backend/pki/certs/picai-backend.crt

# Test signing helper directly
/usr/local/bin/aws_signing_helper credential-process \
  --certificate /home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.crt \
  --private-key /home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.key \
  --trust-anchor-arn arn:aws:rolesanywhere:... \
  --profile-arn arn:aws:rolesanywhere:... \
  --role-arn arn:aws:iam::...
```

### Error: "Certificate has expired"

```bash
# Check certificate expiration
openssl x509 -in ~/PicAI/backend/pki/certs/picai-backend.crt -noout -enddate

# If expired, renew certificate (see pki/README.md)
```

### Error: "No credential providers found"

**Cause:** AWS profile not configured correctly

**Fix:**
1. Verify `~/.aws/config` exists and has the profile
2. Check that `credential_process` path is correct
3. Ensure signing helper is executable: `ls -la /usr/local/bin/aws_signing_helper`

### Error: "Throttling Exception"

**Cause:** Too many API calls

**Fix:**
- Implement exponential backoff in your code
- Check AWS Rekognition quotas (default: 5 operations/second)
- Request quota increase if needed

### Signing Helper Not Found

```bash
# Check if installed
which aws_signing_helper

# If not found, reinstall
cd ~/aws-tools
# Download and install (see Signing Helper Installation section)
```

---

## Backend Integration

After AWS setup is complete, add these environment variables to `backend/.env`:

```bash
# AWS Rekognition (uses IAM Roles Anywhere profile)
AWS_REGION=us-east-1
AWS_PROFILE=picai-rekognition
```

The backend will use `@aws-sdk/credential-providers` with `fromProcess()` to automatically use the AWS profile:

```typescript
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { fromProcess } from '@aws-sdk/credential-providers';

const client = new RekognitionClient({
  region: process.env.AWS_REGION,
  credentials: fromProcess({
    profile: process.env.AWS_PROFILE,
  }),
});
```

---

## Quick Reference

### ARNs to Save

After setup, you'll have these ARNs:

| Resource | ARN Pattern |
|----------|-------------|
| Role | `arn:aws:iam::ACCOUNT:role/PicAI-RekognitionAccess` |
| Trust Anchor | `arn:aws:rolesanywhere:us-east-1:ACCOUNT:trust-anchor/UUID` |
| Profile | `arn:aws:rolesanywhere:us-east-1:ACCOUNT:profile/UUID` |

### Files Used by Signing Helper

| File | Path | Purpose |
|------|------|---------|
| Certificate | `/home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.crt` | Sent to AWS for verification |
| Private Key | `/home/jeffreykeem/PicAI/backend/pki/certs/picai-backend.key` | Signs authentication requests |

### AWS CLI Commands

```bash
# Set profile for session
export AWS_PROFILE=picai-rekognition

# Or use per-command
AWS_PROFILE=picai-rekognition aws rekognition list-collections
```

---

**Last Updated:** December 2025
