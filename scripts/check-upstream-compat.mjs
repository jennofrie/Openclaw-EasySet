#!/usr/bin/env node

/**
 * Checks whether OpenClaw upstream docs still expose key config paths
 * that OpenClaw EasySet depends on.
 */

const DOC_URLS = [
  'https://docs.openclaw.ai/gateway/configuration.md',
  'https://docs.openclaw.ai/cli/security.md',
  'https://docs.openclaw.ai/start/wizard-cli-reference.md',
  'https://docs.openclaw.ai/start/wizard.md',
  'https://docs.openclaw.ai/llms.txt',
];

const REQUIRED_TERMS = [
  'gateway.auth.token',
  'gateway.auth.password',
  'gateway.trustedproxies',
  'dangerouslydisabledeviceauth',
  'channels.whatsapp',
  'channels.discord',
  'channels.slack',
  'dmPolicy',
];

async function main() {
  const docs = await fetchDocs();
  const lower = docs.toLowerCase();

  const missing = REQUIRED_TERMS.filter(term => !lower.includes(term.toLowerCase()));
  if (missing.length > 0) {
    console.error('Upstream compatibility check failed. Missing doc terms:');
    for (const term of missing) {
      console.error(`- ${term}`);
    }
    process.exit(1);
  }

  console.log('Upstream compatibility check passed.');
}

async function fetchDocs() {
  const parts = [];
  for (const url of DOC_URLS) {
    const text = await fetchWithRetry(url);
    parts.push(text);
  }
  return parts.join('\n');
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'openclaw-easyset-upstream-check/1.0',
          accept: 'text/plain, text/markdown, text/html;q=0.9,*/*;q=0.8',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return await res.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(500 * attempt);
      }
    }
  }

  throw new Error(`Failed to fetch ${url}: ${lastError?.message || 'unknown error'}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
