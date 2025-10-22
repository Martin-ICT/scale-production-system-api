const net = require('net');

/**
 * Mettler Toledo SICS Client - Functional Components
 * Handles communication with Mettler Toledo scales using SICS protocol
 */

// Connection state management
let connectionState = {
  socket: null,
  isConnected: false,
  host: '10.102.109.210',
  port: 1701,
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 2000,
  connectionDelay: 1000,
};

// Material registry (in-memory storage)
let materialRegistry = [];

// Initialize connection state
const initializeConnection = (options = {}) => {
  connectionState = {
    socket: null,
    isConnected: false,
    host: options.host || '10.102.109.210',
    port: options.port || 1701,
    timeout: options.timeout || 5000,
    retryAttempts: options.retryAttempts || 3,
    retryDelay: options.retryDelay || 2000,
    connectionDelay: options.connectionDelay || 1000,
  };
};

// Delay function for retry
const delay = async (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Connect to the scale with retry mechanism
const connect = async () => {
  let lastError;

  for (let attempt = 1; attempt <= connectionState.retryAttempts; attempt++) {
    try {
      console.log(
        `Connection attempt ${attempt}/${connectionState.retryAttempts} to ${connectionState.host}:${connectionState.port}`
      );

      const connected = await connectOnce();
      if (connected) {
        return; // Success
      }
    } catch (error) {
      lastError = error;
      console.error(`Connection attempt ${attempt} failed:`, error.message);

      if (attempt < connectionState.retryAttempts) {
        console.log(
          `Retrying in ${connectionState.retryDelay / 1000} seconds...`
        );
        await delay(connectionState.retryDelay);
      }
    }
  }

  throw new Error(
    `Failed to connect after ${connectionState.retryAttempts} attempts. Last error: ${lastError.message}`
  );
};

// Single connection attempt
const connectOnce = async () => {
  return new Promise((resolve, reject) => {
    try {
      connectionState.socket = new net.Socket();
      connectionState.socket.setTimeout(connectionState.timeout);

      connectionState.socket.on('connect', () => {
        console.log(
          `✅ Connected to Mettler Toledo scale at ${connectionState.host}:${connectionState.port}`
        );
        connectionState.isConnected = true;
        resolve(true);
      });

      connectionState.socket.on('error', (error) => {
        console.error('❌ Connection error:', error.message);
        connectionState.isConnected = false;
        reject(error);
      });

      connectionState.socket.on('timeout', () => {
        console.error('⏰ Connection timeout');
        connectionState.isConnected = false;
        connectionState.socket.destroy();
        reject(new Error('Connection timeout'));
      });

      connectionState.socket.on('close', () => {
        console.log('🔌 Connection closed');
        connectionState.isConnected = false;
      });

      connectionState.socket.connect(
        connectionState.port,
        connectionState.host
      );
    } catch (error) {
      reject(error);
    }
  });
};

// Disconnect from the scale
const disconnect = () => {
  if (connectionState.socket && connectionState.isConnected) {
    connectionState.socket.end();
    connectionState.socket.destroy();
    connectionState.isConnected = false;
  }
};

// Send SICS command to scale with retry mechanism
const sendCommand = async (command) => {
  let lastError;

  for (let attempt = 1; attempt <= connectionState.retryAttempts; attempt++) {
    try {
      // Add small delay before command to ensure scale is ready
      if (attempt > 1) {
        await delay(100);
      }

      const result = await sendCommandOnce(command);

      // Add small delay after successful command
      await delay(50);

      return result;
    } catch (error) {
      lastError = error;
      console.error(`Command attempt ${attempt} failed:`, error.message);

      // Check if connection is lost
      if (
        !connectionState.isConnected ||
        error.message.includes('Connection') ||
        error.message.includes('timeout')
      ) {
        console.log('🔌 Connection lost, attempting to reconnect...');
        try {
          await connect();
          console.log('🔄 Reconnected successfully');
        } catch (reconnectError) {
          console.error('❌ Reconnection failed:', reconnectError.message);
        }
      }

      if (attempt < connectionState.retryAttempts) {
        console.log(
          `⏳ Retrying command in ${
            connectionState.retryDelay / 1000
          } seconds...`
        );
        await delay(connectionState.retryDelay);
      }
    }
  }

  throw new Error(
    `Command failed after ${connectionState.retryAttempts} attempts. Last error: ${lastError.message}`
  );
};

// Send SICS command to scale (single attempt)
const sendCommandOnce = async (command) => {
  return new Promise((resolve, reject) => {
    if (!connectionState.isConnected) {
      reject(new Error('Not connected to scale'));
      return;
    }

    const fullCommand = command + '\r\n';
    console.log(`Sending SICS command: ${fullCommand.trim()}`);

    let responseData = '';
    let responseComplete = false;
    let timeoutId;
    let commandSent = false;

    // Handle response
    const onData = (data) => {
      if (responseComplete) return;

      // Only process response after command is sent
      if (!commandSent) {
        console.log(
          `Ignoring data before command sent: ${data.toString().trim()}`
        );
        return;
      }

      responseData += data.toString();
      console.log(`Received response: ${data.toString().trim()}`);

      // Check if we have a complete response
      const trimmed = responseData.trim();

      // SICS responses can be:
      // 1. Weight values: +1250.5 g or -1250.5 kg
      // 2. Status responses: ES, I4, I10, etc.
      // 3. Error responses: ES (error status)
      // 4. Multi-line responses that end with empty line

      if (trimmed.length > 0) {
        // Check for weight pattern
        if (trimmed.match(/^[+-]?\d+\.?\d*\s*[a-zA-Z]*$/)) {
          responseComplete = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(parseResponse(trimmed));
          return;
        }

        // Check for SICS status codes (ES, I4, I10, etc.)
        if (trimmed.match(/^[A-Z]\d*$/)) {
          responseComplete = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(parseResponse(trimmed));
          return;
        }

        // Check for multi-line responses that end with empty line
        if (trimmed.includes('\r\n') || responseData.endsWith('\r\n')) {
          responseComplete = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(parseResponse(trimmed));
          return;
        }

        // For single character responses like "ES", treat as complete after receiving
        if (trimmed.length <= 3 && /^[A-Z]+$/.test(trimmed)) {
          responseComplete = true;
          clearTimeout(timeoutId);
          cleanup();
          resolve(parseResponse(trimmed));
          return;
        }
      }
    };

    // Handle errors
    const onError = (error) => {
      if (responseComplete) return;
      responseComplete = true;
      clearTimeout(timeoutId);
      cleanup();
      reject(error);
    };

    // Cleanup function
    const cleanup = () => {
      connectionState.socket.removeListener('data', onData);
      connectionState.socket.removeListener('error', onError);
    };

    connectionState.socket.on('data', onData);
    connectionState.socket.on('error', onError);

    // Send command
    connectionState.socket.write(fullCommand, (error) => {
      if (error) {
        if (responseComplete) return;
        responseComplete = true;
        clearTimeout(timeoutId);
        cleanup();
        reject(error);
      } else {
        // Mark command as sent
        commandSent = true;
      }
    });

    // Set timeout for response
    timeoutId = setTimeout(() => {
      if (responseComplete) return;
      responseComplete = true;
      cleanup();
      reject(new Error('Command timeout'));
    }, connectionState.timeout);
  });
};

// Parse response from scale
const parseResponse = (response) => {
  const trimmed = response.trim();

  // Try to parse weight values (format: +1250.5 g or -1250.5 kg)
  const weightMatch = trimmed.match(/^([+-]?\d+\.?\d*)\s*([a-zA-Z]*)$/);
  if (weightMatch) {
    return {
      success: true,
      weight: parseFloat(weightMatch[1]),
      unit: weightMatch[2] || 'g',
      raw: trimmed,
      type: 'weight',
    };
  }

  // Handle SICS status codes
  if (trimmed.match(/^[A-Z]\d*$/)) {
    // ES = Error Status, I4 = Serial Number, I10 = Scale ID, etc.
    const isError = trimmed === 'ES';
    return {
      success: !isError,
      status: trimmed,
      isError: isError,
      message: isError ? 'Scale error status' : 'Scale status response',
      raw: trimmed,
      type: 'status',
    };
  }

  // Try to parse SICS status responses (format: I4 A "serial" or similar)
  const statusMatch = trimmed.match(/^([A-Z]\d*)\s+([A-Z])\s+"?([^"]*)"?$/);
  if (statusMatch) {
    return {
      success: true,
      command: statusMatch[1],
      status: statusMatch[2],
      data: statusMatch[3],
      raw: trimmed,
      type: 'status',
    };
  }

  // Try to parse other SICS responses
  if (
    trimmed.includes('MT-SICS') ||
    trimmed.includes('SICS') ||
    trimmed.includes('I4') ||
    trimmed.includes('I')
  ) {
    return {
      success: true,
      data: trimmed,
      raw: trimmed,
      type: 'status',
    };
  }

  // Default response
  return {
    success: true,
    data: trimmed,
    raw: trimmed,
    type: 'unknown',
  };
};

