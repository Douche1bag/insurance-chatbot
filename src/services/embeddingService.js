import mongoService from './mongoService.js';

class EmbeddingService {
  constructor() {
    this.apiKey  = process.env.VITE_API_KEY;
    this.baseUrl = process.env.VITE_API_BASE_URL;
    // Cache embeddings — avoids re-embedding same text on every query
    this._embCache    = new Map();
    this._embCacheTTL = 60 * 60 * 1000; // 1 hour
  }

  // ─── TABLE CLEANING ───────────────────────────────────────────────────────

  cleanTableContent(rawContent) {
    if (!rawContent || !rawContent.toLowerCase().includes('<table')) return rawContent;

    try {
      const trBlocks = [...rawContent.matchAll(/<tr[^>]*>(.*?)<\/tr>/gsi)].map(m => m[1]);
      if (trBlocks.length === 0) return rawContent;

      const rows = trBlocks.map(tr =>
        tr.split(/<t[dh][^>]*>/i)
          .map(p => p.replace(/<\/t[dh]>/gi, '').replace(/<[^>]+>/g, '').trim())
          .filter(Boolean)
      );

      let result = 'ตารางข้อมูล:\n' + '─'.repeat(80) + '\n';

      for (const row of rows) {
        const ageCell = row.find(c => /^\d{2}$/.test(c));
        if (!ageCell) continue;

        const nums = [];
        for (const c of row) {
          if (/^\d{2,5}(,\d{3})?$/.test(c)) {
            const n = parseInt(c.replace(/,/g, ''), 10);
            if (c === ageCell || n < 100) continue; // Keep 500-baht premiums (some policies have low premiums)
            nums.push(n);
          }
        }

        const unique = [...new Set(nums)];
        if (unique.length >= 4) {
          result += `${ageCell} | ${unique.join(' | ')}\n`;
        }
      }

      return result;
    } catch (e) {
      console.log('Table parse error:', e.message);
      return rawContent;
    }
  }

  // ─── PREPROCESS ──────────────────────────────────────────────────────────

  preprocessContent(content) {
    if (!content) return content;

    let processed = content;

    if (processed.toLowerCase().includes('<table')) {
      processed = processed.replace(/<table[\s\S]*?<\/table>/gi, (t) => this.cleanTableContent(t));
    }

    processed = processed.replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n').trim();
    return processed;
  }

  // ─── EMBEDDING ───────────────────────────────────────────────────────────

