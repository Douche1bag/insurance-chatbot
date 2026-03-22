// Backend server for insurance chatbot
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import mongoService from './src/services/mongoService.js';
import embeddingService from './src/services/embeddingService.js';
import { createWorker } from 'tesseract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /pdf|jpg|jpeg|png/.test(path.extname(file.originalname).toLowerCase()) &&
               /pdf|jpg|jpeg|png/.test(file.mimetype);
    ok ? cb(null, true) : cb(new Error('Only PDF, JPG, and PNG files are allowed'));
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// ===== AUTH =====

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    if (password.length < 4) return res.status(400).json({ success: false, error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' });
    const result = await mongoService.registerUser(email, password, name);
    console.log(`✅ ลงทะเบียนผู้ใช้ใหม่: ${email}`);
    res.json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'กรุณากรอกอีเมลและรหัสผ่าน' });
    const result = await mongoService.loginUser(email, password);
    console.log(`✅ เข้าสู่ระบบ: ${email}`);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ success: false, error: error.message });
  }
});

// ===== CHAT =====

app.post('/api/chat', async (req, res) => {
  try {
    const { query, userId, conversationId } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });

    const ragService = (await import('./src/services/ragService.js')).default;
    console.log(`💬 Chat query: "${query}" from user: ${userId || 'guest'}`);

    let recentMessages = [];
    if (userId && conversationId) {
      try {
        const conversation = await mongoService.getConversationMessages(conversationId);
        recentMessages = conversation.messages.slice(-3);
      } catch (e) {
        console.log('⚠️ Could not load conversation history:', e.message);
      }
    }

    const result = await ragService.queryWithRAG(query, {
      contextLimit: 5,
      language: 'thai',
      userId: userId || null,
      recentMessages
    });

    res.json(result);

    if (result.success && userId && conversationId) {
      (async () => {
        try {
          const embSvc = (await import('./src/services/embeddingService.js')).default;
          const messageEmbedding  = embSvc.generateSimpleEmbedding(query);
          const responseEmbedding = embSvc.generateSimpleEmbedding(result.response);
          await mongoService.addMessageToConversation(conversationId, userId, {
            message: query,
            response: result.response,
            messageEmbedding,
            responseEmbedding
          });
          console.log('✅ Chat message saved (background)');
        } catch (e) {
          console.error('⚠️ Failed to save chat message:', e.message);
        }
      })();
    }

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/chat/history/:userId', async (req, res) => {
  try {
    const history = await mongoService.getChatHistory(req.params.userId, parseInt(req.query.limit) || 50);
    res.json({ success: true, history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CONVERSATIONS =====

app.get('/api/conversations/:userId', async (req, res) => {
  try {
    res.json({ success: true, conversations: await mongoService.getUserConversations(req.params.userId) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  try {
    const { userId, title } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });
    res.json({ success: true, conversation: await mongoService.createConversation(userId, title) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/conversations/:conversationId/messages', async (req, res) => {
  try {
    const conv = await mongoService.getConversationMessages(req.params.conversationId);
    res.json({ success: true, messages: conv.messages || [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/conversations/:conversationId', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID required' });
    await mongoService.deleteConversation(req.params.conversationId, userId);
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/conversations/:conversationId/title', async (req, res) => {
  try {
    const { userId, title } = req.body;
    if (!userId || !title) return res.status(400).json({ success: false, error: 'User ID and title required' });
    await mongoService.updateConversationTitle(req.params.conversationId, userId, title);
    res.json({ success: true, message: 'Title updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== MISC ENDPOINTS =====

app.get('/api/health', (req, res) => res.json({ status: 'ok', message: 'Server is running' }));

app.get('/api/comparison/providers', async (req, res) => {
  try {
    res.json({ success: true, data: await mongoService.getPolicyProviders(parseInt(req.query.limit) || 20) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/comparison/search', async (req, res) => {
  try {
    const { policyNames } = req.body;
    if (!policyNames || !Array.isArray(policyNames))
      return res.status(400).json({ success: false, error: 'policyNames must be an array' });
    const results = await mongoService.searchPoliciesByName(policyNames);
    const parsedResults = results.map(doc => {
      const text = doc.text || doc.title || '';
      const providerMatch = text.match(/(?:บริษัท|ประกันภัย)?\s*([ก-๙A-Za-z\s]+?)(?:\s+จำกัด|\s+มหาชน|$)/i);
      return {
        name: providerMatch ? providerMatch[1].trim() : (doc.title || 'Unknown'),
        coverage: mongoService.parsePolicyCoverage(text),
        document: { id: doc._id, title: doc.title, file: doc.file, page: doc.page }
      };
    });
    res.json({ success: true, data: parsedResults });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/documents', async (req, res) => {
  try {
    res.json({ success: true, data: await mongoService.getSystemDocuments(parseInt(req.query.limit) || 10) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/documents/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    console.log(`📄 Fetching documents for user: ${userId}`);
    const documents = await mongoService.getUserDocuments(userId, parseInt(req.query.limit) || 20);
    console.log(`📄 Found ${documents.length} documents`);
    res.json({ success: true, data: documents, count: documents.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== TESSERACT FALLBACK =====

function cleanTesseractText(text) {
  let t = text;
  t = t.replace(/ํา/g, 'ำ');
  t = t.replace(/ํี/g, 'ี');
  t = t.replace(/ํ/g, '');

  const saraAmFixes = ['ชำ','จำ','ทำ','กำ','นำ','คำ','สำ','ยำ','ดำ','ขำ','ลำ','งำ','บำ','ซำ','รำ','ผำ','ถำ','วำ','พำ','ภำ','มำ','ฟำ','ฝำ','ฮำ'];
  saraAmFixes.forEach(w => { t = t.replace(new RegExp(w.replace('ำ','ํา'), 'g'), w); });

  const wordFixes = [
    [/เบีย(?!ร)/g,        'เบี้ย'],
    [/เบื้ย/g,            'เบี้ย'],
    [/ระยเวลา/g,          'ระยะเวลา'],
    [/ประกนภัย/g,         'ประกันภัย'],
    [/ประกันภย/g,         'ประกันภัย'],
    [/กรมธรม์/g,          'กรมธรรม์'],
    [/จํานรน/g,           'จำนวน'],
    [/จำนรน/g,            'จำนวน'],
    [/สญญา/g,             'สัญญา'],
    [/สญเสีย/g,           'สูญเสีย'],
    [/ผลประโยชน(?!์)/g,   'ผลประโยชน์'],
    [/ชดเซย/g,            'ชดเชย'],
    [/จ่วย/g,             'จ่าย'],
    [/ตั๋า/g,             'ต่ำ'],
    [/15ี/g,              '15 ปี'],
    [/(\d+)ี/g,           '$1 ปี'],
    [/(\d+)ป(?!ี)/g,      '$1 ปี'],
    [/ซํา/g,              'ซ้ำ'],
    [/ชำจะ/g,             'ชำระ'],
    [/ซำระ/g,             'ชำระ'],
    [/แจพาะ/g,            'เฉพาะ'],
    [/บันผล/g,            'ปันผล'],
    [/คร้งละ/g,           'ครั้งละ'],
    [/ดำชดเชย/g,          'ค่าชดเชย'],
  ];
  wordFixes.forEach(([re, fix]) => { t = t.replace(re, fix); });

  const cleanedLines = [];
  for (const line of t.split('\n')) {
    const thaiCount = (line.match(/[\u0E00-\u0E7F]/g) || []).length;
    const numCount  = (line.match(/[0-9,.]/g) || []).length;
    const totalChars = line.replace(/\s/g, '').length;
    if (totalChars < 5 || (thaiCount + numCount) / Math.max(totalChars, 1) >= 0.3) {
      cleanedLines.push(line);
    }
  }
  t = cleanedLines.join('\n');
  t = t.replace(/\b[a-zA-Z]{1,2}\b/g, ' ');
  t = t.replace(/[\u00A2\u00A3\u00A5\u00A9\u00AE\u00B0]/g, ' ');
  t = t.replace(/[ \t]{2,}/g, ' ');
  t = t.replace(/\n{3,}/g, '\n\n');
  t = t.replace(/^[ \t]+/gm, '');
  t = t.replace(/(\d),\s+(\d)/g, '$1,$2');

  return t.trim();
}

async function extractWithTesseract(filePath) {
  console.log('🔄 Falling back to Tesseract OCR...');
  const worker = await createWorker(['tha', 'eng'], 1, {
    logger: () => {}
  });
  try {
    const { data: { text } } = await worker.recognize(filePath);
    await worker.terminate();
    if (!text || text.trim().length < 10) throw new Error('Tesseract extracted no meaningful text');
    const cleaned = cleanTesseractText(text);
    console.log(`📝 Tesseract extracted ${text.length} chars → ${cleaned.length} chars after cleaning`);
    return cleaned;
  } catch (err) {
    await worker.terminate();
    throw err;
  }
}

// ===== OCR (vLLM vision format) =====

async function extractTextFromFile(filePath, fileName) {
  const runpodUrl = process.env.RUNPOD_OCR_URL;
  if (!runpodUrl) throw new Error('RUNPOD_OCR_URL not found in environment variables');

  const url = `${runpodUrl}/v1/chat/completions`;
  const maxRetries = 4;

  // อ่านไฟล์เป็น base64
  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');
  const ext = fileName.split('.').pop().toLowerCase();
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔍 OCR attempt ${attempt}/${maxRetries} for ${fileName}`);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer dummy'
        },
        body: JSON.stringify({
          model: 'typhoon-ai/typhoon-ocr1.5-2b',
          max_tokens: 16384,
          temperature: 0.1,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                },
                {
                  type: 'text',
                  text: 'Please extract all text from this insurance document. Return the complete text content including all tables, numbers, and details.'
                }
              ]
            }
          ]
        })
      });

      // HTTP 5xx → retry
      if (response.status >= 500) {
        if (attempt < maxRetries) {
          const wait = attempt * 4000;
          console.log(`⚠️ OCR HTTP ${response.status} — retrying in ${wait/1000}s (attempt ${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, wait));
          continue;
        }
        throw new Error(`OCR API error (${response.status})`);
      }

      if (response.status !== 200) {
        const errText = await response.text();
        throw new Error(`OCR API error (${response.status}): ${errText.substring(0, 200)}`);
      }

      const result = await response.json();
      const fullText = result.choices?.[0]?.message?.content || '';

      if (!fullText || fullText.trim().length === 0) {
        if (attempt < maxRetries) {
          console.log(`⚠️ No text extracted — retrying (attempt ${attempt}/${maxRetries})`);
          await new Promise(r => setTimeout(r, attempt * 4000));
          continue;
        }
        break;
      }

      if (attempt > 1) console.log(`✅ OCR succeeded on attempt ${attempt}`);
      console.log(`📝 Extracted ${fullText.length} characters from ${fileName}`);
      return { text: fullText, method: 'typhoon-ocr' };

    } catch (error) {
      const isRetryable = error.message.includes('502') || error.message.includes('503') ||
                          error.message.includes('Bad Gateway') ||
                          error.message.includes('ECONNRESET') || error.message.includes('ETIMEDOUT');
      if (isRetryable && attempt < maxRetries) {
        const wait = attempt * 4000;
        console.log(`OCR error — retrying in ${wait/1000}s (attempt ${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }

  // Fallback to Tesseract
  console.log('Typhoon OCR failed — attempting Tesseract fallback');
  const tesseractText = await extractWithTesseract(filePath);
  const cleaned = cleanTesseractText(tesseractText);

  const lines = cleaned.split('\n').filter(l => l.trim());
  const numericLines = lines.filter(l => (l.match(/\d/g) || []).length > l.length * 0.3);
  const isLikelyTable = numericLines.length / Math.max(lines.length, 1) > 0.4;

  if (isLikelyTable) {
    throw new Error(
      'OCR ล้มเหลว: เอกสารนี้ดูเหมือนตารางตัวเลข ซึ่ง Tesseract อ่านไม่ถูกต้อง\n' +
      'กรุณารอให้ Typhoon OCR กลับมาใช้งานได้ แล้วลองอัปโหลดใหม่อีกครั้ง'
    );
  }

  return { text: '[Using tesseract — Typhoon ขัดข้อง ข้อความอาจคลาดเคลื่อน]\n\n' + cleaned, method: 'tesseract' };
}

// ===== UPLOAD =====

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const filePath  = req.file.path;
    const fileName  = req.file.originalname;
    const userId    = req.body.userId || 'guest';
    const policyName = req.body.policyName || 'ไม่ระบุกรมธรรม์';

    console.log(`📄 Processing file: ${fileName} for user: ${userId} [Policy: ${policyName}]`);

    console.log('🔍 Extracting text with OCR...');
    const { text: extractedText, method: ocrMethod } = await extractTextFromFile(filePath, fileName);
    console.log(` OCR method used: ${ocrMethod}`);

    console.log('🔄 Generating embeddings...');
    const embedding = await embeddingService.generateEmbedding(extractedText);

    console.log('💾 Storing in user_documents collection...');
    const documentId = await mongoService.storeUserDocument(userId, fileName, extractedText, embedding, {
      originalName: fileName,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
      source: 'user_upload',
      policyName,
      ocrMethod
    });

    console.log('✅ Verifying vector storage...');
    const verification = await mongoService.verifyDocumentWithEmbedding(documentId, 'user_documents');

    fs.unlinkSync(filePath);
    console.log(`✅ Document stored with ID: ${documentId}`);

    res.json({
      success: true,
      data: { documentId, userId, fileName, policyName, ocrMethod, textLength: extractedText.length, embeddingDimensions: embedding.length, collection: 'user_documents', verification }
    });
  } catch (error) {
    console.error('❌ Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/user/documents', async (req, res) => {
  try {
    const documents = await mongoService.getUserDocuments(req.query.userId || 'guest', parseInt(req.query.limit) || 20);
    res.json({
      success: true, count: documents.length, collection: 'user_documents',
      data: documents.map(doc => ({
        id: doc._id, title: doc.title,
        policyName: doc.metadata?.policyName || 'ไม่ระบุกรมธรรม์',
        ocrMethod: doc.metadata?.ocrMethod || 'unknown',
        contentLength: doc.content?.length || 0,
        hasEmbedding: !!doc.embedding,
        embeddingDimensions: doc.embedding?.length || 0,
        createdAt: doc.metadata?.createdAt,
        uploadedAt: doc.metadata?.uploadedAt,
        metadata: doc.metadata
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/verify/:documentId', async (req, res) => {
  try {
    res.json(await mongoService.verifyDocumentWithEmbedding(req.params.documentId, req.query.collection || 'user_documents'));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/user/documents/:documentId', async (req, res) => {
  try {
    const userId = req.query.userId || req.body.userId;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    console.log(`🗑️ Deleting document ${req.params.documentId} for user ${userId}`);
    const result = await mongoService.deleteUserDocument(req.params.documentId, userId);
    result.success
      ? res.json({ success: true, message: 'Document deleted successfully', documentId: req.params.documentId })
      : res.status(404).json({ success: false, error: 'Document not found or unauthorized' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/user/documents', async (req, res) => {
  try {
    const { userId, documentIds } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    if (!Array.isArray(documentIds) || documentIds.length === 0)
      return res.status(400).json({ success: false, error: 'documentIds array is required' });
    console.log(`🗑️ Bulk deleting ${documentIds.length} documents for user ${userId}`);
    let deleted = 0, failed = 0;
    for (const id of documentIds) {
      try { (await mongoService.deleteUserDocument(id, userId)).success ? deleted++ : failed++; }
      catch { failed++; }
    }
    console.log(`✅ Bulk delete done: ${deleted} deleted, ${failed} failed`);
    res.json({ success: true, deleted, failed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/user/documents/:documentId/policy', async (req, res) => {
  try {
    const { userId, policyName } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    if (!policyName) return res.status(400).json({ success: false, error: 'Policy name is required' });
    console.log(`✏️ Updating policy name for document ${req.params.documentId} to "${policyName}"`);
    const result = await mongoService.updateDocumentPolicy(req.params.documentId, userId, policyName);
    result.success
      ? res.json({ success: true, message: 'Policy name updated successfully', documentId: req.params.documentId, policyName })
      : res.status(404).json({ success: false, error: 'Document not found or unauthorized' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/user/documents/bulk-policy', async (req, res) => {
  try {
    const { userId, documentIds, policyName } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });
    if (!Array.isArray(documentIds) || documentIds.length === 0)
      return res.status(400).json({ success: false, error: 'documentIds array is required' });
    if (!policyName) return res.status(400).json({ success: false, error: 'policyName is required' });
    console.log(`✏️ Bulk updating policy to "${policyName}" for ${documentIds.length} documents`);
    let updated = 0, failed = 0;
    for (const id of documentIds) {
      try { (await mongoService.updateDocumentPolicy(id, userId, policyName)).success ? updated++ : failed++; }
      catch { failed++; }
    }
    console.log(`✅ Bulk update done: ${updated} updated, ${failed} failed`);
    res.json({ success: true, updated, failed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/test-rag', async (req, res) => {
  try {
    const { query, userId } = req.body;
    if (!query) return res.status(400).json({ success: false, error: 'Query is required' });
    const embSvc = (await import('./src/services/embeddingService.js')).default;
    const userResults   = userId ? await embSvc.findSimilarUserContent(query, userId, 3) : [];
    const systemResults = await embSvc.findSimilarContent(query, 3);
    res.json({
      success: true, query, userId,
      results: {
        userDocuments:   userResults.map(d => ({ title: d.title, similarity: (d.similarity*100).toFixed(1)+'%', contentPreview: d.content?.substring(0,200)+'...', source: 'user_upload' })),
        systemDocuments: systemResults.map(d => ({ title: d.title, similarity: (d.similarity*100).toFixed(1)+'%', contentPreview: d.content?.substring(0,200)+'...', source: 'system' }))
      },
      summary: { userDocumentsFound: userResults.length, systemDocumentsFound: systemResults.length, totalRelevantDocs: userResults.length + systemResults.length }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/upload/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    const userId     = req.body.userId || 'guest';
    const policyName = req.body.policyName || 'ไม่ระบุกรมธรรม์';
    const results    = [];
    console.log(`Batch upload: ${req.files.length} files for user: ${userId} [Policy: ${policyName}]`);
    for (const file of req.files) {
      try {
        console.log(`\n📄 Processing: ${file.originalname}`);
        const { text: extractedText, method: ocrMethod } = await extractTextFromFile(file.path, file.originalname);
        console.log(`🤖 OCR method: ${ocrMethod}`);
        const embedding     = await embeddingService.generateEmbedding(extractedText);
        const documentId    = await mongoService.storeUserDocument(userId, file.originalname, extractedText, embedding, {
          originalName: file.originalname, mimeType: file.mimetype, size: file.size,
          uploadedAt: new Date(), source: 'user_upload', policyName, ocrMethod
        });
        const verification = await mongoService.verifyDocumentWithEmbedding(documentId, 'user_documents');
        fs.unlinkSync(file.path);
        results.push({ fileName: file.originalname, success: true, documentId, policyName, ocrMethod, textLength: extractedText.length, embeddingDimensions: embedding.length, verification });
        console.log(`✅ Done: ${file.originalname}`);
      } catch (e) {
        console.error(`❌ Failed: ${file.originalname}`, e.message);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        results.push({ fileName: file.originalname, success: false, error: e.message });
      }
    }
    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Batch complete: ${successCount}/${req.files.length} succeeded`);
    res.json({ success: true, total: req.files.length, successCount, errorCount: req.files.length - successCount, results });
  } catch (error) {
    console.error('❌ Batch upload error:', error);
    if (req.files) req.files.forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });
    res.status(500).json({ success: false, error: error.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')));
}

app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  try {
    await mongoService.connect();
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoService.disconnect();
  process.exit(0);
});