require("dotenv").config();
const express = require("express");
const client = require("prom-client");
const axios = require("axios");

const ADGUARD_URL = process.env.ADGUARD_URL;
const ADGUARD_USERNAME = process.env.ADGUARD_USERNAME;
const ADGUARD_PASSWORD = process.env.ADGUARD_PASSWORD;
const EXPORTER_PORT = process.env.EXPORTER_PORT;

const getDateTime = () => new Date().toLocaleString().replace(",", "");

// Prometheus metrics
const totalDnsQueries = new client.Gauge({
  name: "adguard_total_dns_queries",
  help: "Total DNS queries",
});
const blockedDnsQueries = new client.Gauge({
  name: "adguard_blocked_dns_queries",
  help: "Blocked DNS queries",
});
const blockedPercent = new client.Gauge({
  name: "adguard_blocked_percent",
  help: "Percentage of blocked DNS queries",
});
const avgProcessingTime = new client.Gauge({
  name: "adguard_avg_processing_time",
  help: "Average DNS query processing time",
});
const topClients = new client.Gauge({
  name: "adguard_top_clients",
  help: "Top clients by number of DNS queries",
  labelNames: ["client"],
});

const topBlockedDomains = new client.Gauge({
  name: "adguard_top_blocked_domains",
  help: "Top domains blocked by AdGuard Home",
  labelNames: ["domain"],
});

const topQueriedDomains = new client.Gauge({
  name: "adguard_top_queried_domains",
  help: "Top domains queried by clients",
  labelNames: ["domain"],
});

async function fetchAdguardStats() {
  const response = await axios.get(`${ADGUARD_URL}/control/stats`, {
    auth: {
      username: ADGUARD_USERNAME,
      password: ADGUARD_PASSWORD,
    },
  });
  return response.data;
}

async function updateMetrics() {
  try {
    const stats = await fetchAdguardStats();
    totalDnsQueries.set(stats.num_dns_queries || 0);
    blockedDnsQueries.set(stats.num_blocked_filtering || 0);
    blockedPercent.set(
      stats.num_dns_queries > 0
        ? (stats.num_blocked_filtering / stats.num_dns_queries) * 100
        : 0
    );
    avgProcessingTime.set(stats.avg_processing_time || 0);

    updateTopClientsMetric(stats.top_clients || []);

    updateTopBlockedDomainsMetric(stats.top_blocked_domains || []);

    updateTopQueriedDomainsMetric(stats.top_queried_domains || []);
  } catch (error) {
    console.error(`${getDateTime()} Error fetching AdGuard stats:`, error);
  }
}

function updateTopClientsMetric(clients) {
  topClients.reset();

  const clientArray = clients.map((client, index) => ({
    name: Object.keys(client)[0] || `client_${index}`,
    num_requests: Object.values(client)[0] || 0,
  }));

  clientArray.forEach((client) => {
    if (client.name && client.num_requests !== undefined) {
      topClients.labels(client.name).set(client.num_requests);
    } else {
      console.warn(`${getDateTime()} Invalid client data:`, client);
    }
  });
}

function updateTopBlockedDomainsMetric(domains) {
  topBlockedDomains.reset();

  const domainArray = domains.map((domain, index) => ({
    name: Object.keys(domain)[0] || `domain_${index}`,
    num_requests: Object.values(domain)[0] || 0,
  }));

  domainArray.forEach((domain) => {
    if (domain.name && domain.num_requests !== undefined) {
      topBlockedDomains.labels(domain.name).set(domain.num_requests);
    } else {
      console.warn(`${getDateTime()} Invalid domain data:`, domain);
    }
  });
}

function updateTopQueriedDomainsMetric(domains) {
  topQueriedDomains.reset();

  const domainArray = domains.map((domain, index) => ({
    name: Object.keys(domain)[0] || `domain_${index}`,
    num_requests: Object.values(domain)[0] || 0,
  }));

  domainArray.forEach((domain) => {
    if (domain.name && domain.num_requests !== undefined) {
      topQueriedDomains.labels(domain.name).set(domain.num_requests);
    } else {
      console.warn(`${getDateTime()} Invalid domain data:`, domain);
    }
  });
}

const app = express();

app.get("/metrics", async (req, res) => {
  try {
    await updateMetrics();
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
  } catch (error) {
    res.status(500).end(error.toString());
  }
});

app.listen(EXPORTER_PORT, () => {
  console.log(`${getDateTime()} AdGuard Prometheus exporter listening on port ${EXPORTER_PORT}`);
});
