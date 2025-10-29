# Scale Weight API - Mettler Toledo SICS Integration

## Overview

API ini mengintegrasikan sistem dengan timbangan Mettler Toledo menggunakan protokol SICS untuk mendapatkan berat timbangan secara real-time.

## Konfigurasi

- **IP Address**: 10.102.109.210
- **Port**: 1701
- **Protocol**: SICS (Standard Interface Command Set)
- **Command**: S (Get Stable Weight)

## API Endpoint

### GraphQL Query: scaleGetWeight

```graphql
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
```

### Variables

```json
{
  "scaleId": 1
}
```

### Response Format

#### Success Response

```json
{
  "data": {
    "scaleGetWeight": {
      "success": true,
      "weight": 1250.5,
      "unit": "g",
      "raw": "+1250.5 g",
      "scaleId": 1,
      "scaleName": "Production Scale 1",
      "deviceIP": "192.168.1.100",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

#### Error Response

```json
{
  "errors": [
    {
      "message": "Failed to get weight from scale: Connection timeout",
      "extensions": {
        "code": "COMMUNICATION_ERROR"
      }
    }
  ]
}
```

## Implementation Details

### 1. SICS Client (`helpers/mettlerToledoClient.js`)

- Menangani komunikasi TCP/IP dengan timbangan
- Implementasi protokol SICS
- Error handling dan timeout management
- Parsing response dari timbangan

### 2. GraphQL Resolver (`modules/scale/scaleResolver.js`)

- Validasi input
- Koneksi ke database untuk mendapatkan informasi timbangan
- Eksekusi SICS command
- Format response

### 3. GraphQL Schema (`modules/scale/scaleSchema.js`)

- Type definition untuk `ScaleWeightResponse`
- Query definition untuk `scaleGetWeight`

## Testing

### 1. Test Koneksi Langsung

```bash
npm run test:scale-weight
```

### 2. Test GraphQL API

Buka GraphQL Playground di `http://localhost:5000/graphql` dan jalankan query di atas.

### 3. Test dengan cURL

```bash
curl -X POST http://localhost:5000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { scaleGetWeight(scaleId: 1) { success weight unit raw } }"}'
```

## Error Handling

### Error Types

- **VALIDATION_ERROR**: Input validation failed
- **NOT_FOUND**: Scale tidak ditemukan di database
- **COMMUNICATION_ERROR**: Gagal komunikasi dengan timbangan
- **INTERNAL_ERROR**: Server internal error

### Troubleshooting

#### Connection Timeout

- Periksa koneksi network ke 10.102.109.210:1701
- Pastikan timbangan dalam keadaan hidup
- Verifikasi konfigurasi SICS pada timbangan

#### Invalid Response

- Pastikan timbangan mendukung protokol SICS
- Check format response dari timbangan
- Verifikasi command yang dikirim

#### Database Error

- Pastikan scale record ada di database
- Periksa plant ID yang valid
- Run migration jika diperlukan

## Usage Examples

### JavaScript/Apollo Client

```javascript
import { gql, useQuery } from '@apollo/client';

const GET_SCALE_WEIGHT = gql`
  query GetScaleWeight($scaleId: Int!) {
    scaleGetWeight(scaleId: $scaleId) {
      success
      weight
      unit
      raw
      timestamp
    }
  }
`;

function ScaleWeightComponent({ scaleId }) {
  const { data, loading, error } = useQuery(GET_SCALE_WEIGHT, {
    variables: { scaleId },
    pollInterval: 5000, // Poll every 5 seconds
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Scale Weight</h3>
      <p>
        Weight: {data.scaleGetWeight.weight} {data.scaleGetWeight.unit}
      </p>
      <p>Status: {data.scaleGetWeight.success ? 'Success' : 'Failed'}</p>
      <p>Time: {new Date(data.scaleGetWeight.timestamp).toLocaleString()}</p>
    </div>
  );
}
```

### React Hook

```javascript
import { useState, useEffect } from 'react';

function useScaleWeight(scaleId) {
  const [weight, setWeight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchWeight = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            query GetScaleWeight($scaleId: Int!) {
              scaleGetWeight(scaleId: $scaleId) {
                success
                weight
                unit
                raw
                timestamp
              }
            }
          `,
          variables: { scaleId },
        }),
      });

      const result = await response.json();

      if (result.errors) {
        setError(result.errors[0].message);
      } else {
        setWeight(result.data.scaleGetWeight);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeight();
    const interval = setInterval(fetchWeight, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [scaleId]);

  return { weight, loading, error, refetch: fetchWeight };
}
```

## Configuration

### Environment Variables

Tambahkan ke `.env`:

```env
# Scale Communication Settings
SCALE_IP=10.102.109.210
SCALE_PORT=1701
SCALE_TIMEOUT=5000
```

### Database Setup

Pastikan tabel `scale` memiliki record dengan:

- Valid `id` (scaleId yang digunakan dalam query)
- `deviceIP` field (meskipun tidak digunakan untuk koneksi langsung)
- `name` field untuk scaleName dalam response

## Performance Considerations

1. **Connection Management**: Koneksi dibuat dan ditutup untuk setiap request
2. **Timeout**: Default 5 detik untuk connection dan command timeout
3. **Error Retry**: Tidak ada retry mechanism built-in (bisa ditambahkan)
4. **Polling**: Gunakan polling interval yang sesuai untuk kebutuhan real-time

## Security Notes

1. **Network Access**: Pastikan hanya aplikasi yang authorized yang bisa akses timbangan
2. **Error Information**: Jangan expose sensitive error details ke client
3. **Validation**: Selalu validasi input sebelum eksekusi

## Next Steps

1. **Add Retry Logic**: Implementasi retry mechanism untuk reliability
2. **Connection Pooling**: Optimasi koneksi untuk multiple requests
3. **Logging**: Tambahkan detailed logging untuk monitoring
4. **Caching**: Implementasi caching untuk response yang tidak berubah
5. **Additional Commands**: Tambahkan support untuk command SICS lainnya (tare, zero, status)






