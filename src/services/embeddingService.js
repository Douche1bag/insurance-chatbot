import mongoService from './mongoService.js';

class EmbeddingService {
  constructor() {
    this.apiKey = process.env.VITE_API_KEY;
    this.baseUrl = process.env.VITE_API_BASE_URL;
  }

  // Generate text embeddings using Typhoon API
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
          model: "text-embedding-ada-002", // Check if Typhoon supports embeddings
          encoding_format: "float"
        })
      });

      if (!response.ok) {
        throw new Error(`Embedding API error: ${response.status}`);
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error.message);
      // Fallback to a simple hash-based embedding for demo purposes
      return this.generateSimpleEmbedding(text);
    }
  }

  // Fallback: Generate a simple numeric representation (for demo)
  generateSimpleEmbedding(text, dimensions = 128) {
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
      console.error('❌ Error storing chat with embedding:', error.message);
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
      console.error('❌ Error storing document with embedding:', error.message);
      throw error;
    }
  }

  // Find similar content using embeddings
  async findSimilarContent(query, limit = 5) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Try vector search first (requires Atlas Search index)
      try {
        return await mongoService.vectorSearch(queryEmbedding, limit);
      } catch (vectorError) {
        console.warn('Vector search not available, using fallback method');
        
        // Fallback: Manual similarity calculation
        return await this.manualSimilaritySearch(queryEmbedding, limit);
      }
    } catch (error) {
      console.error('❌ Error finding similar content:', error.message);
      throw error;
    }
  }

  // Manual similarity search (when Atlas Search is not available)
  async manualSimilaritySearch(queryEmbedding, limit = 5) {
    try {
      const db = await mongoService.connect();
      const collection = db.collection('documents');
      
      const documents = await collection.find({}).toArray();
      
      const similarities = documents.map(doc => ({
        ...doc,
        similarity: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }));
      
      return similarities
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      console.error('❌ Error in manual similarity search:', error.message);
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
      console.error('❌ Error getting relevant context:', error.message);
      return { context: [], query, timestamp: new Date() };
    }
  }
}

export default new EmbeddingService();