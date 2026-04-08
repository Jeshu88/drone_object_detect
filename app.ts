import { useEffect, useState, useRef } from 'react';
import { FishjamClient } from '@fishjam-dev/ts-client'; // Local Fishjam SDK[[1]](https://fishjam-dev.github.io/ts-client-sdk)

const GEMINI_API_KEY = "AQ.Ab8RN6L7dN2sHZnvfp_lzsQtcloGPs4yO4vGySRV9OuFKxk_sw";
const FISHJAM_WS_URL = "ws://192.168.123.61:4000"; // Update to your IP:4000
const PEER_TOKEN = ""; // Paste your PEER TOKEN here
function App() {
  const [status, setStatus] = useState("🔴 Offline - Paste token & click Connect");
  const [geminiText, setGeminiText] = useState("AI description will appear here");
  const [isConnected, setIsConnected] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const clientRef = useRef(null);

  const analyzeFrame = async () => {
    if (!videoRef.current?.videoWidth) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.8);

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Describe this video frame in detail: objects, actions, scene. Keep under 200 words." },
              { inline_data: { mime_type: "image/jpeg", data: base64Image.split(',')[1] } }
            ]
          }]
        })
      });
      const data = await response.json();
      setGeminiText(data.candidates[0].content.parts[0].text || "Analysis failed");
    } catch (err) {
      setGeminiText("Gemini error: " + err.message);
    }
  };

  const connectToFishjam = async () => {
    if (!PEER_TOKEN || PEER_TOKEN === "") {
      setStatus("❌ Paste PEER TOKEN first!");
      return;
    }

    try {
      setStatus("🟡 Connecting...");
      const client = new FishjamClient();
      clientRef.current = client;

      // Custom WS URL for local server
      client.ws = new WebSocket(FISHJAM_WS_URL.replace('ws://', 'ws://')); // Override if needed

      client.connect({
        token: PEER_TOKEN,
        metadata: { name: 'AI-Viewer' } // Optional
      });

      client.on('joined', () => {
        setStatus("✅ Connected to room! Waiting for Windows stream...");
        setIsConnected(true);
      });

      client.on('trackReady', (ctx) => {
        console.log('Video track ready from peer:', ctx.peer.id);
        if (videoRef.current && ctx.stream) {
          videoRef.current.srcObject = ctx.stream;
          videoRef.current.play();
          setStatus("🟢 LIVE VIDEO + AI ACTIVE!");
          // Auto-analyze every 5s
          const interval = setInterval(analyzeFrame, 5000);
          return () => clearInterval(interval);
        }
      });

      client.on('trackRemoved', () => {
        setStatus("🔴 Track lost");
        if (videoRef.current) videoRef.current.srcObject = null;
      });

      client.on('error', (err) => {
        setStatus("❌ Error: " + err.message);
        console.error(err);
      });

    } catch (err) {
      setStatus("❌ Connect failed: " + err.message);
    }
  };

  useEffect(() => {
    return () => {
      clientRef.current?.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: "30px", fontFamily: "Arial", textAlign: "center", maxWidth: "800px", margin: "0 auto" }}>
      <h1>Smelter + Gemini AI Video</h1>
      
      <p><strong>Status:</strong> {status}</p>
      <button 
        onClick={connectToFishjam}
        disabled={isConnected}
        style={{ padding: "10px 20px", fontSize: "16px", background: isConnected ? "#ccc" : "#0f0", color: "#000" }}
      >
        {isConnected ? "Connected!" : "CONNECT TO FISHJAM (Viewer)"}
      </button>

      {/* Video Container */}
      <div style={{ 
        margin: "20px 0", 
        padding: "20px", 
        background: "#111", 
        color: "#0f0", 
        borderRadius: "10px", 
        minHeight: "300px",
        position: "relative"
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "auto", borderRadius: "5px", background: "#000" }}
        />
        <canvas ref={canvasRef} style={{ display: "none" }} />
        <div style={{ whiteSpace: "pre-wrap", marginTop: "10px", fontSize: "14px" }}>
          {geminiText}
        </div>
      </div>

      <p style={{ marginTop: "30px", color: "#666", fontSize: "14px" }}>
        1. Paste PEER TOKEN into code & save<br/>
        2. Ensure Windows is streaming (green status)<br/>
        3. Click CONNECT → Video + AI appears!
      </p>
    </div>
  );
}

export default App;
