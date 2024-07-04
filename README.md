# NodeJS AdGuard Prometheus Exporter

This really fucking simple Node app serves as a Prometheus exporter for AdGuard Home statistics. It fetches various metrics from AdGuard Home's API and exposes them in a format that Prometheus can scrape.

## Requirements

- Node.js
- AdGuard Home instance
- Environment variables configured using `.env` file or system variables:
  - `ADGUARD_URL`: URL of your AdGuard Home instance
  - `ADGUARD_USERNAME`: Username for accessing AdGuard Home API
  - `ADGUARD_PASSWORD`: Password for accessing AdGuard Home API
  - `EXPORTER_PORT`: Port on which this exporter will run

## Installation and Usage

1. Clone the repository:

```bash
git clone <repository-url>
cd adguard-prometheus-exporter
```

2. Install dependencies:

```bash
npm i
```

3. Configure environment variables in .env:

```bash
ADGUARD_URL=<url>
ADGUARD_USERNAME=<username>
ADGUARD_PASSWORD=<password>
EXPORTER_PORT=<port>
```

5. Start the exporter:

Running in foreground:
```bash
npm start
```
or

Running in background with pm2:
```bash
pm2 start index.js --name adguard-exporter
```


6. Access metrics:

The metrics are exposed at http://localhost:<EXPORTER_PORT>/metrics. 
You can configure Prometheus to scrape this endpoint.

## Metrics Provided

The exporter provides the following metrics:

    adguard_total_dns_queries: Total DNS queries handled by AdGuard Home.
    adguard_blocked_dns_queries: DNS queries blocked by AdGuard Home.
    adguard_blocked_percent: Percentage of DNS queries blocked.
    adguard_avg_processing_time: Average DNS query processing time.
    adguard_top_clients: Top clients by number of DNS queries.
    adguard_top_blocked_domains: Top domains blocked by AdGuard Home.
    adguard_top_queried_domains: Top domains queried by clients.
