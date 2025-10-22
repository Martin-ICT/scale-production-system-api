/**
 * Test script for Material Management
 * Demonstrates material registration and usage with scale
 */

require('dotenv').config();
const {
  initializeConnection,
  connect,
  disconnect,
  registerMaterial,
  updateMaterial,
  getMaterialList,
  getMaterialById,
  deleteMaterial,
  useMaterial,
  clearMaterialRegistry,
  getStableWeight,
} = require('../helpers/mettlerToledoClient');

async function testMaterialManagement() {
  console.log('=== Testing Material Management ===\n');

  try {
    // ==================== MATERIAL REGISTRATION ====================
    console.log('--- Registering Materials ---');

    const material1 = registerMaterial('MAT-001', 'Corn Feed Grade A', {
      category: 'Feed',
      unit: 'kg',
      supplier: 'PT Supplier A',
    });
    console.log('Material 1:', material1);

    const material2 = registerMaterial('MAT-002', 'Soybean Meal Premium', {
      category: 'Feed',
      unit: 'kg',
      supplier: 'PT Supplier B',
    });
    console.log('Material 2:', material2);

    const material3 = registerMaterial('MAT-003', 'Wheat Flour Type 1', {
      category: 'Flour',
      unit: 'kg',
      supplier: 'PT Supplier C',
    });
    console.log('Material 3:', material3);

    // ==================== GET MATERIAL LIST ====================
    console.log('\n--- Material List ---');
    const materialList = getMaterialList();
    console.log('Total Materials:', materialList.total);
    console.log('Materials:', materialList.materials);

    // ==================== SEARCH MATERIALS ====================
    console.log('\n--- Search Materials (search: "feed") ---');
    const searchResult = getMaterialList({ search: 'feed' });
    console.log('Search Results:', searchResult);

    // ==================== GET MATERIAL BY ID ====================
    console.log('\n--- Get Material by ID (MAT-001) ---');
    const materialDetail = getMaterialById('MAT-001');
    console.log('Material Detail:', materialDetail);

    // ==================== UPDATE MATERIAL ====================
    console.log('\n--- Update Material (MAT-001) ---');
    const updatedMaterial = updateMaterial('MAT-001', {
      description: 'Corn Feed Grade A - Updated',
      price: 5000,
    });
    console.log('Updated Material:', updatedMaterial);

    // ==================== CONNECT TO SCALE AND USE MATERIAL ====================
    console.log('\n--- Connecting to Scale ---');
    initializeConnection({
      host: '10.102.109.210',
      port: 1701,
      timeout: 10000,
      retryAttempts: 3,
      retryDelay: 2000,
      connectionDelay: 1000,
    });

    await connect();
    console.log('✅ Connected successfully!');

    // Use material MAT-001 for weighing
    console.log('\n--- Using Material MAT-001 for Weighing ---');
    const useMaterialResult = await useMaterial('MAT-001');
    console.log('Material Set to Scale:', useMaterialResult);

    // Get weight with material info
    console.log('\n--- Getting Stable Weight ---');
    const weightResult = await getStableWeight();
    console.log('Weight Result:', weightResult);
    console.log('Material:', useMaterialResult.material.materialId);
    console.log('Description:', useMaterialResult.material.description);

    // Use another material
    console.log('\n--- Using Material MAT-002 for Weighing ---');
    const useMaterial2Result = await useMaterial('MAT-002');
    console.log('Material Set to Scale:', useMaterial2Result);

    // Get weight again
    console.log('\n--- Getting Stable Weight ---');
    const weightResult2 = await getStableWeight();
    console.log('Weight Result:', weightResult2);
    console.log('Material:', useMaterial2Result.material.materialId);
    console.log('Description:', useMaterial2Result.material.description);

    // ==================== DELETE MATERIAL ====================
    console.log('\n--- Delete Material (MAT-003) ---');
    const deleteResult = deleteMaterial('MAT-003');
    console.log('Delete Result:', deleteResult);

    // ==================== MATERIAL LIST AFTER DELETION ====================
    console.log('\n--- Material List After Deletion ---');
    const materialListAfter = getMaterialList();
    console.log('Total Materials:', materialListAfter.total);
    console.log('Materials:', materialListAfter.materials);

    // ==================== PAGINATION TEST ====================
    console.log('\n--- Pagination Test (limit: 1, offset: 0) ---');
    const paginatedList = getMaterialList({ limit: 1, offset: 0 });
    console.log('Paginated Result:', paginatedList);

    // ==================== CLEAR REGISTRY (Optional) ====================
    // console.log('\n--- Clear Material Registry ---');
    // const clearResult = clearMaterialRegistry();
    // console.log('Clear Result:', clearResult);
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    disconnect();
    console.log('\n✅ Test completed!');
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testMaterialManagement();
}

module.exports = {
  testMaterialManagement,
};
