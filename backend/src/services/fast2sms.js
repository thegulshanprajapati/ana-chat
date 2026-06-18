import axios from "axios";

export async function sendOTP(mobile, otp) {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const route = process.env.FAST2SMS_ROUTE || "dlt";
  const senderId = process.env.FAST2SMS_SENDER_ID || "SRVDOR";
  const messageId = process.env.FAST2SMS_MESSAGE_ID || "200423";
  const flash = process.env.FAST2SMS_FLASH || "0";
  const scheduleTime = process.env.FAST2SMS_SCHEDULE_TIME || "";
  const variableFormat = (process.env.FAST2SMS_VARIABLES_VALUES || "").trim();
  const variablesValues = variableFormat.includes("{otp}")
    ? variableFormat.replace(/\{otp\}/g, otp)
    : `${otp}|`;

  if (!apiKey) {
    console.log(`[DEV OTP] ${mobile} => ${otp}`);
    return { dev: true };
  }

  await axios.get("https://www.fast2sms.com/dev/bulkV2", {
    params: {
      authorization: apiKey,
      route,
      sender_id: senderId,
      message: messageId,
      variables_values: variablesValues,
      numbers: mobile,
      schedule_time: scheduleTime,
      flash
    }
  });

  return { dev: false, route, senderId, messageId };
}
