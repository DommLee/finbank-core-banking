"""Simple async load test for FinBank endpoints.

Usage:
  python scripts/load_test_smoke.py --url http://localhost:8000/health --requests 500 --concurrency 50
"""

import argparse
import asyncio
import statistics
import time

import httpx


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    k = (len(ordered) - 1) * p
    f = int(k)
    c = min(f + 1, len(ordered) - 1)
    if f == c:
        return ordered[f]
    return ordered[f] + (ordered[c] - ordered[f]) * (k - f)


async def run_load(url: str, total_requests: int, concurrency: int, timeout: float):
    semaphore = asyncio.Semaphore(concurrency)
    latencies: list[float] = []
    success = 0
    failed = 0

    async with httpx.AsyncClient(timeout=timeout) as client:
        async def one_request():
            nonlocal success, failed
            async with semaphore:
                start = time.perf_counter()
                try:
                    response = await client.get(url)
                    elapsed = time.perf_counter() - start
                    latencies.append(elapsed)
                    if 200 <= response.status_code < 400:
                        success += 1
                    else:
                        failed += 1
                except Exception:
                    failed += 1

        tasks = [asyncio.create_task(one_request()) for _ in range(total_requests)]
        global_start = time.perf_counter()
        await asyncio.gather(*tasks)
        total_time = time.perf_counter() - global_start

    rps = success / total_time if total_time > 0 else 0.0
    avg = statistics.fmean(latencies) if latencies else 0.0

    print(f"url={url}")
    print(f"requests_total={total_requests}")
    print(f"concurrency={concurrency}")
    print(f"success={success}")
    print(f"failed={failed}")
    print(f"duration_seconds={total_time:.4f}")
    print(f"throughput_rps={rps:.2f}")
    print(f"latency_avg_ms={avg * 1000:.2f}")
    print(f"latency_p50_ms={percentile(latencies, 0.50) * 1000:.2f}")
    print(f"latency_p95_ms={percentile(latencies, 0.95) * 1000:.2f}")
    print(f"latency_p99_ms={percentile(latencies, 0.99) * 1000:.2f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://localhost:8000/health")
    parser.add_argument("--requests", type=int, default=300)
    parser.add_argument("--concurrency", type=int, default=30)
    parser.add_argument("--timeout", type=float, default=10.0)
    args = parser.parse_args()

    asyncio.run(
        run_load(
            url=args.url,
            total_requests=args.requests,
            concurrency=args.concurrency,
            timeout=args.timeout,
        )
    )
