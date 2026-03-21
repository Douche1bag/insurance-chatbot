import mongoService from './mongoService.js';

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.VITE_API_KEY;
    this.baseUrl = process.env.VITE_API_BASE_URL;
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
            if (c === ageCell || n <= 600) continue;
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
      return data.data[0].embedding;
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
    const m = await this.generateEmbedding(message);
    const r = await this.generateEmbedding(response);
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

      // Force-include docs matching filename tokens in query
      const filenameTokens = Array.from(
        new Set((query.match(/\b(?:AIA\d{1,3}|IMG_\d{3,6})(?:\.(?:png|jpg|jpeg))?\b/gi) || [])
          .map(t => t.toLowerCase()))
      );
      const forcedIds = new Set();
      const forcedDocs = filenameTokens.length > 0
        ? userDocs.filter(doc => {
            const title = (doc.title || '').toLowerCase();
            const orig  = (doc.metadata?.originalName || '').toLowerCase();
            return filenameTokens.some(tok => {
              const ext = tok.includes('.') ? tok : tok + '.png';
              return title.includes(tok) || orig.includes(tok) || title.includes(ext) || orig.includes(ext);
            });
          }).map(doc => {
            forcedIds.add(doc._id?.toString?.() ?? doc._id);
            return { ...doc, similarity: 1.0, score: 1.0, source: 'user_upload' };
          })
        : [];

      if (forcedDocs.length >= limit) return forcedDocs.slice(0, limit);

      // Exact policy number match
      const policyMatch = query.match(/(\d{7,10})/);
      if (policyMatch) {
        const exact = userDocs.filter(d => d.content?.includes(policyMatch[1]));
        if (exact.length > 0)
          return exact.map(d => ({ ...d, similarity: 1.0, score: 1.0, source: 'user_upload' })).slice(0, limit);
      }

      // Embedding similarity
      const qEmb = await this.generateEmbedding(query);
      const scored = userDocs
        .filter(d => d.embedding && Array.isArray(d.embedding))
        .map(d => ({ ...d, similarity: this.cosineSimilarity(qEmb, d.embedding), score: this.cosineSimilarity(qEmb, d.embedding), source: 'user_upload' }))
        .filter(d => d.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      const merged = [
        ...forcedDocs,
        ...scored.filter(d => !forcedIds.has(d._id?.toString?.() ?? d._id))
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
      const qEmb       = await this.generateEmbedding(query);
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