// --- QoE & Full WebRTC Stats Script for Jitsi Meet ---
let qoeInterval;
let sampleCount = 0;
let qoeSamples = [];
let lastVideoSent = 0, lastVideoRecv = 0, lastTimestamp = 0;

async function collectQoESample() {
  try {
    const pcMap = APP.conference._room.rtc.peerConnections;
    const pcs = [];
    for (const lp of pcMap.values()) {
      if (lp && lp.peerconnection) pcs.push(lp.peerconnection);
    }
    if (pcs.length === 0) {
      console.warn("No peer connections found. Is the call active?");
      return;
    }
    const pc = pcs[0];
    const stats = await pc.getStats();

    // Store all relevant stats for display
    let videoOutbound = null, videoInbound = null, audioInbound = null;
    for (const stat of stats.values()) {
      // Outbound video (sent)
      if (stat.type === "outbound-rtp" && stat.kind === "video" && !videoOutbound) {
        videoOutbound = stat;
      }
      // Inbound video (received)
      if (stat.type === "inbound-rtp" && stat.kind === "video" && !videoInbound) {
        videoInbound = stat;
      }
      // Inbound audio (received)
      if (stat.type === "inbound-rtp" && stat.kind === "audio" && !audioInbound) {
        audioInbound = stat;
      }
    }

    if (!(videoOutbound && videoInbound && audioInbound)) {
      console.warn("Missing one or more streams (video/audio). Are at least two participants sending/receiving media?");
      // Print what you DID find for troubleshooting:
      for (const stat of stats.values()) {
        if (["inbound-rtp", "outbound-rtp"].includes(stat.type)) {
          console.log(stat);
        }
      }
      return;
    }

    // Get raw stats
    let nowTs = Date.now();
    let videoSent = videoOutbound.packetsSent ?? 0;
    let videoRecv = videoInbound.packetsReceived ?? 0;
    let audioJitter = audioInbound.jitter ?? 0;
    let audioLost = audioInbound.packetsLost ?? 0;

    // Per-second deltas
    let videoSentPerSec = 0, videoRecvPerSec = 0;
    if (sampleCount > 0 && lastTimestamp > 0) {
      let secs = (nowTs - lastTimestamp) / 1000;
      videoSentPerSec = secs > 0 ? (videoSent - lastVideoSent) / secs : 0;
      videoRecvPerSec = secs > 0 ? (videoRecv - lastVideoRecv) / secs : 0;
    }
    lastVideoSent = videoSent;
    lastVideoRecv = videoRecv;
    lastTimestamp = nowTs;

    // Compute QoE as per your equation
    let qoe = null;
    if (sampleCount > 0) {
      qoe = 3.420
        + 0.005 * videoSentPerSec
        - 72.898 * audioJitter
        - 0.001 * audioLost
        + 0.004 * videoRecvPerSec;
      qoe = qoe.toFixed(3);
    }

    sampleCount++;
    const record = {
      timestamp: new Date(nowTs).toISOString(),
      VideoStream_PacketsSent: videoSent,
      VideoStream_PacketsSentPerSec: videoSentPerSec.toFixed(2),
      VideoStream_PacketsReceived: videoRecv,
      VideoStream_PacketsReceivedPerSec: videoRecvPerSec.toFixed(2),
      AudioStream_Jitter: audioJitter,
      AudioStream_PacketsLost: audioLost,
      QoE: qoe,
      // Optionally add more fields if you want, e.g., audioInbound.jitterBufferDelay, etc.
    };
    if (sampleCount > 1) qoeSamples.push(record); // skip first (delta is 0)

    // Print all info, including the whole stat objects for advanced troubleshooting
    console.log(`\nSample #${sampleCount-1}:`);
    console.table([record]);
    console.log("Raw videoOutbound:", videoOutbound);
    console.log("Raw videoInbound:", videoInbound);
    console.log("Raw audioInbound:", audioInbound);
    if (qoe !== null) console.log("QoE (per equation):", qoe);
  } catch (err) {
    console.error("Error collecting QoE sample:", err);
  }
}

function startQoESampling(intervalMs = 1000) {
  if (qoeInterval) clearInterval(qoeInterval);
  sampleCount = 0;
  qoeSamples = [];
  lastVideoSent = 0;
  lastVideoRecv = 0;
  lastTimestamp = 0;
  qoeInterval = setInterval(collectQoESample, intervalMs);
  console.log(`QoE sampling started every ${intervalMs / 1000} seconds.`);
}

function stopQoESampling() {
  if (qoeInterval) clearInterval(qoeInterval);
  console.log("QoE sampling stopped.");
}

function downloadQoESamplesAsCSV() {
  if (qoeSamples.length === 0) {
    console.warn("No QoE samples collected yet.");
    return;
  }
  const keys = Object.keys(qoeSamples[0]);
  const csvRows = [
    keys.join(','), // header
    ...qoeSamples.map(sample => keys.map(key => sample[key] ?? '').join(','))
  ];
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `jitsi_qoe_equation_samples_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log("CSV download triggered.");
}
// --- End of Script ---
// you can sample by every 1 second by using the line below 
startQoESampling(1000);

//to stop sampling 
stopQoESampling();
// to doownload the results using CSV file use the below 
downloadQoESamplesAsCSV();

