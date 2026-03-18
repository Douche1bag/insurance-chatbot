import embeddingService from './embeddingService.js';
import { APIService } from './apiService.js';

class RAGService {
  constructor() {
    this.similarityThreshold = 0.2; // Minimum similarity score (lowered to 20% for better recall)
    this.maxContextLength = 2000; // Maximum characters for context
    this.defaultContextLimit = 3; 
    this.maxChunkLength = 600; // Maximum length per chunk in context if too much the typhoon gonna blown up
  }

  /**
   * Clean response formatting: remove ### headers and convert ** to ""
   */
  cleanResponseFormatting(text) {
    if (!text) return text;
    
    // Remove ### markdown headers
    let cleaned = text.replace(/###\s*/g, '');
    
    // Convert **bold** to ""quoted""
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '"$1"');
    
    return cleaned;
  }


  normalizePolicySourceLine(text, contextDocs = []) {
    if (!text) return text;

    const pickBestPolicyName = () => {
      if (!Array.isArray(contextDocs) || contextDocs.length === 0) return '';
      // Prioritize user documents
      const bestUserDoc = contextDocs.find(d => (d?.source || '').toLowerCase() === 'user' && d?.policyName);
      const bestAnyDoc = contextDocs.find(d => d?.policyName);
      const policyName = (bestUserDoc?.policyName || bestAnyDoc?.policyName || '').toString().trim();
      return policyName;
    };

    const bestPolicyName = pickBestPolicyName();
    const fallbackTitle = 'นี่คือข้อมูลของระบบโปรดตรวจสอบกรมธรรม์ของคุณอีกครั้ง';

    const shouldReplaceBracket = (bracketText) => {
      const t = (bracketText || '').toString();
      return /ชื่อกรมธรรม์|ไม่ระบุ|ไม่มีชื่อ|unknown|not\s*specified/i.test(t);
    };

    const replaceThai = (input) => {
      return input.replace(/จากกรมธรรม์\s*\[([^\]]+)\]/g, (match, bracketText) => {
        if (!shouldReplaceBracket(bracketText)) return match;
        return `จากกรมธรรม์ ${bestPolicyName || fallbackTitle}`;
      });
    };

