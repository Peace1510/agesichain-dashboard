/**
 * @file scripts/serial-bridge.js
 * @description Zero-configuration auto-pairing serial bridge for the Agesichain Cold Chain Dashboard.
 * 
 * Capabilities:
 *  - Auto-discovers active Next.js dashboard backend on port 3000 or 3001 (IPv4 / 127.0.0.1 safe)
 *  - Auto-scans USB-UART hardware ports, ignoring virtual Bluetooth serial links
 *  - Continuous auto-reconnect loop on USB unplug / plug-in
 *  - Ingests single-line JSON telemetry payloads and forwards to /api/telemetry via HTTP POST
 *  - High-visibility color-coded terminal telemetry monitor
 */

const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const http = require("http");

// ─────────────────────────────────────────────────────────────────────────────
// TERMINAL COLOR CODES (ANSI)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  blue: "\x1b[34m",
};

const LOG = {
  scan: (msg) => console.log(`${C.cyan}[USB SCAN]${C.reset} ${msg}`),
  paired: (msg) => console.log(`${C.green}${C.bold}[PAIRED]${C.reset} ${msg}`),
  stream: (msg) => console.log(`${C.magenta}[STREAM]${C.reset} ${msg}`),
  reconnect: (msg) => console.log(`${C.yellow}[RECONNECT]${C.reset} ${msg}`),
  error: (msg) => console.log(`${C.red}[ERROR]${C.reset} ${msg}`),
  info: (msg) => console.log(`${C.blue}[INFO]${C.reset} ${msg}`),
};

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const CANDIDATE_PORTS = [3000, 3001];
const BAUD_RATE = 115200;
const RECONNECT_INTERVAL_MS = 2000;

// Hardware substrings for USB-to-UART bridge controllers (CP2102, CH340, FT232, ESP32 USB-JTAG)
const KNOWN_HARDWARE_KEYWORDS = [
  "cp210",
  "ch340",
  "ch341",
  "ftdi",
  "silicon labs",
  "usb-serial",
  "usb serial",
  "uart",
  "esp32",
  "wch",
  "prolific",
  "vid_10c4", // Silicon Labs
  "vid_1a86", // QinHeng Electronics (CH340)
  "vid_0403", // FTDI
  "vid_303a", // Espressif Systems
];

let activeBackendUrl = null;
let activeSerialPort = null;
let isConnecting = false;
let reconnectTimer = null;

// ─────────────────────────────────────────────────────────────────────────────
// 1. DYNAMIC BACKEND PORT DISCOVERY
// ─────────────────────────────────────────────────────────────────────────────
async function pingBackend(port) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/api/telemetry",
        method: "GET",
        timeout: 1200,
      },
      (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );

    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

