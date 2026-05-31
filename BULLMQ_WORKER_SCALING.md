# BullMQ Worker Scaling Guide

This document provides guidance on configuring BullMQ worker concurrency for optimal performance across different environments.

## Overview

ClipCash uses BullMQ for background job processing with two main queues:

1. **Clip Generation Queue** (`clip-generation`) - CPU-intensive video processing
2. **Email Delivery Queue** (`email-delivery`) - I/O-bound SMTP operations

Worker concurrency controls how many jobs each queue processes simultaneously. Proper configuration is critical for balancing throughput, resource usage, and system stability.

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```env
# Clip generation worker concurrency (video processing is CPU-intensive)
BULLMQ_CLIP_GENERATION_CONCURRENCY=2

# Email delivery worker concurrency (I/O-bound, can handle more)
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=5
```

### Default Values

If not specified, the following defaults are used:

- `BULLMQ_CLIP_GENERATION_CONCURRENCY`: **2**
- `BULLMQ_EMAIL_DELIVERY_CONCURRENCY`: **5**

### Validation

The system validates configuration on startup:

- Minimum concurrency: **1** (for all queues)
- Maximum concurrency:
  - Clip generation: **20** (prevents resource exhaustion)
  - Email delivery: **50** (prevents SMTP rate limit issues)

## Scaling Recommendations

### Development Environment

**Goal**: Easy debugging, minimal resource usage

```env
BULLMQ_CLIP_GENERATION_CONCURRENCY=1
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=2
```

**Rationale**:
- Single concurrent job makes debugging easier
- Lower memory footprint for local development
- Reduces CPU contention with IDE and other dev tools

### Staging Environment

**Goal**: Realistic testing with moderate load

```env
BULLMQ_CLIP_GENERATION_CONCURRENCY=2
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=5
```

**Rationale**:
- Matches production behavior at smaller scale
- Tests concurrency issues without overwhelming resources
- Suitable for 2-4 CPU core servers

### Production Environment

**Goal**: Maximum throughput with stability

#### Small Instance (2-4 CPU cores, 4-8 GB RAM)

```env
BULLMQ_CLIP_GENERATION_CONCURRENCY=2
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=10
```

#### Medium Instance (4-8 CPU cores, 8-16 GB RAM)

```env
BULLMQ_CLIP_GENERATION_CONCURRENCY=4
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=15
```

#### Large Instance (8+ CPU cores, 16+ GB RAM)

```env
BULLMQ_CLIP_GENERATION_CONCURRENCY=8
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=20
```

**Rationale**:
- Clip generation scales with CPU cores (1 job ≈ 1 core during FFmpeg processing)
- Email delivery can scale higher (I/O-bound, waiting on SMTP responses)
- Leave headroom for HTTP requests and other processes

## Queue-Specific Guidelines

### Clip Generation Queue

**Characteristics**:
- CPU-intensive (FFmpeg video processing)
- Memory-intensive (video buffers in RAM)
- Long-running jobs (10-60 seconds per clip)

**Scaling Strategy**:
- **Conservative approach**: Set concurrency = number of CPU cores - 1
- **Aggressive approach**: Set concurrency = number of CPU cores × 1.5
- Monitor CPU usage and adjust if consistently > 90%
- Monitor memory usage and reduce if approaching limits

**Warning Signs**:
- ❌ CPU usage consistently at 100%
- ❌ Memory usage approaching server limits
- ❌ Jobs timing out (30-minute timeout)
- ❌ Increased job failure rate

**Optimization Tips**:
- Use dedicated worker servers for video processing
- Consider horizontal scaling (multiple worker instances)
- Monitor queue depth and add workers if consistently > 100 jobs

### Email Delivery Queue

**Characteristics**:
- I/O-bound (waiting on SMTP server responses)
- Low CPU usage
- Fast jobs (typically < 5 seconds)

**Scaling Strategy**:
- Can handle higher concurrency than CPU-bound tasks
- Limited by SMTP provider rate limits
- Typical range: 5-20 concurrent jobs

**Warning Signs**:
- ❌ SMTP rate limit errors (429, 550 responses)
- ❌ Connection pool exhaustion
- ❌ Increased email delivery failures

**Optimization Tips**:
- Check your SMTP provider's rate limits
- Use dedicated email service (SendGrid, Mailgun) for higher throughput
- Implement exponential backoff for transient failures
- Consider multiple SMTP providers for redundancy

## Monitoring

### Key Metrics to Track

1. **Queue Depth**
   - Metric: `clipcash_job_queue_depth{queue="clip-generation"}`
   - Alert if: > 100 jobs for > 5 minutes

2. **Job Processing Time**
   - Metric: `clipcash_job_duration_seconds`
   - Alert if: p95 > 60 seconds (clip generation)

