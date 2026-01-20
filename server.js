const express = require("express");
const path = require("path");
const { checkPayment } = require("./gmailReader");

const app = express();
// Active payment sessions
const activeSessions = new Map();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, "public")));

// API: check payment
app.post("/api/check-payment", async (req, res) => {
  const { bankName, amount, sessionId } = req.body;

  console.log("\n📩 API HIT");
  console.log("Bank Name from frontend:", bankName);
  console.log("Amount from frontend:", amount);
  console.log("Session ID:", sessionId);

  // mark session active
  activeSessions.set(sessionId, { cancelled: false });

  try {
    const result = await checkPayment({
      bankName,
      amount,
      sessionId,
      isCancelled: () => activeSessions.get(sessionId)?.cancelled
    });

    activeSessions.delete(sessionId);
    console.log("Final result sent to frontend:", result);
    res.json(result);
  } catch (err) {
    activeSessions.delete(sessionId);
    res.json({ success: false });
  }
});
// API: cancel payment check
app.post("/api/cancel-payment", (req, res) => {
  const { sessionId } = req.body;

  if (activeSessions.has(sessionId)) {
    activeSessions.get(sessionId).cancelled = true;
    console.log("❌ PAYMENT CANCELLED BY USER | Session:", sessionId);
  }

  res.json({ cancelled: true });
});


app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
