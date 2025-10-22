/**
 * Simple test script for I12, I13, I14 ID Management
 * Tests SICS communication with Mettler Toledo scale using Functional Components
 */

require('dotenv').config();
const {
  initializeConnection,
  connect,
  disconnect,
  setID1,
  setID2,
  setID3,
  getID1,
  getID2,
  getID3,
  getStableWeight,
} = require('../helpers/mettlerToledoClient');

async function testSimple() {
  console.log('=== Testing I12, I13, I14 ID Management (Functional) ===');
  console.log('IP: 10.102.109.210');
  console.log('Port: 1701');

  // Initialize connection with options
  initializeConnection({
    host: '10.102.109.210',
    port: 1701,
    timeout: 10000,
    retryAttempts: 3, // Retry 3 times
    retryDelay: 2000, // Wait 2 seconds between retries
    connectionDelay: 1000, // Wait 1 second between connection attempts
  });

  try {
    console.log('\n--- Connecting to scale ---');
    await connect();
    console.log('✅ Connected successfully!');

    // I12, I13, I14 ID Management (Official SICS Commands)
    console.log('\n--- I12, I13, I14 ID Management ---');
    try {
      // Set ID1, ID2, ID3
      const test = await setID1('cobain lagi bu rini');
      console.log('Test:', test);

      const id1Result = await setID1('cobain lagi bu rini');
      console.log('ID1 Set:', id1Result);

      const id2Result = await setID2('BATCH: BATCH_001');
      console.log('ID2 Set:', id2Result);

      const id3Result = await setID3('SAMPLE: SAMPLE_A');
      console.log('ID3 Set:', id3Result);

      // Get ID1, ID2, ID3 values
      const getID1Result = await getID1();
      console.log('ID1 Value:', getID1Result);

      //   const getID2Result = await getID2();
      //   console.log('ID2 Value:', getID2Result);

      //   const getID3Result = await getID3();
      //   console.log('ID3 Value:', getID3Result);

      // Get stable weight
      console.log('\n--- Getting Stable Weight ---');
      const weightResult = await getStableWeight();
      console.log('Stable Weight Result:', weightResult);
    } catch (idsError) {
      console.error('I12/I13/I14 ID Error:', idsError.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    disconnect();
    console.log('\nDisconnected from scale');
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testSimple();
}

module.exports = {
  testSimple,
};
