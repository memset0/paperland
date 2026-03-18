## Context
Semantic Scholar API: `https://api.semanticscholar.org/graph/v1/paper/CorpusID:{id}?fields=externalIds,title,abstract,authors,citationCount,references`

## Goals / Non-Goals
**Goals:** Fetch metadata, resolve arxiv_id from corpus_id, get citation count
**Non-Goals:** Full citation graph analysis

## Decisions
### 1. Use S2 Graph API v1
Free tier, no API key required (but rate limited). Fields param to control response size.

## Risks / Trade-offs
- **[Risk] S2 rate limits (100 req/5min)** → rate_limit_interval: 1s in config
