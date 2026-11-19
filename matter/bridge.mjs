// moodots as a local Matter bridge.
//
// Alexa (Echo), Apple Home and Google Home pair with this bridge on the home
// network using an 11-digit setup code; no cloud, no skill. Each device the
// user chose on moodots' Voice page appears as an on/off plug. Started and
// restarted by server.py whenever the chosen devices change.
//
//   NUQTA_URL         http://127.0.0.1:8420  (the moodots server on this computer)
//   MATTER_STORAGE_PATH  folder that keeps the pairing (read by the Matter library itself)
//   MATTER_PORT       5540

import { Endpoint, Minutes, ServerNode, VendorId } from "@matter/main";
import { DeviceCommissioner } from "@matter/main/protocol";
import { BridgedDeviceBasicInformationServer } from "@matter/main/behaviors/bridged-device-basic-information";
import { OnOffPlugInUnitDevice } from "@matter/main/devices/on-off-plug-in-unit";
import { AggregatorEndpoint } from "@matter/main/endpoints/aggregator";

const NUQTA = process.env.NUQTA_URL || "http://127.0.0.1:8420";

async function nuqta(path, body) {
  const r = await fetch(`${NUQTA}${path}`, body === undefined ? {} : {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json();
}

let cfg;
for (let i = 0; ; i++) {                       // moodots may still be starting up
  try { cfg = await nuqta("/api/voice/matter"); break; }
  catch (e) { if (i > 60) throw e; await new Promise((r) => setTimeout(r, 2000)); }
}
const devices = cfg.devices || [];

const server = await ServerNode.create({
  id: "nuqta",
  network: { port: Number(process.env.MATTER_PORT || 5540) },
  commissioning: { passcode: cfg.passcode, discriminator: cfg.discriminator },
  // The Matter identity below keeps the old name (Nuqta) on purpose: changing it could unpair
  // devices people already added to Alexa / Apple Home / Google Home.
  productDescription: { name: "Nuqta", deviceType: AggregatorEndpoint.deviceType },
  basicInformation: {
    vendorName: "Nuqta", vendorId: VendorId(0xfff1), nodeLabel: "Nuqta",
    productName: "Nuqta", productLabel: "Nuqta", productId: 0x8000,
    serialNumber: cfg.serial, uniqueId: cfg.serial,
  },
});

const aggregator = new Endpoint(AggregatorEndpoint, { id: "aggregator" });
await server.add(aggregator);

const byId = new Map();
for (const d of devices) {
  const ep = new Endpoint(OnOffPlugInUnitDevice.with(BridgedDeviceBasicInformationServer), {
    id: `d-${d.id}`.replace(/[^A-Za-z0-9-]/g, "-"),
    bridgedDeviceBasicInformation: {
      nodeLabel: d.name.slice(0, 32), productName: "Nuqta", productLabel: d.name.slice(0, 64),
      serialNumber: `nuqta-${d.id}`.slice(0, 32), uniqueId: `nuqta-${d.id}`.slice(0, 32), reachable: true,
    },
    onOff: { onOff: Boolean(d.on) },
  });
  await aggregator.add(ep);
  byId.set(d.id, ep);
  ep.events.onOff.onOff$Changed.on((value, _old, context) => {
    if (context?.offline) return;                       // our own update from the poll below
    nuqta("/api/voice/matter", { device: d.id, on: value }).catch(() => {});
  });
}

function windowOpen() {
  try { return server.env.get(DeviceCommissioner).windowStatus !== 0; } catch { return false; }
}

async function report() {
  const codes = server.state.commissioning.pairingCodes;
  await nuqta("/api/voice/matter", {
    pairing: { manual: codes.manualPairingCode, qr: codes.qrPairingCode,
               commissioned: server.state.commissioning.commissioned, devices: devices.length,
               window: windowOpen(), fabrics: (server.state.operationalCredentials?.fabrics || []).map((f) => f.label || "") },
  }).catch(() => {});
}

// "Pair another app" on the Voice page: open pairing again for 15 minutes, with the same code,
// so Apple Home or Google Home can join next to Alexa.
let handledOpen = cfg.open_pairing || 0;
async function maybeOpen(req) {
  if (!req || req === handledOpen) return;
  handledOpen = req;
  if (!server.state.commissioning.commissioned || windowOpen()) return;
  try {
    await server.env.get(DeviceCommissioner).allowBasicCommissioning({ timeout: Minutes(15) });
    console.log("Pairing reopened for 15 minutes");
  } catch (e) { console.log(`Couldn't reopen pairing: ${e}`); }
}

server.lifecycle.commissioned.on(report);
server.lifecycle.decommissioned?.on?.(report);
await server.start();
await report();
console.log(`moodots Matter bridge ready: ${devices.length} device(s), code ${server.state.commissioning.pairingCodes.manualPairingCode}`);

// keep each plug's on/off in step with the machine
setInterval(async () => {
  try {
    const now = await nuqta("/api/voice/matter");
    await maybeOpen(now.open_pairing);
    for (const d of now.devices || []) {
      const ep = byId.get(d.id);
      if (ep && ep.state.onOff.onOff !== Boolean(d.on)) {
        await ep.set({ onOff: { onOff: Boolean(d.on) } }).catch(() => {});
      }
    }
    await report();
  } catch {}
}, 3000);