async function discoverBackendPort() {
  LOG.info("Searching for active Next.js dashboard backend (ports 3000, 3001)...");

  for (const port of CANDIDATE_PORTS) {
    const alive = await pingBackend(port);
    if (alive) {
      activeBackendUrl = `http://127.0.0.1:${port}/api/telemetry`;
      LOG.info(`Locked onto backend: ${C.bold}${activeBackendUrl}${C.reset}`);
      return activeBackendUrl;
    }
  }

  // Default to 3001 if pending
  activeBackendUrl = "http://127.0.0.1:3001/api/telemetry";
  LOG.info(`Dashboard listener pending. Target set to: ${activeBackendUrl}`);
  return activeBackendUrl;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. HARDWARE AUTO-DETECTION
// ─────────────────────────────────────────────────────────────────────────────
async function detectEsp32Port() {
  try {
    const allPorts = await SerialPort.list();

    if (!allPorts || allPorts.length === 0) {
      return null;
    }

    // Filter out Bluetooth virtual ports to prevent Windows error 121 hang
    const physicalPorts = allPorts.filter((p) => {
      const pnp = (p.pnpId || "").toUpperCase();
      const friendly = (p.friendlyName || "").toLowerCase();
      const mfg = (p.manufacturer || "").toLowerCase();

      if (pnp.includes("BTHENUM") || friendly.includes("bluetooth") || mfg.includes("bluetooth")) {
        return false;
      }
      return true;
    });

    if (physicalPorts.length === 0) {
      return null;
    }

    LOG.scan(`Physical COM ports detected: ${physicalPorts.map((p) => p.path).join(", ")}`);

    // Match priority: known USB-UART vendor / hardware signature
    for (const p of physicalPorts) {
      const combined = `${p.manufacturer || ""} ${p.friendlyName || ""} ${p.pnpId || ""} ${p.productId || ""}`.toLowerCase();
      const isKnown = KNOWN_HARDWARE_KEYWORDS.some((kw) => combined.includes(kw));

      if (isKnown) {
        LOG.scan(`Matched ESP32 UART bridge on ${C.bold}${p.path}${C.reset} (${p.friendlyName || p.manufacturer || "USB-UART"})`);
        return p.path;
      }
    }

    // Fall back to first physical USB/COM port
    LOG.scan(`Auto-selecting ${C.bold}${physicalPorts[0].path}${C.reset} (${physicalPorts[0].friendlyName || "Physical Serial Port"})`);
    return physicalPorts[0].path;
  } catch (err) {
    LOG.error(`COM scan error: ${err.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TELEMETRY INGESTION & FORWARDING
// ─────────────────────────────────────────────────────────────────────────────
async function forwardTelemetry(payload) {
  if (!activeBackendUrl) return;

  const dataStr = JSON.stringify(payload);
  const url = new URL(activeBackendUrl);

  const req = http.request(
    {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(dataStr),
      },
      timeout: 2000,
    },
    (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const resp = JSON.parse(body);
          if (resp.success && resp.snapshot) {
            const snap = resp.snapshot;
            const evalObj = snap.evaluation || {};
            const status = evalObj.status || "NOMINAL";
            const viability = (snap.cumulative_viability * 100).toFixed(2);

            let statusColor = C.green;
            if (status === "WARNING") statusColor = C.yellow;
            if (status === "CRITICAL") statusColor = C.red;

            LOG.stream(
              `Forwarded [${payload.device_id}] | Temp: ${C.bold}${payload.temperature.toFixed(1)}°C${C.reset} | Viability: ${C.bold}${viability}%${C.reset} | Status: ${statusColor}${C.bold}${status}${C.reset}`
            );
          } else {
            LOG.stream(`Forwarded reading [${payload.device_id}] (HTTP ${res.statusCode})`);
          }
        } catch {
          LOG.stream(`Forwarded reading [${payload.device_id}] (HTTP ${res.statusCode})`);
        }
      });
    }
  );

  req.on("error", (err) => {
    LOG.error(`Failed forwarding to ${activeBackendUrl}: ${err.message}`);
  });

  req.on("timeout", () => {
    req.destroy();
    LOG.error(`Timeout posting to ${activeBackendUrl}`);
  });

  req.write(dataStr);
  req.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. PORT CONNECTION & AUTO-RECONNECT LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
async function connectToDevice() {
  if (isConnecting) return;
  isConnecting = true;

  const portPath = await detectEsp32Port();

  if (!portPath) {
    LOG.reconnect("Waiting for ESP32 connection... (plug in via USB)");
    scheduleReconnect();
    return;
  }

  LOG.info(`Opening ${portPath} @ ${BAUD_RATE} baud...`);

  try {
    activeSerialPort = new SerialPort({
      path: portPath,
      baudRate: BAUD_RATE,
      autoOpen: false,
    });

    activeSerialPort.open((err) => {
      if (err) {
        LOG.error(`Failed to open ${portPath}: ${err.message}`);
        activeSerialPort = null;
        scheduleReconnect();
        return;
      }

      LOG.paired(`${C.bold}${portPath}${C.reset} ➔ Target Backend: ${C.cyan}${activeBackendUrl}${C.reset}`);
      isConnecting = false;

      const parser = activeSerialPort.pipe(new ReadlineParser({ delimiter: "\n" }));

      parser.on("data", (line) => {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("{") || !trimmed.endsWith("}")) {
          return; // Ignore raw boot logs or corrupt fragments
        }

        try {
          const payload = JSON.parse(trimmed);
          if (!payload.timestamp) {
            payload.timestamp = Math.floor(Date.now() / 1000);
          }
          if (payload.speed_kmh === undefined) {
            payload.speed_kmh = 0.0;
          }
          forwardTelemetry(payload);
        } catch {
          // Ignore invalid JSON
        }
      });

      activeSerialPort.on("close", () => {
        LOG.reconnect("Device disconnected / USB unplugged.");
        activeSerialPort = null;
        scheduleReconnect();
      });

      activeSerialPort.on("error", (err) => {
        LOG.error(`Serial connection error: ${err.message}`);
        activeSerialPort = null;
        scheduleReconnect();
      });
    });
  } catch (err) {
    LOG.error(`Port initialization failed: ${err.message}`);
    activeSerialPort = null;
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  isConnecting = false;
  reconnectTimer = setTimeout(() => {
    connectToDevice();
  }, RECONNECT_INTERVAL_MS);
}

// ─────────────────────────────────────────────────────────────────────────────
// STARTUP BANNER & MAIN
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`
${C.cyan}${C.bold}╔═══════════════════════════════════════════════════════════════════╗
║          AGESICHAIN COLD-CHAIN ZERO-CONFIG SERIAL BRIDGE          ║
║      Real-Time Hardware Auto-Pairing & Arrhenius Ingestion        ║
╚═══════════════════════════════════════════════════════════════════╝${C.reset}
`);

  await discoverBackendPort();
  connectToDevice();
}

// Clean process exit handler
process.on("SIGINT", () => {
  console.log(`\n${C.yellow}Shutting down serial bridge...${C.reset}`);
  if (activeSerialPort && activeSerialPort.isOpen) {
    activeSerialPort.close();
  }
  process.exit(0);
});

main();
