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
const exporterInfo = new client.Gauge({
  name: "adguard_exporter_info",
  help: "Information about the AdGuard Prometheus exporter",
  labelNames: ["version", "node_version"],
});
const timeUnits = new client.Gauge({
  name: "adguard_time_units",
  help: "Time units used by AdGuard metrics",
  labelNames: ["time_unit"],
});
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
const topUpstreamsResponses = new client.Gauge({
  name: "adguard_top_upstreams_responses",
  help: "Top upstream responses",
  labelNames: ["upstream"],
});
const topUpstreamsAvgTime = new client.Gauge({
  name: "adguard_top_upstreams_avg_time",
  help: "Top upstream average response time",
  labelNames: ["upstream"],
});
const numReplacedSafebrowsing = new client.Gauge({
  name: "adguard_num_replaced_safebrowsing",
  help: "Number of requests replaced by Safebrowsing",
});
const numReplacedSafesearch = new client.Gauge({
  name: "adguard_num_replaced_safesearch",
  help: "Number of requests replaced by Safesearch",
});
const numReplacedParental = new client.Gauge({
  name: "adguard_num_replaced_parental",
  help: "Number of requests replaced by Parental control",
});
const periodicDnsQueries = new client.Gauge({
  name: "adguard_periodic_dns_queries",
  help: "Periodic DNS queries",
  labelNames: ["period"],
});
const periodicBlockedFiltering = new client.Gauge({
  name: "adguard_periodic_blocked_filtering",
  help: "Periodic blocked filtering",
  labelNames: ["period"],
});
const periodicReplacedSafebrowsing = new client.Gauge({
  name: "adguard_periodic_replaced_safebrowsing",
  help: "Periodic replaced safebrowsing",
  labelNames: ["period"],
});
const periodicReplacedParental = new client.Gauge({
  name: "adguard_periodic_replaced_parental",
  help: "Periodic replaced parental",
  labelNames: ["period"],
});
exporterInfo.labels("0.0.1", process.version).set(1);

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
    numReplacedSafebrowsing.set(stats.num_replaced_safebrowsing || 0);
    numReplacedSafesearch.set(stats.num_replaced_safesearch || 0);
    numReplacedParental.set(stats.num_replaced_parental || 0);

    updateTimeUnits(stats.time_units || "unknown");

    updateTopClientsMetric(stats.top_clients || []);
    updateTopBlockedDomainsMetric(stats.top_blocked_domains || []);
    updateTopQueriedDomainsMetric(stats.top_queried_domains || []);
    updateTopUpstreamsResponsesMetric(stats.top_upstreams_responses || []);
    updateTopUpstreamsAvgTimeMetric(stats.top_upstreams_avg_time || []);

    updatePeriodicMetrics(stats.dns_queries || [], periodicDnsQueries);
    updatePeriodicMetrics(stats.blocked_filtering || [], periodicBlockedFiltering);
    updatePeriodicMetrics(stats.replaced_safebrowsing || [], periodicReplacedSafebrowsing);
    updatePeriodicMetrics(stats.replaced_parental || [], periodicReplacedParental);
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

function updateTopUpstreamsResponsesMetric(upstreams) {
  topUpstreamsResponses.reset();
  upstreams.forEach((upstream) => {
    const upstreamName = Object.keys(upstream)[0];
    const numRequests = upstream[upstreamName];
    if (upstreamName && !isNaN(numRequests)) {
      topUpstreamsResponses.labels(upstreamName).set(numRequests);
    }
  });
}

function updateTopUpstreamsAvgTimeMetric(upstreams) {
  topUpstreamsAvgTime.reset();
  upstreams.forEach((upstream) => {
    const upstreamName = Object.keys(upstream)[0];
    const avgTime = upstream[upstreamName];
    if (upstreamName && !isNaN(avgTime)) {
      topUpstreamsAvgTime.labels(upstreamName).set(avgTime);
    }
  });
}

function updatePeriodicMetrics(arrayData, metric) {
  metric.reset();
  arrayData.forEach((value, index) => {
    if (!isNaN(value)) {
      metric.labels(index.toString()).set(value);
    }
  });
}

function updateTimeUnits(units) {
  timeUnits.reset();
  timeUnits.labels(units).set(1);
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
