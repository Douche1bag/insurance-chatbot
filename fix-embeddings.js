/**
 * Fix Embeddings Script
 * This script checks and regenerates embeddings for documents that have incorrect dimensions
 */

import mongoService from './src/services/mongoService.js';
import embeddingService from './src/services/embeddingService.js';

async function checkAndFixEmbeddings() {
  console.log('🔍 Checking embeddings in database...\n');
  
  try {
    const db = await mongoService.connect();
    
    // Check user_documents collection
    console.log('📂 Checking user_documents collection...');
    const userDocs = db.collection('user_documents');
    const userDocuments = await userDocs.find({}).toArray();
    
    let fixedUserDocs = 0;
    for (const doc of userDocuments) {
      if (doc.embedding) {
        const dimension = doc.embedding.length;
        if (dimension !== 384) {
          console.log(`⚠️  Document ${doc._id} has ${dimension} dimensions, regenerating...`);
          
          // Regenerate embedding with correct dimension
          const newEmbedding = embeddingService.generateSimpleEmbedding(doc.content || doc.text || '', 384);
          
          await userDocs.updateOne(
            { _id: doc._id },
            { $set: { embedding: newEmbedding } }
          );
          
          fixedUserDocs++;
          console.log(`✅ Fixed embedding for document ${doc._id}`);
        }
      } else {
        console.log(`⚠️  Document ${doc._id} has no embedding, generating...`);
        const newEmbedding = embeddingService.generateSimpleEmbedding(doc.content || doc.text || '', 384);
        
        await userDocs.updateOne(
          { _id: doc._id },
          { $set: { embedding: newEmbedding } }
        );
        
        fixedUserDocs++;
        console.log(`✅ Added embedding for document ${doc._id}`);
      }
    }
    
    console.log(`\n✅ User documents: ${userDocuments.length} total, ${fixedUserDocs} fixed\n`);
    
    // Check chat_history collection
    console.log('💬 Checking chat_history collection...');
    const chatHistory = db.collection('chat_history');
    const chatMessages = await chatHistory.find({}).toArray();
    
    let fixedChats = 0;
    for (const chat of chatMessages) {
      let needsUpdate = false;
      const updates = {};
      
      // Check message embedding
      if (!chat.messageEmbedding && chat.userMessage) {
        updates.messageEmbedding = embeddingService.generateSimpleEmbedding(chat.userMessage, 384);
        needsUpdate = true;
      } else if (chat.messageEmbedding && chat.messageEmbedding.length !== 384) {
        updates.messageEmbedding = embeddingService.generateSimpleEmbedding(chat.userMessage, 384);
        needsUpdate = true;
      }
      
      // Check response embedding
      if (!chat.responseEmbedding && chat.botResponse) {
        updates.responseEmbedding = embeddingService.generateSimpleEmbedding(chat.botResponse, 384);
        needsUpdate = true;
      } else if (chat.responseEmbedding && chat.responseEmbedding.length !== 384) {
        updates.responseEmbedding = embeddingService.generateSimpleEmbedding(chat.botResponse, 384);
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await chatHistory.updateOne(
          { _id: chat._id },
          { $set: updates }
        );
        fixedChats++;
        console.log(`✅ Fixed embeddings for chat ${chat._id}`);
      }
    }
    
    console.log(`\n✅ Chat history: ${chatMessages.length} total, ${fixedChats} fixed\n`);
    
    // Summary
    console.log('📊 Summary:');
    console.log(`   User Documents: ${userDocuments.length} total, ${fixedUserDocs} fixed`);
    console.log(`   Chat History: ${chatMessages.length} total, ${fixedChats} fixed`);
    console.log('\n✅ All embeddings are now 384 dimensions!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
checkAndFixEmbeddings();