3. **Job Failure Rate**
   - Metric: `clipcash_clips_generated_total{status="failure"}`
   - Alert if: > 5% failure rate

4. **System Resources**
   - CPU usage: Alert if > 90% for > 5 minutes
   - Memory usage: Alert if > 85% of available RAM
   - Disk I/O: Monitor for bottlenecks during video processing

### Prometheus Queries

```promql
# Average queue depth over 5 minutes
avg_over_time(clipcash_job_queue_depth{queue="clip-generation"}[5m])

# Job failure rate (last hour)
rate(clipcash_clips_generated_total{status="failure"}[1h])

# P95 job processing time
histogram_quantile(0.95, rate(clipcash_job_duration_seconds_bucket[5m]))
```

## Troubleshooting

### Problem: Jobs are timing out

**Symptoms**: Jobs fail with "Timeout" error after 30 minutes

**Solutions**:
1. Reduce concurrency to free up CPU resources
2. Check for resource contention (disk I/O, network)
3. Optimize FFmpeg settings (lower quality, faster presets)
4. Increase timeout if jobs legitimately need more time

### Problem: Queue depth keeps growing

**Symptoms**: Jobs accumulate faster than they're processed

**Solutions**:
1. Increase worker concurrency (if resources allow)
2. Add more worker instances (horizontal scaling)
3. Optimize job processing time
4. Implement job prioritization

### Problem: High memory usage / OOM errors

**Symptoms**: Worker crashes with out-of-memory errors

**Solutions**:
1. Reduce concurrency (fewer simultaneous video buffers)
2. Implement streaming for large files
3. Add more RAM to server
4. Use swap space (temporary solution)

### Problem: SMTP rate limit errors

**Symptoms**: Email jobs fail with 429 or 550 errors

**Solutions**:
1. Reduce email delivery concurrency
2. Implement rate limiting in application code
3. Upgrade SMTP provider plan
4. Use multiple SMTP providers with load balancing

## Advanced Configuration

### Per-Environment Configuration

Use environment-specific `.env` files:

```bash
# .env.development
BULLMQ_CLIP_GENERATION_CONCURRENCY=1
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=2

# .env.staging
BULLMQ_CLIP_GENERATION_CONCURRENCY=2
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=5

# .env.production
BULLMQ_CLIP_GENERATION_CONCURRENCY=8
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=20
```

### Dynamic Scaling (Future Enhancement)

Consider implementing auto-scaling based on metrics:

```typescript
// Pseudo-code for future implementation
if (queueDepth > 100 && cpuUsage < 70%) {
  increaseConcurrency();
} else if (queueDepth < 10 && cpuUsage > 90%) {
  decreaseConcurrency();
}
```

### Dedicated Worker Servers

For high-scale deployments, run workers on dedicated servers:

```bash
# API server (no workers)
BULLMQ_CLIP_GENERATION_CONCURRENCY=0
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=0

# Worker server 1 (clip generation only)
BULLMQ_CLIP_GENERATION_CONCURRENCY=8
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=0

# Worker server 2 (email delivery only)
BULLMQ_CLIP_GENERATION_CONCURRENCY=0
BULLMQ_EMAIL_DELIVERY_CONCURRENCY=20
```

## Testing

### Load Testing

Test your configuration under load:

```bash
# Generate 100 concurrent clip jobs
for i in {1..100}; do
  curl -X POST http://localhost:3000/clips/generate \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"videoId": "test-video"}'
done

# Monitor queue depth and processing time
watch -n 1 'redis-cli llen bull:clip-generation:wait'
```

### Stress Testing

Find the breaking point:

1. Start with conservative concurrency
2. Gradually increase while monitoring metrics
3. Note when CPU/memory/failure rate becomes problematic
4. Set production value at 70-80% of breaking point

## Best Practices

1. **Start Conservative**: Begin with lower concurrency and scale up based on metrics
2. **Monitor Continuously**: Set up alerts for queue depth, failure rate, and resource usage
3. **Test Before Production**: Validate configuration in staging with realistic load
4. **Document Changes**: Record concurrency changes and their impact
5. **Plan for Peaks**: Configure for peak load, not average load
6. **Leave Headroom**: Don't max out CPU/memory - leave 20-30% buffer
7. **Review Regularly**: Revisit configuration as usage patterns change

## References

- [BullMQ Documentation](https://docs.bullmq.io/)
- [BullMQ Concurrency Guide](https://docs.bullmq.io/guide/workers/concurrency)
- [NestJS BullMQ Integration](https://docs.nestjs.com/techniques/queues)
- [FFmpeg Performance Tuning](https://trac.ffmpeg.org/wiki/Encode/H.264)

## Support

For questions or issues with worker scaling:

1. Check Prometheus metrics at `/metrics`
2. Review worker logs for errors
3. Consult this guide for recommendations
4. Open an issue on GitHub with metrics and logs
