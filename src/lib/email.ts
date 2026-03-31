import nodemailer from "nodemailer";

function createTransporter() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.office365.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

function getTransporter() {
  const t = createTransporter();
  if (!t) {
    throw new Error("SMTP 설정이 완료되지 않았습니다. .env 파일의 SMTP_USER, SMTP_PASS를 확인하세요.");
  }
  return t;
}

interface SendSurveyEmailParams {
  to: string;
  customerName: string;
  contactName: string | null;
  surveyTitle: string;
  serviceType: string;
  projectName?: string | null;
  respondUrl: string;
}

export async function sendSurveyEmail(params: SendSurveyEmailParams) {
  const { to, customerName, contactName, surveyTitle, serviceType, projectName, respondUrl } = params;
  const greeting = contactName ? `${contactName}님` : `${customerName} 담당자님`;
  const projectLine = projectName
    ? `<strong>${projectName}</strong> 관련 `
    : "";

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'맑은고딕',sans-serif;background:#f4f4f5;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;color:#fff;padding:24px 32px;">
      <h1 style="margin:0;font-size:18px;">CS 고객만족도 설문조사</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;color:#27272a;line-height:1.7;">
        안녕하세요, <strong>${greeting}</strong>.
      </p>
      <p style="font-size:14px;color:#52525b;line-height:1.7;">
        ${projectLine}<strong>${serviceType}</strong> 서비스에 대한 만족도 설문입니다.<br>
        아래 버튼을 클릭하여 설문에 참여해 주시면 감사하겠습니다.
      </p>
      <p style="font-size:13px;color:#71717a;">소요 시간: 약 3분</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${respondUrl}"
           style="display:inline-block;background:#18181b;color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
          설문 참여하기
        </a>
      </div>
      <p style="font-size:12px;color:#a1a1aa;line-height:1.6;">
        본 메일은 ${surveyTitle}에 대한 설문 안내입니다.<br>
        링크가 작동하지 않으면 아래 URL을 브라우저에 직접 붙여넣어 주세요:<br>
        <a href="${respondUrl}" style="color:#3b82f6;word-break:break-all;">${respondUrl}</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  return getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `[만족도 설문] ${surveyTitle}`,
    html,
  });
}

interface SendReminderEmailParams extends SendSurveyEmailParams {
  reminderCount: number;
}

export async function sendReminderEmail(params: SendReminderEmailParams) {
  const { to, customerName, contactName, surveyTitle, serviceType, respondUrl, reminderCount } = params;
  const greeting = contactName ? `${contactName}님` : `${customerName} 담당자님`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:'맑은고딕',sans-serif;background:#f4f4f5;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e4e7;">
    <div style="background:#18181b;color:#fff;padding:24px 32px;">
      <h1 style="margin:0;font-size:18px;">설문 참여 요청 (리마인더)</h1>
    </div>
    <div style="padding:32px;">
      <p style="font-size:15px;color:#27272a;line-height:1.7;">
        안녕하세요, <strong>${greeting}</strong>.
      </p>
      <p style="font-size:14px;color:#52525b;line-height:1.7;">
        아직 <strong>${serviceType}</strong> 서비스 만족도 설문에 응답하지 않으셨습니다.<br>
        바쁘시겠지만, 잠시 시간을 내어 설문에 참여해 주시면 감사하겠습니다.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${respondUrl}"
           style="display:inline-block;background:#18181b;color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;">
          설문 참여하기
        </a>
      </div>
    </div>
  </div>
</body>
</html>`;

  return getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject: `[리마인더] ${surveyTitle} - 설문 참여 요청`,
    html,
  });
}
