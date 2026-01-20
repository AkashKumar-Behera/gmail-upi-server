/* =====================================================
   GLOBAL ELEMENTS & STATE
===================================================== */
const toggle = document.getElementById("menuToggle");
const panel = document.getElementById("menuPanel");

const donateBtn = document.querySelector(".btn");
const qrOverlay = document.getElementById("qrOverlay");
const qrClose = document.getElementById("qrClose");

const qrImage = document.getElementById("qrImage");
const qrAmount = document.getElementById("qrAmount");
const qrContent = document.getElementById("qrContent");

const waitingBox = document.getElementById("paymentWaiting");
const timeLeft = document.getElementById("timeLeft");
const cancelWaitBtn = document.getElementById("cancelWait");

const failedBox = document.getElementById("paymentFailed");
const retryBtn = document.getElementById("retryPayment");
const submitUtrBtn = document.getElementById("submitUtr");
const utrInput = document.getElementById("utrInput");

const cancelConfirm = document.getElementById("cancelConfirm");
const cancelYes = document.getElementById("cancelYes");
const cancelNo = document.getElementById("cancelNo");

const resumePayment = document.getElementById("resumePayment");
const upiInput = document.getElementById("upiInput");

const snackbar = document.getElementById("snackbar");

const summaryAmount = document.querySelector(".summary strong");


/* =====================================================
   Total Amount Update
===================================================== */

function updateSummary(amount) {
  summaryAmount.innerText = `₹${amount} INR`;
}


/* =====================================================
   CONFIG
===================================================== */
const MERCHANT_UPI = "princeytz@upi";
const MERCHANT_NAME = "PrinceYT";
const QR_API = "https://api.qrserver.com/v1/create-qr-code/";
const WAIT_TIME = 300; // testing (300 in production)

/* =====================================================
   INTERNAL STATE
===================================================== */
let waitTimer = null;
let time = WAIT_TIME;
let snackbarTimer = null;

let paymentState = "IDLE"; 
// IDLE | WAITING | CANCEL_CONFIRM | FAILED

/* =====================================================
   MENU
===================================================== */
toggle.addEventListener("change", () => {
  panel.classList.toggle("show", toggle.checked);
});

document.addEventListener("click", (e) => {
  if (!panel.contains(e.target) && !e.target.closest(".menu-btn")) {
    toggle.checked = false;
    panel.classList.remove("show");
  }
});

/* =====================================================
   SNACKBAR
===================================================== */
function showSnackbar(message, type = "default") {
  snackbar.innerText = message;

  snackbar.classList.remove(
    "show",
    "snackbar-error",
    "snackbar-success",
    "snackbar-info",
    "snackbar-warning"
  );

  if (type !== "default") {
    snackbar.classList.add(`snackbar-${type}`);
  }

  snackbar.classList.add("show");

  clearTimeout(snackbarTimer);
  snackbarTimer = setTimeout(() => {
    snackbar.classList.remove("show");
  }, 3500);
}



/* =====================================================
   HELPERS
===================================================== */
async function startServerPaymentCheck(bankName, amount) {
  const sessionId = Date.now().toString();
  window.currentSessionId = sessionId;

  try {
    const res = await fetch("/api/check-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankName, amount, sessionId })
    });

    const data = await res.json();

    if (data.success) {
      paymentSuccess();
    } else {
      showFailedState();
    }
  } catch (err) {
    showFailedState();
  }
}



function generateOrderId() {
  return "ORD" + Date.now() + Math.floor(Math.random() * 1000);
}

function getSelectedAmount() {
  const active = document.querySelector(".amount.active");
  const custom = document.querySelector(".amount-box input");

  if (custom.value && Number(custom.value) >= 10) {
    return Number(custom.value);
  }
  if (active) {
    return Number(active.innerText.replace("₹", ""));
  }
  return 0;
}

/* =====================================================
   WAITING STATE
===================================================== */
function startWaitingState() {
  stopWaitingState();

  paymentState = "WAITING";

  failedBox.classList.remove("show");   // ❌ failed hide
  waitingBox.classList.add("show");     // ✅ waiting show

  time = WAIT_TIME;
  updateTimer();

  waitTimer = setInterval(() => {
    if (paymentState !== "WAITING") return; // 🔒 freeze protection

    time--;
    updateTimer();

    if (time <= 0) {
      stopWaitingState();
      showFailedState();
    }
  }, 1000);
}


function stopWaitingState() {
  if (waitTimer) {
    clearInterval(waitTimer);
    waitTimer = null;
  }
  waitingBox.classList.remove("show");
}

function updateTimer() {
  const min = String(Math.floor(time / 60)).padStart(2, "0");
  const sec = String(time % 60).padStart(2, "0");
  timeLeft.innerText = `${min}:${sec}`;
}

/* =====================================================
   FAILED STATE (FINAL STATE)
===================================================== */
function showFailedState() {
  paymentState = "FAILED";

  stopWaitingState();
  unlockDonateBtn(); // 🔓 allow new payment

  waitingBox.classList.remove("show");  // 🔒 FORCE HIDE
  qrContent.classList.add("hidden");    // ✅ 🔥 YAHI LINE IMPORTANT HAI
  failedBox.classList.add("show");      // ✅ Payment not detected
}

