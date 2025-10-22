/**
 * Test script for network scanning functionality
 * Tests finding connected scales in the network
 */

require('dotenv').config();
const NetworkScanner = require('../helpers/networkScanner');

async function testNetworkInfo() {
  console.log('=== Testing Network Information ===');

  const scanner = new NetworkScanner();
  const networks = scanner.getLocalNetworkInfo();

  console.log('Local Network Information:');
  networks.forEach((network, index) => {
    console.log(`${index + 1}. Interface: ${network.interface}`);
    console.log(`   IP: ${network.ip}`);
    console.log(`   Subnet: ${network.subnet}.x`);
    console.log(`   Netmask: ${network.netmask}`);
    console.log('');
  });

  return networks;
}

async function testPortScanning() {
  console.log('=== Testing Port Scanning ===');

  const scanner = new NetworkScanner({
    defaultPorts: [1701, 4001, 4002, 4003],
    timeout: 1000,
    maxConcurrent: 10,
  });

  // Test scanning a specific subnet (adjust based on your network)
  const networks = scanner.getLocalNetworkInfo();
  if (networks.length === 0) {
    console.log('❌ No network interfaces found');
    return;
  }

  const testSubnet = networks[0].subnet;
  console.log(`Scanning subnet: ${testSubnet}.x`);
  console.log('This may take a while...\n');

  try {
    const results = await scanner.scanSubnet(testSubnet);

    console.log(`Found ${results.length} open port(s):`);
    results.forEach((result, index) => {
      console.log(
        `${index + 1}. ${result.ip}:${result.port} - ${result.deviceType}`
      );
    });

    return results;
  } catch (error) {
    console.error('❌ Port scanning failed:', error.message);
    return [];
  }
}

async function testScaleDetection() {
  console.log('\n=== Testing Scale Detection ===');

  const scanner = new NetworkScanner();

  // Test known scale IP (adjust to your actual scale IP)
  const knownScaleIP = '10.102.109.210';
  console.log(`Testing connection to known scale: ${knownScaleIP}`);

  try {
    const result = await scanner.quickScan(knownScaleIP);

    if (result) {
      console.log('✅ Scale detected:');
      console.log(`   IP: ${result.ip}`);
      console.log(`   Port: ${result.port}`);
      console.log(`   Device Type: ${result.deviceType}`);
      console.log(`   Status: ${result.status}`);
      console.log(`   Device Info:`, result.deviceInfo);
    } else {
      console.log('❌ No scale detected at', knownScaleIP);
    }

    return result;
  } catch (error) {
    console.error('❌ Scale detection failed:', error.message);
    return null;
  }
}

async function testFullNetworkScan() {
  console.log('\n=== Testing Full Network Scan ===');
  console.log('Scanning all networks for connected scales...');
  console.log('This may take several minutes...\n');

  const scanner = new NetworkScanner({
    defaultPorts: [1701, 4001, 4002, 4003],
    timeout: 2000,
    maxConcurrent: 20,
  });

  try {
    const connectedScales = await scanner.findConnectedScales();

    console.log(`Found ${connectedScales.length} connected scale(s):`);
    connectedScales.forEach((scale, index) => {
      console.log(`${index + 1}. ${scale.ip}:${scale.port}`);
      console.log(`   Device Type: ${scale.deviceType}`);
      console.log(`   Status: ${scale.status}`);
      console.log(`   Device Info:`, scale.deviceInfo);
      console.log(`   Last Checked: ${scale.lastChecked}`);
      console.log('');
    });

    return connectedScales;
  } catch (error) {
    console.error('❌ Full network scan failed:', error.message);
    return [];
  }
}

async function testGraphQLQuery() {
  console.log('\n=== GraphQL Query Example ===');
  console.log('Use this query in GraphQL Playground:');

  console.log(`
query GetConnectedScales {
  scaleConnectedList {
    totalFound
    connectedCount
    offlineCount
    scanTimestamp
    scales {
      ip
      port
      deviceType
      status
      deviceInfo
      lastChecked
      scaleId
      scaleName
      deviceId
      isInDatabase
    }
  }
}
  `);
}

async function runTests() {
  console.log('🔍 Network Scanning Test Suite');
  console.log('================================');

  try {
    // Test 1: Network Information
    await testNetworkInfo();

    // Test 2: Port Scanning (limited)
    await testPortScanning();

    // Test 3: Scale Detection (specific IP)
    await testScaleDetection();

    // Test 4: GraphQL Query Example
    await testGraphQLQuery();

    console.log('\n✅ Basic tests completed!');
    console.log('\nOptional: Run full network scan (takes longer)');
    console.log('Uncomment the line below to run full scan:');
    console.log('// await testFullNetworkScan();');

    // Uncomment to run full network scan
    // await testFullNetworkScan();

    console.log('\nNext steps:');
    console.log('1. Verify network connectivity');
    console.log('2. Check firewall settings');
    console.log(
      '3. Test the GraphQL query in Apollo Studio/GraphQL Playground'
    );
    console.log('4. Adjust timeout and concurrent settings if needed');
  } catch (error) {
    console.error('❌ Test suite failed:', error);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests();
}

module.exports = {
  testNetworkInfo,
  testPortScanning,
  testScaleDetection,
  testFullNetworkScan,
  testGraphQLQuery,
  runTests,
};
