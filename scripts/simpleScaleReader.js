const net = require('net');

/**
 * Simple IND400 Reader - Hanya Listen untuk Print Data
 * Tidak kirim command, hanya terima data saat IND400 print
 */

const SCALE_IP = '10.102.109.141';
const SCALE_PORT = 1702;

let client = null;
let reconnectTimer = null;
let isConnected = false;

function connect() {
  console.log('🔌 Connecting to IND400...');
  console.log(`   IP: ${SCALE_IP}`);
  console.log(`   Port: ${SCALE_PORT}`);
  console.log('');

  client = new net.Socket();

  // Set keepalive
  client.setKeepAlive(true, 30000);

  // Connect
  client.connect(SCALE_PORT, SCALE_IP, () => {
    isConnected = true;
    console.log('✅ Connected to IND400!');
    console.log('📡 Listening for print data...');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Taruh barang di timbangan');
    console.log('   - Tunggu sampai stabil');
    console.log('   - Tekan tombol Print di IND400 (jika ada)');
    console.log('   - Atau data akan otomatis muncul jika auto-print enabled');
    console.log('');
    console.log('Press Ctrl+C to exit');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
  });

  // Receive data
  client.on('data', (data) => {
    const timestamp = new Date().toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });

    const rawData = data.toString();

    // Print raw data
    console.log(`[${timestamp}] RAW: ${JSON.stringify(rawData)}`);
    console.log(`[${timestamp}] HEX: ${Buffer.from(rawData).toString('hex')}`);

    // Clean and parse
    const cleanData = rawData.replace(/[\r\n\t]/g, '').trim();
    if (cleanData) {
      console.log(`[${timestamp}] CLEAN: ${cleanData}`);

      // Try parse
      const parsed = parseScaleData(cleanData);
      if (parsed) {
        console.log(`[${timestamp}] PARSED:`);
        console.log(`                Weight: ${parsed.weight} ${parsed.unit}`);
        console.log(
          `                Status: ${
            parsed.isStable ? '✅ STABLE' : '⚠️  UNSTABLE'
          }`
        );
        if (parsed.scaleId) {
          console.log(`                Scale ID: ${parsed.scaleId}`);
        }
      }
    }

    console.log(
      '─────────────────────────────────────────────────────────────'
    );
    console.log('');
  });

  // Handle close
  client.on('close', () => {
    isConnected = false;
    console.log('');
    console.log('❌ Connection closed');

    // Auto reconnect after 5 seconds
    console.log('🔄 Will retry in 5 seconds...');
    reconnectTimer = setTimeout(() => {
      connect();
    }, 5000);
  });

  // Handle error
  client.on('error', (error) => {
    isConnected = false;
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('   Code:', error.code);
    console.error('');

    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Possible issues:');
      console.error('   - IND400 is turned off');
      console.error('   - Wrong IP address (current: ' + SCALE_IP + ')');
      console.error('   - Wrong port (current: ' + SCALE_PORT + ')');
      console.error('   - Network cable not connected');
      console.error('');
    }
  });

  // Handle timeout
  client.setTimeout(60000); // 60 second timeout
  client.on('timeout', () => {
    console.log('⚠️  Connection timeout (no data for 60 seconds)');
    console.log('   Connection is still open, waiting for data...');
    console.log('');
  });
}

// Parse scale data
function parseScaleData(cleanData) {
  try {
    // Pattern 1: SCALEID,STATUS,WEIGHT,UNIT
    const pattern1 = /^([A-Z0-9]+),(ST|US),([+-]?\d+\.?\d*),(\w+)$/i;
    const match1 = cleanData.match(pattern1);

    if (match1) {
      return {
        scaleId: match1[1],
        status: match1[2].toUpperCase(),
        isStable: match1[2].toUpperCase() === 'ST',
        weight: parseFloat(match1[3]),
        unit: match1[4],
      };
    }

    // Pattern 2: STATUS,WEIGHT,UNIT
    const pattern2 = /^(ST|US),([+-]?\d+\.?\d*),(\w+)$/i;
    const match2 = cleanData.match(pattern2);

    if (match2) {
      return {
        status: match2[1].toUpperCase(),
        isStable: match2[1].toUpperCase() === 'ST',
        weight: parseFloat(match2[2]),
        unit: match2[3],
      };
    }

    // Pattern 3: Just weight and unit
    const pattern3 = /([+-]?\d+\.?\d*)\s*(\w+)/i;
    const match3 = cleanData.match(pattern3);

    if (match3) {
      return {
        weight: parseFloat(match3[1]),
        unit: match3[2],
        isStable: true,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('');
  console.log('🛑 Shutting down...');

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
  }

  if (client) {
    client.destroy();
  }

  process.exit(0);
});

// Start
connect();
