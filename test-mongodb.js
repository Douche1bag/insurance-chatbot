// Test MongoDB Atlas connection and vector storage
import dotenv from 'dotenv';
import mongoService from './src/services/mongoService.js';
import embeddingService from './src/services/embeddingService.js';

dotenv.config();

async function testMongoDB() {
  console.log('🧪 Testing MongoDB Atlas Connection and Vector Storage...\n');

  try {
    // Test 1: Connect to MongoDB
    console.log('1️⃣ Testing MongoDB connection...');
    await mongoService.connect();
    console.log('✅ MongoDB connection successful!\n');

    // Test 2: Create database indexes
    console.log('2️⃣ Creating database indexes...');
    await mongoService.createIndexes();
    console.log('✅ Database indexes created!\n');

    // Test 3: Store a test document with embedding
    console.log('3️⃣ Testing document storage with embeddings...');
    const testDocument = {
      title: 'Car Insurance Policy',
      content: `Car insurance provides financial protection against physical damage 
                or bodily injury resulting from traffic collisions. It covers liability, 
                comprehensive, and collision coverage. Premiums depend on factors like 
                age, driving record, and vehicle type.`,
    };

    const docId = await embeddingService.storeDocumentWithEmbedding(
      testDocument.title,
      testDocument.content,
      { category: 'insurance_policy', type: 'car' }
    );
    console.log('✅ Document stored with ID:', docId, '\n');

    // Test 4: Store a test chat conversation
    console.log('4️⃣ Testing chat storage with embeddings...');
    const userId = 'test-user-123';
    const message = 'What does car insurance cover?';
    const response = 'Car insurance typically covers liability, collision, and comprehensive damage.';

    const chatId = await embeddingService.storeChatWithEmbedding(userId, message, response);
    console.log('✅ Chat stored with ID:', chatId, '\n');

    // Test 5: Test similarity search
    console.log('5️⃣ Testing similarity search...');
    const query = 'Tell me about car insurance coverage';
    const context = await embeddingService.getRelevantContext(query, 2);
    console.log('✅ Similar content found:');
    context.context.forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.title} (similarity: ${item.similarity?.toFixed(4)})`);
      console.log(`      Content: ${item.content.substring(0, 100)}...\n`);
    });

    // Test 6: Retrieve chat history
    console.log('6️⃣ Testing chat history retrieval...');
    const history = await mongoService.getChatHistory(userId, 5);
    console.log(`✅ Found ${history.length} chat messages for user ${userId}\n`);

    // Test 7: Generate sample insurance documents
    console.log('7️⃣ Adding more sample insurance documents...');
    const sampleDocs = [
      {
        title: 'Health Insurance Basics',
        content: `Health insurance helps cover medical expenses including doctor visits, 
                  hospital stays, prescription drugs, and preventive care. Plans include 
                  HMO, PPO, and high-deductible options with varying networks and costs.`,
        metadata: { category: 'insurance_policy', type: 'health' }
      },
      {
        title: 'Life Insurance Guide',
        content: `Life insurance provides financial security for beneficiaries after 
                  the policyholder's death. Term life offers temporary coverage, while 
                  whole life builds cash value. Premiums depend on age, health, and coverage amount.`,
        metadata: { category: 'insurance_policy', type: 'life' }
      },
      {
        title: 'Home Insurance Coverage',
        content: `Homeowner's insurance protects your property and belongings against 
                  damage from fire, theft, and natural disasters. It includes dwelling, 
                  personal property, liability, and additional living expenses coverage.`,
        metadata: { category: 'insurance_policy', type: 'home' }
      }
    ];

    for (const doc of sampleDocs) {
      const id = await embeddingService.storeDocumentWithEmbedding(
        doc.title,
        doc.content,
        doc.metadata
      );
      console.log(`   ✅ Stored: ${doc.title} (ID: ${id})`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Replace <db_password> in .env with your actual MongoDB password');
    console.log('2. Set up Atlas Search vector index for better similarity search');
    console.log('3. Integrate the services into your React chatbot');
    console.log('4. Add more insurance documents to improve RAG responses\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('<db_password>')) {
      console.log('\n🔧 Fix: Update your .env file:');
      console.log('   Replace <db_password> with your actual MongoDB Atlas password');
    }
  } finally {
    await mongoService.disconnect();
  }
}

// Run the test
testMongoDB();