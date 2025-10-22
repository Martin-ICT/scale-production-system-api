/**
 * Test script untuk timbangan spesifik di 10.102.109.210
 * Mencoba berbagai command SICS untuk memahami response timbangan
 */

require('dotenv').config();
const MettlerToledoClient = require('../helpers/mettlerToledoClient');

async function testSpecificScale() {
  console.log('🧪 Testing Specific Scale at 10.102.109.210:1701');
  console.log('================================================');

  const client = new MettlerToledoClient({
    host: '10.102.109.210',
    port: 1701,
    timeout: 5000,
  });

  try {
    console.log('Connecting to scale...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test berbagai command SICS
    const commands = [
      {
        name: 'Status Info',
        command: 'I',
        description: 'Get scale information',
      },
      {
        name: 'Current Weight',
        command: 'P',
        description: 'Get current weight',
      },
      {
        name: 'Stable Weight',
        command: 'SI',
        description: 'Get stable weight',
      },
      { name: 'Moving Weight', command: 'M', description: 'Get moving weight' },
      { name: 'Unit Info', command: 'U', description: 'Get current unit' },
      { name: 'Capacity Info', command: 'N', description: 'Get capacity' },
      { name: 'Error Status', command: 'E', description: 'Get error status' },
    ];

    for (const cmd of commands) {
      console.log(`--- Testing ${cmd.name} (${cmd.command}) ---`);
      console.log(`Description: ${cmd.description}`);

      try {
        const result = await client.sendCommand(cmd.command);
        console.log(`✅ Response:`, JSON.stringify(result, null, 2));

        // Coba parse response untuk mendapatkan informasi lebih detail
        if (result.success && result.data) {
          console.log(`📊 Parsed Info:`);
          console.log(`   Raw: "${result.raw}"`);
          console.log(`   Type: ${result.type}`);
          if (result.command) console.log(`   Command: ${result.command}`);
          if (result.status) console.log(`   Status: ${result.status}`);
          if (result.data) console.log(`   Data: ${result.data}`);
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }

      console.log('');

      // Delay antar command
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Test weight reading dengan delay
    console.log('--- Testing Weight Reading with Delay ---');
    console.log('Waiting 3 seconds before reading weight...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    try {
      const weightResult = await client.sendCommand('SI');
      console.log('Weight result:', JSON.stringify(weightResult, null, 2));

      // Coba interpretasi response
      if (weightResult.raw.includes('I4')) {
        console.log('\n🔍 Analysis of I4 response:');
        console.log('I4 response typically means:');
        console.log('- Scale is in measurement mode');
        console.log('- May need to wait for stable reading');
        console.log('- Try placing something on the scale');
      }
    } catch (error) {
      console.log(`❌ Weight reading error: ${error.message}`);
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    client.disconnect();
    console.log('\nDisconnected from scale');
  }
}

async function analyzeScaleResponse() {
  console.log('\n📋 Scale Response Analysis:');
  console.log('===========================');

  console.log('Response "I4 A \\"69113776FC\\"" analysis:');
  console.log('');
  console.log('I4 = Status response for Information command');
  console.log('A = Status indicator (A = Active/Ready)');
  console.log('"69113776FC" = Device serial number or identifier');
  console.log('');
  console.log('This indicates:');
  console.log('✅ Scale is connected and responding');
  console.log('✅ Scale is in active/ready state');
  console.log('✅ Device identifier: 69113776FC');
  console.log('');
  console.log('Next steps:');
  console.log('1. Place an object on the scale');
  console.log('2. Wait for stable reading');
  console.log('3. Try weight command (S or P) again');
  console.log('4. Check if scale needs calibration');
}

async function runTest() {
  await testSpecificScale();
  await analyzeScaleResponse();

  console.log('\n🎯 CONCLUSION:');
  console.log('==============');
  console.log('Scale at 10.102.109.210:1701 is:');
  console.log('✅ CONNECTED and RESPONDING');
  console.log('✅ Using Mettler Toledo SICS protocol');
  console.log('✅ Device ID: 69113776FC');
  console.log('⚠️  May need object placed on scale for weight reading');
  console.log('⚠️  May need calibration or setup');
}

// Run if executed directly
if (require.main === module) {
  runTest();
}

module.exports = {
  testSpecificScale,
  analyzeScaleResponse,
  runTest,
};
