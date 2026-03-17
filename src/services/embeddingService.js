import mongoService from './mongoService.js';

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.VITE_API_KEY;
    this.baseUrl = process.env.VITE_API_BASE_URL;
  }

  // Generate text embeddings using Typhoon API (with fallback)
  async generateEmbedding(text) {
    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          input: text,
          model: "text-embedding-ada-002", 
          encoding_format: "float"
        })
      });

      if (!response.ok) {
        console.log(`Embedding API unavailable (${response.status}), using fallback method`);
        return this.generateSimpleEmbedding(text);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.log(`Embedding API error (${error.message}), using fallback method`);
      // Fallback to a simple hash-based embedding for demo purposes
      return this.generateSimpleEmbedding(text);
    }
  }

  // Fallback: Generate a simple numeric representation (384 dims to match system docs)
  generateSimpleEmbedding(text, dimensions = 384) {
    // Safety check for undefined/null text
    if (!text || typeof text !== 'string') {
      console.warn('Invalid text for embedding, using empty string');
      text = '';
    }
    
    const embedding = new Array(dimensions).fill(0);
    
    // Simple hash-based embedding
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      const index = char % dimensions;
      embedding[index] += Math.sin(char * 0.1) * Math.cos(i * 0.1);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => magnitude > 0 ? val / magnitude : 0);
  }

  // Calculate cosine similarity between two vectors
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimension');
    }

    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
  }

  // Store chat with embedding
  async storeChatWithEmbedding(userId, message, response) {
    try {
      const messageEmbedding = await this.generateEmbedding(message);
      const responseEmbedding = await this.generateEmbedding(response);
      Í
      return await mongoService.storeChatMessage(
        userId, 
        message, 
        response, 
        {
          messageEmbedding,
          responseEmbedding,
          combinedEmbedding: this.combineEmbeddings(messageEmbedding, responseEmbedding)
        }
      );
    } catch (error) {
      console.error('Error storing chat with embedding:', error.message);
      throw error;
    }
  }

  // Store document with embedding for RAG
  async storeDocumentWithEmbedding(title, content, metadata = {}) {
    try {
      const embedding = await this.generateEmbedding(content);
      return await mongoService.storeDocument(title, content, embedding, {
        ...metadata,
        embeddingMethod: 'typhoon-api',
        embeddingDimensions: embedding.length
      });
    } catch (error) {
      console.error('Error storing document with embedding:', error.message);
      throw error;
    }
  }

  // Find similar content using embeddings with enhanced scoring
  async findSimilarContent(query, limit = 5) {
    try {
      console.log(`🔍 Searching for content similar to: "${query}"`);
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Try vector search first 
      try {
        const results = await mongoService.vectorSearch(queryEmbedding, limit);
        console.log(`Vector search returned ${results.length} results`);
        return results;
      } catch (vectorError) {
        console.warn('Vector search not available, using fallback method');
        
        // Fallback: Manual similarity calculation
        const results = await this.manualSimilaritySearch(queryEmbedding, limit);
        console.log(`Manual search returned ${results.length} results`);
        return results;
      }
    } catch (error) {
      console.error('Error finding similar content:', error.message);
      throw error;
    }
  }

  // Manual similarity search (when Atlas Search is not available)
  async manualSimilaritySearch(queryEmbedding, limit = 5) {
    try {
      console.log('Performing manual similarity search...');
      const db = await mongoService.connect();
      const collection = db.collection('thai_insurance_docs');
      
      const documents = await collection.find({}).toArray();
      console.log(`Found ${documents.length} documents in database`);
      
      if (documents.length === 0) {
        console.log('No documents found in database');
        return [];
      }
      
      const similarities = documents
        .filter(doc => doc.embedding && Array.isArray(doc.embedding))
        .map(doc => {
          const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
          return {
            ...doc,
            similarity: similarity,
            score: similarity // Add score field for compatibility
          };
        })
        .filter(doc => doc.similarity > 0); // Filter out zero similarities
      
      const sortedResults = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      console.log(`Manual search completed, returning ${sortedResults.length} results`);
      console.log(`Top similarity scores: ${sortedResults.slice(0, 3).map(r => (r.similarity * 100).toFixed(1) + '%').join(', ')}`);
      
      return sortedResults;
    } catch (error) {
      console.error('Error in manual similarity search:', error.message);
      throw error;
    }
  }

  // Combine two embeddings (for chat context)
  combineEmbeddings(embA, embB, alpha = 0.5) {
    return embA.map((val, i) => alpha * val + (1 - alpha) * embB[i]);
  }

  // Get context for RAG-based responses
  async getRelevantContext(query, limit = 3) {
    try {
      const similarDocs = await this.findSimilarContent(query, limit);
      
      return {
        context: similarDocs.map(doc => ({
          title: doc.title,
          content: doc.content.substring(0, 500), // Truncate for context
          similarity: doc.similarity || doc.score
        })),
        query,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting relevant context:', error.message);
      return { context: [], query, timestamp: new Date() };
    }
  }

  // Find similar content in USER documents
  async findSimilarUserContent(query, userId, limit = 5) {
    try {
      console.log(`Searching user documents for userId: ${userId}`);
      
      const db = await mongoService.connect();
      const collection = db.collection('user_documents');
      
      const userDocuments = await collection.find({ userId }).toArray();
      console.log(`Found ${userDocuments.length} user documents`);
      
      if (userDocuments.length === 0) {
        return [];
      }
      
      // Check if query contains a policy number
      const policyNumberMatch = query.match(/(\d{7,10})/);
      if (policyNumberMatch) {
        const policyNumber = policyNumberMatch[1];
        console.log(`Detected policy number in query: ${policyNumber}`);
        
        // Try exact match first
        const exactMatches = userDocuments.filter(doc => 
          doc.content && doc.content.includes(policyNumber)
        );
        
        if (exactMatches.length > 0) {
          console.log(`Found ${exactMatches.length} exact matches for policy ${policyNumber}`);
          return exactMatches.map(doc => ({
            ...doc,
            similarity: 1.0, // Perfect match
            score: 1.0,
            source: 'user_upload'
          })).slice(0, limit);
        }
      }
      
      // Fall back to embedding similarity search
      const queryEmbedding = await this.generateEmbedding(query);
      
      const similarities = userDocuments
        .filter(doc => doc.embedding && Array.isArray(doc.embedding))
        .map(doc => {
          const similarity = this.cosineSimilarity(queryEmbedding, doc.embedding);
          return {
            ...doc,
            similarity: similarity,
            score: similarity,
            source: 'user_upload'
          };
        })
        .filter(doc => doc.similarity > 0);
      
      const sortedResults = similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
      
      console.log(`User search completed, returning ${sortedResults.length} results`);
      if (sortedResults.length > 0) {
        console.log(`Top user doc scores: ${sortedResults.slice(0, 3).map(r => (r.similarity * 100).toFixed(1) + '%').join(', ')}`);
      }
      
      return sortedResults;
    } catch (error) {
      console.error(' Error finding similar user content:', error.message);
      return [];
    }
  }

  /**
   * Search for similar chat history using semantic similarity
   * Useful for finding relevant past conversations
   */
  async findSimilarChatHistory(query, userId, limit = 5) {
    try {
      console.log(`Searching chat history for: "${query}"`);
      const queryEmbedding = await this.generateEmbedding(query);
      
      const db = await mongoService.connect();
      const collection = db.collection('chat_history');
      
      // Get all chat history for this user that has embeddings
      const chatHistory = await collection.find({ 
        userId,
        $or: [
          { messageEmbedding: { $exists: true, $ne: null } },
          { responseEmbedding: { $exists: true, $ne: null } }
        ]
      }).toArray();
      
      console.log(`Found ${chatHistory.length} chat messages with embeddings`);
      
      if (chatHistory.length === 0) {
        return [];
      }
      
      const similarities = chatHistory.map(chat => {
        let maxSimilarity = 0;
        let matchedContent = '';
        let matchedType = '';
        
        // Check similarity with user message
        if (chat.messageEmbedding && Array.isArray(chat.messageEmbedding)) {
          const msgSimilarity = this.cosineSimilarity(queryEmbedding, chat.messageEmbedding);
          if (msgSimilarity > maxSimilarity) {
            maxSimilarity = msgSimilarity;
            matchedContent = chat.userMessage;
            matchedType = 'user_message';
          }
        }
        
        // Check similarity with bot response
        if (chat.responseEmbedding && Array.isArray(chat.responseEmbedding)) {
          const resSimilarity = this.cosineSimilarity(queryEmbedding, chat.responseEmbedding);
          if (resSimilarity > maxSimilarity) {
            maxSimilarity = resSimilarity;
            matchedContent = chat.botResponse;
            matchedType = 'bot_response';
          }
        }
        
        return {
          userMessage: chat.userMessage,
          botResponse: chat.botResponse,
          timestamp: chat.timestamp,
          similarity: maxSimilarity,
          matchedContent,
          matchedType
        };
      })
      .filter(chat => chat.similarity > 0.3) // Minimum threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);
      
      console.log(`Chat history search completed, returning ${similarities.length} results`);
      if (similarities.length > 0) {
        console.log(`Top chat scores: ${similarities.slice(0, 3).map(r => (r.similarity * 100).toFixed(1) + '%').join(', ')}`);
      }
      
      return similarities;
    } catch (error) {
      console.error('Error searching chat history:', error.message);
      return [];
    }
  }
}

export default new EmbeddingService();