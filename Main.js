let qoeSamples = [];
let qoeInterval;
let sampleCount = 0;

// Convert current timestamp to HH:MM:SS
function timestamp() {
  return new Date().toLocaleTimeString();
}

function formatQoEStats(stats) {
  const data = {
    time: timestamp(),
    video_bitrate_kbps: "N/A",
    video_jitter_ms: "N/A",
    video_fps: "N/A",
    video_packets_lost: "N/A",
    audio_jitter_ms: "N/A",
    audio_packets_lost: "N/A",
    rtt_ms: "N/A",
    avail_out_bitrate_kbps: "N/A",
    avail_in_bitrate_kbps: "N/A"
  };

  for (const stat of stats.values()) {
    if (stat.type === "inbound-rtp" && stat.kind === "video") {
      data.video_bitrate_kbps = stat.bytesReceived ? ((stat.bytesReceived * 8) / 1024).toFixed(2) : "N/A";
      data.video_jitter_ms = stat.jitter ? (stat.jitter * 1000).toFixed(2) : "N/A";
      data.video_packets_lost = stat.packetsLost ?? "N/A";
      data.video_fps = stat.framesPerSecond ?? "N/A";
    }

    if (stat.type === "inbound-rtp" && stat.kind === "audio") {
      data.audio_jitter_ms = stat.jitter ? (stat.jitter * 1000).toFixed(2) : "N/A";
      data.audio_packets_lost = stat.packetsLost ?? "N/A";
    }

    if (stat.type === "candidate-pair" && stat.state === "succeeded" && stat.nominated) {
      data.rtt_ms = stat.currentRoundTripTime ? (stat.currentRoundTripTime * 1000).toFixed(2) : "N/A";
      data.avail_out_bitrate_kbps = stat.availableOutgoingBitrate ? (stat.availableOutgoingBitrate / 1000).toFixed(2) : "N/A";
      data.avail_in_bitrate_kbps = stat.availableIncomingBitrate ? (stat.availableIncomingBitrate / 1000).toFixed(2) : "N/A";
    }
  }

  return data;
}

async function collectQoESampleToCSV() {
  const pcMap = APP.conference._room.rtc.peerConnections;
  const pcs = [];

  for (const lp of pcMap.values()) {
    if (lp && lp.peerconnection) pcs.push(lp.peerconnection);
  }

  for (let i = 0; i < pcs.length; i++) {
    const stats = await pcs[i].getStats();
    const formatted = formatQoEStats(stats);
    qoeSamples.push(formatted);
    sampleCount++;
    console.log(`📦 Saved sample #${sampleCount}:`, formatted);
  }
}

function startQoECSVSampling(intervalMs = 5000) {
  qoeSamples = [];
  sampleCount = 0;
  qoeInterval = setInterval(collectQoESampleToCSV, intervalMs);
  console.log(`⏱️ QoE CSV sampling started every ${intervalMs / 1000} seconds.`);
}

function stopQoECSVSamplingAndDownload() {
  clearInterval(qoeInterval);
  console.log("🛑 QoE sampling stopped. Preparing CSV...");

  if (qoeSamples.length === 0) {
    console.warn("⚠️ No samples to save.");
    return;
  }

  const header = Object.keys(qoeSamples[0]).join(",");
  const rows = qoeSamples.map(s => Object.values(s).join(","));
  const csvContent = [header, ...rows].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "jitsi_qoe_log.csv";
  a.click();
  URL.revokeObjectURL(url);
}


///////////////////////////////////copy the code above and past it in the cosole first///////////////////////////////////////
//step 2
// start the sampling 
startQoESampling(5000); // Sample every 5 seconds
//to stop it
stopQoECSVSamplingAndDownload();
//The CSV file created by stopQoECSVSamplingAndDownload(); is not saved automatically to disk — instead it will trigger download.
