import embeddingService from './embeddingService.js';
import { APIService } from './apiService.js';

class RAGService {
  constructor() {
    this.similarityThreshold = 0.2;
    this.defaultContextLimit = 5;
    this.maxChunkLength = 2500;
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
      const cleanedResponse   = this.cleanResponseFormatting(response.message);
      const normalizedResponse = this.normalizePolicySourceLine(cleanedResponse, contextData.context);

      return {
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
    const keywords = [
      'วงเงิน','จำนวนเงิน','ทุนประกัน','เบี้ยประกัน','ค่าใช้จ่าย','เบี้ย',
      'จ่ายสูงสุด','จ่ายเท่าไหร่','ราคา','ต้องจ่าย','จ่ายเท่าไร',
      'เสียชีวิต','ค่าชดเชย','ผลประโยชน์','สินไหม','เงินเอาประกันภัย'
    ];
    return keywords.some(k => query.toLowerCase().includes(k.toLowerCase()));
  }

  isPremiumRateQuery(query) {
    return /เบี้ย(?:รายเดือน|รายปี)?|จ่ายเดือน|ต้องจ่ายเดือน/.test(query);
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
    if (/เบี้ย|จ่ายเดือน|ต้องจ่าย/.test(query)) {
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
      r += ' เบี้ยประกันภัยรายเดือน ตารางเบี้ย อัตราเบี้ย';

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
          const _isPrem  = /เบี้ย|จ่ายเดือน|ต้องจ่ายเดือน/.test(query);
          const _hasAge  = /อายุ\s*\d+|\b\d{2}\s*ปี/.test(query);
          const _hasSex  = /ชาย|หญิง/.test(query);

          // Bypass similarity when: premium query + age (sex optional — model will ask if missing)
          if (_isPrem && (_hasAge || _hasSex)) {
            const all    = await embeddingService.findSimilarUserContent(query, userId, 20);
            userDocs     = all.slice(0, limit);
            userContextCount = userDocs.length;
            console.log('Premium bypass: ' + userContextCount + ' docs');
          } else {
            const searchLimit = isCoverageQuery ? Math.ceil(limit * 2) : limit;
            const similar     = await embeddingService.findSimilarUserContent(query, userId, searchLimit);
            const threshold   = isCoverageQuery ? 0.05 : this.similarityThreshold;
            userDocs = similar.filter(d => (d.similarity || d.score || 0) >= threshold).slice(0, limit);

            // FALLBACK: if similarity search returns 0 docs, return ALL user docs
            // User uploaded them specifically to be used — never leave them out
            if (userDocs.length === 0 && similar.length > 0) {
              userDocs = similar.slice(0, limit);
              console.log('Similarity fallback: returning all ' + userDocs.length + ' user docs (threshold bypassed)');
            }
            userContextCount = userDocs.length;
            console.log('Found ' + userContextCount + ' docs');
          }
        } catch (e) {
          console.log('No user documents found: ' + e.message);
        }
      }

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
    try {
      const systemMessage = this.buildSystemMessage(contextData, recentMessages);
      console.log('Generating response with context...');
      return await APIService.sendMessage([
        { role: 'system', content: systemMessage },
        { role: 'user',   content: query }
      ]);
    } catch (error) {
      console.error('Error generating RAG response:', error.message);
      throw error;
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
          const short = m.botResponse.length > 500 ? m.botResponse.substring(0, 500) + '...' : m.botResponse;
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

    // User-scoped anti-hallucination
    if (isUserScoped) {
      msg += `

🚨 กฎสำคัญ: ใช้เฉพาะข้อมูลจากเอกสารที่ผู้ใช้อัปโหลด (👤) ด้านล่างเท่านั้น
- ❌ ห้ามใช้ความรู้จาก training data หรือชื่อกรมธรรม์ที่ไม่มีในเอกสาร
- ✅ ถ้าไม่พบข้อมูลในเอกสาร → ตอบว่า "ไม่พบข้อมูลนี้ในเอกสารที่อัปโหลด" เท่านั้น ห้ามเดา`;
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
- ✅ ถ้าไม่มีข้อมูลในเอกสาร → ตอบตรงๆ ว่า "ไม่พบข้อมูล [สิ่งที่ถาม] ในเอกสารที่อัปโหลด"
- ✅ คำนวณได้เฉพาะเมื่อตัวเลขทุกตัวมีใน context พร้อมแสดงสูตรสั้นๆ

📌 คำถาม "เสียชีวิตได้กี่บาท":
- ❌ ห้ามตอบแค่ "ได้รับ X บาท" แล้วจบ
- ✅ แจกแจงทุกกรณีจากตาราง: เสียชีวิตปกติ / อุบัติเหตุ (ทุนประกัน+ADD) / สาธารณภัย / HB รายวัน ฯลฯ
- ✅ ตอบเฉพาะสิ่งที่มีใน context ห้ามสมมติ

📌 วิธีอ่านตารางเบี้ยรายเดือน:
ตารางรูปแบบ: อายุ | ป1ชาย | ป1หญิง | ป2ชาย | ป2หญิง | ป3ชาย | ป3หญิง
(ป1=โครงการ1 ทุน100,000, ป2=โครงการ2 ทุน150,000, ป3=โครงการ3 ทุน200,000)
ตัวอย่าง: 20 | 849 | 833 | 1225 | 1201 | 1601 | 1569 → ป1ชาย=849 ป1หญิง=833 ป2ชาย=1225 ป2หญิง=1201 ป3ชาย=1601 ป3หญิง=1569
ตัวอย่าง: 40 | 885 | 855 | 1279 | 1234 | 1673 | 1613 → ป1ชาย=885 ป1หญิง=855 ป2ชาย=1279 ป2หญิง=1234 ป3ชาย=1673 ป3หญิง=1613
🎯 ขั้นตอน: (1) หาแถวที่ขึ้นต้นด้วยอายุที่ถาม (2) นับค่าที่ 1-6 ตามลำดับ (3) ตอบค่าที่ตรงกับโครงการ+เพศ
❌ ห้ามอ่านผิดแถว ❌ ห้ามสับคอลัมน์ — ค่าที่ 3 = ป2ชาย ไม่ใช่ ป1หญิง
- ถ้าต้องการทราบเบี้ย: ต้องรู้ อายุ/เพศ ถ้าไม่มีให้ถามผู้ใช้ก่อน`;
    }

    // Context documents
    if (contextData.context?.length > 0) {
      msg += '\n\nข้อมูลที่เกี่ยวข้อง (กรุณาอ่านทุกเอกสารอย่างละเอียด):';
      contextData.context.forEach((doc, i) => {
        const pct         = (doc.similarity * 100).toFixed(1);
        const sourceLabel = doc.source === 'user' ? '👤 เอกสารผู้ใช้' : '🏛️ ข้อมูลระบบ';
        const policyLabel = doc.policyName ? ' (' + doc.policyName + ')' : '';
        msg += '\n\n' + (i+1) + '. ' + doc.sourceIcon + ' ' + doc.title + policyLabel + (doc.chunkInfo||'') + ' [' + sourceLabel + ']' +
               '\n   📝 เนื้อหา: ' + doc.content + '\n   🎯 ความเกี่ยวข้อง: ' + pct + '%';
      });
      msg += '\n\nกรุณาอ้างอิงข้อมูลข้างต้นในการตอบ และระบุชื่อเอกสาร/ไฟล์ที่มาของข้อมูล';
    }

    // Similar past chats (skip for amount/premium)
    if (!isUserOnlyQuery && contextData.similarChats?.length > 0) {
      msg += '\n\n🔍 บทสนทนาที่คล้ายกันในอดีต:';
      contextData.similarChats.forEach((chat, i) => {
        const short = chat.botResponse.length > 500 ? chat.botResponse.substring(0,500) + '...' : chat.botResponse;
        msg += '\n\n' + (i+1) + '. คำถาม: ' + chat.userMessage + '\n   คำตอบ: ' + short + '\n   🎯 ความเกี่ยวข้อง: ' + (chat.similarity*100).toFixed(1) + '%';
      });
      msg += '\n\nℹ️ บทสนทนาข้างต้นอาจให้บริบทเพิ่มเติม แต่ให้ตอบตามคำถามปัจจุบันเป็นหลัก';
    }

    // No data
    if (!contextData.context?.length && !contextData.similarChats?.length) {
      if (isUserOnlyQuery || isUserScoped) {
        msg += '\n\n[ไม่พบข้อมูลในเอกสารที่อัปโหลด]: ตอบว่าไม่พบข้อมูลที่ถามในเอกสาร ห้ามใช้ข้อมูลจาก training data ห้ามเดา';
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
      return response.success ? response.message : 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
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