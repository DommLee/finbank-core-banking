# Evidence Pack

Generated on: 2026-03-24 (Europe/Istanbul)

## Runtime and Infrastructure
- `docker_ps.txt`: active containers and port bindings
- `health.json`: backend health endpoint response
- `swagger_status.txt`: HTTP status code for `/docs`
- `ws_smoke.txt`: register + login + WebSocket ping/pong smoke test output
- `metrics_status.txt`: HTTP status code for `/metrics`
- `monitoring_prometheus_health.txt`: Prometheus health status
- `monitoring_grafana_health.json`: Grafana health payload

## UI Screenshots
- `frontend_login.png`: login page
- `frontend_accounts.png`: account list page
- `frontend_transfer.png`: transfer form page
- `frontend_ledger.png`: ledger/history page
- `frontend_admin_audit.png`: admin audit logs page
- `swagger_ui.png`: Swagger UI page

## Quality Checks
- `backend_pytest.txt`: backend test run output (`77 passed`)
- `backend_ruff.txt`: backend lint output (`All checks passed`)
- `frontend_eslint.txt`: frontend lint output
- `frontend_build.txt`: frontend production build output
- `load_test_report.txt`: async smoke load test result

## GitHub Workflow Evidence
- `github_actions_runs.txt`: latest GitHub Actions runs and status links
- `github_pr_issue_counts.txt`: PR and issue counts with URLs
- `rubric_score_summary.txt`: auto-calculated checklist completion percentages

## Monitoring Evidence
- `monitoring_prometheus.png`: Prometheus targets/status screenshot
- `monitoring_grafana_dashboard.png`: Grafana dashboard screenshot

## Mobile/PWA Evidence
- `mobile_pwa_evidence.txt`: PWA config and generated manifest/service worker proof
