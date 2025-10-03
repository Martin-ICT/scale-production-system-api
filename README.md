# Scale Monitor System

API CRUD untuk Scale List menggunakan GraphQL dan Sequelize.

## Features

- **Scale CRUD Operations**:
  - Create scale
  - Read scale list (with pagination and search)
  - Read scale detail
  - Update scale
  - Delete scale

## Database Schema

### Scale Table

- `id` (INTEGER, PRIMARY KEY, AUTO_INCREMENT)
- `name` (STRING, NOT NULL)
- `description` (TEXT, NULLABLE)
- `created_at` (DATETIME)
- `updated_at` (DATETIME)

## Installation

1. Install dependencies:

```bash
npm install
```

2. Setup environment variables:

```bash
cp env.example .env
```

3. Configure database connection in `.env`:

```
DB_HOST=localhost
DB_PORT=3306
DB_NAME=scale_monitor_system
DB_USER=root
DB_PASSWORD=your_password
```

4. Run the server:

```bash
# Development
npm run dev

# Production
npm start
```

## GraphQL API

Server akan berjalan di `http://localhost:4000/graphql`

### Queries

#### Get Scale List

```graphql
query {
  scaleList(page: 0, pageSize: 10, search: "scale") {
    scales {
      id
      name
      description
      createdAt
      updatedAt
    }
    meta {
      totalItems
      pageSize
      currentPage
      totalPages
    }
  }
}
```

#### Get Scale Count

```graphql
query {
  scaleCount(search: "scale") {
    count
  }
}
```

#### Get Scale Detail

```graphql
query {
  scaleDetail(id: "1") {
    id
    name
    description
    createdAt
    updatedAt
  }
}
```

### Mutations

#### Create Scale

```graphql
mutation {
  scaleCreate(
    input: { name: "Scale 1", description: "Description for scale 1" }
  ) {
    id
    name
    description
    createdAt
    updatedAt
  }
}
```

#### Update Scale

```graphql
mutation {
  scaleUpdate(
    id: "1"
    input: { name: "Updated Scale 1", description: "Updated description" }
  ) {
    id
    name
    description
    createdAt
    updatedAt
  }
}
```

#### Delete Scale

```graphql
mutation {
  scaleDelete(id: "1") {
    id
    name
    description
    createdAt
    updatedAt
  }
}
```

## Project Structure

```
├── models/
│   └── scale.js            # Scale model
├── modules/
│   └── scale/
│       ├── scaleSchema.js  # GraphQL schema
│       └── scaleResolver.js # GraphQL resolvers
├── db.js                   # Database connection
├── server.js               # Main server file
├── package.json
└── README.md
```
