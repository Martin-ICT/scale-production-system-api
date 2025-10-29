/**
 * Debug script untuk mencoba berbagai command SICS
 * Mencari command yang tepat untuk mendapatkan weight
 */

require('dotenv').config();
const MettlerToledoClient = require('../helpers/mettlerToledoClient');

async function debugScaleCommands() {
  console.log('🔧 DEBUG SCALE COMMANDS - 10.102.109.210:1701');
  console.log('==============================================');

  const client = new MettlerToledoClient({
    host: '10.102.109.210',
    port: 1701,
    timeout: 10000, // Increase timeout
  });

  try {
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Test berbagai command SICS untuk weight
    const weightCommands = [
      { cmd: 'P', desc: 'Current weight (immediate)' },
      { cmd: 'S', desc: 'Stable weight' },
      { cmd: 'M', desc: 'Moving weight' },
      { cmd: 'W', desc: 'Weight (alternative)' },
      { cmd: 'Q', desc: 'Quick weight' },
      { cmd: 'R', desc: 'Release/Hold' },
    ];

    console.log('🧪 Testing Weight Commands:');
    console.log('============================');

    for (const { cmd, desc } of weightCommands) {
      console.log(`\n--- Testing Command: ${cmd} (${desc}) ---`);

      try {
        const result = await client.sendCommand(cmd);
        console.log(`✅ Response:`, JSON.stringify(result, null, 2));

        // Analyze response
        if (result.raw) {
          console.log(`📊 Raw Response: "${result.raw}"`);

          // Check if it looks like a weight value
          const weightMatch = result.raw.match(
            /^([+-]?\d+\.?\d*)\s*([a-zA-Z]*)$/
          );
          if (weightMatch) {
            console.log(
              `🎯 WEIGHT FOUND! Value: ${weightMatch[1]} ${weightMatch[2]}`
            );
          } else {
            console.log(`ℹ️  Not a weight value, but valid response`);
          }
        }
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }

      // Wait between commands
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    // Test status commands
    console.log('\n\n🔍 Testing Status Commands:');
    console.log('============================');

    const statusCommands = [
      { cmd: 'I', desc: 'Information' },
      { cmd: 'U', desc: 'Unit' },
      { cmd: 'N', desc: 'Capacity' },
      { cmd: 'E', desc: 'Error status' },
    ];

    for (const { cmd, desc } of statusCommands) {
      console.log(`\n--- Testing Command: ${cmd} (${desc}) ---`);

      try {
        const result = await client.sendCommand(cmd);
        console.log(`✅ Response:`, JSON.stringify(result, null, 2));
      } catch (error) {
        console.log(`❌ Error: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Test dengan delay untuk weight reading
    console.log('\n\n⏱️  Testing Weight with Delay:');
    console.log('==============================');
    console.log('Waiting 5 seconds before trying weight commands...');

    await new Promise((resolve) => setTimeout(resolve, 5000));

    console.log('\nTrying P command again after delay...');
    try {
      const result = await client.sendCommand('P');
      console.log(`✅ Delayed P Response:`, JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(`❌ Delayed P Error: ${error.message}`);
    }

    console.log('\nTrying S command again after delay...');
    try {
      const result = await client.sendCommand('S');
      console.log(`✅ Delayed S Response:`, JSON.stringify(result, null, 2));
    } catch (error) {
      console.log(`❌ Delayed S Error: ${error.message}`);
    }
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    client.disconnect();
    console.log('\nDisconnected from scale');
  }
}

async function testScaleState() {
  console.log('\n\n🔬 SCALE STATE ANALYSIS:');
  console.log('=========================');

  console.log('Response "I4 A \\"69113776FC\\"" indicates:');
  console.log('- I4 = Information command response');
  console.log('- A = Status indicator (Active/Ready)');
  console.log('- "69113776FC" = Device serial number');
  console.log('');
  console.log('Possible reasons for weight command failure:');
  console.log('1. Scale needs calibration');
  console.log('2. Scale is in wrong mode');
  console.log('3. No object on scale (needs weight to read)');
  console.log('4. Scale needs specific setup sequence');
  console.log('5. Different SICS command format required');
  console.log('');
  console.log('Try these solutions:');
  console.log('1. Place an object on the scale');
  console.log('2. Try different weight commands (P, S, M)');
  console.log('3. Check scale manual for correct SICS commands');
  console.log('4. Try calibration sequence');
}

async function runDebug() {
  await debugScaleCommands();
  await testScaleState();

  console.log('\n🎯 DEBUG COMPLETED!');
  console.log('===================');
  console.log('Check the responses above to find the correct weight command.');
}

// Run if executed directly
if (require.main === module) {
  runDebug();
}

module.exports = {
  debugScaleCommands,
  testScaleState,
  runDebug,
};






