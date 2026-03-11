import embeddingService from './embeddingService.js';
import { APIService } from './apiService.js';

class RAGService {
  constructor() {
    this.similarityThreshold = 0.2; // Minimum similarity score (lowered to 20% for better recall)
    this.maxContextLength = 2000; // Maximum characters for context
    this.defaultContextLimit = 3; // Default number of similar documents to retrieve
    this.maxChunkLength = 600; // Maximum length per chunk in context
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
      console.log('🔍 Starting RAG workflow for query:', userQuery);
      
      // Optional: Search for semantically similar past conversations
      let similarPastChats = [];
      if (userId) {
        try {
          similarPastChats = await embeddingService.findSimilarChatHistory(userQuery, userId, 2);
          if (similarPastChats.length > 0) {
            console.log(`💭 Found ${similarPastChats.length} similar past conversations`);
          }
        } catch (chatSearchError) {
          console.log('⚠️ Could not search chat history:', chatSearchError.message);
        }
      }
      
      // Step 1: Retrieve relevant context with priority (user docs first)
      const contextData = await this.retrievePrioritizedContext(userQuery, contextLimit, userId);
      
      // Add similar past chats to context data
      contextData.similarChats = similarPastChats;
      
      // Step 2: Generate response using retrieved context + conversation history
      const response = await this.generateRAGResponse(userQuery, contextData, language, recentMessages);
      
      // Clean response formatting
      const cleanedResponse = this.cleanResponseFormatting(response.message);
      
      // Step 3: Return complete RAG result
      return {
        success: true,
        query: userQuery,
        response: cleanedResponse,
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
      console.error('❌ RAG workflow error:', error.message);
      return {
        success: false,
        query: userQuery,
        error: error.message,
        fallbackResponse: this.cleanResponseFormatting(await this.generateFallbackResponse(userQuery, language))
      };
    }
  }