  async generateEmbedding(text) {
    const cleanText = this.preprocessContent(text);

    // Return cached embedding if available (avoids 429 on repeated queries)
    const cKey = cleanText.substring(0, 200); // key = first 200 chars
    const cached = this._embCache.get(cKey);
    if (cached && Date.now() - cached.ts < this._embCacheTTL) return cached.vec;

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({ input: cleanText, model: 'text-embedding-ada-002', encoding_format: 'float' })
      });

      if (!response.ok) {
        console.log(`API failed (${response.status}) → fallback`);
        return this.generateSimpleEmbedding(cleanText);
      }

      const data = await response.json();
      const vec  = data.data[0].embedding;
      this._embCache.set(cKey, { vec, ts: Date.now() });
      if (this._embCache.size > 500) this._embCache.delete(this._embCache.keys().next().value);
      return vec;
    } catch (err) {
      console.log('Embedding error → fallback', err.message);
      return this.generateSimpleEmbedding(cleanText);
    }
  }

  generateSimpleEmbedding(text, dim = 384) {
    const emb = new Array(dim).fill(0);
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      emb[char % dim] += Math.sin(char * 0.1) * Math.cos(i * 0.1);
    }
    const mag = Math.sqrt(emb.reduce((s, v) => s + v * v, 0));
    return emb.map(v => (mag ? v / mag : 0));
  }

  // ─── SIMILARITY ──────────────────────────────────────────────────────────

  cosineSimilarity(a, b) {
    if (a.length !== b.length) throw new Error('Dim mismatch');
    const dot  = a.reduce((s, v, i) => s + v * b[i], 0);
    const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return magA && magB ? dot / (magA * magB) : 0;
  }

  combineEmbeddings(a, b, alpha = 0.5) {
    return a.map((v, i) => alpha * v + (1 - alpha) * b[i]);
  }

  // ─── STORAGE ─────────────────────────────────────────────────────────────

  async storeDocumentWithEmbedding(title, content, metadata = {}) {
    const cleaned   = this.preprocessContent(content);
    const embedding = await this.generateEmbedding(cleaned);
    return await mongoService.storeDocument(title, cleaned, embedding, {
      ...metadata,
      wasTableCleaned: content.toLowerCase().includes('<table')
    });
  }

  async storeChatWithEmbedding(userId, message, response) {
    // Use hash embedding (no API call) for chat history storage
    // This avoids 2 API calls per message while still allowing similarity search
    const m = this.generateSimpleEmbedding(message);
    const r = this.generateSimpleEmbedding(response);
    return await mongoService.storeChatMessage(userId, message, response, {
      messageEmbedding:  m,
      responseEmbedding: r,
      combinedEmbedding: this.combineEmbeddings(m, r)
    });
  }

  // ─── SEARCH ──────────────────────────────────────────────────────────────

  async findSimilarContent(query, limit = 5) {
    const qEmb = await this.generateEmbedding(query);
    try {
      return await mongoService.vectorSearch(qEmb, limit);
    } catch {
      return this.manualSimilaritySearch(qEmb, limit);
    }
  }

  async manualSimilaritySearch(qEmb, limit = 5) {
    const db   = await mongoService.connect();
    const docs = await db.collection('thai_insurance_docs').find({}).toArray();
    return docs
      .filter(d => d.embedding)
      .map(d => ({ ...d, similarity: this.cosineSimilarity(qEmb, d.embedding) }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
  }

  async getRelevantContext(query, limit = 3) {
    const docs = await this.findSimilarContent(query, limit);
    return {
      context: docs.map(d => ({ title: d.title, content: d.content.substring(0, 500), similarity: d.similarity })),
      query, timestamp: new Date()
    };
  }

  // ─── USER DOCUMENT SEARCH (required by ragService) ───────────────────────

  async findSimilarUserContent(query, userId, limit = 5) {
    try {
      console.log(`Searching user documents for userId: ${userId}`);
      const db         = await mongoService.connect();
      const collection = db.collection('user_documents');
      const userDocs   = await collection.find({ userId }).toArray();
      console.log(`Found ${userDocs.length} user documents`);
      if (userDocs.length === 0) return [];

      // ── 0. Keyword search for premium amount queries ─────────────────────
      // Bypasses embedding when API fails — scan raw content for เบี้ย + amount
      const _isPremAmt = /\u0e0a\u0e33\u0e23\u0e30\u0e40\u0e1a\u0e35\u0e49\u0e22|\u0e40\u0e1a\u0e35\u0e49\u0e22\u0e01\u0e23\u0e21\u0e18\u0e23\u0e23\u0e21|\u0e40\u0e1a\u0e35\u0e49\u0e22\u0e1b\u0e23\u0e30\u0e01\u0e31\u0e19/.test(query);
      const _keywordForced = [];
      const _keywordIds    = new Set();
      if (_isPremAmt) {
        const _amtRe = /\d{3,6}\s*\u0e1a\u0e32\u0e17/;
        userDocs.filter(d => _amtRe.test(d.content || '')).forEach(d => {
          const id = d._id?.toString?.() ?? d._id;
          _keywordIds.add(id);
          _keywordForced.push({ ...d, similarity: 0.95, score: 0.95, source: 'user_upload' });
          console.log('Keyword premium match: ' + d.title);
        });
      }

      const forcedIds = new Set();
      const forced = [];

      // ── 1. Policy number match (highest priority) ──────────────────────────
      // User can specify their policy number in the query — match against policyName metadata
      // Supports 5-12 digit numbers (Thai insurance policy numbers vary)
      const policyNumMatch = query.match(/\b(\d{5,12})\b/);
      if (policyNumMatch) {
        const pNum = policyNumMatch[1];
        const byPolicy = userDocs.filter(d =>
          (d.metadata?.policyName || '').toString().includes(pNum) ||
          (d.content || '').includes(pNum)
        );
        byPolicy.forEach(d => {
          const id = d._id?.toString?.() ?? d._id;
          if (!forcedIds.has(id)) { forcedIds.add(id); forced.push({ ...d, similarity: 1.0, score: 1.0, source: 'user_upload' }); }
        });
        if (forced.length > 0) console.log('Policy number match (' + pNum + '): ' + forced.length + ' docs');
      }

      // ── 2. Filename token match ────────────────────────────────────────────
      // Match any filename-like token in the query (IMG_xxxx, AIA01, DSC_xxxx, etc.)
      // Also match partial numbers like "8785" against "IMG_8785.JPG"
      const fileTokens = Array.from(new Set(
        (query.match(/\b(?:[A-Z]{1,5}_?\d{3,6}|[A-Z]{2,5}\d{1,3})(?:\.(?:png|jpg|jpeg|pdf))?\b/gi) || [])
          .map(t => t.toLowerCase())
      ));
      // Also extract bare numbers that could be part of a filename (e.g. "8785" → IMG_8785)
      const bareNums = (query.match(/\b(\d{4,6})\b/g) || []);

      if (fileTokens.length > 0 || bareNums.length > 0) {
        userDocs.forEach(doc => {
          const id    = doc._id?.toString?.() ?? doc._id;
          if (forcedIds.has(id)) return;
          const title = (doc.title || '').toLowerCase();
          const orig  = (doc.metadata?.originalName || '').toLowerCase();
          const combined = title + ' ' + orig;

          const matchesToken = fileTokens.some(tok => {
            const withExt = tok.includes('.') ? tok : tok;
            return combined.includes(tok) || combined.includes(withExt);
          });
          const matchesBare = bareNums.some(n => combined.includes(n));

          if (matchesToken || matchesBare) {
            forcedIds.add(id);
            forced.push({ ...doc, similarity: 1.0, score: 1.0, source: 'user_upload' });
          }
        });
      }

      if (forced.length >= limit) return forced.slice(0, limit);

      // Embedding similarity — cached so repeated queries don't cost API calls
      const qEmb = await this.generateEmbedding(query);
      const scored = userDocs
        .filter(d => d.embedding && Array.isArray(d.embedding))
        .map(d => ({ ...d, similarity: this.cosineSimilarity(qEmb, d.embedding), score: this.cosineSimilarity(qEmb, d.embedding), source: 'user_upload' }))
        .filter(d => d.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      const merged = [
        ..._keywordForced,
        ...forced.filter(d => !_keywordIds.has(d._id?.toString?.() ?? d._id)),
        ...scored.filter(d => !forcedIds.has(d._id?.toString?.() ?? d._id) && !_keywordIds.has(d._id?.toString?.() ?? d._id))
      ].slice(0, limit);

      console.log(`User search: ${merged.length} results`);
      return merged;
    } catch (error) {
      console.error('Error finding similar user content:', error.message);
      return [];
    }
  }

  // ─── CHAT HISTORY SEARCH (required by ragService) ────────────────────────

  async findSimilarChatHistory(query, userId, limit = 5) {
    try {
      // Use hash embedding — consistent with how chat history is stored
      const qEmb       = this.generateSimpleEmbedding(query);
      const db         = await mongoService.connect();
      const collection = db.collection('chat_history');
      const history    = await collection.find({
        userId,
        $or: [
          { messageEmbedding:  { $exists: true, $ne: null } },
          { responseEmbedding: { $exists: true, $ne: null } }
        ]
      }).toArray();

      if (!history.length) return [];

      return history
        .map(chat => {
          let max = 0;
          if (chat.messageEmbedding?.length)  max = Math.max(max, this.cosineSimilarity(qEmb, chat.messageEmbedding));
          if (chat.responseEmbedding?.length) max = Math.max(max, this.cosineSimilarity(qEmb, chat.responseEmbedding));
          return { userMessage: chat.userMessage, botResponse: chat.botResponse, timestamp: chat.timestamp, similarity: max };
        })
        .filter(c => c.similarity > 0.3)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('Error searching chat history:', error.message);
      return [];
    }
  }
}

export default new EmbeddingService();