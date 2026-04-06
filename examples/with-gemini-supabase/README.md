# Example: Gemini + Supabase

Default ragpipe example using Google Gemini for embedding/generation and Supabase (pgvector) for vector storage.

## Prerequisites

- A Google AI API key ([Get one here](https://makersuite.google.com/app/apikey))
- A Supabase project with pgvector enabled

## Setup

1. Create a `.env` file:

```bash
GEMINI_API_KEY=your-gemini-api-key
DATABASE_URL=postgres://user:pass@host:5432/dbname
```

2. Create the documents table in Supabase:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  vector VECTOR(3072)
);

CREATE INDEX ON documents USING ivfflat (vector vector_cosine_ops) WITH (lists = 100);
```

3. Install dependencies:

```bash
pnpm install
```

## Usage

```bash
# Ingest the sample docs
pnpm run ingest

# Ask a question
pnpm run ask "How do I get started with ragpipe?"
```
