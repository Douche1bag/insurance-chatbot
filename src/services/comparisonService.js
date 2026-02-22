// Browser-compatible comparison service
// This service works without needing a backend server

class ComparisonService {
  constructor() {
    this.policies = this.loadPoliciesFromEmbeddings();
  }

  // Load policies from the embedded dataset
  loadPoliciesFromEmbeddings() {
    // You can add your actual embedded data here
    // Or load it from your JSON files
    return [
      {
        name: 'เอไอเอ',
        provider: 'AIA',
        text: 'บริษัท เอไอเอ จำกัด 181 ถนนสุรวงศ์ บางรัก กรุงเทพฯ 10500 ผู้เอาประกันภัย นาง ขวัญจิตต์ สร้อยทอง จำนวนเงินเอาประกันภัย 150,000.00 บาท แบบการประกันภัย เอไอเอ สะสมทรัพย์ 30 ปี การรักษาในโรงพยาบาลและศัลยกรรม 1,600.00 บาท ค่าชดเชยรายวันการเข้ารักษาในโรงพยาบาล 600.00 บาท'
      },
      {
        name: 'FWD',
        provider: 'FWD',
        text: 'บริษัท เอฟดับบลิวดี ประกันชีวิต จำกัด (มหาชน) จำนวนเงินเอาประกันภัย 200,000 บาท การรักษาในโรงพยาบาล 100,000 บาท ค่าห้อง 2,000 บาท โรคร้ายแรง 500,000 บาท'
      },
      {
        name: 'มิวเจอร์',
        provider: 'Muang Thai',
        text: 'บริษัท เมืองไทยประกันชีวิต จำกัด (มหาชน) จำนวนเงินเอาประกันภัย 300,000 บาท อุบัติเหตุ 1,000,000 บาท ค่าห้อง 1,500 บาท'
      },
      {
        name: 'กรุงเทพประกันชีวิต',
        provider: 'Bangkok Life',
        text: 'บริษัท กรุงเทพประกันชีวิต จำกัด (มหาชน) จำนวนเงินเอาประกันภัย 250,000 บาท การรักษาในโรงพยาบาล 150,000 บาท ค่าห้อง 3,000 บาท โรคร้ายแรง 800,000 บาท อุบัติเหตุ 500,000 บาท'
      }
    ];
  }

  // Parse coverage from text
  parseCoverage(text) {
    const coverage = {
      life: null,
      ipd: null,
      room: null,
      critical: null,
      accident: null
    };

    if (!text) return coverage;

    // Life insurance
    const lifeMatch = text.match(/(?:จำนวนเงินเอาประกันภัย|ทุนประกันภัย|ความคุ้มครอง)[\s:]*([0-9,]+(?:\.[0-9]+)?)\s*บาท/i);
    if (lifeMatch) {
      coverage.life = parseFloat(lifeMatch[1].replace(/,/g, ''));
    }

    // IPD Coverage
    const ipdMatch = text.match(/(?:รักษาในโรงพยาบาล|IPD|ผู้ป่วยใน)[\s:]*([0-9,]+(?:\.[0-9]+)?)/i);
    if (ipdMatch) {
      coverage.ipd = parseFloat(ipdMatch[1].replace(/,/g, ''));
    }

    // Room coverage
    const roomMatch = text.match(/(?:ค่าห้อง|ห้องพิเศษ)[\s:]*([0-9,]+(?:\.[0-9]+)?)/i);
    if (roomMatch) {
      coverage.room = parseFloat(roomMatch[1].replace(/,/g, ''));
    }

    // Critical illness
    const criticalMatch = text.match(/(?:โรคร้ายแรง|critical|มะเร็ง)[\s:]*([0-9,]+(?:\.[0-9]+)?)/i);
    if (criticalMatch) {
      coverage.critical = parseFloat(criticalMatch[1].replace(/,/g, ''));
    }

    // Accident
    const accidentMatch = text.match(/(?:อุบัติเหตุ|accident)[\s:]*([0-9,]+(?:\.[0-9]+)?)/i);
    if (accidentMatch) {
      coverage.accident = parseFloat(accidentMatch[1].replace(/,/g, ''));
    }

    return coverage;
  }

  // Search policies by name
  async searchPoliciesByName(searchTerms) {
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 300));

    const results = this.policies.filter(policy => 
      searchTerms.some(term => {
        const termLower = term.toLowerCase();
        return policy.name.toLowerCase().includes(termLower) ||
               policy.provider.toLowerCase().includes(termLower) ||
               termLower.includes(policy.name.toLowerCase()) ||
               termLower.includes(policy.provider.toLowerCase());
      })
    );

    return results.map(policy => ({
      name: policy.name,
      coverage: this.parseCoverage(policy.text),
      document: {
        title: policy.name,
        provider: policy.provider,
        text: policy.text
      }
    }));
  }

  // Get available providers
  async getPolicyProviders() {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.policies.map(p => p.name);
  }

  // Add custom policy data (for when you have your actual data)
  addPolicyData(policies) {
    this.policies = [...this.policies, ...policies];
  }
}

export default new ComparisonService();
