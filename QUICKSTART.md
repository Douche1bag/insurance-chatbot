# 🚀 Quick Start Guide - Policy Comparison

## Prerequisites
- ✅ MongoDB Atlas connection configured in `.env`
- ✅ Policy documents loaded in `thai_insurance_docs` collection
- ✅ pnpm installed on your system

## Installation & Testing (3 Steps)

### Step 1: Install Dependencies
```bash
cd /Users/aum/Desktop/LLM/insurance-chatbot
pnpm install
```

### Step 2: Test MongoDB Connection
```bash
node test-comparison.js
```

**Expected output:**
```
🧪 Testing Policy Comparison Functionality

📌 Test 1: Connecting to MongoDB...
✅ Connected successfully

📌 Test 2: Getting available policy providers...
✅ Found 10 providers:
   1. AIA
   2. FWD
   3. เอไอเอ
   ...

📌 Test 3: Searching for policies...
✅ Found X matching documents

📌 Test 4: Parsing coverage from first document...
   Parsed coverage:
   - Life Insurance: ฿150,000
   - IPD Coverage: ฿500,000
   ...

🎉 All tests completed successfully!
```

### Step 3: Run the App
```bash
pnpm run dev
```

Then open: http://localhost:5173

## Using the Comparison Feature

### Basic Usage
1. Navigate to the **Comparison Page**
2. Enter policy names: `AIA, FWD`
3. Press **Enter** or click **ค้นหา**
4. View comparison table with gaps

### Advanced Usage
- **Multiple policies:** `AIA, FWD, มิวเจอร์, กรุงเทพ`
- **Quick select:** Click suggested provider buttons
- **Add more:** Click "เพิ่มกรมธรรม์" after first search
- **Clear:** Clear search box to start over

## Example Searches

| Search Term | Description |
|------------|-------------|
| `AIA` | Single policy |
| `AIA, FWD` | Two policies |
| `เอไอเอ` | Thai name |
| `AIA Premium, FWD Care` | Full names |

## What to Expect

### Success Case
✅ Comparison table appears  
✅ Coverage amounts displayed  
✅ Gaps highlighted in yellow  
✅ Can add more policies

### No Results
⚠️ "ไม่พบกรมธรรม์ที่ค้นหา"  
→ Try different search terms  
→ Check if data exists in MongoDB

### Coverage Shows "-"
ℹ️ Policy text doesn't contain parseable coverage  
→ Normal for some policies  
→ System extracts what it can find

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection error | Check `.env` MongoDB URI |
| No providers | Run `node test-comparison.js` |
| Search fails | Verify MongoDB has data |
| Loading forever | Check browser console |

## Files Modified

1. **[src/services/mongoService.js](src/services/mongoService.js)** - Added 3 new methods
2. **[src/Pages/ComparisonPage.jsx](src/Pages/ComparisonPage.jsx)** - Complete rewrite

## Documentation

- 📖 [COMPARISON_FEATURE.md](COMPARISON_FEATURE.md) - Full feature guide
- 📊 [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) - Technical summary
- 🔄 [BEFORE_AFTER.md](BEFORE_AFTER.md) - Detailed comparison
- 🚀 [QUICKSTART.md](QUICKSTART.md) - This file

## Next Steps

1. ✅ Install & test (Steps 1-3 above)
2. 🎨 Customize UI if needed
3. 📊 Add more coverage types if desired
4. 🔍 Enhance search patterns
5. 💾 Consider caching results
6. 📱 Test on mobile devices

## Support

If you encounter issues:
1. Check error messages in browser console
2. Run test script: `node test-comparison.js`
3. Verify MongoDB connection
4. Check network tab in DevTools

## Success Checklist

- [ ] pnpm install completed
- [ ] test-comparison.js runs successfully
- [ ] App starts with pnpm run dev
- [ ] Can open Comparison Page
- [ ] Search returns results
- [ ] Coverage data appears
- [ ] Gaps are calculated
- [ ] Can add multiple policies

**All checked?** You're ready to go! 🎉

---

**Remember:** Always use `pnpm` (not npm) for this project!

```bash
✅ pnpm install
✅ pnpm run dev
✅ pnpm run build

❌ npm install (don't use)
❌ npm run dev (don't use)
```
