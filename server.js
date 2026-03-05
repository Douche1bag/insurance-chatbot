// Backend server for insurance chatbot
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import FormData from 'form-data';
import fetch from 'node-fetch';
import mongoService from './src/services/mongoService.js';
import embeddingService from './src/services/embeddingService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'));
    }
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// ===== AUTHENTICATION ENDPOINTS =====

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'กรุณากรอกอีเมลและรหัสผ่าน' 
      });
    }

    if (password.length < 4) {
      return res.status(400).json({ 
        success: false, 
        error: 'รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร' 
      });
    }

    const result = await mongoService.registerUser(email, password, name);
    
    console.log(`✅ ลงทะเบียนผู้ใช้ใหม่: ${email}`);
    res.json(result);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(400).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'กรุณากรอกอีเมลและรหัสผ่าน' 
      });
    }

    const result = await mongoService.loginUser(email, password);
    
    console.log(`✅ เข้าสู่ระบบ: ${email}`);
    res.json(result);
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// ===== END AUTHENTICATION ENDPOINTS =====

// Chat with RAG endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { query, userId } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required' 
      });
    }

    const ragService = (await import('./src/services/ragService.js')).default;
    
    console.log(`💬 Chat query: "${query}" from user: ${userId || 'guest'}`);
    
    // Get recent chat history for context
    let recentMessages = [];
    if (userId) {
      try {
        const history = await mongoService.getChatHistory(userId, 5);
        recentMessages = history.slice(-3); // Last 3 conversations
      } catch (historyError) {
        console.log('⚠️ Could not load chat history:', historyError.message);
      }
    }
    
    const result = await ragService.queryWithRAG(query, {
      contextLimit: 3,
      language: 'thai',
      userId: userId || null,
      recentMessages // Pass conversation context
    });
    
    // Store chat history with embeddings in MongoDB
    if (result.success && userId) {
      try {
        const embeddingService = (await import('./src/services/embeddingService.js')).default;
        
        // Generate embeddings for both message and response
        const messageEmbedding = await embeddingService.generateEmbedding(query);
        const responseEmbedding = await embeddingService.generateEmbedding(result.response);
        
        await mongoService.storeChatMessage(userId, query, result.response, {
          messageEmbedding,
          responseEmbedding
        });
        console.log('✅ Chat history saved with embeddings');
      } catch (saveError) {
        console.error('⚠️ Failed to save chat history:', saveError.message);
        // Fallback: save without embeddings
        await mongoService.storeChatMessage(userId, query, result.response);
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get chat history endpoint
app.get('/api/chat/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    
    const history = await mongoService.getChatHistory(userId, limit);
    
    res.json({ 
      success: true, 
      history 
    });
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Get policy providers
app.get('/api/comparison/providers', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const providers = await mongoService.getPolicyProviders(limit);
    res.json({ success: true, data: providers });
  } catch (error) {
    console.error('Error fetching providers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Search policies by name
app.post('/api/comparison/search', async (req, res) => {
  try {
    const { policyNames } = req.body;
    
    if (!policyNames || !Array.isArray(policyNames)) {
      return res.status(400).json({ 
        success: false, 
        error: 'policyNames must be an array' 
      });
    }

    const results = await mongoService.searchPoliciesByName(policyNames);
    
    // Parse coverage for each document
    const parsedResults = results.map(doc => {
      const text = doc.text || doc.title || '';
      const coverage = mongoService.parsePolicyCoverage(text);
      
      // Extract provider name
      const providerMatch = text.match(/(?:บริษัท|ประกันภัย)?\s*([ก-๙A-Za-z\s]+?)(?:\s+จำกัด|\s+มหาชน|$)/i);
      const provider = providerMatch ? providerMatch[1].trim() : (doc.title || 'Unknown');
      
      return {
        name: provider,
        coverage: coverage,
        document: {
          id: doc._id,
          title: doc.title,
          file: doc.file,
          page: doc.page
        }
      };
    });

    res.json({ success: true, data: parsedResults });
  } catch (error) {
    console.error('Error searching policies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get system documents
app.get('/api/documents', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const documents = await mongoService.getSystemDocuments(limit);
    res.json({ success: true, data: documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user documents for dashboard
app.get('/api/documents/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        error: 'User ID is required' 
      });
    }
    
    console.log(`📄 Fetching documents for user: ${userId}`);
    const documents = await mongoService.getUserDocuments(userId, limit);
    console.log(`📄 Found ${documents.length} documents`);
    
    res.json({ 
      success: true, 
      data: documents,
      count: documents.length 
    });
  } catch (error) {
    console.error('Error fetching user documents:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// OCR function using OpenTyphoon API
async function extractTextFromFile(filePath, fileName) {
  const apiKey = process.env.TYPHOON_API_KEY;
  
  if (!apiKey) {
    throw new Error('TYPHOON_API_KEY not found in environment variables');
  }

  const url = 'https://api.opentyphoon.ai/v1/ocr';
  
  try {
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('model', 'typhoon-ocr');
    formData.append('task_type', 'default');
    formData.append('max_tokens', '16384');
    formData.append('temperature', '0.1');
    formData.append('top_p', '0.6');
    formData.append('repetition_penalty', '1.2');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });

    if (response.status !== 200) {
      const errorText = await response.text();
      throw new Error(`OCR API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    
    // Extract text from successful results
    const extractedTexts = [];
    for (const pageResult of result.results || []) {
      if (pageResult.success && pageResult.message) {
        const content = pageResult.message.choices[0].message.content;
        try {
          // Try to parse as JSON if it's structured output
          const parsed = JSON.parse(content);
          const text = parsed.natural_text || content;
          extractedTexts.push(text);
        } catch {
          // If not JSON, use as plain text
          extractedTexts.push(content);
        }
      } else if (!pageResult.success) {
        console.warn(`⚠️ Error processing ${pageResult.filename || 'unknown'}: ${pageResult.error || 'Unknown error'}`);
      }
    }

    const fullText = extractedTexts.join('\n\n');
    
    if (!fullText || fullText.trim().length === 0) {
      throw new Error('No text extracted from file');
    }

    console.log(`📝 Extracted ${fullText.length} characters from ${fileName}`);
    return fullText;
    
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error(`Failed to extract text: ${error.message}`);
  }
}

// Upload and process document with OCR
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const userId = req.body.userId || 'guest'; // Get userId from request or default to 'guest'
    
    console.log(`📄 Processing file: ${fileName} for user: ${userId}`);
    
    // Step 1: Extract text using OpenTyphoon OCR
    console.log('🔍 Extracting text with OCR...');
    const extractedText = await extractTextFromFile(filePath, fileName);
    
    // Step 2: Generate embeddings
    console.log('🔄 Generating embeddings...');
    const embedding = await embeddingService.generateEmbedding(extractedText);
    
    // Step 3: Store in MongoDB user_documents collection (NOT thai_insurance_docs)
    console.log('💾 Storing in user_documents collection...');
    const documentId = await mongoService.storeUserDocument(
      userId,
      fileName,
      extractedText,
      embedding,
      {
        originalName: fileName,
        mimeType: req.file.mimetype,
        size: req.file.size,
        uploadedAt: new Date(),
        source: 'user_upload'
      }
    );
    
    // Step 4: Verify the document was stored with embedding
    console.log('✅ Verifying vector storage...');
    const verification = await mongoService.verifyDocumentWithEmbedding(documentId, 'user_documents');
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    console.log(`✅ Document stored with ID: ${documentId}`);
    console.log(`📊 Verification:`, verification);
    
    res.json({
      success: true,
      data: {
        documentId,
        userId,
        fileName,
        textLength: extractedText.length,
        embeddingDimensions: embedding.length,
        collection: 'user_documents',
        verification
      }
    });
    
  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Clean up file if error occurs
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get user's uploaded documents
app.get('/api/user/documents', async (req, res) => {
  try {
    const userId = req.query.userId || 'guest';
    const limit = parseInt(req.query.limit) || 20;
    
    const documents = await mongoService.getUserDocuments(userId, limit);
    
    res.json({ 
      success: true, 
      count: documents.length,
      collection: 'user_documents',
      data: documents.map(doc => ({
        id: doc._id,
        title: doc.title,
        contentLength: doc.content?.length || 0,
        hasEmbedding: !!doc.embedding,
        embeddingDimensions: doc.embedding?.length || 0,
        createdAt: doc.metadata?.createdAt,
        metadata: doc.metadata
      }))
    });
  } catch (error) {
    console.error('Error fetching user documents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify specific document
app.get('/api/verify/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;
    const collection = req.query.collection || 'user_documents';
    
    const verification = await mongoService.verifyDocumentWithEmbedding(
      documentId,
      collection
    );
    
    res.json(verification);
  } catch (error) {
    console.error('Error verifying document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test RAG search on user documents
app.post('/api/test-rag', async (req, res) => {
  try {
    const { query, userId } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        success: false, 
        error: 'Query is required' 
      });
    }

    const embeddingService = (await import('./src/services/embeddingService.js')).default;
    
    // Search user documents
    let userResults = [];
    if (userId) {
      userResults = await embeddingService.findSimilarUserContent(query, userId, 3);
    }
    
    // Search system documents
    const systemResults = await embeddingService.findSimilarContent(query, 3);
    
    res.json({
      success: true,
      query,
      userId,
      results: {
        userDocuments: userResults.map(doc => ({
          title: doc.title,
          similarity: (doc.similarity * 100).toFixed(1) + '%',
          contentPreview: doc.content?.substring(0, 200) + '...',
          source: 'user_upload'
        })),
        systemDocuments: systemResults.map(doc => ({
          title: doc.title,
          similarity: (doc.similarity * 100).toFixed(1) + '%',
          contentPreview: doc.content?.substring(0, 200) + '...',
          source: 'system'
        }))
      },
      summary: {
        userDocumentsFound: userResults.length,
        systemDocumentsFound: systemResults.length,
        totalRelevantDocs: userResults.length + systemResults.length
      }
    });
  } catch (error) {
    console.error('Error testing RAG:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch upload multiple documents
app.post('/api/upload/batch', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const userId = req.body.userId || 'guest';
    const results = [];

    console.log(`📦 Batch upload: ${req.files.length} files for user: ${userId}`);

    for (const file of req.files) {
      const filePath = file.path;
      const fileName = file.originalname;

      try {
        console.log(`\n📄 Processing: ${fileName}`);

        // Step 1: OCR
        const extractedText = await extractTextFromFile(filePath, fileName);

        // Step 2: Embedding
        const embedding = await embeddingService.generateEmbedding(extractedText);

        // Step 3: Store
        const documentId = await mongoService.storeUserDocument(
          userId, fileName, extractedText, embedding,
          {
            originalName: fileName,
            mimeType: file.mimetype,
            size: file.size,
            uploadedAt: new Date(),
            source: 'user_upload'
          }
        );

        // Step 4: Verify
        const verification = await mongoService.verifyDocumentWithEmbedding(documentId, 'user_documents');

        // Cleanup
        fs.unlinkSync(filePath);

        results.push({
          fileName,
          success: true,
          documentId,
          textLength: extractedText.length,
          embeddingDimensions: embedding.length,
          verification
        });

        console.log(`✅ Done: ${fileName}`);

      } catch (fileError) {
        console.error(`❌ Failed: ${fileName}`, fileError.message);

        // Cleanup on error
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        results.push({
          fileName,
          success: false,
          error: fileError.message
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`\n📊 Batch complete: ${successCount}/${req.files.length} succeeded`);

    res.json({
      success: true,
      total: req.files.length,
      successCount,
      errorCount: req.files.length - successCount,
      results
    });

  } catch (error) {
    console.error('❌ Batch upload error:', error);

    // Cleanup all files on catastrophic error
    if (req.files) {
      req.files.forEach(f => {
        if (fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });
    }

    res.status(500).json({ success: false, error: error.message });
  }
});

// Catch-all route for SPA (must be last)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test MongoDB connection
  try {
    await mongoService.connect();
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await mongoService.disconnect();
  process.exit(0);
});
