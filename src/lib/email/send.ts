export type TaxEmailPayload = {
  to: string
  employeeName: string
  year: number
  magicLink: string
  expiryDays: number
}

export async function sendTaxEmail(payload: TaxEmailPayload): Promise<void> {
  const { to, employeeName, year, magicLink, expiryDays } = payload

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Your ${year} Tax Summary</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
          <!-- Header -->
          <tr>
            <td style="background:#0f172a;padding:32px 40px">
              <p style="margin:0;color:#fff;font-size:20px;font-weight:700">Tax Filing Portal</p>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px">Annual Tax Summary Ready</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px">
              <p style="margin:0 0 12px;color:#0f172a;font-size:15px">Hi ${employeeName},</p>
              <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6">
                Your <strong>${year} Annual Tax Summary</strong> has been generated and is ready for your review.
                Please access your summary using the secure link below, then download your PDF and upload your tax receipt.
              </p>
              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px">
                <tr>
                  <td style="background:#2563eb;border-radius:8px">
                    <a href="${magicLink}"
                       style="display:inline-block;padding:14px 32px;color:#fff;font-size:14px;font-weight:600;text-decoration:none">
                      View My Tax Summary →
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Warning -->
              <div style="background:#fefce8;border:1px solid #fde047;border-radius:8px;padding:14px 16px;margin-bottom:24px">
                <p style="margin:0;color:#713f12;font-size:13px">
                  <strong>Important:</strong> This link expires in <strong>${expiryDays} days</strong>.
                  If your link expires, contact your finance team for a new one.
                </p>
              </div>
              <!-- Steps -->
              <p style="margin:0 0 12px;color:#0f172a;font-size:13px;font-weight:600">What to do next:</p>
              <ol style="margin:0;padding-left:18px;color:#475569;font-size:13px;line-height:2">
                <li>Click the button above to view your summary</li>
                <li>Review your annual tax figures</li>
                <li>Download your PDF</li>
                <li>Upload your tax receipt to confirm submission</li>
              </ol>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e2e8f0;background:#f8fafc">
              <p style="margin:0;color:#94a3b8;font-size:12px">
                This is an automated message. Do not reply to this email.
                If you have questions, contact your finance team directly.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Tax Portal <noreply@yourdomain.com>',
      to,
      subject: `Your ${year} Annual Tax Summary is Ready`,
      html,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Email send failed: ${err}`)
  }
}
