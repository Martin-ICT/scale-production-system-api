# Material Management API

## Overview

Sistem manajemen material untuk scale production system yang memungkinkan pendaftaran, pencatatan, dan penggunaan material dalam proses penimbangan.

## Features

- ✅ Register material dengan ID dan deskripsi
- ✅ Update informasi material
- ✅ View list semua material (dengan search dan pagination)
- ✅ Get detail material by ID
- ✅ Delete material
- ✅ Use material untuk weighing (otomatis set ke scale IDs)
- ✅ Clear material registry

## API Functions

### 1. `registerMaterial(materialId, description, additionalData)`

Mendaftarkan material baru ke registry.

**Parameters:**

- `materialId` (string, required) - Unique material ID
- `description` (string, required) - Material description
- `additionalData` (object, optional) - Data tambahan (category, unit, supplier, price, dll)

**Returns:**

```javascript
{
  success: true,
  message: "Material registered successfully",
  material: {
    materialId: "MAT-001",
    description: "Corn Feed Grade A",
    category: "Feed",
    unit: "kg",
    supplier: "PT Supplier A",
    createdAt: "2025-10-07T...",
    updatedAt: "2025-10-07T..."
  }
}
```

**Example:**

```javascript
const result = registerMaterial('MAT-001', 'Corn Feed Grade A', {
  category: 'Feed',
  unit: 'kg',
  supplier: 'PT Supplier A',
  price: 5000,
});
```

---

### 2. `updateMaterial(materialId, updates)`

Update informasi material yang sudah terdaftar.

**Parameters:**

- `materialId` (string, required) - Material ID to update
- `updates` (object, required) - Fields to update

**Returns:**

```javascript
{
  success: true,
  message: "Material updated successfully",
  material: { /* updated material */ }
}
```

**Example:**

```javascript
const result = updateMaterial('MAT-001', {
  description: 'Corn Feed Grade A - Premium',
  price: 6000,
});
```

---

### 3. `getMaterialList(filters)`

Mendapatkan list semua material dengan optional filtering dan pagination.

**Parameters:**

- `filters` (object, optional)
  - `search` (string) - Search by materialId or description
  - `limit` (number) - Number of items per page
  - `offset` (number) - Starting index

**Returns:**

```javascript
{
  success: true,
  total: 10,
  count: 5,
  offset: 0,
  limit: 5,
  materials: [ /* array of materials */ ]
}
```

**Examples:**

```javascript
// Get all materials
const allMaterials = getMaterialList();

// Search materials
const searchResults = getMaterialList({ search: 'corn' });

// Paginated list
const page1 = getMaterialList({ limit: 10, offset: 0 });
const page2 = getMaterialList({ limit: 10, offset: 10 });
```

---

### 4. `getMaterialById(materialId)`

Mendapatkan detail material by ID.

**Parameters:**

- `materialId` (string, required) - Material ID

**Returns:**

```javascript
{
  success: true,
  material: { /* material details */ }
}
```

**Example:**

```javascript
const result = getMaterialById('MAT-001');
console.log(result.material);
```

---

### 5. `deleteMaterial(materialId)`

Menghapus material dari registry.

**Parameters:**

- `materialId` (string, required) - Material ID to delete

**Returns:**

```javascript
{
  success: true,
  message: "Material deleted successfully",
  material: { /* deleted material */ }
}
```

**Example:**

```javascript
const result = deleteMaterial('MAT-001');
```

---

### 6. `useMaterial(materialId)` 🌟

**ASYNC** - Menggunakan material untuk weighing dengan otomatis set informasi ke scale IDs.

**Mapping:**

- **ID1** = Material ID
- **ID2** = Material Description
- **ID3** = Usage timestamp

**Parameters:**

- `materialId` (string, required) - Material ID to use

**Returns:**

```javascript
{
  success: true,
  message: "Material set to scale successfully",
  material: { /* material details */ },
  scaleIds: {
    id1: { /* setID1 result */ },
    id2: { /* setID2 result */ },
    id3: { /* setID3 result */ }
  }
}
```

