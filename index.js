const express = require("express");
const twilio = require("twilio");

const app = express();
const PORT = process.env.PORT || 3000;

// Temporary memory for critical alerts.
// Later, we can move this to Firebase/database.
const alerts = new Map();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// HOME
// --------------------------------------------------

app.get("/", (req, res) => {
  res.send("Hasim Critical Call Backend is running!");
});

// --------------------------------------------------
// CREATE CRITICAL ALERT + START CALL
// --------------------------------------------------

app.get("/critical-alert", async (req, res) => {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const toNumber = process.env.TWILIO_TO_NUMBER;
    const publicBaseUrl = process.env.PUBLIC_BASE_URL;
    const alertKey = process.env.ALERT_KEY;

    // Simple protection so random people cannot trigger calls.
    if (alertKey && req.query.key !== alertKey) {
      return res.status(401).send("Unauthorized.");
    }

    if (
      !accountSid ||
      !authToken ||
      !fromNumber ||
      !toNumber ||
      !publicBaseUrl
    ) {
      return res.status(500).send(
        "Twilio or PUBLIC_BASE_URL configuration is missing."
      );
    }

    // Information supplied by AI / Report / Block / Game etc.
    const userName = req.query.userName || "";
    const userId = req.query.userId || "";
    const userMessage = req.query.userMessage || "";
    const aiReply = req.query.aiReply || "";
    const severity = req.query.severity || "CRITICAL";
    const reason = req.query.reason || "Critical issue";

    const alertId =
      Date.now().toString() +
      "-" +
      Math.random().toString(36).substring(2, 10);

    const alert = {
      alertId,
      userName,
      userId,
      userMessage,
      aiReply,
      severity,
      reason,
      createdAt: new Date().toISOString()
    };

    alerts.set(alertId, alert);

    const client = twilio(accountSid, authToken);

    // Twilio will visit this public URL and receive
    // the instructions for what to say.
    const twimlUrl =
      publicBaseUrl.replace(/\/$/, "") +
      "/twiml/" +
      encodeURIComponent(alertId);

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: twimlUrl
    });

    console.log("Critical call created:", call.sid);
    console.log("Alert ID:", alertId);

    res.json({
      success: true,
      message: "Critical call started.",
      alertId: alertId,
      callSid: call.sid
    });

  } catch (error) {
    console.error("Critical call error:", error.message);

    res.status(500).json({
      success: false,
      message: "Critical call failed.",
      error: error.message
    });
  }
});

// --------------------------------------------------
// TWILIO VOICE INSTRUCTIONS
// --------------------------------------------------

app.get("/twiml/:alertId", (req, res) => {
  try {
    const alert = alerts.get(req.params.alertId);

    if (!alert) {
      const response = new twilio.twiml.VoiceResponse();

      response.say(
        {
          language: "en-US"
        },
        "Critical alert. Alert information is not available."
      );

      response.hangup();

      res.type("text/xml");
      return res.send(response.toString());
    }

    const response = new twilio.twiml.VoiceResponse();

    response.say(
      {
        language: "en-US"
      },
      "Critical alert."
    );

    if (alert.userName) {
      response.say(
        {
          language: "en-US"
        },
        "User name: " + alert.userName
      );
    }

    if (alert.userId) {
      response.say(
        {
          language: "en-US"
        },
        "User ID: " + alert.userId
      );
    }

    response.say(
      {
        language: "en-US"
      },
      "Severity: " + alert.severity
    );

    response.say(
      {
        language: "en-US"
      },
      "Reason: " + alert.reason
    );

    if (alert.userMessage) {
      response.say(
        {
          language: "en-US"
        },
        "User message: " + alert.userMessage
      );
    }

    if (alert.aiReply) {
      response.say(
        {
          language: "en-US"
        },
        "AI reply: " + alert.aiReply
      );
    }

    response.say(
      {
        language: "en-US"
      },
      "Please check the issue immediately."
    );

    response.hangup();

    res.type("text/xml");
    res.send(response.toString());

  } catch (error) {
    console.error("TwiML error:", error.message);

    res.status(500).type("text/plain").send(
      "Unable to create voice instructions."
    );
  }
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
