# 📤 Upload Feature - Real OCR & Vector Storage

## What's New

The upload page now actually works! It will:
1. ✅ Accept PDF/Image files
2. ✅ Extract text (OCR placeholder - ready for integration)
3. ✅ Generate embeddings using OpenAI
4. ✅ Store in MongoDB with vectors

## Setup

### 1. Install Dependencies
```bash
pnpm install
```

This adds `multer` for file uploads.

### 2. Start Backend Server
```bash
pnpm run server
```

Server runs on `http://localhost:3001`

### 3. Start Frontend
```bash
pnpm run dev
```

Frontend runs on `http://localhost:5173`

## How It Works

### Upload Flow:
```
User uploads file
    ↓
Frontend sends to /api/upload
    ↓
Backend saves file temporarily
    ↓
Extract text (OCR)
    ↓
Generate embeddings (OpenAI API)
    ↓
Store in MongoDB: {title, text, embedding, metadata}
    ↓
Delete temporary file
    ↓
Return success to user
```

### API Endpoint

**POST /api/upload**
- Accepts: PDF, JPG, PNG (max 20MB)
- Returns:
```json
{
  "success": true,
  "data": {
    "documentId": "...",
    "fileName": "policy.pdf",
    "textLength": 1234,
    "embeddingDimensions": 1536
  }
}
```

## OCR Integration (Next Step)

The current implementation has a placeholder for OCR. To add real OCR:

### Option 1: Tesseract.js (Free, Offline)
```bash
pnpm add tesseract.js
```

```javascript
import Tesseract from 'tesseract.js';

const { data: { text } } = await Tesseract.recognize(
  filePath,
  'tha+eng', // Thai + English
  { logger: m => console.log(m) }
);
```

### Option 2: Google Cloud Vision API (Paid, Better)
```bash
pnpm add @google-cloud/vision
```

```javascript
import vision from '@google-cloud/vision';
const client = new vision.ImageAnnotatorClient();

const [result] = await client.textDetection(filePath);
const text = result.fullTextAnnotation.text;
```

### Option 3: Azure Computer Vision (Paid)
```bash
pnpm add @azure/cognitiveservices-computervision
```

## MongoDB Storage

Documents are stored with this structure:
```javascript
{
  _id: ObjectId("..."),
  title: "policy.pdf",
  content: "extracted text content...",
  embedding: [0.123, -0.456, ...], // 1536 dimensions
  metadata: {
    originalName: "policy.pdf",
    mimeType: "application/pdf",
    size: 123456,
    uploadedAt: ISODate("2026-02-22..."),
    source: "user_upload"
  },
  createdAt: ISODate("2026-02-22...")
}
```

## Testing

1. Go to Upload page
2. Drop a PDF or image file
3. Click "Scan Document"
4. Wait for processing
5. Check success message with:
   - Document ID
   - Text length
   - Embedding dimensions

## Environment Variables

Make sure `.env` has:
```env
MONGODB_URI=your_mongodb_connection
MONGODB_DATABASE=insurance-chatbot
VITE_API_KEY=your_openai_api_key
```

## Future Enhancements

- [ ] Add real OCR library (Tesseract/Google Vision)
- [ ] Support more file formats (DOCX, TXT)
- [ ] Batch upload multiple files
- [ ] Show extracted text preview
- [ ] Add progress tracking per upload stage
- [ ] Implement retry on failure
- [ ] Add file validation before upload
- [ ] Generate thumbnail previews

## Troubleshooting

### "Upload failed"
- Check backend server is running on port 3001
- Verify MongoDB connection
- Check OpenAI API key is valid

### "No embeddings generated"
- Ensure `VITE_API_KEY` is set in `.env`
- Check OpenAI API credits
- Verify `embeddingService` is working

### "OCR not working"
- Currently using placeholder text
- Integrate actual OCR library (see options above)

## File Structure
```
uploads/           # Temporary file storage (auto-created)
  └── [deleted after processing]

src/
  Pages/
    └── UploadPage.jsx    # Updated with real upload
  services/
    ├── mongoService.js   # Has storeDocument method
    └── embeddingService.js  # Generates embeddings

server.js          # Added upload endpoint
```

Now your upload feature actually stores data in MongoDB! 🎉