// Set ID1 (SICS command: I12 "text")
const setID1 = async (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('ID1 text must be a non-empty string');
    }

    if (text.length > 40) {
      throw new Error('ID1 text cannot exceed 40 characters');
    }

    const command = `I12 "${text}"`;
    const result = await sendCommand(command);

    // Check for error responses first
    if (result.raw === 'ES' || result.isError || result.status === 'ES') {
      throw new Error('I12 command failed - ES (Error Status)');
    }

    if (result.raw === 'I12 I' || result.data === 'I12 I') {
      throw new Error('I12 command understood but not executable');
    }

    if (result.raw === 'I12 L' || result.data === 'I12 L') {
      throw new Error('I12 command failed - text too long or wrong parameter');
    }

    // Check for success response (I12 A)
    if (result.success) {
      return {
        success: true,
        id: 'ID1',
        text: text,
        message: 'ID1 set successfully',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    // If we get here, it's an unknown response
    throw new Error(`I12 command failed - unknown response: ${result.raw}`);
  } catch (error) {
    console.error('Error setting ID1:', error);
    throw error;
  }
};

// Set ID2 (SICS command: I13 "text")
const setID2 = async (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('ID2 text must be a non-empty string');
    }

    if (text.length > 40) {
      throw new Error('ID2 text cannot exceed 40 characters');
    }

    const command = `I13 "${text}"`;
    const result = await sendCommand(command);

    // Check for error responses first
    if (result.raw === 'ES' || result.isError || result.status === 'ES') {
      throw new Error('I13 command failed - ES (Error Status)');
    }

    if (result.raw === 'I13 I' || result.data === 'I13 I') {
      throw new Error('I13 command understood but not executable');
    }

    if (result.raw === 'I13 L' || result.data === 'I13 L') {
      throw new Error('I13 command failed - text too long or wrong parameter');
    }

    // Check for success response (I13 A)
    if (result.success) {
      return {
        success: true,
        id: 'ID2',
        text: text,
        message: 'ID2 set successfully',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    // If we get here, it's an unknown response
    throw new Error(`I13 command failed - unknown response: ${result.raw}`);
  } catch (error) {
    console.error('Error setting ID2:', error);
    throw error;
  }
};

