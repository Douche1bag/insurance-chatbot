import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

class MongoService {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      if (this.isConnected) {
        return this.db;
      }

      const uri = process.env.MONGODB_URI;
      const dbName = process.env.MONGODB_DATABASE || 'insurance-chatbot';

      if (!uri) {
        throw new Error('MongoDB URI not found in environment variables');
      }

      // Replace <db_password> with your actual password
      if (uri.includes('<db_password>')) {
        throw new Error('Please replace <db_password> with your actual MongoDB password in the .env file');
      }

      this.client = new MongoClient(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      await this.client.connect();
      this.db = this.client.db(dbName);
      this.isConnected = true;

      console.log('✅ Connected to MongoDB Atlas');
      return this.db;
    } catch (error) {
      console.error('❌ MongoDB connection error:', error.message);
      throw error;
    }
  }

  async disconnect() {
    try {
      if (this.client) {
        await this.client.close();
        this.isConnected = false;
        console.log('🔌 Disconnected from MongoDB');
      }
    } catch (error) {
      console.error('❌ MongoDB disconnect error:', error.message);
      throw error;
    }
  }

  // Store chat conversation with vector embeddings
  async storeChatMessage(userId, message, response, embedding = null) {
    try {
      const db = await this.connect();
      const collection = db.collection('chat_history');

      const chatRecord = {
        userId,
        message,
        response,
        embedding, // Store vector embeddings here
        timestamp: new Date(),
        metadata: {
          model: process.env.VITE_MODEL_NAME,
          messageLength: message.length,
          responseLength: response.length
        }
      };

      const result = await collection.insertOne(chatRecord);
      console.log('✅ Chat message stored:', result.insertedId);
      return result.insertedId;
    } catch (error) {
      console.error('❌ Error storing chat message:', error.message);
      throw error;
    }
  }

  // Store document with vector embeddings for RAG
  async storeDocument(title, content, embedding, metadata = {}) {
    try {
      const db = await this.connect();
      const collection = db.collection('documents');

      const document = {
        title,
        content,
        embedding, // Vector embedding for similarity search
        metadata: {
          ...metadata,
          createdAt: new Date(),
          contentLength: content.length
        }
      };

      const result = await collection.insertOne(document);
      console.log('✅ Document stored:', result.insertedId);
      return result.insertedId;
    } catch (error) {
      console.error('❌ Error storing document:', error.message);
      throw error;
    }
  }

  // Get chat history for a user
  async getChatHistory(userId, limit = 10) {
    try {
      const db = await this.connect();
      const collection = db.collection('chat_history');

      const history = await collection
        .find({ userId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray();

      return history.reverse(); // Return in chronological order
    } catch (error) {
      console.error('❌ Error fetching chat history:', error.message);
      throw error;
    }
  }

  // Vector similarity search (requires MongoDB Atlas Search index)
  async vectorSearch(queryEmbedding, limit = 5, collection = 'documents') {
    try {
      const db = await this.connect();
      const coll = db.collection(collection);

      // This requires setting up Atlas Search with vector index
      const pipeline = [
        {
          $vectorSearch: {
            index: "vector_index", // You need to create this index in Atlas
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: limit * 10,
            limit: limit
          }
        },
        {
          $project: {
            title: 1,
            content: 1,
            metadata: 1,
            score: { $meta: "vectorSearchScore" }
          }
        }
      ];

      const results = await coll.aggregate(pipeline).toArray();
      return results;
    } catch (error) {
      console.error('❌ Error in vector search:', error.message);
      throw error;
    }
  }

  // Create indexes for better performance
  async createIndexes() {
    try {
      const db = await this.connect();
      
      // Index for chat history
      const chatCollection = db.collection('chat_history');
      await chatCollection.createIndex({ userId: 1, timestamp: -1 });
      
      // Index for documents
      const docCollection = db.collection('documents');
      await docCollection.createIndex({ title: 1 });
      await docCollection.createIndex({ "metadata.createdAt": -1 });

      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('❌ Error creating indexes:', error.message);
      throw error;
    }
  }
}

export default new MongoService();