**Example:**

```javascript
// Must be connected to scale first
await connect();

// Use material
const result = await useMaterial('MAT-001');
console.log('Material set:', result.material);

// Get weight with material info
const weight = await getStableWeight();
console.log('Weight:', weight);
```

---

### 7. `clearMaterialRegistry()`

Menghapus semua material dari registry.

**Returns:**

```javascript
{
  success: true,
  message: "Cleared 10 materials from registry",
  count: 10
}
```

**Example:**

```javascript
const result = clearMaterialRegistry();
```

---

## Complete Usage Example

```javascript
const {
  initializeConnection,
  connect,
  disconnect,
  registerMaterial,
  getMaterialList,
  useMaterial,
  getStableWeight,
} = require('../helpers/mettlerToledoClient');

async function main() {
  try {
    // 1. Register materials
    registerMaterial('MAT-001', 'Corn Feed', {
      category: 'Feed',
      unit: 'kg',
    });
    registerMaterial('MAT-002', 'Soybean Meal', {
      category: 'Feed',
      unit: 'kg',
    });

    // 2. View material list
    const materials = getMaterialList();
    console.log('Materials:', materials.materials);

    // 3. Connect to scale
    initializeConnection({
      host: '10.102.109.210',
      port: 1701,
      timeout: 10000,
    });
    await connect();

    // 4. Use material for weighing
    await useMaterial('MAT-001');
    console.log('Material MAT-001 set to scale');

    // 5. Get weight
    const weight = await getStableWeight();
    console.log('Weight:', weight.weight, weight.unit);

    // 6. Switch to different material
    await useMaterial('MAT-002');
    const weight2 = await getStableWeight();
    console.log('Weight:', weight2.weight, weight2.unit);
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    disconnect();
  }
}

main();
```

---

## Storage

Material registry menggunakan **in-memory storage** (array). Data akan hilang ketika aplikasi di-restart. Untuk persistent storage, pertimbangkan untuk:

- Simpan ke database (MongoDB, PostgreSQL, etc.)
- Simpan ke file JSON
- Integrate dengan existing material database

---

## Error Handling

Semua fungsi akan throw error jika:

- Material ID tidak valid (empty, bukan string)
- Material tidak ditemukan (get, update, delete, use)
- Material sudah ada (register duplicate)
- Scale tidak terkoneksi (useMaterial)

**Example Error Handling:**

```javascript
try {
  const result = registerMaterial('MAT-001', 'Material 1');
} catch (error) {
  console.error('Registration failed:', error.message);
}
```

---

## Testing

Run test script:

```bash
node scripts/testMaterial.js
```

Test script akan:

1. ✅ Register 3 materials
2. ✅ Get material list
3. ✅ Search materials
4. ✅ Get material by ID
5. ✅ Update material
6. ✅ Connect to scale
7. ✅ Use materials for weighing
8. ✅ Get stable weight
9. ✅ Delete material
10. ✅ Test pagination

---

## Integration dengan Scale

Ketika menggunakan `useMaterial(materialId)`, sistem akan:

1. ✅ Cari material di registry
2. ✅ Set **ID1** = Material ID
3. ✅ Set **ID2** = Material Description
4. ✅ Set **ID3** = Usage timestamp
5. ✅ Return hasil setting ke scale

Informasi ini akan muncul di:

- Scale display
- Print ticket
- Weight record

---

## Tips

1. **Naming Convention**: Gunakan prefix untuk material ID (contoh: `MAT-001`, `FEED-001`)
2. **Additional Data**: Manfaatkan `additionalData` untuk menyimpan info custom (supplier, price, batch, etc.)
3. **Search**: Gunakan search untuk filter material by ID atau description
4. **Pagination**: Untuk large dataset, gunakan pagination
5. **Error Handling**: Always wrap dalam try-catch

---

## Future Enhancements

- [ ] Persistent storage (database)
- [ ] Material history tracking
- [ ] Batch/lot management
- [ ] Barcode scanning integration
- [ ] Material expiry tracking
- [ ] Stock management
- [ ] Multi-language support
