import mongoService from './src/services/mongoService.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function checkDatabase() {
  try {
    console.log('🔍 Checking database connection and data...');
    
    // Test connection
    const db = await mongoService.connect();
    console.log('✅ Connected to MongoDB');
    
    // Check documents collection
    const documentsCollection = db.collection('documents');
    const documentCount = await documentsCollection.countDocuments();
    console.log(`📄 Documents in collection: ${documentCount}`);
    
    if (documentCount > 0) {
      // Get sample documents
      const sampleDocs = await documentsCollection.find({}).limit(3).toArray();
      console.log('\n📋 Sample documents:');
      
      sampleDocs.forEach((doc, index) => {
        console.log(`${index + 1}. Title: "${doc.title || 'No title'}"`);
        console.log(`   Content length: ${doc.content ? doc.content.length : 0} characters`);
        console.log(`   Has embedding: ${doc.embedding ? 'Yes (' + doc.embedding.length + ' dimensions)' : 'No'}`);
        console.log('');
      });
      
      // Test vector search capability
      console.log('🧪 Testing vector search...');
      const testQuery = 'ประกันชีวิต';
      
      // Create a sample embedding for testing
      const sampleEmbedding = new Array(384).fill(0).map(() => Math.random());
      
      try {
        const results = await mongoService.vectorSearch(sampleEmbedding, 3);
        console.log(`✅ Vector search returned ${results.length} results`);
      } catch (vectorError) {
        console.log('⚠️ Vector search not available, will use manual search');
        
        // Test manual similarity calculation
        const docs = await documentsCollection.find({ embedding: { $exists: true } }).limit(3).toArray();
        if (docs.length > 0) {
          console.log(`✅ Manual search can process ${docs.length} documents with embeddings`);
        }
      }
      
    } else {
      console.log('⚠️ No documents found in database');
      console.log('   Run test-insurance-embeddings.js to import data first');
    }
    
    console.log('\n✅ Database check completed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
    process.exit(1);
  }
}

checkDatabase();