// Set ID3 (SICS command: I14 "text")
const setID3 = async (text) => {
  try {
    if (!text || typeof text !== 'string') {
      throw new Error('ID3 text must be a non-empty string');
    }

    if (text.length > 40) {
      throw new Error('ID3 text cannot exceed 40 characters');
    }

    const command = `I14 "${text}"`;
    const result = await sendCommand(command);

    // Check for error responses first
    if (result.raw === 'ES' || result.isError || result.status === 'ES') {
      throw new Error('I14 command failed - ES (Error Status)');
    }

    if (result.raw === 'I14 I' || result.data === 'I14 I') {
      throw new Error('I14 command understood but not executable');
    }

    if (result.raw === 'I14 L' || result.data === 'I14 L') {
      throw new Error('I14 command failed - text too long or wrong parameter');
    }

    // Check for success response (I14 A)
    if (result.success) {
      return {
        success: true,
        id: 'ID3',
        text: text,
        message: 'ID3 set successfully',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    // If we get here, it's an unknown response
    throw new Error(`I14 command failed - unknown response: ${result.raw}`);
  } catch (error) {
    console.error('Error setting ID3:', error);
    throw error;
  }
};

// Get ID1 value (SICS command: I12)
const getID1 = async () => {
  try {
    const result = await sendCommand('MTL LST');

    // Parse response I12_A_"text"
    const match = result.raw.match(/I12_A_"([^"]*)"/);
    if (match) {
      return {
        success: true,
        id: 'ID1',
        text: match[1],
        message: 'ID1 retrieved successfully',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    if (result.raw === 'I12_I' || result.data === 'I12_I') {
      throw new Error('I12 command understood but not executable');
    }

    return {
      success: true,
      id: 'ID1',
      text: result.raw,
      message: 'ID1 retrieved successfully',
      raw: result.raw,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting ID1:', error);
    throw error;
  }
};

// Get ID2 value (SICS command: I13)
const getID2 = async () => {
  try {
    const result = await sendCommand('I13');

    // Parse response I13_A_"text"
    const match = result.raw.match(/I13_A_"([^"]*)"/);
    if (match) {
      return {
        success: true,
        id: 'ID2',
        text: match[1],
        message: 'ID2 retrieved successfully',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    if (result.raw === 'I13_I' || result.data === 'I13_I') {
      throw new Error('I13 command understood but not executable');
    }

    return {
      success: true,
      id: 'ID2',
      text: result.raw,
      message: 'ID2 retrieved successfully',
      raw: result.raw,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting ID2:', error);
    throw error;
  }
};

// Get ID3 value (SICS command: I14)
const getID3 = async () => {
  try {
    const result = await sendCommand('I14');

    // Parse response I14_A_"text"
    const match = result.raw.match(/I14_A_"([^"]*)"/);
    if (match) {
      return {
        success: true,
        id: 'ID3',
        text: match[1],
        message: 'ID3 retrieved successfully',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    if (result.raw === 'I14_I' || result.data === 'I14_I') {
      throw new Error('I14 command understood but not executable');
    }

    return {
      success: true,
      id: 'ID3',
      text: result.raw,
      message: 'ID3 retrieved successfully',
      raw: result.raw,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting ID3:', error);
    throw error;
  }
};

// Get stable weight from scale (SICS command: S)
const getStableWeight = async () => {
  try {
    const result = await sendCommand('S');
    console.log('GILA', result);

    // Parse weight response (format: +1250.5 g or similar)
    const weightMatch = result.raw.match(/^([+-]?\d+\.?\d*)\s*([a-zA-Z]*)$/);
    if (weightMatch) {
      return {
        success: true,
        weight: parseFloat(weightMatch[1]),
        unit: weightMatch[2] || 'g',
        raw: result.raw,
        timestamp: new Date().toISOString(),
      };
    }

    // If not a weight response, return as is
    return {
      success: true,
      data: result.raw,
      raw: result.raw,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting stable weight:', error);
    throw error;
  }
};

// ==================== MATERIAL MANAGEMENT ====================

/**
 * Register a new material
 * @param {string} materialId - Unique material ID
 * @param {string} description - Material description
 * @param {object} additionalData - Additional data (optional)
 * @returns {object} Registered material
 */
const registerMaterial = (materialId, description, additionalData = {}) => {
  try {
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Material ID must be a non-empty string');
    }

    if (!description || typeof description !== 'string') {
      throw new Error('Description must be a non-empty string');
    }

    // Check if material already exists
    const existingMaterial = materialRegistry.find(
      (m) => m.materialId === materialId
    );
    if (existingMaterial) {
      throw new Error(`Material with ID "${materialId}" already exists`);
    }

    const material = {
      materialId,
      description,
      ...additionalData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    materialRegistry.push(material);

    return {
      success: true,
      message: 'Material registered successfully',
      material,
    };
  } catch (error) {
    console.error('Error registering material:', error);
    throw error;
  }
};

/**
 * Update existing material
 * @param {string} materialId - Material ID to update
 * @param {object} updates - Fields to update
 * @returns {object} Updated material
 */
const updateMaterial = (materialId, updates = {}) => {
  try {
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Material ID must be a non-empty string');
    }

    const materialIndex = materialRegistry.findIndex(
      (m) => m.materialId === materialId
    );

    if (materialIndex === -1) {
      throw new Error(`Material with ID "${materialId}" not found`);
    }

    // Update material
    materialRegistry[materialIndex] = {
      ...materialRegistry[materialIndex],
      ...updates,
      materialId, // Don't allow changing materialId
      updatedAt: new Date().toISOString(),
    };

    return {
      success: true,
      message: 'Material updated successfully',
      material: materialRegistry[materialIndex],
    };
  } catch (error) {
    console.error('Error updating material:', error);
    throw error;
  }
};

/**
 * Get list of all registered materials
 * @param {object} filters - Optional filters (search, limit, offset)
 * @returns {object} List of materials
 */
const getMaterialList = (filters = {}) => {
  try {
    let materials = [...materialRegistry];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      materials = materials.filter(
        (m) =>
          m.materialId.toLowerCase().includes(searchLower) ||
          m.description.toLowerCase().includes(searchLower)
      );
    }

    // Apply pagination
    const total = materials.length;
    const offset = filters.offset || 0;
    const limit = filters.limit || total;

    materials = materials.slice(offset, offset + limit);

    return {
      success: true,
      total,
      count: materials.length,
      offset,
      limit,
      materials,
    };
  } catch (error) {
    console.error('Error getting material list:', error);
    throw error;
  }
};

/**
 * Get specific material by ID
 * @param {string} materialId - Material ID
 * @returns {object} Material details
 */
const getMaterialById = (materialId) => {
  try {
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Material ID must be a non-empty string');
    }

    const material = materialRegistry.find((m) => m.materialId === materialId);

    if (!material) {
      throw new Error(`Material with ID "${materialId}" not found`);
    }

    return {
      success: true,
      material,
    };
  } catch (error) {
    console.error('Error getting material:', error);
    throw error;
  }
};

/**
 * Delete material from registry
 * @param {string} materialId - Material ID to delete
 * @returns {object} Deletion result
 */
const deleteMaterial = (materialId) => {
  try {
    if (!materialId || typeof materialId !== 'string') {
      throw new Error('Material ID must be a non-empty string');
    }

    const materialIndex = materialRegistry.findIndex(
      (m) => m.materialId === materialId
    );

    if (materialIndex === -1) {
      throw new Error(`Material with ID "${materialId}" not found`);
    }

    const deletedMaterial = materialRegistry.splice(materialIndex, 1)[0];

    return {
      success: true,
      message: 'Material deleted successfully',
      material: deletedMaterial,
    };
  } catch (error) {
    console.error('Error deleting material:', error);
    throw error;
  }
};

/**
 * Use material for weighing (set material info to scale IDs)
 * @param {string} materialId - Material ID to use
 * @returns {object} Result of setting material to scale
 */
const useMaterial = async (materialId) => {
  try {
    // Get material from registry
    const materialResult = getMaterialById(materialId);
    const material = materialResult.material;

    // Set material info to scale IDs
    // ID1 = Material ID
    // ID2 = Material Description
    // ID3 = Timestamp
    const id1Result = await setID1(material.materialId);
    const id2Result = await setID2(material.description);
    const id3Result = await setID3(
      `Used: ${new Date().toISOString().split('T')[0]}`
    );

    return {
      success: true,
      message: 'Material set to scale successfully',
      material,
      scaleIds: {
        id1: id1Result,
        id2: id2Result,
        id3: id3Result,
      },
    };
  } catch (error) {
    console.error('Error using material:', error);
    throw error;
  }
};

/**
 * Clear all materials from registry
 * @returns {object} Clear result
 */
const clearMaterialRegistry = () => {
  try {
    const count = materialRegistry.length;
    materialRegistry = [];

    return {
      success: true,
      message: `Cleared ${count} materials from registry`,
      count,
    };
  } catch (error) {
    console.error('Error clearing material registry:', error);
    throw error;
  }
};

// Export all functional components
module.exports = {
  // Connection management
  initializeConnection,
  connect,
  connectOnce,
  disconnect,
  sendCommand,
  sendCommandOnce,
  parseResponse,
  delay,

  // Scale ID management
  setID1,
  setID2,
  setID3,
  getID1,
  getID2,
  getID3,
  getStableWeight,

  // Material management
  registerMaterial,
  updateMaterial,
  getMaterialList,
  getMaterialById,
  deleteMaterial,
  useMaterial,
  clearMaterialRegistry,
};
