import embeddingService from './embeddingService.js';
import { APIService } from './apiService.js';

class RAGService {
  constructor() {
    this.similarityThreshold = 0.2;
    this.defaultContextLimit = 8; // Increased for users with many uploaded files
    this.maxChunkLength = 2000; // Full rate table needs ~2000 chars
    // Response cache — avoids hitting API for repeated questions
    this._cache    = new Map();
    this._cacheTTL = 30 * 60 * 1000; // 30 min
  }

  _cacheKey(userId, query) {
    const q = query.toLowerCase().replace(/\s+/g, ' ').replace(/[?!.,]/g, '').trim();
    return (userId || 'anon') + '::' + q;
  }

  _fromCache(key) {
    const e = this._cache.get(key);
    if (!e) return null;
    if (Date.now() - e.ts > this._cacheTTL) { this._cache.delete(key); return null; }
    console.log('Cache hit:', key.substring(0, 60));
    return e.val;
  }

  _toCache(key, val) {
    if (this._cache.size >= 200) this._cache.delete(this._cache.keys().next().value);
    this._cache.set(key, { val, ts: Date.now() });
  }

  cleanResponseFormatting(text) {
    if (!text) return text;
    let cleaned = text.replace(/###\s*/g, '');
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '"$1"');
    return cleaned;
  }

