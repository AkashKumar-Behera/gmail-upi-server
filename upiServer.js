require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/upi-webhook", (req, res) => {
  console.log("📩 NEW UPI PAYMENT");
  console.log(req.body);
  res.json({ status: "ok" });
});

app.listen(process.env.PORT, () => {
  console.log("🚀 Server running on port", process.env.PORT);
});