  /**
   * Retrieve prioritized context (user documents first, then system documents)
   */
  async retrievePrioritizedContext(query, limit = 5, userId = null) {
    try {
      let userDocs = [];
      let systemDocs = [];
      let userContextCount = 0;
      let systemContextCount = 0;
      
      // Check if query is about coverage or amounts (special handling)
      const isCoverageQuery = this.isCoverageOrAmountQuery(query);
      const searchLimit = isCoverageQuery ? limit * 1.5 : limit; // Search slightly more docs for coverage queries
      
      // Priority 1: Search user documents if userId provided
      if (userId) {
        try {
          const userSimilar = await embeddingService.findSimilarUserContent(query, userId, searchLimit);
          const relevantUserDocs = userSimilar.filter(doc => {
            const score = doc.similarity || doc.score || 0;
            // Lower threshold for coverage queries to catch more relevant info
            const threshold = isCoverageQuery ? 0.15 : this.similarityThreshold;
            return score >= threshold;
          });
          userDocs = relevantUserDocs.slice(0, limit);
          userContextCount = userDocs.length;
          console.log(`👤 Found ${userContextCount} relevant user documents (coverage query: ${isCoverageQuery})`);
        } catch (userError) {
          console.log('🔍 No user documents found, proceeding to system docs');
        }
      }
      
      // Priority 2: Search system documents if we need more context
      const remaining = Math.max(0, limit - userDocs.length);
      if (remaining > 0) {
        try {
          const systemSimilar = await embeddingService.findSimilarContent(query, remaining * 2);
          const relevantSystemDocs = systemSimilar.filter(doc => {
            const score = doc.similarity || doc.score || 0;
            return score >= this.similarityThreshold;
          });
          systemDocs = relevantSystemDocs.slice(0, remaining);
          systemContextCount = systemDocs.length;
          console.log(`🏛️ Found ${systemContextCount} relevant system documents`);
        } catch (systemError) {
          console.error('❌ Error searching system documents:', systemError.message);
        }
      }
      
      // Combine user docs (priority) + system docs (fallback)
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
        isChunked: doc.metadata?.isChunked || false,
        chunkInfo: doc.metadata?.isChunked ? ` [${doc.metadata.chunkIndex + 1}/${doc.metadata.totalChunks}]` : ''
      }));
      
      console.log(`📄 Retrieved ${contextDocs.length} total documents (${userContextCount} user + ${systemContextCount} system)`);
      
      return {
        context: contextDocs,
        userContextCount,
        systemContextCount,
        totalFound: allDocs.length,
        query: query
      };
    } catch (error) {
      console.error('❌ Error retrieving prioritized context:', error.message);
      return { 
        context: [], 
        userContextCount: 0,
        systemContextCount: 0,
        totalFound: 0, 
        query 
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

      console.log(`📄 Retrieved ${contextDocs.length} relevant documents`);
      
      return {
        context: contextDocs,
        totalFound: similarDocs.length,
        relevantCount: relevantDocs.length,
        query: query
      };
    } catch (error) {
      console.error('❌ Error retrieving context:', error.message);
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
    
    // Add conversation context if available
    if (recentMessages && recentMessages.length > 0) {
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
        '\n\n⚠️ สำคัญ: กรุณาอ้างอิงบริบทจากบทสนทนาก่อนหน้านี้ในการตอบคำถามปัจจุบัน หากผู้ใช้ถามถึงข้อมูลที่เคยพูดคุยไปแล้ว ให้ตอบโดยอิงจากประวัติการสนทนา' :
        '\n\n⚠️ Important: Please reference context from previous conversation when answering current question. If the user refers to previously discussed information, respond based on conversation history';
      
      systemMessage = conversationHistory + contextInstruction + '\n\n---\n';
    } else {
      systemMessage = '';
    }
    
    if (language === 'thai' || language === 'english') {
      systemMessage += `คุณเป็นผู้ช่วยด้านประกันภัยไทยที่เชี่ยวชาญ ตอบคำถามสั้น กระชับ ตรงประเด็น

📋 รูปแบบการตอบตามประเภทคำถาม:

**1️⃣ คำถามเรื่องความคุ้มครอง (เช่น "ขาหักคุ้มครองไหม", "อุบัติเหตุจ่ายไหม"):**
- บรรทัดแรก: ✅ "คุ้มครอง" / ❌ "ไม่คุ้มครอง" / ⚠️ "conditional"
- บรรทัดที่สอง: "จากกรมธรรม์ [ชื่อกรมธรรม์]"
- คำอธิบาย 2-3 ประโยค: เหตุผลและเงื่อนไข

**2️⃣ คำถามเรื่องวงเงิน/จำนวนเงิน (เช่น "วงเงินประกันเท่าไหร่", "จ่ายสูงสุดเท่าไร"):**
- บรรทัดแรก: "วงเงิน [จำนวนเงิน] บาท"
- บรรทัดที่สอง: "จากกรมธรรม์ [ชื่อกรมธรรม์]"
- คำอธิบายสั้น: รายละเอียดเพิ่มเติม (ถ้ามี)

**3️⃣ คำถามเรื่องเบี้ยประกัน/ค่าใช้จ่าย:**
- บรรทัดแรก: "เบี้ยประกัน [จำนวนเงิน] บาท/[งวด]"
- บรรทัดที่สอง: "จากกรมธรรม์ [ชื่อกรมธรรม์]"
- คำอธิบายสั้น: เงื่อนไขการจ่าย

**4️⃣ คำถามทั่วไป/รายละเอียดอื่นๆ:**
- เริ่มด้วยคำตอบโดยตรง
- ระบุแหล่งที่มา (กรมธรรม์)
- อธิบายสั้นๆ 2-4 ประโยค

⚠️ หลักการสำคัญ:
1. **ให้ความสำคัญกับเอกสารผู้ใช้ (👤) เป็นอันดับแรก** - นี่คือกรมธรรม์จริง
2. **เริ่มด้วยคำตอบเสมอ** - อย่าขึ้นต้นด้วย "จากข้อมูล..." หรือ "ตามเอกสาร..."
3. **ตอบสั้น 3-6 ประโยค** - ไม่เกิน 10 ประโยค
4. **ระบุชื่อกรมธรรม์เสมอ** - บอกว่าข้อมูลมาจากกรมธรรม์ไหน
5. **มุ่งเน้นตามคำถาม** - ถ้าถามอุบัติเหตุก็ตอบอุบัติเหตุ อย่าพูดถึงโรค

❌ อย่าทำ:
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

    if (contextData.context && contextData.context.length > 0) {
      const contextSection = language === 'thai-english' ? 
        '\n\n ข้อมูลที่เกี่ยวข้อง (กรุณาอ่านทุกเอกสารอย่างละเอียด):' : 
        '\n\n Relevant Information (Please read all documents carefully):';
      
      systemMessage += contextSection;
      
      contextData.context.forEach((doc, index) => {
        const similarityPercent = (doc.similarity * 100).toFixed(1);
        const sourceLabel = doc.source === 'user' ? '👤 เอกสารผู้ใช้' : '🏛️ ข้อมูลระบบ';
        const chunkLabel = doc.chunkInfo || '';
        systemMessage += `\n\n${index + 1}. ${doc.sourceIcon} ${doc.title}${chunkLabel} [${sourceLabel}]\n   📝 เนื้อหา: ${doc.content}\n   🎯 ความเกี่ยวข้อง: ${similarityPercent}%`;
      });
      
      const instruction = language === 'thai-english' ? 
        '\n\n คำแนะนำ: กรุณาอ้างอิงข้อมูลข้างต้นในการตอบ และระบุแหล่งข้อมูลที่ใช้' :
        '\n\n Instructions: Please reference the above information in your response and cite the sources used';
      
      systemMessage += instruction;
    }
    
    // Add similar past conversations if available
    if (contextData.similarChats && contextData.similarChats.length > 0) {
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
      const noDataMessage = language === 'thai-english' ? 
        '\n\n ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูล กรุณาตอบตามความรู้ทั่วไปเกี่ยวกับประกันภัย และแนะนำให้ติดต่อผู้เชี่ยวชาญสำหรับข้อมูลที่แม่นยำ' :
        '\n\n No relevant information found in database. Please answer based on general insurance knowledge and recommend consulting an expert for accurate information';
      
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
      console.error('❌ Fallback response error:', error.message);
      return 'ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง';
    }
  }

  /**
   * Check if query is about coverage or insurance amounts
   */
  isCoverageOrAmountQuery(query) {
    const coverageKeywords = [
      'ความคุ้มครอง', 'คุ้มครอง', 'วงเงิน', 'จำนวนเงิน',
      'ทุนประกัน', 'เบี้ยประกัน', 'ค่าใช้จ่าย', 'จ่ายสูงสุด',
      'จ่ายเท่าไหร่', 'ได้เงิน', 'เคลม', 'สิทธิประโยชน์',
      'coverage', 'amount', 'limit', 'benefit', 'claim'
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
    
    return `\n\n📚 แหล่งข้อมูลที่ใช้:\n${citations}`;
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

