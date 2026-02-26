# RAG (Retrieval-Augmented Generation) Implementation

## Overview

This project now implements a complete RAG workflow for the Thai insurance chatbot, allowing it to search through your vector database first, then use the retrieved information to provide more accurate and contextual responses.

## RAG Workflow

```
User Query → Vector Search → Context Retrieval → LLM + Context → Enhanced Response
```

### Step-by-Step Process

1. **User Input**: User asks a question about insurance
2. **Vector Search**: System searches the MongoDB vector database for relevant documents
3. **Context Retrieval**: Top relevant documents are selected based on similarity scores
4. **Context Enrichment**: Retrieved context is formatted and added to the LLM prompt
5. **Response Generation**: LLM generates response using both query and context
6. **Source Attribution**: Final response includes citations and source information

## Key Components

### 1. RAGService (`src/services/ragService.js`)
- **Main RAG orchestrator**
- Handles the complete RAG workflow
- Provides query processing, context retrieval, and response generation
- Includes fallback mechanisms for error handling

#### Key Methods:
- `queryWithRAG()` - Main RAG workflow
- `retrieveContext()` - Search and retrieve relevant documents
- `generateRAGResponse()` - Generate response with context
- `processComplexQuery()` - Handle advanced queries with entity extraction

### 2. Enhanced EmbeddingService (`src/services/embeddingService.js`)
- **Vector operations and similarity search**
- Generates embeddings for text using Typhoon API
- Performs cosine similarity calculations
- Handles both Atlas Vector Search and manual fallback

#### Key Methods:
- `generateEmbedding()` - Create vector embeddings
- `findSimilarContent()` - Search for similar documents
- `manualSimilaritySearch()` - Fallback when Atlas Search unavailable
- `cosineSimilarity()` - Calculate similarity between vectors

### 3. Updated ChatPage (`src/Pages/ChatPage.jsx`)
- **Frontend integration**
- Uses RAGService instead of direct API calls
- Displays context information and source citations
- Shows search metadata (number of results, similarity scores)

## Features

### 🔍 Intelligent Search
- Vector similarity search through insurance documents
- Configurable similarity threshold (default: 0.3)
- Multiple document retrieval with ranking

### 📊 Context Enrichment
- Retrieved documents are summarized and formatted
- Similarity scores are displayed as percentages
- Content truncation for optimal context length

### 🎯 Source Attribution
- All responses include source citations
- Similarity scores show relevance level
- Metadata about search results (count, average similarity)

### ⚠️ Fallback Mechanisms
- Manual similarity search when Atlas Vector Search unavailable
- General knowledge responses when no context found
- Error handling with graceful degradation

### 🌐 Thai Language Support
- Thai system messages and instructions
- Thai keyword extraction for enhanced search
- Insurance terminology recognition

## Usage Examples

### Basic Query
```javascript
const result = await ragService.queryWithRAG('ประกันชีวิตคืออะไร');
console.log(result.response); // Enhanced response with context
console.log(result.context);  // Source documents used
```

### Advanced Query
```javascript
const result = await ragService.processComplexQuery(
  'ประกันรถยนต์ชั้น 1 เบี้ยประกัน 15,000 บาท',
  { contextLimit: 5 }
);
```

### Custom Context Retrieval
```javascript
const contextData = await ragService.retrieveContext('ประกันสุขภาพ', 3);
console.log(contextData.context); // Relevant documents
```

## Configuration

### RAGService Settings
```javascript
this.similarityThreshold = 0.3;  // Minimum relevance score
this.maxContextLength = 2000;    // Max context characters
this.defaultContextLimit = 3;    // Default docs to retrieve
```

### Query Options
```javascript
const options = {
  contextLimit: 5,        // Number of documents to retrieve
  includeScore: true,     // Include similarity scores
  language: 'thai'        // Response language
};
```

## Testing

### Run RAG Tests
```bash
node test-rag-workflow.js
```

### Test Coverage
- ✅ Context retrieval testing
- ✅ RAG workflow testing  
- ✅ Complex query processing
- ✅ Fallback mechanism testing
- ✅ Error handling validation

## Response Format

### Successful RAG Response
```json
{
  "success": true,
  "query": "ประกันชีวิตคืออะไร",
  "response": "ประกันชีวิตคือ... [with context]",
  "context": [
    {
      "title": "คู่มือประกันชีวิต",
      "content": "...",
      "similarity": 0.85
    }
  ],
  "metadata": {
    "contextFound": true,
    "contextCount": 3,
    "avgSimilarity": 0.75,
    "timestamp": "2024-..."
  }
}
```

### Display Format
The chatbot now shows:
1. **Enhanced Response**: Context-aware answer
2. **Search Metadata**: "พบข้อมูลที่เกี่ยวข้อง 3 รายการ (ความแม่นยำเฉลี่ย: 75%)"
3. **Source Citations**: 
   ```
   📚 แหล่งข้อมูลที่ใช้:
   • คู่มือประกันชีวิต (85% เกี่ยวข้อง)
   • ข้อมูลความคุ้มครอง (72% เกี่ยวข้อง)
   ```

## Troubleshooting

### Common Issues

1. **No Context Found**
   - Check if documents exist in MongoDB
   - Verify vector embeddings are stored
   - Lower similarity threshold if needed

2. **Vector Search Failed**
   - RAG automatically falls back to manual similarity search
   - Check MongoDB Atlas Search index configuration

3. **Low Similarity Scores**
   - Review document content quality
   - Consider embedding model appropriateness
   - Adjust similarity threshold

### Debug Logging
All RAG operations include console logging:
- 🔍 Search operations
- 📄 Document retrieval
- 🤖 Response generation
- ⚠️ Warnings and fallbacks

## Performance Considerations

- **Context Limiting**: Default 3 documents to avoid token limits
- **Content Truncation**: Documents truncated to 500 characters
- **Caching**: Consider implementing embedding caching for repeated queries
- **Batch Processing**: Use for bulk operations

## Future Enhancements

1. **Advanced Entity Extraction**: Better recognition of insurance terms
2. **Query Expansion**: Synonym and related term searching  
3. **Caching Layer**: Redis for frequently accessed contexts
4. **Multi-modal RAG**: Support for document images/tables
5. **Conversation History**: Context from previous messages
6. **Fine-tuned Embeddings**: Custom embeddings for Thai insurance domain