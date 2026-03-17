# Document Upload & Management API

## New Features

### 1. Policy Name Tagging
When uploading documents, users can now specify which insurance policy (กรมธรรม์) the document belongs to.

### 2. Document Deletion
Users can delete uploaded documents if they made a mistake.

---

## API Endpoints

### Upload Single Document with Policy Name

**Endpoint:** `POST /api/upload`

**Parameters:**
- `file`: The document file (PDF, JPG, PNG)
- `userId`: User ID
- `policyName`: Name of the insurance policy (optional)

**Example:**
```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);
formData.append('userId', 'user123');
formData.append('policyName', 'ประกันชีวิต AIA Supreme');

fetch('http://localhost:3001/api/upload', {
  method: 'POST',
  body: formData
})
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documentId": "65abc123...",
    "userId": "user123",
    "fileName": "policy.pdf",
    "policyName": "ประกันชีวิต AIA Supreme",
    "textLength": 5432,
    "embeddingDimensions": 384
  }
}
```

---

### Upload Multiple Documents (Batch)

**Endpoint:** `POST /api/upload/batch`

**Parameters:**
- `files[]`: Multiple document files
- `userId`: User ID
- `policyName`: Name of the insurance policy (applies to all files)

**Example:**
```javascript
const formData = new FormData();
formData.append('files', file1);
formData.append('files', file2);
formData.append('files', file3);
formData.append('userId', 'user123');
formData.append('policyName', 'ประกันสุขภาพ Allianz');

fetch('http://localhost:3001/api/upload/batch', {
  method: 'POST',
  body: formData
})
```

---

### Get User Documents

**Endpoint:** `GET /api/user/documents?userId=user123&limit=20`

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [
    {
      "id": "65abc123...",
      "title": "policy.pdf",
      "policyName": "ประกันชีวิต AIA Supreme",
      "contentLength": 5432,
      "hasEmbedding": true,
      "uploadedAt": "2026-03-10T12:00:00.000Z"
    }
  ]
}
```

---

### Delete User Document

**Endpoint:** `DELETE /api/user/documents/:documentId?userId=user123`

**Example:**
```javascript
fetch('http://localhost:3001/api/user/documents/65abc123?userId=user123', {
  method: 'DELETE'
})
```

**Response:**
```json
{
  "success": true,
  "message": "Document deleted successfully",
  "documentId": "65abc123..."
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Document not found or unauthorized"
}
```

---

## Common Policy Names (Examples)

- `ประกันชีวิต` (Life Insurance)
- `ประกันสุขภาพ` (Health Insurance)
- `ประกันรถยนต์` (Car Insurance)
- `ประกันอุบัติเหตุ` (Accident Insurance)
- `ประกันมะเร็ง` (Cancer Insurance)
- `ประกันโรคร้ายแรง` (Critical Illness)

Or specific company policies:
- `ประกันชีวิต AIA Supreme`
- `ประกันสุขภาพ Allianz SmartHealth`
- `ประกันรถยนต์ชั้น 1 กรุงไทย`

---

## Security Notes

1. **Authorization Check**: The delete endpoint verifies that the document belongs to the requesting user before deletion
2. **User Isolation**: Users can only view and delete their own documents
3. **Permanent Deletion**: Deleted documents cannot be recovered

---

## Frontend Integration Example

```javascript
// Upload with policy selection
async function uploadDocument(file, userId, policyName) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('userId', userId);
  formData.append('policyName', policyName);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  });
  
  return await response.json();
}

// Delete document
async function deleteDocument(documentId, userId) {
  const response = await fetch(`/api/user/documents/${documentId}?userId=${userId}`, {
    method: 'DELETE'
  });
  
  return await response.json();
}

// Get user's documents
async function getUserDocuments(userId) {
  const response = await fetch(`/api/user/documents?userId=${userId}&limit=50`);
  return await response.json();
}
```

---

## Testing with cURL

```bash
# Upload with policy name
curl -X POST http://localhost:3001/api/upload \
  -F "file=@policy.pdf" \
  -F "userId=user123" \
  -F "policyName=ประกันชีวิต AIA"

# Get documents
curl "http://localhost:3001/api/user/documents?userId=user123"

# Delete document
curl -X DELETE "http://localhost:3001/api/user/documents/65abc123?userId=user123"
```
