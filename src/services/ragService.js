import embeddingService from './embeddingService.js';
import { APIService } from './apiService.js';

class RAGService {
  constructor() {
    this.similarityThreshold = 0.3; // Minimum similarity score for relevant content
    this.maxContextLength = 2000; // Maximum characters for context
    this.defaultContextLimit = 3; // Default number of similar documents to retrieve
  }

  /**
   * Main RAG workflow: Retrieve relevant context and generate response
   */
  async queryWithRAG(userQuery, options = {}) {
    const {
      contextLimit = this.defaultContextLimit,
      includeScore = true,
      language = 'thai'
    } = options;

    try {
      console.log('🔍 Starting RAG workflow for query:', userQuery);
      
      // Step 1: Retrieve relevant context from vector database
      const contextData = await this.retrieveContext(userQuery, contextLimit);
      
      // Step 2: Generate response using retrieved context
      const response = await this.generateRAGResponse(userQuery, contextData, language);
      
      // Step 3: Return complete RAG result
      return {
        success: true,
        query: userQuery,
        response: response.message,
        context: contextData.context,
        metadata: {
          contextFound: contextData.context.length > 0,
          contextCount: contextData.context.length,
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
        fallbackResponse: await this.generateFallbackResponse(userQuery, language)
      };
    }
  }

  /**
   * Retrieve relevant context from vector database
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
  async generateRAGResponse(query, contextData, language = 'thai') {
    try {
      const systemMessage = this.buildSystemMessage(contextData, language);
      
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
  buildSystemMessage(contextData, language = 'thai') {
    let systemMessage;
    
    if (language === 'thai') {
      systemMessage = `คุณเป็นผู้ช่วยด้านประกันภัยไทยที่มีความเชี่ยวชาญ กรุณาตอบคำถามโดยใช้ข้อมูลที่เกี่ยวข้องนี้:

📋 หลักการตอบคำถาม:
1. ใช้ข้อมูลจากแหล่งที่เชื่อถือได้เป็นหลัก
2. อธิบายอย่างชัดเจนและเข้าใจง่าย
3. ระบุแหล่งข้อมูลที่ใช้
4. หากไม่แน่ใจ ให้แนะนำติดต่อผู้เชี่ยวชาญ`;
    } else {
      systemMessage = `You are a knowledgeable Thai insurance assistant. Please answer questions using the following relevant information:

📋 Response Guidelines:
1. Use information from reliable sources as the primary basis
2. Explain clearly and simply
3. Cite sources used
4. If uncertain, recommend consulting an expert`;
    }

    if (contextData.context && contextData.context.length > 0) {
      const contextSection = language === 'thai' ? 
        '\n\n📚 ข้อมูลที่เกี่ยวข้อง:' : 
        '\n\n📚 Relevant Information:';
      
      systemMessage += contextSection;
      
      contextData.context.forEach((doc, index) => {
        const similarityPercent = (doc.similarity * 100).toFixed(1);
        systemMessage += `\n\n${index + 1}. 📄 ${doc.title}\n   📝 เนื้อหา: ${doc.content}\n   🎯 ความเกี่ยวข้อง: ${similarityPercent}%`;
      });
      
      const instruction = language === 'thai' ? 
        '\n\n⚠️ คำแนะนำ: กรุณาอ้างอิงข้อมูลข้างต้นในการตอบ และระบุแหล่งข้อมูลที่ใช้' :
        '\n\n⚠️ Instructions: Please reference the above information in your response and cite the sources used';
      
      systemMessage += instruction;
    } else {
      const noDataMessage = language === 'thai' ? 
        '\n\n⚠️ ไม่พบข้อมูลที่เกี่ยวข้องในฐานข้อมูล กรุณาตอบตามความรู้ทั่วไปเกี่ยวกับประกันภัย และแนะนำให้ติดต่อผู้เชี่ยวชาญสำหรับข้อมูลที่แม่นยำ' :
        '\n\n⚠️ No relevant information found in database. Please answer based on general insurance knowledge and recommend consulting an expert for accurate information';
      
      systemMessage += noDataMessage;
    }

    return systemMessage;
  }

  /**
   * Generate fallback response when RAG fails
   */
  async generateFallbackResponse(query, language = 'thai') {
    try {
      const fallbackSystemMessage = language === 'thai' ? 
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
   * Utility methods
   */
  truncateContent(content, maxLength = 500) {
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