function paymentSuccess() {
  paymentState = "IDLE";

  stopWaitingState();
  unlockDonateBtn();

  qrOverlay.classList.remove("show");
  qrContent.classList.remove("hidden");
  failedBox.classList.remove("show");

  showSnackbar("Payment received successfully", "success");
}



/* =====================================================
   CANCEL CONFIRM
===================================================== */
function askCancelConfirmation() {
  if (paymentState !== "WAITING") return;

  paymentState = "IDLE"; // 🔥 important
  stopWaitingState();
  cancelConfirm.classList.add("show");
}



// cancelYes.addEventListener("click", () => {
//   cancelConfirm.classList.remove("show");
//   paymentState = "IDLE";
//   unlockDonateBtn(); // 🔓
//   stopWaitingState();
//   qrOverlay.classList.remove("show");
//   showSnackbar("Payment cancelled", "error");
// });

cancelYes.addEventListener("click", async () => {
  stopWaitingState();
  qrOverlay.classList.remove("show");

  showSnackbar("Payment cancelled", "error");

  if (window.currentSessionId) {
    await fetch("/api/cancel-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: window.currentSessionId
      })
    });
  }
});




cancelNo.addEventListener("click", () => {
  cancelConfirm.classList.remove("show");

  resumePayment.classList.add("show");

  setTimeout(() => {
    resumePayment.classList.remove("show");

    paymentState = "WAITING";
    showSnackbar("Resuming payment...", "success");
    startWaitingState(); // ⏯️ RESUME TIMER
  }, 900);
});


/* =====================================================
   DONATE FLOW (SINGLE SOURCE OF TRUTH)
===================================================== */

donateBtn.addEventListener("click", () => {
  const amount = getSelectedAmount();
  const userUpiId = upiInput.value.trim();

  if (!userUpiId) {
    showSnackbar("Please enter your UPI ID", "error");
    return;
  }

  if (!amount || amount < 10) {
    showSnackbar("Please select or enter a valid amount (₹10 minimum)", "error");
    return;
  }

  // RESET ALL STATES
  stopWaitingState();
  failedBox.classList.remove("show");
  qrContent.classList.remove("hidden");

  const orderId = generateOrderId();

  const upiLink =
    `upi://pay?pa=${MERCHANT_UPI}` +
    `&pn=${encodeURIComponent(MERCHANT_NAME)}` +
    `&am=${amount}` +
    `&cu=INR` +
    `&tn=${orderId}`;

  qrImage.src =
    `${QR_API}?size=160x160&data=${encodeURIComponent(upiLink)}`;

  qrAmount.innerText = amount;

  qrOverlay.classList.add("show");
  startWaitingState();
  updateSummary(amount);
  startServerPaymentCheck(userUpiId, amount);
});


/* =====================================================
   CLOSE / OUTSIDE / ESC
===================================================== */
qrClose.addEventListener("click", () => {
  if (failedBox.classList.contains("show")) {
    qrOverlay.classList.remove("show");
    unlockDonateBtn();
    showSnackbar("Payment failed");
  } else {
    askCancelConfirmation();
  }
});

qrOverlay.addEventListener("click", (e) => {
  if (e.target !== qrOverlay) return;

  if (paymentState === "WAITING") {
    askCancelConfirmation();
    return;
  }

  if (paymentState === "FAILED") {
    qrOverlay.classList.remove("show");
    unlockDonateBtn();
    showSnackbar("Payment failed");
  }
});


document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;

  if (paymentState === "WAITING") {
    askCancelConfirmation();
    return;
  }

  if (paymentState === "FAILED") {
    qrOverlay.classList.remove("show");
    unlockDonateBtn();
    showSnackbar("Payment failed", "error");
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && paymentState !== "IDLE") {
    e.preventDefault();
  }
});

/* =====================================================
   BUTTONS
===================================================== */
cancelWaitBtn.addEventListener("click", () => {
  stopWaitingState();
  askCancelConfirmation();
});

retryBtn.addEventListener("click", () => {
  failedBox.classList.remove("show");
  qrContent.classList.remove("hidden");
  startWaitingState();
});

submitUtrBtn.addEventListener("click", () => {
  const utr = utrInput.value.trim();
  if (utr.length < 10) {
    showSnackbar("Please enter a valid UTR number", "error");
    return;
  }
  console.log("UTR submitted:", utr);
  qrOverlay.classList.remove("show");
  unlockDonateBtn();
  showSnackbar("UTR submitted. We will verify shortly." , "success");
  utrInput.value = "";
});

function lockDonateBtn() {
  donateBtn.disabled = true;
  donateBtn.classList.add("disabled");
}

function unlockDonateBtn() {
  donateBtn.disabled = false;
  donateBtn.classList.remove("disabled");
}

/* =====================================================
   AMOUNT BUTTONS
===================================================== */
document.querySelectorAll(".amount").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".amount").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelector(".amount-box input").value = "";
  });
});

