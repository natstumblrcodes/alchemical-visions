const apiBase = "https://api.twilio.com/2010-04-01";

function config() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) throw new Error("Missing Twilio configuration.");
  return { sid, token, from };
}

async function twilioPost(path: string, params: Record<string, string>) {
  const { sid, token } = config();
  const response = await fetch(apiBase + "/Accounts/" + sid + path, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(sid + ":" + token).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Twilio request failed: " + await response.text());
  return response.json();
}

export async function sendSessionSms(to: string, sessionType: string) {
  const { from } = config();
  return twilioPost("/Messages.json", {
    To: to,
    From: from,
    Body: "Alchemical Visions: You have a new " + sessionType + " consultation request. Open your provider console to accept it.",
  });
}

export async function callForSession(to: string, sessionType: string) {
  const { from } = config();
  const twiml = "<Response><Say voice="alice">Alchemical Visions. You have a new " + sessionType + " consultation request. Please open your provider console to accept the session.</Say></Response>";
  return twilioPost("/Calls.json", { To: to, From: from, Twiml: twiml });
}
