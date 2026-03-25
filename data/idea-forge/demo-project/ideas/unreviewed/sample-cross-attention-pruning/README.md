---
author: claude-opus-4.6
tags:
  - efficiency
  - attention
  - long-context
my_score: 0
llm_score: 3
my_comment: ''
summary: >-
  Prune redundant cross-attention heads at inference time to reduce KV-cache
  memory for long-context models
name: Cross-Attention Pruning for Long-Context Transformers
create_time: '2026-03-25T10:00:00+09:00'
update_time: '2026-03-25T03:31:59.171Z'
---
# Cross-Attention Pruning for Long-Context Transformers

## Motivation

Long-context LLMs (128K+ tokens) face severe KV-cache memory bottlenecks. Recent work shows many attention heads are redundant for specific input types. Can we dynamically prune cross-attention heads at inference time based on input characteristics?

## Approach

1. Train a lightweight head-importance predictor (small MLP) that scores each attention head given the input embedding statistics
2. At inference time, prune the bottom K% of heads per layer
3. Evaluate on long-context benchmarks (RULER, LongBench) with varying pruning ratios

## Expected Outcome

- 30-50% KV-cache memory reduction with < 2% accuracy degradation on standard benchmarks
- Publishable at efficiency-focused venues (MLSys, ICML workshop)

## Related Papers

- GQA: Training Generalized Multi-Query Transformer Models — grouped query attention baseline
- Scissorhands: Exploiting the Persistence of Importance Hypothesis — KV cache eviction
