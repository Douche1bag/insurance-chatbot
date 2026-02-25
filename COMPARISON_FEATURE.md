# Policy Comparison Feature - Setup Guide

## Overview
The Comparison Page now connects to real MongoDB data to search and compare insurance policies from your database.

## Features
1. **Real-time Policy Search**: Search for policies by provider name (e.g., AIA, FWD, เอไอเอ)
2. **Multi-policy Comparison**: Compare multiple policies side-by-side
3. **Coverage Gap Analysis**: Automatically identifies gaps in coverage
4. **Dynamic Data Parsing**: Extracts coverage amounts from policy documents

## Setup Instructions

### 1. Install Dependencies (if not already done)
```bash
cd /Users/aum/Desktop/LLM/insurance-chatbot
pnpm install
```

### 2. MongoDB Configuration
Make sure your `.env` file contains the MongoDB connection string:
```
MONGODB_URI=your_mongodb_connection_string
MONGODB_DATABASE=insurance-chatbot
```

### 3. Ensure Data is Loaded
Your MongoDB should have documents in the `thai_insurance_docs` collection. The documents should contain:
- `title`: Policy title
- `text`: Policy content with coverage information
- `embedding`: Vector embeddings for similarity search

### 4. Run the Application
```bash
pnpm run dev
```

## How to Use the Comparison Page

### Search for Policies
1. Navigate to the Comparison Page
2. Enter policy provider names in the search box (e.g., "AIA, FWD")
3. Multiple names can be separated by commas
4. Click "ค้นหา" (Search) button

### What Gets Extracted
The system automatically parses the following coverage types from policy documents:
- **ทุนประกันชีวิต (Life Insurance)**: Main insurance coverage amount
- **ค่ารักษาพยาบาล IPD**: In-patient department coverage
- **ค่าห้องต่อวัน (Room Coverage)**: Daily room rate coverage
- **โรคร้ายแรง (Critical Illness)**: Critical illness coverage
- **อุบัติเหตุ (Accident)**: Accident coverage

### Gap Analysis
The system automatically:
- Compares coverage amounts across selected policies
- Highlights differences (gaps) in yellow
- Shows recommendations for coverage improvements

## New MongoDB Service Methods

### `searchPoliciesByName(policyNames, userId)`
Searches for policies matching the given names.
```javascript
const results = await mongoService.searchPoliciesByName(['AIA', 'FWD']);
```

### `getPolicyProviders(limit)`
Gets a list of unique policy providers from the database.
```javascript
const providers = await mongoService.getPolicyProviders(20);
```

### `parsePolicyCoverage(text)`
Parses coverage information from policy text.
```javascript
const coverage = mongoService.parsePolicyCoverage(policyText);
// Returns: { life, ipd, room, critical, accident }
```

## Troubleshooting

### No results found
- Check if policy documents are loaded in MongoDB
- Verify the search term matches provider names in the documents
- Try using partial names or different variations (e.g., "AIA" or "เอไอเอ")

### Coverage values not showing
- The parser looks for specific Thai keywords in the policy text
- Ensure your policy documents contain coverage amounts with the unit "บาท"
- Check the console for parsing errors

### Connection errors
- Verify MongoDB URI in `.env` file
- Ensure MongoDB Atlas allows connections from your IP
- Check network connectivity

## Example Search Terms
- Single policy: `AIA`
- Multiple policies: `AIA, FWD, มิวเจอร์`
- Thai names: `เอไอเอ, กรุงเทพ`
- Mixed: `AIA Premium, FWD Care`

## Future Enhancements
- Advanced filtering options
- Custom coverage criteria
- Export comparison results
- Recommendation engine for gap filling
- Historical comparison tracking