  normalizePolicySourceLine(text, contextDocs = []) {
    if (!text) return text;
    const pickBestPolicyName = () => {
      if (!Array.isArray(contextDocs) || contextDocs.length === 0) return '';
      const bestUserDoc = contextDocs.find(d => (d?.source || '').toLowerCase() === 'user' && d?.policyName);
      const bestAnyDoc  = contextDocs.find(d => d?.policyName);
      return (bestUserDoc?.policyName || bestAnyDoc?.policyName || '').toString().trim();
    };
    const best = pickBestPolicyName();
    const fallback = 'นี่คือข้อมูลของระบบโปรดตรวจสอบกรมธรรม์ของคุณอีกครั้ง';
    const shouldReplace = (t) => /ชื่อกรมธรรม์|ไม่ระบุ|ไม่มีชื่อ|unknown|not\s*specified/i.test((t || '').toString());
    const replaceThai = (s) => s.replace(/จากกรมธรรม์\s*\[([^\]]+)\]/g, (m, bt) => shouldReplace(bt) ? `จากกรมธรรม์ ${best || fallback}` : m);
    const fillBare  = (s) => s.replace(/^(\s*จากกรมธรรม์)\s*$/gm, `$1 ${best || fallback}`);
    return fillBare(replaceThai(text));
  }

  async queryWithRAG(userQuery, options = {}) {
    const { contextLimit = this.defaultContextLimit, userId = null, recentMessages = [] } = options;

    // Cache check — OUTSIDE try so cacheKey is accessible in catch too
    const cacheKey = this._cacheKey(userId, userQuery);
    const cached   = this._fromCache(cacheKey);
    if (cached) return cached;

    try {
      console.log('Starting RAG workflow for query:', userQuery);
      let similarPastChats = [];
      if (userId) {
        try {
          similarPastChats = await embeddingService.findSimilarChatHistory(userQuery, userId, 2);
        } catch (e) { console.log('Could not search chat history:', e.message); }
      }

      const retrievalQuery = this.rewriteQueryForRetrieval(userQuery);
      const contextData    = await this.retrievePrioritizedContext(retrievalQuery, contextLimit, userId);

      if (userId && contextData?.context?.length) {
        const u = contextData.context.filter(d => d?.source === 'user');
        contextData.context = u; contextData.userContextCount = u.length; contextData.systemContextCount = 0;
      }
      if (this.isAmountOrPremiumQuery(userQuery) && contextData?.context?.length) {
        const u = contextData.context.filter(d => d?.source === 'user');
        contextData.context = u; contextData.userContextCount = u.length;
        contextData.systemContextCount = 0; contextData.queryType = 'amount-premium';
      }
      contextData.similarChats = similarPastChats;

      const response          = await this.generateRAGResponse(userQuery, contextData, recentMessages);
      // Safely extract message text — handle multiple possible response shapes
      const rawMessage = response?.message          // { message: '...' }
                      || response?.content          // { content: '...' }
                      || response?.choices?.[0]?.message?.content  // OpenAI shape
                      || (typeof response === 'string' ? response : null)
                      || 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ กรุณาลองใหม่อีกครั้ง';
      const cleanedResponse   = this.cleanResponseFormatting(rawMessage);
      const normalizedResponse = this.normalizePolicySourceLine(cleanedResponse, contextData.context);

      const result = {
        success: true, query: userQuery, response: normalizedResponse, context: contextData.context,
        metadata: {
          contextFound: contextData.context.length > 0,
          contextCount: contextData.context.length,
          userContextCount: contextData.userContextCount || 0,
          systemContextCount: contextData.systemContextCount || 0,
          avgSimilarity: this.calculateAverageScore(contextData.context),
          timestamp: new Date()
        }
      };
      this._toCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error in RAG workflow:', error.message);
      return {
        success: false, query: userQuery, error: error.message,
        fallbackResponse: this.normalizePolicySourceLine(
          this.cleanResponseFormatting(await this.generateFallbackResponse(userQuery)), []
        )
      };
    }
  }

  isAmountOrPremiumQuery(query) {
    // Only trigger strict mode for actual money/premium queries
    // ❌ Do NOT include เสียชีวิต/ผลประโยชน์ — those are coverage questions, not amount-only
    const keywords = [
      'วงเงิน','จำนวนเงิน','ทุนประกัน','เบี้ยประกัน','ค่าใช้จ่าย','เบี้ย',
      'จ่ายสูงสุด','จ่ายเท่าไหร่','ราคา','ต้องจ่าย','จ่ายเท่าไร',
      'ค่าชดเชย','สินไหม','เงินเอาประกันภัย'
    ];
    return keywords.some(k => query.toLowerCase().includes(k.toLowerCase()));
  }

  isPremiumRateQuery(query) {
    return /เบี้ย(?:รายเดือน|รายปี|กรมธรรม์)?|จ่ายเดือน|ต้องจ่ายเดือน|อัตราเบี้ย|ชำระเบี้ย|ชำระเบี้ยประกัน/.test(query);
  }

  isCoverageOrAmountQuery(query) {
    const keywords = [
      'ความคุ้มครอง','คุ้มครอง','อุบัติเหตุ','โรค','ป่วย','พิการ',
      'สิทธิประโยชน์','สิทธิ','เคลม','โครง','ผลประโยชน์','เงื่อนไข','สัญญา','ประโยชน์','แผน','แบบ'
    ];
    return keywords.some(k => query.toLowerCase().includes(k.toLowerCase()));
  }

  rewriteQueryForRetrieval(query) {
    let r = query;

    // Pattern 1: Sum Assured reference
    const sumMatch = query.match(/(?:เบี้ย|จ่ายปีละ|จ่ายเบี้ย(?:ปีละ)?)\s*([\d,]+)/i);
    if (sumMatch) {
      const num = parseInt(sumMatch[1].replace(/,/g, ''), 10);
      if (num >= 10000) r += ' ผลประโยชน์กรณีเสียชีวิต จำนวนเงินเอาประกันภัย ' + sumMatch[1].replace(/,/g,'') + ' โครงการ ความคุ้มครอง';
    }

    // Pattern 2: death/payout
    if (/เสียชีวิต|ได้เงิน/.test(query)) r += ' ผลประโยชน์กรณีเสียชีวิต ความคุ้มครอง จำนวนเงินเอาประกันภัย';

    // Pattern 3: benefit/condition
    if (/ผลประโยชน์|เงื่อนไข|ความคุ้มครองและ|สัญญา/.test(query) && !/จำนวนเงินเอาประกันภัย/.test(r))
      r += ' ผลประโยชน์ ความคุ้มครอง เงื่อนไข';

    // Pattern 4: premium rate table
    if (/เบี้ย|จ่ายเดือน|ต้องจ่าย|ชำระเบี้ย/.test(query)) {
      r += ' เบี้ยประกันภัยรายเดือน ตารางเบี้ย อัตราเบี้ย รายเดือน';
      const ageMatch = query.match(/อายุ\s*(\d+)|\b(\d{2})\s*ปี/);
      if (ageMatch) r += ' อายุ ' + (ageMatch[1] || ageMatch[2]);
      if (/ชาย/.test(query)) r += ' ชาย';
      if (/หญิง/.test(query)) r += ' หญิง';
    }

    // Pattern 5: coverage period
    if (/ระยะเวลา|คุ้มครองกี่ปี|อายุกรมธรรม์/.test(query)) r += ' ระยะเวลาคุ้มครอง ชำระเบี้ย ปี';

    // Pattern 6: plan benefit questions
    if (/ผลประโยชน์|ความคุ้มครองของโครง|โครงการ\s*\d|แผน\s*\d|ความคุ้มครองและ/.test(query))
      r += ' ผลประโยชน์กรณีเสียชีวิต จำนวนเงินเอาประกันภัย ความคุ้มครองและผลประโยชน์ โครงการ อุบัติเหตุ สาธารณภัย ADD HB';

    // Pattern 7: conditions/exclusions
    if (/เงื่อนไข|รายละเอียด|สัญญาเพิ่มเติม|ข้อยกเว้น/.test(query)) r += ' เงื่อนไข ความคุ้มครอง สัญญา ข้อยกเว้น';

    // Pattern 8: short generic death/benefit queries with no other keywords
    // e.g. "เสียชีวิตได้กี่บาท", "ถ้าเสียชีวิตได้เงินกี่บาท"
    if (/เสียชีวิต/.test(query) && !/ผลประโยชน์กรณีเสียชีวิต/.test(r))
      r += ' ผลประโยชน์กรณีเสียชีวิต ความคุ้มครอง จำนวนเงินเอาประกันภัย อุบัติเหตุ ADD';

    // Pattern 9: generic premium query with no age/sex
    // e.g. "เบี้ยรายเดือนต้องจ่ายเท่าไหร่"
    if (/เบี้ย/.test(query) && !/อายุ|ชาย|หญิง/.test(query) && !/ตารางเบี้ย/.test(r))
      r += ' เบี้ยประกันภัยรายเดือน เบี้ยรายปี ตารางเบี้ย อัตราเบี้ย อายุ โครงการ';

    // Pattern 10: generic conditions/benefits query
    // e.g. "เงื่อนไขกรมธรรม์และผลประโยชน์"
    if (/เงื่อนไข|เงื่อนไขกรมธรรม์/.test(query) && !/ความคุ้มครอง/.test(r))
      r += ' ความคุ้มครองและผลประโยชน์ เงื่อนไข สัญญา โครงการ';

    if (r !== query) console.log('Query rewritten:', r);
    return r;
  }

  async retrievePrioritizedContext(query, limit = 5, userId = null) {
    try {
      let userDocs = [], systemDocs = [], userContextCount = 0, systemContextCount = 0;
      const isAmountOrPremium = this.isAmountOrPremiumQuery(query);
      const isCoverageQuery   = this.isCoverageOrAmountQuery(query);

      console.log('Query Type: ' + (isAmountOrPremium ? 'Amount/Premium' : isCoverageQuery ? 'Coverage' : 'General'));

      if (userId) {
        try {
          const _isPrem  = /เบี้ย(?:รายเดือน|รายปี|กรมธรรม์)?|จ่ายเดือน|ต้องจ่ายเดือน|อัตราเบี้ย|ชำระเบี้ย|ชำระเบี้ยประกัน/.test(query);
          const _hasAge  = /อายุ\s*\d+|\b\d{2}\s*ปี/.test(query);
          const _hasSex  = /ชาย|หญิง/.test(query);

          // Bypass similarity when: premium query + (age OR sex OR it's a general premium question)
          // General premium questions like "ต้องชำระเบี้ยกี่บาท" also need bypass — answer is in policy doc
          const _isGeneralPrem = _isPrem && !_hasAge && !_hasSex;
          if (_isPrem && (_hasAge || _hasSex || _isGeneralPrem)) {
            // Fetch ALL user docs — re-ranking happens below to find the right one
            const all    = await embeddingService.findSimilarUserContent(query, userId, 20);
            userDocs     = all; // keep all for now, capped after re-rank
            userContextCount = userDocs.length;
            console.log('Premium bypass: ' + userContextCount + ' docs (will re-rank)');
          } else {
            const searchLimit = isCoverageQuery ? Math.ceil(limit * 2) : limit;
            const similar     = await embeddingService.findSimilarUserContent(query, userId, searchLimit);
            const threshold   = isCoverageQuery ? 0.05 : this.similarityThreshold;
            userDocs = similar.filter(d => (d.similarity || d.score || 0) >= threshold).slice(0, limit);

            // FALLBACK: if similarity search returns 0 docs, return ALL user docs
            // User uploaded them specifically to be used — never leave them out
            if (userDocs.length === 0 && similar.length > 0) {
              userDocs = similar.slice(0, Math.min(limit, 3)); // Cap fallback docs
              console.log('Similarity fallback: returning all ' + userDocs.length + ' user docs (threshold bypassed)');
            }
            userContextCount = userDocs.length;
            console.log('Found ' + userContextCount + ' docs');
          }
        } catch (e) {
          console.log('No user documents found: ' + e.message);
        }
      }

      // Re-rank: exact age+sex match wins
      const _premQ = /เบี้ย|ชำระเบี้ย/.test(query);
      if (_premQ && userDocs.length > 1) {
        // Extract age number from query e.g. "35" from "อายุ35" or "35ปี"
        const _ageM = query.match(/อายุ\s*(\d+)|\b(\d{2})\s*ปี/);
        const _age  = _ageM ? (_ageM[1] || _ageM[2]) : null;
        const _male = /ชาย/.test(query);
        const _fem  = /หญิง/.test(query);

        userDocs.sort((a, b) => {
          const ac = a.content || '', bc = b.content || '';
          let scoreA = 0, scoreB = 0;

          // +3: doc contains the exact age row e.g. "35 |" or "35\t"
          if (_age) {
            const ageRe = new RegExp('(^|\\s)' + _age + '\\s*[\\|\\t]');
            if (ageRe.test(ac)) scoreA += 3;
            if (ageRe.test(bc)) scoreB += 3;
          }

          // +2: doc is a rate table (has "ตารางข้อมูล" or "age | number" rows)
          const rateRe = /ตารางข้อมูล|\d{2}\s*\|\s*\d{3}/;
          if (rateRe.test(ac)) scoreA += 2;
          if (rateRe.test(bc)) scoreB += 2;

          // +1: doc mentions the requested sex
          if (_male && /ชาย/.test(ac)) scoreA += 1;
          if (_male && /ชาย/.test(bc)) scoreB += 1;
          if (_fem  && /หญิง/.test(ac)) scoreA += 1;
          if (_fem  && /หญิง/.test(bc)) scoreB += 1;

          // Fallback to similarity score
          if (scoreA !== scoreB) return scoreB - scoreA;
          return (b.similarity || 0) - (a.similarity || 0);
        });

        console.log('Re-rank: age=' + _age + ' sex=' + (_male ? 'M' : _fem ? 'F' : '?') + ' top=' + userDocs[0]?.title);
      }
      const maxDocs = _premQ ? 3 : 5;
      userDocs = userDocs.slice(0, maxDocs);



      const allDocs = [...userDocs, ...systemDocs];
      const contextDocs = allDocs.map(doc => ({
        title:      doc.title || 'เอกสาร',
        content:    this.truncateContent(this.cleanTableContent(doc.content), this.maxChunkLength),
        similarity: doc.similarity || doc.score || 0,
        id:         doc._id || doc.id,
        source:     doc.userId ? 'user' : 'system',
        sourceIcon: doc.userId ? '👤' : '🏛️',
        policyName: doc.metadata?.policyName || 'ไม่ระบุชื่อกรมธรรม์',
        isChunked:  doc.metadata?.isChunked || false,
        chunkInfo:  doc.metadata?.isChunked ? ' [' + (doc.metadata.chunkIndex + 1) + '/' + doc.metadata.totalChunks + ']' : ''
      }));

      // Post-filter: premium queries → keep only rate table chunks
      const _prem = /เบี้ยรายเดือน|ตารางเบี้ย/.test(query);
      let finalDocs = contextDocs;
      if (_prem && contextDocs.length > 1) {
        const rateOnly = contextDocs.filter(d => /ตารางข้อมูล|ตารางเบี้ยประกันภัยรายเดือน/.test(d.content));
        if (rateOnly.length > 0) { finalDocs = rateOnly; console.log('Rate filter: ' + rateOnly.length + ' docs'); }
      }

      return {
        context: finalDocs, userContextCount, systemContextCount,
        totalFound: allDocs.length, query,
        queryType: isAmountOrPremium ? 'amount-premium' : isCoverageQuery ? 'coverage' : 'general',
        userId: userId || null
      };
    } catch (error) {
      console.error('Error retrieving context:', error.message);
      return { context: [], userContextCount: 0, systemContextCount: 0, totalFound: 0, query, queryType: 'unknown', userId: userId || null };
    }
  }

  async retrieveContext(query, limit = 3) {
    try {
      const similar  = await embeddingService.findSimilarContent(query, limit * 2);
      const relevant = similar.filter(d => (d.similarity || d.score || 0) >= this.similarityThreshold);
      return {
        context: relevant.slice(0, limit).map(d => ({ title: d.title || 'เอกสาร', content: this.truncateContent(d.content, 500), similarity: d.similarity || d.score || 0, id: d._id || d.id })),
        totalFound: similar.length, relevantCount: relevant.length, query
      };
    } catch (error) {
      console.error('Error retrieving context:', error.message);
      return { context: [], totalFound: 0, relevantCount: 0, query };
    }
  }

  async generateRAGResponse(query, contextData, recentMessages = []) {
    const systemMessage = this.buildSystemMessage(contextData, recentMessages);
    const messages = [
      { role: 'system', content: systemMessage },
      { role: 'user',   content: query }
    ];

    // Retry with exponential backoff on 429 rate limit
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log('Generating response (attempt ' + attempt + ')...');
        return await APIService.sendMessage(messages);
      } catch (error) {
        const is429 = error.message?.includes('429') || error.status === 429;
        if (is429 && attempt < maxRetries) {
          const wait = attempt * 2000; // 2s, 4s, 6s
          console.log('Rate limit hit — retrying in ' + (wait/1000) + 's...');
          await new Promise(r => setTimeout(r, wait));
        } else {
          console.error('Error generating RAG response:', error.message);
          throw error;
        }
      }
    }
  }

  buildSystemMessage(contextData, recentMessages = []) {
    const isUserOnlyQuery = contextData?.queryType === 'amount-premium';
    const isUserScoped    = !!contextData?.userId;
    let msg = '';

    // Conversation history (skip for amount/premium)
    if (!isUserOnlyQuery && recentMessages?.length > 0) {
      msg += '\n\n💬 บทสนทนาที่ผ่านมา:';
      recentMessages.forEach((m, i) => {
        if (m.userMessage && m.botResponse) {
          const short = m.botResponse.length > 200 ? m.botResponse.substring(0, 200) + '...' : m.botResponse;
          msg += '\n\n' + (i+1) + '. ผู้ใช้: ' + m.userMessage + '\n   ระบบ: ' + short;
        }
      });
      msg += '\n\nสำคัญ: อ้างอิงบริบทจากบทสนทนาข้างต้นในการตอบคำถามปัจจุบัน\n\n---\n';
    }

    // Main prompt
    msg += `คุณเป็นผู้ช่วยด้านประกันภัยไทยที่เชี่ยวชาญ ตอบคำถามสั้น กระชับ ตรงประเด็น

รูปแบบการตอบ:
1. ความคุ้มครอง: ✅คุ้มครอง / ❌ไม่คุ้มครอง / ⚠️มีเงื่อนไข → จากกรมธรรม์ [ชื่อ] → อธิบาย 2-3 ประโยค
2. ผลประโยชน์/จำนวนเงิน: แจกแจงทุกกรณีจากตาราง พร้อมการคำนวณ → ระบุแหล่งที่มา
3. ทั่วไป: เริ่มด้วยคำตอบโดยตรง ระบุแหล่งที่มา อธิบายสั้น

หลักการ:
- ให้ความสำคัญกับเอกสารผู้ใช้ (👤) เป็นอันดับแรก
- เริ่มด้วยคำตอบเสมอ อย่าขึ้นต้นด้วย "จากข้อมูล..." หรือ "ตามเอกสาร..."
- ตอบสั้น 3-6 ประโยค ไม่เกิน 10 ประโยค
- ระบุชื่อกรมธรรม์เสมอ
- อย่าใช้หัวข้อ ### หรือจัดรูปแบบซับซ้อน`;

    // User-scoped: use docs first, but don't block reasonable answers
    if (isUserScoped) {
      msg += `

🚨 ใช้ข้อมูลจากเอกสาร (👤) ด้านล่างก่อนเสมอ — ตอบจากเอกสาร ระบุชื่อไฟล์ — ห้ามแต่งชื่อหรือตัวเลขที่ไม่มีในเอกสาร`;
    }

    // Amount/premium extra rules
    if (isUserOnlyQuery) {
      msg += `

📌 กฎแยกแยะ ทุนประกัน vs เบี้ย:
- ตัวเลขหลักแสน+ ในคอลัมน์ "โครงการ/จำนวนเงินเอาประกันภัย" = ทุนประกัน ไม่ใช่เบี้ยรายปี
- เบี้ยจริงอยู่ในตารางแยก มักเป็นหลักร้อย-พันบาท แยกตามอายุ/เพศ
- ถ้าผู้ใช้พูดว่า "เบี้ย X" หรือ "จ่ายปีละ X" และ X ตรงกับ Sum Assured ในตาราง → ตีความว่าผู้ใช้เลือกโครงการ Sum Assured = X แล้วตอบผลประโยชน์จากตารางนั้น

🚨 ห้ามสร้างข้อมูลเท็จ:
- ✅ ใช้เฉพาะตัวเลขและชื่อใน context เท่านั้น
- ❌ ห้ามตั้งชื่อกรมธรรม์เอง ห้ามใส่ตัวเลขที่ไม่มีใน context
- ❌ ห้ามสรุปว่า "เบี้ยรวม (เบี้ย×ปี)" = "ทุนประกัน/ผลประโยชน์กรณีเสียชีวิต"
- ✅ ถ้าไม่มีข้อมูลในเอกสาร → บอกว่าไม่พบ แต่ถ้าพบข้อมูลใกล้เคียง ให้ตอบสิ่งที่พบพร้อมบอกว่าข้อมูลมาจากไหน
- ✅ ถ้าเอกสารมีตัวเลขที่เกี่ยวข้อง (เช่น เบี้ยประกันภัยรวม 500 บาท) → ตอบตัวเลขนั้นพร้อมระบุแหล่งที่มา
- ✅ คำนวณได้เฉพาะเมื่อตัวเลขทุกตัวมีใน context พร้อมแสดงสูตรสั้นๆ

📌 คำถาม "เสียชีวิตได้กี่บาท":
- ❌ ห้ามตอบแค่ "ได้รับ X บาท" แล้วจบ
- ✅ แจกแจงทุกกรณีจากตาราง: เสียชีวิตปกติ / อุบัติเหตุ (ทุนประกัน+ADD) / สาธารณภัย / HB รายวัน ฯลฯ
- ✅ ตอบเฉพาะสิ่งที่มีใน context ห้ามสมมติ

📌 อ่านตารางเบี้ย: อายุ | ป1ชาย | ป1หญิง | ป2ชาย | ป2หญิง | ป3ชาย | ป3หญิง
วิธี: (1) ค้นหาแถวที่ขึ้นต้นด้วยเลขอายุที่ถาม เช่น "35 |"  (2) อ่านค่าตามคอลัมน์เพศ+โครงการ
❌ ห้ามใช้แถวอื่น — ถาม 35 ต้องตอบจาก "35 |" ไม่ใช่แถว 20 หรือ 40
❌ ห้ามสับคอลัมน์ — ป1ชาย≠ป2ชาย
- ไม่บอกเพศ → แสดงทั้งชายและหญิงจากแถวอายุนั้น
- ไม่บอกทั้งอายุและเพศ → ถามกลับ`
    }

    // Context documents
    if (contextData.context?.length > 0) {
      msg += '\n\nข้อมูลที่เกี่ยวข้อง (กรุณาอ่านทุกเอกสารอย่างละเอียด):';
      contextData.context.forEach((doc, i) => {
        const pct         = (doc.similarity * 100).toFixed(1);
        const sourceLabel = doc.source === 'user' ? '👤 เอกสารผู้ใช้' : '🏛️ ข้อมูลระบบ';
        const policyLabel = doc.policyName ? ' (' + doc.policyName + ')' : '';
        msg += '\n\n' + (i+1) + '. ' + doc.sourceIcon + ' ' + doc.title + policyLabel + (doc.chunkInfo||'') + ' [' + sourceLabel + ']' +
               '\n   📝 เนื้อหา: ' + (doc.content.length > 800 ? doc.content.substring(0, 800) + '...' : doc.content) + '\n   🎯 ความเกี่ยวข้อง: ' + pct + '%';
      });
      msg += '\n\nกรุณาอ้างอิงข้อมูลข้างต้นในการตอบ และระบุชื่อเอกสาร/ไฟล์ที่มาของข้อมูล';
      msg += '\n\n⚠️ สำคัญ: เอกสารข้างต้นคือข้อมูลจริงจากผู้ใช้ กรุณาอ่านและตอบจากเนื้อหาในเอกสาร ห้ามตอบว่า "ไม่พบ" ถ้ายังไม่ได้อ่านเนื้อหาในเอกสารทั้งหมดด้านบน';
    }

    // Similar past chats (skip for amount/premium)
    if (!isUserOnlyQuery && contextData.similarChats?.length > 0) {
      msg += '\n\n🔍 บทสนทนาที่คล้ายกันในอดีต:';
      contextData.similarChats.forEach((chat, i) => {
        const short = chat.botResponse.length > 200 ? chat.botResponse.substring(0,200) + '...' : chat.botResponse;
        msg += '\n\n' + (i+1) + '. คำถาม: ' + chat.userMessage + '\n   คำตอบ: ' + short + '\n   🎯 ความเกี่ยวข้อง: ' + (chat.similarity*100).toFixed(1) + '%';
      });
      msg += '\n\nℹ️ บทสนทนาข้างต้นอาจให้บริบทเพิ่มเติม แต่ให้ตอบตามคำถามปัจจุบันเป็นหลัก';
    }

    // No data
    if (!contextData.context?.length && !contextData.similarChats?.length) {
      if (isUserOnlyQuery || isUserScoped) {
        msg += '\n\n[เอกสารที่ดึงมาไม่มีข้อมูลที่ตรงกัน]: กรุณาตอบว่าไม่พบข้อมูลนี้ในเอกสาร และแนะนำให้ผู้ใช้อัปโหลดเอกสารที่มีข้อมูลดังกล่าว';
      } else {
        msg += '\n\nไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูล กรุณาตอบตามความรู้ทั่วไปเกี่ยวกับประกันภัย และแนะนำให้ติดต่อผู้เชี่ยวชาญ';
      }
    }

    return msg;
  }

  async generateFallbackResponse(query) {
    try {
      const response = await APIService.sendMessage([
        { role: 'system', content: 'คุณเป็นผู้ช่วยด้านประกันภัยไทย กรุณาตอบคำถามด้วยความรู้ทั่วไป และแนะนำให้ปรึกษาผู้เชี่ยวชาญ' },
        { role: 'user',   content: query }
      ]);
      const fbMsg = response?.message || response?.content || response?.choices?.[0]?.message?.content || null;
      return fbMsg || 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
    } catch (e) {
      return 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
    }
  }

  cleanTableContent(rawContent) {
    if (!rawContent) return rawContent;
    if (!rawContent.toLowerCase().includes('<table')) return rawContent;
    // Strip HTML tags as fallback for any raw HTML that slipped through
    return rawContent.replace(/<[^>]+>/g, ' ').replace(/\s{3,}/g, '\n').trim();
  }

  truncateContent(content, maxLength = 800) {
    if (!content) return '';
    return content.length <= maxLength ? content : content.substring(0, maxLength) + '...';
  }

  calculateAverageScore(contextDocs) {
    if (!contextDocs?.length) return 0;
    return contextDocs.reduce((sum, d) => sum + (d.similarity || 0), 0) / contextDocs.length;
  }

  formatSourceCitations(contextDocs) {
    if (!contextDocs?.length) return '';
    return '\n\nแหล่งข้อมูลที่ใช้:\n' + contextDocs.map(d => '• ' + d.title + ' (' + (d.similarity*100).toFixed(1) + '% เกี่ยวข้อง)').join('\n');
  }

  extractKeywords(text) {
    const terms = ['ประกันภัย','ประกันชีวิต','ประกันรถยนต์','ประกันสุขภาพ','เบี้ยประกัน','ความคุ้มครอง','สิทธิประโยชน์','การเคลม','ผู้เอาประกัน','ผู้รับประโยชน์','กรมธรรม์','การต่ออายุ'];
    return terms.filter(t => text.includes(t));
  }

  extractInsuranceEntities(text) {
    const entities = { insuranceTypes: [], amounts: [], periods: [], companies: [] };
    entities.amounts = text.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:บาท|฿)/g) || [];
    return entities;
  }

  async processComplexQuery(query, options = {}) {
    const keywords    = this.extractKeywords(query);
    const entities    = this.extractInsuranceEntities(query);
    const contextData = await this.retrieveContext(query, options.contextLimit || 5);
    return await this.queryWithRAG(query, { ...options, keywords, entities, contextData });
  }
}

export default new RAGService();