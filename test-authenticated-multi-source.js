// Authenticated test of Multi-Source Data Integration
import http from 'http';

const baseUrl = 'http://localhost:5000';

// Simulate authenticated request using the existing user session
const makeAuthenticatedRequest = (path, method = 'GET', data = null) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        // Use the authenticated user ID from the logs
        'X-User-ID': '65594c27-8659-44fe-b287-5a1cd88ce289'
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: responseData
        });
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
};

console.log('🔍 Testing Multi-Source Data Integration with Authentication\n');

// Test 1: Check data sources status
console.log('1. Testing data sources status...');
makeAuthenticatedRequest('/api/data-sources/status')
  .then(response => {
    console.log(`   Status: ${response.statusCode}`);
    if (response.statusCode === 200) {
      const data = JSON.parse(response.data);
      console.log('   ✅ Data Sources Available:', Object.keys(data).filter(k => data[k]?.available));
    } else {
      console.log('   Response:', response.data.substring(0, 100));
    }
  })
  .catch(err => console.log('   Error:', err.message));

// Test 2: Search prospects with multi-source integration
setTimeout(() => {
  console.log('\n2. Testing prospect search with multi-source integration...');
  const searchData = {
    keywords: "Software Engineer",
    industry: "Technology", 
    location: "San Francisco",
    limit: 5
  };

  makeAuthenticatedRequest('/api/prospects/search', 'POST', searchData)
    .then(response => {
      console.log(`   Status: ${response.statusCode}`);
      if (response.statusCode === 200) {
        const data = JSON.parse(response.data);
        console.log(`   ✅ Found ${data.totalResults} prospects`);
        console.log(`   ✅ Sources used: ${data.searchInsights?.dataSourcesUsed || 0}`);
        if (data.prospects && data.prospects.length > 0) {
          const firstProspect = data.prospects[0];
          console.log(`   ✅ Sample prospect: ${firstProspect.name} at ${firstProspect.company}`);
          console.log(`   ✅ Data quality: ${firstProspect.dataQuality || 0}/100`);
          console.log(`   ✅ Sources: ${firstProspect.sources?.join(', ') || 'N/A'}`);
        }
      } else {
        console.log('   Response:', response.data.substring(0, 200));
      }
    })
    .catch(err => console.log('   Error:', err.message));
}, 1000);

// Test 3: Check quality stats
setTimeout(() => {
  console.log('\n3. Testing quality statistics...');
  makeAuthenticatedRequest('/api/prospects/quality-stats')
    .then(response => {
      console.log(`   Status: ${response.statusCode}`);
      if (response.statusCode === 200) {
        const data = JSON.parse(response.data);
        console.log(`   ✅ Total prospects: ${data.total}`);
        console.log(`   ✅ Multi-source prospects: ${data.withMultipleSources}`);
        console.log(`   ✅ Average quality: ${Math.round(data.averageQuality)}/100`);
        console.log(`   ✅ Verified: ${data.verified}`);
      } else {
        console.log('   Response:', response.data.substring(0, 100));
      }
    })
    .catch(err => console.log('   Error:', err.message));
}, 2000);

console.log('\n🎯 Multi-Source Integration Test Complete');