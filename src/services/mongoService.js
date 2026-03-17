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

      console.log('Connected to MongoDB Atlas');
      return this.db;
    } catch (error) {
      console.error('MongoDB connection error:', error.message);
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
      console.error('MongoDB disconnect error:', error.message);
      throw error;
    }
  }

  // Store chat conversation with vector embeddings
  async storeChatMessage(userId, userMessage, botResponse, embeddings = {}) {
    try {
      const db = await this.connect();
      const collection = db.collection('chat_history');

      // Safety checks
      const safeUserMessage = userMessage || '';
      const safeBotResponse = botResponse || '';

      const chatRecord = {
        userId,
        userMessage: safeUserMessage,
        botResponse: safeBotResponse,
        messageEmbedding: embeddings.messageEmbedding || null,
        responseEmbedding: embeddings.responseEmbedding || null,
        timestamp: new Date(),
        metadata: {
          model: process.env.VITE_MODEL_NAME,
          messageLength: safeUserMessage.length,
          responseLength: safeBotResponse.length,
          hasEmbeddings: !!(embeddings.messageEmbedding && embeddings.responseEmbedding)
        }
      };

      const result = await collection.insertOne(chatRecord);
      console.log('Chat message stored:', result.insertedId);
      return result.insertedId;
    } catch (error) {
      console.error('Error storing chat message:', error.message);
      throw error;
    }
  }

  // Store document with vector embeddings for RAG (System documents)
  async storeDocument(title, content, embedding, metadata = {}) {
    try {
      const db = await this.connect();
      const collection = db.collection('thai_insurance_docs');

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
      console.log('Document stored:', result.insertedId);
      return result.insertedId;
    } catch (error) {
      console.error('Error storing document:', error.message);
      throw error;
    }
  }

  // Store user-uploaded document in separate collection
  async storeUserDocument(userId, title, content, embedding, metadata = {}) {
    try {
      const db = await this.connect();
      const collection = db.collection('user_documents');

      const document = {
        userId, // Associate with specific user
        title,
        content,
        embedding, // Vector embedding for similarity search
        metadata: {
          ...metadata,
          createdAt: new Date(),
          contentLength: content.length,
          embeddingDimensions: embedding.length
        }
      };

      const result = await collection.insertOne(document);
      console.log(`User document stored in user_documents: ${result.insertedId}`);
      return result.insertedId;
    } catch (error) {
      console.error('Error storing user document:', error.message);
      throw error;
    }
  }

  // Verify document was stored with embedding
  async verifyDocumentWithEmbedding(documentId, collectionName = 'user_documents') {
    try {
      const db = await this.connect();
      const collection = db.collection(collectionName);
      
      const doc = await collection.findOne({ _id: documentId });
      
      if (!doc) {
        return { success: false, error: 'Document not found' };
      }
      
      const hasEmbedding = doc.embedding && Array.isArray(doc.embedding) && doc.embedding.length > 0;
      
      return {
        success: true,
        documentId: doc._id,
        title: doc.title,
        hasEmbedding,
        embeddingDimensions: hasEmbedding ? doc.embedding.length : 0,
        contentLength: doc.content?.length || 0,
        createdAt: doc.metadata?.createdAt,
        collection: collectionName
      };
    } catch (error) {
      console.error('Error verifying document:', error.message);
      return { success: false, error: error.message };
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
      console.error('Error fetching chat history:', error.message);
      throw error;
    }
  }

  // Vector similarity search (requires MongoDB Atlas Search index)
  async vectorSearch(queryEmbedding, limit = 5, collection = 'thai_insurance_docs') {
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
      console.error('Error in vector search:', error.message);
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

      console.log('Database indexes created');
    } catch (error) {
      console.error('Error creating indexes:', error.message);
      throw error;
    }
  }

  // Get user documents (uploaded by a specific user)
  async getUserDocuments(userId, limit = 10) {
    try {
      const db = await this.connect();
      const collection = db.collection('user_documents');

      const documents = await collection
        .find({ userId })
        .sort({ 'metadata.createdAt': -1 })
        .limit(limit)
        .toArray();

      // Ensure all documents have policyName field (add default if missing)
      const documentsWithPolicy = documents.map(doc => ({
        ...doc,
        metadata: {
          ...(doc.metadata || {}),
          policyName: doc.metadata?.policyName || 'ไม่ระบุกรมธรรม์'
        }
      }));

      return documentsWithPolicy;
    } catch (error) {
      console.error('❌ Error fetching user documents:', error.message);
      return [];
    }
  }

  // Delete user document (with authorization check)
  async deleteUserDocument(documentId, userId) {
    try {
      const db = await this.connect();
      const collection = db.collection('user_documents');
      const { ObjectId } = await import('mongodb');

      // First verify the document belongs to this user
      const document = await collection.findOne({ 
        _id: new ObjectId(documentId),
        userId: userId 
      });

      if (!document) {
        console.log(`Document ${documentId} not found or unauthorized for user ${userId}`);
        return { success: false, error: 'Document not found or unauthorized' };
      }

      // Delete the document
      const result = await collection.deleteOne({ 
        _id: new ObjectId(documentId),
        userId: userId 
      });

      if (result.deletedCount === 1) {
        console.log(`Deleted document ${documentId} for user ${userId}`);
        return { success: true, deletedCount: 1 };
      } else {
        return { success: false, error: 'Failed to delete document' };
      }
    } catch (error) {
      console.error('Error deleting user document:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Update document policy name
  async updateDocumentPolicy(documentId, userId, policyName) {
    try {
      const db = await this.connect();
      const collection = db.collection('user_documents');
      const { ObjectId } = await import('mongodb');

      // First verify the document belongs to this user
      const document = await collection.findOne({ 
        _id: new ObjectId(documentId),
        userId: userId 
      });

      if (!document) {
        console.log(` Document ${documentId} not found or unauthorized for user ${userId}`);
        return { success: false, error: 'Document not found or unauthorized' };
      }

      // Update the policy name in metadata
      const result = await collection.updateOne(
        { 
          _id: new ObjectId(documentId),
          userId: userId 
        },
        { 
          $set: { 
            'metadata.policyName': policyName,
            'metadata.updatedAt': new Date()
          } 
        }
      );

      if (result.modifiedCount === 1) {
        console.log(`Updated policy name for document ${documentId} to "${policyName}"`);
        return { success: true, modifiedCount: 1 };
      } else {
        return { success: false, error: 'Failed to update policy name' };
      }
    } catch (error) {
      console.error(' Error updating document policy:', error.message);
      return { success: false, error: error.message };
    }
  }

  // Get system documents (from thai_insurance_docs collection)
  async getSystemDocuments(limit = 10) {
    try {
      const db = await this.connect();
      const collection = db.collection('thai_insurance_docs');

      const documents = await collection
        .find({})
        .limit(limit)
        .toArray();

      return documents;
    } catch (error) {
      console.error(' Error fetching system documents:', error.message);
      return [];
    }
  }

  // Get all documents for dashboard (prioritized: user docs first, then system docs)
  async getAllDocumentsForDashboard(userId = null, limit = 20) {
    try {
      let userDocs = [];
      let systemDocs = [];

      // If user is logged in, get their documents first
      if (userId) {
        userDocs = await this.getUserDocuments(userId, limit);
      }

      // Fill remaining with system documents
      const remaining = Math.max(0, limit - userDocs.length);
      if (remaining > 0) {
        systemDocs = await this.getSystemDocuments(remaining);
      }

      return [...userDocs, ...systemDocs];
    } catch (error) {
      console.error(' Error fetching all documents:', error.message);
      return [];
    }
  }

  // ===== USER AUTHENTICATION =====
  
  // Register new user
  async registerUser(email, password, name = '') {
    try {
      const db = await this.connect();
      const usersCollection = db.collection('users');

      // Check if user already exists
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        throw new Error('อีเมลนี้ถูกใช้งานแล้ว');
      }

      // Create user with simple password (you can add crypto.createHash if you want basic hashing)
      const user = {
        email,
        password, // Simple password storage
        name: name || email.split('@')[0],
        createdAt: new Date()
      };

      const result = await usersCollection.insertOne(user);
      
      return {
        success: true,
        user: {
          id: result.insertedId.toString(),
          email: user.email,
          name: user.name
        }
      };
    } catch (error) {
      console.error(' Registration error:', error);
      throw error;
    }
  }

  // Login user
  async loginUser(email, password) {
    try {
      const db = await this.connect();
      const usersCollection = db.collection('users');

      // Find user
      const user = await usersCollection.findOne({ email });
      if (!user) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }

      // Check password
      if (user.password !== password) {
        throw new Error('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
      }

      return {
        success: true,
        user: {
          id: user._id.toString(),
          email: user.email,
          name: user.name
        }
      };
    } catch (error) {
      console.error(' Login error:', error);
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const db = await this.connect();
      const usersCollection = db.collection('users');
      
      const { ObjectId } = await import('mongodb');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      
      if (!user) {
        throw new Error('ไม่พบผู้ใช้');
      }

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      };
    } catch (error) {
      console.error(' Get user error:', error);
      throw error;
    }
  }

  // ==================== Conversation Management ====================
  
  // Get all conversations for a user
  async getUserConversations(userId) {
    try {
      const db = await this.connect();
      const conversationsCollection = db.collection('conversations');
      
      const conversations = await conversationsCollection
        .find({ userId })
        .sort({ updatedAt: -1 })
        .toArray();
      
      return conversations.map(conv => ({
        _id: conv._id.toString(),
        id: conv._id.toString(),
        userId: conv.userId,
        title: conv.title,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages ? conv.messages.length : 0
      }));
    } catch (error) {
      console.error(' Error getting conversations:', error);
      throw error;
    }
  }

  // Create a new conversation
  async createConversation(userId, title = 'การสนทนาใหม่') {
    try {
      const db = await this.connect();
      const conversationsCollection = db.collection('conversations');
      
      const newConversation = {
        userId,
        title,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await conversationsCollection.insertOne(newConversation);
      console.log('✅ Conversation created:', result.insertedId);
      
      return {
        _id: result.insertedId.toString(),
        id: result.insertedId.toString(),
        ...newConversation
      };
    } catch (error) {
      console.error(' Error creating conversation:', error);
      throw error;
    }
  }

  // Get messages from a conversation
  async getConversationMessages(conversationId) {
    try {
      const db = await this.connect();
      const conversationsCollection = db.collection('conversations');
      const { ObjectId } = await import('mongodb');
      
      // Validate ObjectId format
      if (!ObjectId.isValid(conversationId)) {
        throw new Error('รูปแบบ ID ของการสนทนาไม่ถูกต้อง');
      }
      
      const conversation = await conversationsCollection.findOne({
        _id: new ObjectId(conversationId)
      });
      
      if (!conversation) {
        throw new Error('ไม่พบการสนทนา');
      }
      
      return {
        _id: conversation._id.toString(),
        id: conversation._id.toString(),
        userId: conversation.userId,
        title: conversation.title,
        messages: conversation.messages || [],
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      };
    } catch (error) {
      console.error('❌ Error getting conversation messages:', error);
      throw error;
    }
  }

  // Add a message to a conversation
  async addMessageToConversation(conversationId, userId, messageData) {
    try {
      const db = await this.connect();
      const conversationsCollection = db.collection('conversations');
      const { ObjectId } = await import('mongodb');
      
      // Validate ObjectId format
      if (!ObjectId.isValid(conversationId)) {
        throw new Error('รูปแบบ ID ของการสนทนาไม่ถูกต้อง');
      }
      
      // Verify the conversation belongs to the user
      const conversation = await conversationsCollection.findOne({
        _id: new ObjectId(conversationId),
        userId: userId
      });
      
      if (!conversation) {
        throw new Error('ไม่พบการสนทนาหรือไม่มีสิทธิ์เข้าถึง');
      }
      
      const newMessage = {
        message: messageData.message,
        response: messageData.response,
        messageEmbedding: messageData.messageEmbedding || null,
        responseEmbedding: messageData.responseEmbedding || null,
        timestamp: new Date()
      };
      
      const result = await conversationsCollection.updateOne(
        { _id: new ObjectId(conversationId) },
        { 
          $push: { messages: newMessage },
          $set: { updatedAt: new Date() }
        }
      );
      
      console.log('✅ Message added to conversation:', conversationId);
      return result;
    } catch (error) {
      console.error('❌ Error adding message to conversation:', error);
      throw error;
    }
  }

  // Delete a conversation
  async deleteConversation(conversationId, userId) {
    try {
      const db = await this.connect();
      const conversationsCollection = db.collection('conversations');
      const { ObjectId } = await import('mongodb');
      
      // Validate ObjectId format
      if (!ObjectId.isValid(conversationId)) {
        throw new Error('รูปแบบ ID ของการสนทนาไม่ถูกต้อง');
      }
      
      // Verify the conversation belongs to the user before deleting
      const result = await conversationsCollection.deleteOne({
        _id: new ObjectId(conversationId),
        userId: userId
      });
      
      if (result.deletedCount === 0) {
        throw new Error('ไม่พบการสนทนาหรือไม่มีสิทธิ์ลบ');
      }
      
      console.log('✅ Conversation deleted:', conversationId);
      return result;
    } catch (error) {
      console.error('❌ Error deleting conversation:', error);
      throw error;
    }
  }

  // Update conversation title
  async updateConversationTitle(conversationId, userId, newTitle) {
    try {
      const db = await this.connect();
      const conversationsCollection = db.collection('conversations');
      const { ObjectId } = await import('mongodb');
      
      // Validate ObjectId format
      if (!ObjectId.isValid(conversationId)) {
        throw new Error('รูปแบบ ID ของการสนทนาไม่ถูกต้อง');
      }
      
      // Update the conversation title
      const result = await conversationsCollection.updateOne(
        { 
          _id: new ObjectId(conversationId),
          userId: userId
        },
        {
          $set: { 
            title: newTitle,
            updatedAt: new Date()
          }
        }
      );
      
      if (result.matchedCount === 0) {
        throw new Error('ไม่พบการสนทนาหรือไม่มีสิทธิ์แก้ไข');
      }
      
      console.log(' Conversation title updated:', conversationId);
      return result;
    } catch (error) {
      console.error(' Error updating conversation title:', error);
      throw error;
    }
  }
}

export default new MongoService();