    const replaceEnglish = (input) => {
      return input.replace(/From policy\s*\[([^\]]+)\]/gi, (match, bracketText) => {
        if (!shouldReplaceBracket(bracketText)) return match;
        return `From policy ${bestPolicyName || fallbackTitle}`;
      });
    };

    // If the model outputs "จากกรมธรรม์" without any name at all, fill it in.
    const fillBareThai = (input) => {
      return input.replace(/^(\s*จากกรมธรรม์)\s*$/gm, `$1 ${bestPolicyName || fallbackTitle}`);
    };

    return fillBareThai(replaceEnglish(replaceThai(text)));
  }

  /**
   * Main RAG workflow: Retrieve relevant context and generate response
   * Now supports prioritized data (user documents first, then system documents)
   */
  async queryWithRAG(userQuery, options = {}) {
    const {
      contextLimit = this.defaultContextLimit,
      includeScore = true,
      language = 'thai',
      userId = null, // Add user ID for prioritized search
      recentMessages = [] // Conversation history for context
    } = options;

    try {
      console.log('Starting RAG workflow for query:', userQuery);
      
      // Optional: Search for semantically similar past conversations
      let similarPastChats = [];
      if (userId) {
        try {
          similarPastChats = await embeddingService.findSimilarChatHistory(userQuery, userId, 2);
          if (similarPastChats.length > 0) {
            console.log(` Found ${similarPastChats.length} similar past conversations`);
          }
        } catch (chatSearchError) {
          console.log(' Could not search chat history:', chatSearchError.message);
        }
      }
      
      // Step 1: Retrieve relevant context with priority (user docs first)
      const contextData = await this.retrievePrioritizedContext(userQuery, contextLimit, userId);

      // Strict mode: if the request is tied to a user, NEVER pass non-user docs to the model.
      // This guarantees "only this user's uploads" behavior (no system docs, no other users).
      if (userId && contextData?.context?.length) {
        const userOnly = contextData.context.filter(d => d?.source === 'user');
        contextData.context = userOnly;
        contextData.userContextCount = userOnly.length;
        contextData.systemContextCount = 0;
      }

      // Hard-guard: for amount/premium queries, ensure we NEVER pass system docs to the model
      // even if queryType detection upstream changes or documents are mis-labeled.
      if (this.isAmountOrPremiumQuery(userQuery) && contextData?.context?.length) {
        const userOnly = contextData.context.filter(d => d?.source === 'user');
        contextData.context = userOnly;
        contextData.userContextCount = userOnly.length;
        contextData.systemContextCount = 0;
        contextData.queryType = 'amount-premium';
      }
      
      // Add similar past chats to context data
      contextData.similarChats = similarPastChats;
      
      // Step 2: Generate response using retrieved context + conversation history
      const response = await this.generateRAGResponse(userQuery, contextData, language, recentMessages);
      
      // Clean response formatting
      const cleanedResponse = this.cleanResponseFormatting(response.message);
      const normalizedResponse = this.normalizePolicySourceLine(cleanedResponse, contextData.context);
      
      // Step 3: Return complete RAG result
      return {
        success: true,
        query: userQuery,
        response: normalizedResponse,
        context: contextData.context,
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
        success: false,
        query: userQuery,
        error: error.message,
        fallbackResponse: this.normalizePolicySourceLine(
          this.cleanResponseFormatting(await this.generateFallbackResponse(userQuery, language)),
          []
        )
      };
    }
  }

  /**
   * Check if query is about amount or premium (user documents only)
   */
  isAmountOrPremiumQuery(query) {
    const amountKeywords = [
      'วงเงิน', 'จำนวนเงิน', 'ทุนประกัน', 'เบี้ยประกัน', 'ค่าใช้จ่าย','เบี้ย',
      'จ่ายสูงสุด', 'จ่ายเท่าไหร่', 'ราคา', 'ต้องจ่าย', 'จ่ายเท่าไร',
      'เสียชีวิต', 'ค่าชดเชย', 'ผลประโยชน์', 'สินไหม', 'เงินเอาประกันภัย',
      'amount', 'limit', 'premium', 'cost', 'price', 'maximum'
    ];
    
    return amountKeywords.some(keyword => query.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Retrieve prioritized context (user documents first, then system documents)
   * user+sys =5 where this 5 find similarity of the top 3 and used if relevant lessthan that used only relavant
   * CRITICAL: For amount/premium questions, return ONLY user documents
   */
  async retrievePrioritizedContext(query, limit = 5, userId = null) {
    try {
      let userDocs = [];
      let systemDocs = [];
      let userContextCount = 0;
      let systemContextCount = 0;
      
      // Check query type: coverage/general vs amount/premium
      const isAmountOrPremium = this.isAmountOrPremiumQuery(query);
      const isCoverageQuery = this.isCoverageOrAmountQuery(query);
      
      console.log(`Query Type: ${isAmountOrPremium ? ' Amount/Premium (USER ONLY)' : isCoverageQuery ? 'Coverage Query' : 'General'}`);
      
      // Priority 1: Search user documents if userId provided
      if (userId) {
        try {
          const searchLimit = isCoverageQuery ? limit * 1.5 : limit;
          const userSimilar = await embeddingService.findSimilarUserContent(query, userId, searchLimit);
          const relevantUserDocs = userSimilar.filter(doc => {
            const score = doc.similarity || doc.score || 0;
            // Lower threshold for coverage queries to catch more relevant info
            const threshold = isCoverageQuery ? 0.15 : this.similarityThreshold;
            return score >= threshold;
          });
          userDocs = relevantUserDocs.slice(0, limit);
          userContextCount = userDocs.length;
          console.log(`👤 Found ${userContextCount} relevant user documents`);
        } catch (userError) {
          console.log('🔍 No user documents found');
        }
      }
      
      // Priority 2: Search system documents - BUT ONLY IF NOT amount/premium question
      const remaining = Math.max(0, limit - userDocs.length);
      
      // IMPORTANT: This app is configured to use ONLY user-uploaded documents for RAG.
      // We intentionally do NOT fall back to system documents for ANY query type.
      if (isAmountOrPremium) {
        console.log('Amount/Premium query - using user docs only (system docs disabled)');
      } else {
        console.log('User-docs-only mode - system documents disabled');
      }
      
      // Combine user docs (priority) + system docs (fallback only for coverage/general)
      const allDocs = [...userDocs, ...systemDocs];
      
      // Prepare context with content truncation and source marking
      // Truncate chunks to prevent token overflow while preserving key information
      const contextDocs = allDocs.map(doc => ({
        title: doc.title || 'เอกสาร',
        content: this.truncateContent(doc.content, this.maxChunkLength), // Limit chunk size
        similarity: doc.similarity || doc.score || 0,
        id: doc._id || doc.id,
        source: doc.userId ? 'user' : 'system', // Mark document source
        sourceIcon: doc.userId ? '👤' : '🏛️',
        policyName: doc.metadata?.policyName || 'ไม่ระบุชื่อกรมธรรม์', // Include policy name from metadata
        isChunked: doc.metadata?.isChunked || false,
        chunkInfo: doc.metadata?.isChunked ? ` [${doc.metadata.chunkIndex + 1}/${doc.metadata.totalChunks}]` : ''
      }));
      
      console.log(`✅ Retrieved ${contextDocs.length} total documents (${userContextCount} user + ${systemContextCount} system)`);
      
      return {
        context: contextDocs,
        userContextCount,
        systemContextCount,
        totalFound: allDocs.length,
        query: query,
        queryType: isAmountOrPremium ? 'amount-premium' : isCoverageQuery ? 'coverage' : 'general',
        userId: userId || null
      };
    } catch (error) {
      console.error('Error retrieving prioritized context:', error.message);
      return { 
        context: [], 
        userContextCount: 0,
        systemContextCount: 0,
        totalFound: 0, 
        query,
        queryType: 'unknown',
        userId: userId || null
      };
    }
  }

  /**
   * Retrieve relevant context from vector database (legacy method)
   */
  async retrieveContext(query, limit = 3) {
    try {
      const similarDocs = await embeddingService.findSimilarContent(query, limit * 2); // Get more initially
      
      // Filter by similarity threshold
      const relevantDocs = similarDocs.filter(doc => {
        const score = doc.similarity || doc.score || 0;
        return score >= this.similarityThreshold;
      });
      
      // Take only the requested number of best matches
      const topDocs = relevantDocs.slice(0, limit);
      
      // Prepare context with content truncation
      const contextDocs = topDocs.map(doc => ({
        title: doc.title || 'เอกสาร',
        content: this.truncateContent(doc.content, 500),
        similarity: doc.similarity || doc.score || 0,
        id: doc._id || doc.id
      }));

      console.log(`Retrieved ${contextDocs.length} relevant documents`);
      
      return {
        context: contextDocs,
        totalFound: similarDocs.length,
        relevantCount: relevantDocs.length,
        query: query
      };
    } catch (error) {
      console.error('Error retrieving context:', error.message);
      return { context: [], totalFound: 0, relevantCount: 0, query };
    }
  }

  /**
   * Generate response using RAG context
   */
  async generateRAGResponse(query, contextData, language = 'thai-english', recentMessages = []) {
    try {
      const systemMessage = this.buildSystemMessage(contextData, language, recentMessages);
      
      const messagesForAPI = [
        { role: 'system', content: systemMessage },
        { role: 'user', content: query }
      ];

      console.log('🤖 Generating response with context...');
      return await APIService.sendMessage(messagesForAPI);
    } catch (error) {
      console.error('❌ Error generating RAG response:', error.message);
      throw error;
    }
  }

  /**
   * Build system message with retrieved context
   */
  buildSystemMessage(contextData, language = 'thai-english', recentMessages = []) {
    let systemMessage;
    const isUserOnlyQuery = contextData?.queryType === 'amount-premium';
    const isUserScoped = !!contextData?.userId;
    
    // Add conversation context if available
    // IMPORTANT: For amount/premium queries, do NOT use prior conversation
    // (it may contain system-derived info and must not override uploaded docs).
    if (!isUserOnlyQuery && recentMessages && recentMessages.length > 0) {
      const conversationContext = language === 'thai-english' ? 
        '\n\n💬 บทสนทนาที่ผ่านมา:' : 
        '\n\n💬 Recent Conversation:';
      
      let conversationHistory = conversationContext;
      recentMessages.forEach((msg, index) => {
        if (msg.userMessage && msg.botResponse) {
          // Truncate long responses to prevent token overflow
          const truncatedResponse = msg.botResponse.length > 500 
            ? msg.botResponse.substring(0, 500) + '...' 
            : msg.botResponse;
          
          conversationHistory += `\n\n${index + 1}. ผู้ใช้: ${msg.userMessage}\n   ระบบ: ${truncatedResponse}`;
        }
      });
      
      const contextInstruction = language === 'thai-english' ? 
        '\n\n สำคัญ: กรุณาอ้างอิงบริบทจากบทสนทนาก่อนหน้านี้ในการตอบคำถามปัจจุบัน หากผู้ใช้ถามถึงข้อมูลที่เคยพูดคุยไปแล้ว ให้ตอบโดยอิงจากประวัติการสนทนา' :
        '\n\n Important: Please reference context from previous conversation when answering current question. If the user refers to previously discussed information, respond based on conversation history';
      
      systemMessage = conversationHistory + contextInstruction + '\n\n---\n';
    } else {
      systemMessage = '';
    }
    
    if (language === 'thai' || language === 'english') {
      systemMessage += `คุณเป็นผู้ช่วยด้านประกันภัยไทยที่เชี่ยวชาญ ตอบคำถามสั้น กระชับ ตรงประเด็น

 รูปแบบการตอบตามประเภทคำถาม:

**1️ คำถามเรื่องความคุ้มครอง (เช่น "ขาหักคุ้มครองไหม", "อุบัติเหตุจ่ายไหม"):**
- บรรทัดแรก: ✅ "คุ้มครอง" / ❌ "ไม่คุ้มครอง" / ⚠️ "conditional"
- บรรทัดที่สอง: "จากกรมธรรม์ [ชื่อกรมธรรม์]"
- คำอธิบาย 2-3 ประโยค: เหตุผลและเงื่อนไข

**2️ คำถามเรื่องวงเงิน/จำนวนเงิน (ONLY if information exists):**
- บรรทัดแรก: "วงเงิน [จำนวนเงิน] บาท" **(เฉพาะเมื่อมีข้อมูลในเอกสาร)**
- บรรทัดที่สอง: "จากกรมธรรม์ [ชื่อกรมธรรม์]"
- คำอธิบายสั้น: รายละเอียดเพิ่มเติม (ถ้ามี)
- **ถ้าไม่มีข้อมูลวงเงินในเอกสาร ให้ตอบว่า "ข้อมูลวงเงินไม่พบในเอกสาร"**

**3️ คำถามเรื่องเบี้ยประกัน/ค่าใช้จ่าย (ONLY if information exists):**
- บรรทัดแรก: "เบี้ยประกัน [จำนวนเงิน] บาท/[งวด]" **(เฉพาะเมื่อมีข้อมูลในเอกสาร)**
- บรรทัดที่สอง: "จากกรมธรรม์ [ชื่อกรมธรรม์]"
- คำอธิบายสั้น: เงื่อนไขการจ่าย
- **ถ้าไม่มีข้อมูลเบี้ยในเอกสาร ให้ตอบว่า "ข้อมูลเบี้ยประกันไม่พบในเอกสาร"**

**4️ คำถามทั่วไป/รายละเอียดอื่นๆ:**
- เริ่มด้วยคำตอบโดยตรง
- ระบุแหล่งที่มา (กรมธรรม์)
- อธิบายสั้นๆ 2-4 ประโยค

  หลักการสำคัญ:
1. **ให้ความสำคัญกับเอกสารผู้ใช้ (👤) เป็นอันดับแรก** - นี่คือกรมธรรม์จริง
2. **เริ่มด้วยคำตอบเสมอ** - อย่าขึ้นต้นด้วย "จากข้อมูล..." หรือ "ตามเอกสาร..."
3. **ตอบสั้น 3-6 ประโยค** - ไม่เกิน 10 ประโยค
4. **ระบุชื่อกรมธรรม์เสมอ** - บอกว่าข้อมูลมาจากกรมธรรม์ไหน
5. **มุ่งเน้นตามคำถาม** - ถ้าถามอุบัติเหตุก็ตอบอุบัติเหตุ อย่าพูดถึงโรค

  อย่าทำ:
- อย่าเขียนยาวเกิน 10 ประโยค
- อย่าพูดนอกเรื่อง (ถามอุบัติเหตุแต่ตอบเรื่องโรค)
- อย่าแนะนำให้ส่งเอกสารเพิ่ม ถ้ามีข้อมูลพอตอบ
- อย่าใช้หัวข้อ ### หรือจัดรูปแบบซับซ้อน`;
    } else {
      systemMessage += `You are a Thai insurance assistant specializing in accident coverage assessment.

📋 Response Format (Keep it SHORT and DIRECT):

**First Line - Clear Answer:**
✅ "คุ้มครอง" (Covered) - if insurance pays
❌ "ไม่คุ้มครอง" (Not covered) - if insurance doesn't pay
⚠️ "conditional" - if conditions need verification

**Second Line - Source:**
"From policy [Policy Name/Type]"

**Brief Explanation (2-3 sentences only):**
- Why covered/not covered
- Important conditions (if any)
- Reference policy clause (if available)

⚠️ Key Rules:
1. Prioritize user documents (👤) - these are real policies
2. **Answer SHORT, CONCISE, CLEAR** - don't write long
3. **Start with answer** - covered/not covered/conditional
4. **Focus on accidents** - don't mention diseases unless asked
5. **Cite policy name** - specify which policy`;
    }
    
    if (isUserOnlyQuery) {
      systemMessage += language === 'thai-english'
        ? `\n\n❗กฎสำคัญเพิ่มเติมสำหรับคำถาม "วงเงิน/จำนวนเงิน" และ "เบี้ยประกัน/ค่าใช้จ่าย":\n- ใช้ข้อมูลจากเอกสารผู้ใช้ (👤) เท่านั้น\n- ห้ามใช้ข้อมูลระบบ (🏛️), ความรู้ทั่วไป, หรือบทสนทนาเดิมเพื่อเดาตัวเลข\n- ถ้าเอกสารผู้ใช้ไม่มีตัวเลขที่ถาม ให้ตอบว่า "ข้อมูลวงเงิน/เบี้ยประกันไม่พบในเอกสารที่แนบมา"`
        : `\n\n❗Additional strict rule for amount/premium questions:\n- Use ONLY user documents (👤)\n- Do NOT use system docs (🏛️), general knowledge, or prior chat to guess numbers\n- If the uploaded docs don't contain the requested number, say it is not found in the uploaded documents.`;

      systemMessage += language === 'thai-english'
        ? `\n- ✅ อนุญาตให้ "คำนวณ" ได้ เฉพาะเมื่อมีตัวเลขครบในเอกสารผู้ใช้ เช่น เบี้ย/ปี และจำนวนปี: ให้แสดงวิธีคิดสั้นๆ (เช่น 100,000 × 15 = 1,500,000)\n- ❌ ห้ามสมมติค่าที่ไม่มีในเอกสาร (เช่น อัตราผลตอบแทน, ตารางมูลค่าเวนคืน, โบนัส)`
        : `\n- ✅ You MAY do arithmetic ONLY when all required numbers are present in the user docs; show a short formula.\n- ❌ Do NOT assume missing values (no rates, surrender tables, bonuses, etc.).`;

      // Critical: prevent the common hallucination "premium × years = death benefit"
      systemMessage += language === 'thai-english'
        ? `\n- ❌ ห้ามสรุปว่า "เบี้ยรวม (เบี้ย×ปี)" = "ทุนประกัน/ผลประโยชน์กรณีเสียชีวิต" เว้นแต่เอกสารระบุชัดเจนว่าเท่ากัน\n- ✅ ถ้าคำถามถาม "เสียชีวิตได้กี่บาท/ทุนประกันเท่าไหร่" ให้ตอบตามช่อง "ผลประโยชน์กรณีเสียชีวิต/เงินเอาประกันภัย" ในตารางของเอกสารเท่านั้น`
        : `\n- ❌ Never assume "total premium paid (premium×years)" equals "sum assured / death benefit" unless the document explicitly states so.\n- ✅ For death benefit / sum assured questions, answer ONLY from the document's stated death benefit / sum assured fields (often in a benefits table).`;

      // ── AIA-specific mapping guidance (FIXED) ──────────────────────────────
      systemMessage += language === 'thai-english'
        ? `\n- 🔎 ถ้าเอกสารมีตาราง "โครงการ 1/2/3" หรือ "จำนวนเงินเอาประกันภัยรวม 100,000 / 150,000 / 200,000":
  - ⚠️ กฎสำคัญ: ตัวเลข 100,000 / 150,000 / 200,000 ในเอกสาร AIA15PAY30 คือ "จำนวนเงินเอาประกันภัย (Sum Assured)" ไม่ใช่เบี้ยรายปี เพราะเบี้ยจริงอยู่ในตารางเบี้ย (หลักร้อย-พัน บาท/เดือน)
  - ถ้าผู้ใช้พูดว่า "จ่ายเบี้ยปีละ 100,000" หรือ "เบี้ย 100,000" ให้ตีความว่าผู้ใช้เลือก "โครงการ 1 จำนวนเงินเอาประกันภัย 100,000 บาท" แล้วตอบผลประโยชน์จากตารางโครงการ 1
  - สำหรับ "เสียชีวิตปีที่ X ได้กี่บาท" ในโครงการ 1 (Sum Assured 100,000) ให้แจกแจงตามสาเหตุการเสียชีวิต:
    * เสียชีวิตปกติ/โรคภัย/ไข้เจ็บ = 100,000 บาท (จำนวนเงินเอาประกันภัย)
    * เสียชีวิตจากอุบัติเหตุทั่วไป = 100,000 + 100,000 (ADD/RCC) = 200,000 บาท
    * เสียชีวิตจากอุบัติเหตุสาธารณภัย (รถ, รถไฟ, ลิฟท์ฯ) = 100,000 + 200,000 (ADD สาธารณภัย) = 300,000 บาท
    * บวกเพิ่ม HB 500 บาท/วัน หากต้องรักษาตัวในโรงพยาบาล (สูงสุด 365 วัน)
  - เช่นเดียวกันสำหรับโครงการ 2 (150,000) และโครงการ 3 (200,000) ให้คูณสัดส่วนตาม Sum Assured ของโครงการนั้น
  - ถ้าผู้ใช้ถามถึงเบี้ยจริงๆ (ต้องการทราบว่าต้องจ่ายเบี้ยเท่าไหร่): ต้องใช้ตารางเบี้ย ซึ่งต้องรู้ อายุ/เพศ ถ้าไม่มีข้อมูลดังกล่าวในคำถาม ให้ถามผู้ใช้ก่อน`
        : `\n- 🔎 AIA15PAY30 Plan Tables — CRITICAL RULE:
  - ⚠️ 100,000 / 150,000 / 200,000 in AIA15PAY30 docs = Sum Assured (จำนวนเงินเอาประกันภัย), NOT annual premium. Actual premiums are hundreds of baht/month per the separate premium rate table.
  - If user says "pay premium 100,000/year" or "premium 100,000" → interpret as: user chose Plan 1 (Sum Assured = 100,000 baht). Answer benefits from Plan 1 column.
  - For "death in year X" under Plan 1 (Sum Assured 100,000), break down by cause:
    * Natural / illness death = 100,000 baht
    * General accidental death = 100,000 + 100,000 (ADD/RCC rider) = 200,000 baht
    * Public accident death (bus, train, lift, etc.) = 100,000 + 200,000 (public ADD) = 300,000 baht
    * Plus HB rider: 500 baht/day if hospitalized (max 365 days)
  - Same logic applies to Plan 2 (150,000) and Plan 3 (200,000) — scale benefits proportionally.
  - If user genuinely asks about the actual monthly/annual premium cost: requires age + sex from the rate table. If not provided, ask the user before answering.`;
    }

    if (contextData.context && contextData.context.length > 0) {
      const contextSection = language === 'thai-english' ? 
        '\n\n ข้อมูลที่เกี่ยวข้อง (กรุณาอ่านทุกเอกสารอย่างละเอียด):' : 
        '\n\n Relevant Information (Please read all documents carefully):';
      
      systemMessage += contextSection;
      
      contextData.context.forEach((doc, index) => {
        const similarityPercent = (doc.similarity * 100).toFixed(1);
        const sourceLabel = doc.source === 'user' ? '👤 เอกสารผู้ใช้' : '🏛️ ข้อมูลระบบ';
        const chunkLabel = doc.chunkInfo || '';
        const policyLabel = doc.policyName ? ` (${doc.policyName})` : '';
        systemMessage += `\n\n${index + 1}. ${doc.sourceIcon} ${doc.title}${policyLabel}${chunkLabel} [${sourceLabel}]\n   📝 เนื้อหา: ${doc.content}\n   🎯 ความเกี่ยวข้อง: ${similarityPercent}%`;
      });
      
      const instruction = language === 'thai-english' ? 
        '\n\n คำแนะนำ: กรุณาอ้างอิงข้อมูลข้างต้นในการตอบ และระบุแหล่งข้อมูลที่ใช้' :
        '\n\n Instructions: Please reference the above information in your response and cite the sources used';
      
      systemMessage += instruction;
    }
    
    // Add similar past conversations if available
    // IMPORTANT: For amount/premium queries, do NOT include similar chats
    // (they may contain system-derived answers and must not influence numeric outputs).
    if (!isUserOnlyQuery && contextData.similarChats && contextData.similarChats.length > 0) {
      const similarChatsSection = language === 'thai-english' ? 
        '\n\n🔍 บทสนทนาที่คล้ายกันในอดีต:' : 
        '\n\n🔍 Similar Past Conversations:';
      
      systemMessage += similarChatsSection;
      
      contextData.similarChats.forEach((chat, index) => {
        const similarityPercent = (chat.similarity * 100).toFixed(1);
        // Truncate long responses to prevent token overflow
        const truncatedResponse = chat.botResponse.length > 500 
          ? chat.botResponse.substring(0, 500) + '...' 
          : chat.botResponse;
        
        systemMessage += `\n\n${index + 1}. คำถาม: ${chat.userMessage}\n   คำตอบ: ${truncatedResponse}\n   🎯 ความเกี่ยวข้อง: ${similarityPercent}%`;
      });
      
      const chatInstruction = language === 'thai-english' ? 
        '\n\n ℹ️ หมายเหตุ: บทสนทนาที่คล้ายกันข้างต้นอาจให้บริบทเพิ่มเติม แต่ให้ตอบตามคำถามปัจจุบันเป็นหลัก' :
        '\n\n ℹ️ Note: The similar conversations above may provide additional context, but prioritize answering the current question';
      
      systemMessage += chatInstruction;
    }
    
    if ((contextData.context && contextData.context.length === 0) && (!contextData.similarChats || contextData.similarChats.length === 0)) {
      const noDataMessage = isUserOnlyQuery
        ? (language === 'thai-english'
          ? '\n\n ไม่พบข้อมูลที่เกี่ยวข้องในเอกสารผู้ใช้ (👤) ที่แนบมา: กรุณาตอบว่า "ข้อมูลวงเงิน/เบี้ยประกันไม่พบในเอกสารที่แนบมา" และอย่าคาดเดาตัวเลข'
          : '\n\n No relevant info found in uploaded user documents (👤). Reply that the amount/premium is not found in the uploaded documents and do not guess numbers.')
        : (isUserScoped
          ? (language === 'thai-english'
            ? '\n\n ไม่พบข้อมูลที่เกี่ยวข้องในเอกสารที่คุณอัปโหลด (👤) สำหรับบัญชีนี้ จึงไม่สามารถตอบจากข้อมูลอื่นได้'
            : '\n\n No relevant information found in YOUR uploaded documents (👤) for this account, so do not use other sources.')
          : (language === 'thai-english'
            ? '\n\n ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูล กรุณาตอบตามความรู้ทั่วไปเกี่ยวกับประกันภัย และแนะนำให้ติดต่อผู้เชี่ยวชาญสำหรับข้อมูลที่แม่นยำ'
            : '\n\n No relevant information found in database. Please answer based on general insurance knowledge and recommend consulting an expert for accurate information'));
      
      systemMessage += noDataMessage;
    }

    return systemMessage;
  }

  /**
   * Generate fallback response when RAG fails
   */
  async generateFallbackResponse(query, language = 'thai-english') {
    try {
      const fallbackSystemMessage = language === 'thai-english' ? 
        'คุณเป็นผู้ช่วยด้านประกันภัยไทย กรุณาตอบคำถามด้วยความรู้ทั่วไป และแนะนำให้ปรึกษาผู้เชี่ยวชาญ' :
        'You are a Thai insurance assistant. Please answer with general knowledge and recommend consulting an expert';

      const response = await APIService.sendMessage([
        { role: 'system', content: fallbackSystemMessage },
        { role: 'user', content: query }
      ]);

      return response.success ? response.message : 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
    } catch (error) {
      console.error('Fallback response error:', error.message);
      return 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
    }
  }

  /**
   * Check if query is about coverage or general insurance questions
   */
  isCoverageOrAmountQuery(query) {
    const coverageKeywords = [
      'ความคุ้มครอง', 'คุ้มครอง', 'อุบัติเหตุ', 'โรค', 'ป่วย', 'พิการ',
      'สิทธิประโยชน์', 'สิทธิ', 'เคลม', 'โครง', 'ซ่อม',
      'coverage', 'accident', 'disease', 'illness', 'disability', 'benefit', 'claim'
    ];
    
    return coverageKeywords.some(keyword => query.toLowerCase().includes(keyword.toLowerCase()));
  }

  /**
   * Utility methods
   */
  truncateContent(content, maxLength = 800) {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  }

  calculateAverageScore(contextDocs) {
    if (!contextDocs || contextDocs.length === 0) return 0;
    const total = contextDocs.reduce((sum, doc) => sum + (doc.similarity || 0), 0);
    return total / contextDocs.length;
  }

  formatSourceCitations(contextDocs) {
    if (!contextDocs || contextDocs.length === 0) return '';
    
    const citations = contextDocs.map((doc, index) => 
      `• ${doc.title} (${(doc.similarity * 100).toFixed(1)}% เกี่ยวข้อง)`
    ).join('\n');
    
    return `\n\n แหล่งข้อมูลที่ใช้:\n${citations}`;
  }

  /**
   * Advanced query processing
   */
  async processComplexQuery(query, options = {}) {
    // Extract keywords and entities
    const keywords = this.extractKeywords(query);
    const entities = this.extractInsuranceEntities(query);
    
    // Enhanced context retrieval based on keywords
    const contextData = await this.retrieveContext(query, options.contextLimit || 5);
    
    // Generate response with enhanced context
    return await this.queryWithRAG(query, {
      ...options,
      keywords,
      entities,
      contextData
    });
  }

  extractKeywords(text) {
    // Simple Thai keyword extraction
    const commonInsuranceTerms = [
      'ประกันภัย', 'ประกันชีวิต', 'ประกันรถยนต์', 'ประกันสุขภาพ',
      'เบี้ยประกัน', 'ความคุ้มครอง', 'สิทธิประโยชน์', 'การเคลม',
      'ผู้เอาประกัน', 'ผู้รับประโยชน์', 'กรมธรรม์', 'การต่ออายุ'
    ];
    
    return commonInsuranceTerms.filter(term => text.includes(term));
  }

  extractInsuranceEntities(text) {
    // Extract insurance-specific entities
    const entities = {
      insuranceTypes: [],
      amounts: [],
      periods: [],
      companies: []
    };
    
    // Simple pattern matching for amounts (฿, บาท)
    const amountPattern = /(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*(?:บาท|฿)/g;
    const amounts = text.match(amountPattern) || [];
    entities.amounts = amounts;
    
    return entities;
  }
}

export default new RAGService();