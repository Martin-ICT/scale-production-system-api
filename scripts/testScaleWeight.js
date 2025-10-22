/**
 * Test script for scaleGetWeight functionality
 * Tests SICS communication with Mettler Toledo scale
 */

require('dotenv').config();
const MettlerToledoClient = require('../helpers/mettlerToledoClient');

async function testDirectConnection() {
  console.log('=== Testing Direct Connection to Mettler Toledo Scale ===');
  console.log('IP: 10.102.109.210');
  console.log('Port: 1701');

  const client = new MettlerToledoClient({
    host: '10.102.109.210',
    port: 1701,
    timeout: 10000,
    retryAttempts: 3, // Retry 3 times
    retryDelay: 2000, // Wait 2 seconds between retries
    connectionDelay: 1000, // Wait 1 second between connection attempts
  });

  try {
    console.log('\n--- Connecting to scale ---');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('\n--- Detecting Supported Commands ---');
    try {
      const commandDetection = await client.detectSupportedCommands();
      console.log('Command Detection Complete:', commandDetection);
    } catch (detectionError) {
      console.error('Command Detection Error:', detectionError.message);
    }

    console.log('\n--- Testing Weight Reading ---');
    const weightResult = await client.getStableWeight();
    console.log('Weight Result:', weightResult);

    console.log('\n--- Testing Status Reading ---');
    try {
      const statusResult = await client.getStatus();
      console.log('Status Result:', statusResult);
    } catch (statusError) {
      console.error('Status Error:', statusError.message);
      // Continue with other tests even if status fails
    }

    console.log('\n--- Testing Scale ID Management ---');
    try {
      // Get current scale ID
      const currentId = await client.getScaleId();
      console.log('Current Scale ID:', currentId);

      // Set new scale ID
      const newId = `Scale_${Date.now()}`.substring(0, 20);
      const setIdResult = await client.setScaleId(newId);
      console.log('Set ID Result:', setIdResult);

      // Verify the new ID
      const verifyId = await client.getScaleId();
      console.log('Verified Scale ID:', verifyId);

      // Get scale serial number
      const serialNumber = await client.getSerialNumber();
      console.log('Serial Number:', serialNumber);
    } catch (idError) {
      console.error('ID Management Error:', idError.message);
    }

    console.log('\n--- Testing Sample/Transaction ID Management ---');
    try {
      // Set transaction ID for printout
      const transactionId = `TXN_${Date.now()}`.substring(0, 20);
      const setTxnResult = await client.setTransactionId(transactionId);
      console.log('Transaction ID Set:', setTxnResult);

      // Set batch ID for printout
      const batchId = `BATCH_${Date.now()}`.substring(0, 20);
      const setBatchResult = await client.setBatchId(batchId);
      console.log('Batch ID Set:', setBatchResult);

      const getScaleId = await client.getScaleId();
      console.log('Scale Id', getScaleId);

      const getIdList = await client.getIdList();
      console.log(' Id List', getIdList);

      // Set custom sample ID
      const customResult = await client.setSampleId('SampleID', 'SAMPLE_001');
      console.log('Custom Sample ID Set:', customResult);

      // Print weight with sample IDs (this will trigger printout)
      console.log('\n--- Printing Weight with Sample IDs ---');
      const printResult = await client.printStableWeight();
      console.log('Print Result:', printResult);

      // Interactive ID value lookup
      console.log('\n--- Interactive ID Value Lookup ---');
      try {
        const idValue = await client.getInteractiveIdValue();
        if (idValue) {
          console.log('Successfully got ID value:', idValue);
        }
      } catch (interactiveError) {
        console.error('Interactive ID lookup error:', interactiveError.message);
      }

      // User Input ID Management
      console.log('\n--- User Input ID Management ---');
      try {
        // Set PO ID like in the image
        const poResult = await client.setPOId('156ged');
        console.log('PO ID Set:', poResult);

        // Set Batch ID
        const batchResult = await client.setBatchId('BATCH_001');
        console.log('Batch ID Set:', batchResult);

        // Set Sample ID (User Input)
        const sampleResult = await client.setSampleIdUser('SAMPLE_A');
        console.log('Sample ID Set:', sampleResult);

        // Get PO ID value
        const getPOResult = await client.getUserInputId('PO');
        console.log('PO ID Value:', getPOResult);

        // Interactive user input ID setting
        console.log('\n--- Interactive User Input ID Setting ---');
        const interactiveResult = await client.setInteractiveUserInputId();
        if (interactiveResult) {
          console.log('Interactive ID Set Successfully:', interactiveResult);
        }
      } catch (userInputError) {
        console.error('User Input ID Error:', userInputError.message);
      }

      // I12, I13, I14 ID Management (Official SICS Commands)
      console.log('\n--- I12, I13, I14 ID Management ---');
      try {
        // Set ID1, ID2, ID3
        const id1Result = await client.setID1('steven');
        console.log('ID1 Set:', id1Result);

        const id2Result = await client.setID2('suoper');
        console.log('ID2 Set:', id2Result);

        const id3Result = await client.setID3('SAMPLE: SAMPLE_A');
        console.log('ID3 Set:', id3Result);

        // Get ID1, ID2, ID3 values
        const getID1Result = await client.getID1();
        console.log('ID1 Value:', getID1Result);

        const getID2Result = await client.getID2();
        console.log('ID2 Value:', getID2Result);

        const getID3Result = await client.getID3();
        console.log('ID3 Value:', getID3Result);

        // Print with all IDs set
        console.log('\n--- Printing with I12/I13/I14 IDs ---');
        const printWithIds = await client.printStableWeight();
        console.log('Print Result with IDs:', printWithIds);
      } catch (idsError) {
        console.error('I12/I13/I14 ID Error:', idsError.message);
      }
    } catch (sampleError) {
      console.error('Sample ID Management Error:', sampleError.message);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.disconnect();
    console.log('\nDisconnected from scale');
  }
}

async function testGraphQLQuery() {
  console.log('\n=== GraphQL Query Examples ===');
  console.log('Use these queries in GraphQL Playground:');

  console.log(`
1. Get Scale Weight:
query GetScaleWeight($scaleId: Int!) {
  scaleGetWeight(scaleId: $scaleId) {
    success
    weight
    unit
    raw
    scaleId
    scaleName
    deviceIP
    timestamp
  }
}

Variables:
{
  "scaleId": 1
}

2. Get Scale ID (if implemented):
query GetScaleId($scaleId: Int!) {
  scaleGetId(scaleId: $scaleId) {
    success
    scaleId
    deviceIP
    timestamp
  }
}

3. Set Sample ID for Printout (if implemented):
mutation SetSampleId($scaleId: Int!, $label: String!, $value: String!) {
  scaleSetSampleId(scaleId: $scaleId, label: $label, value: $value) {
    success
    label
    value
    message
    timestamp
  }
}

Variables:
{
  "scaleId": 1,
  "label": "TransactionID",
  "value": "TXN_001"
}

4. Print Weight with Sample ID (if implemented):
mutation PrintWeightWithId($scaleId: Int!) {
  scalePrintWeight(scaleId: $scaleId) {
    success
    weight
    unit
    message
    timestamp
  }
}
  `);
}

async function runTests() {
  console.log('🧪 Scale Weight Test Suite');
  console.log('============================');

  try {
    await testDirectConnection();
    await testGraphQLQuery();

    console.log('\n✅ Test suite completed!');
    console.log('\nNext steps:');
    console.log('1. Ensure your Mettler Toledo scale is powered on');
    console.log('2. Verify network connectivity to 10.102.109.210:1701');
    console.log('3. Check scale SICS configuration');
    console.log(
      '4. Test the GraphQL query in Apollo Studio/GraphQL Playground'
    );
    console.log(
      '5. Make sure you have a scale record in the database with ID 1'
    );
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testDirectConnection,
  testGraphQLQuery,
  runTests,
};
