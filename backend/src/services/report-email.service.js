const { createHmac, randomInt } = require("node:crypto");
const db = require("../config/db");
const env = require("../config/env");
const { getXlsxExportData } = require("./telemetry.service");
const { buildTelemetryWorkbook } = require("./telemetry-xlsx.service");

const OTP_MINUTES = 10;

function reportEmailError(status, code, message) {
    return Object.assign(new Error(message), { status, code, reportEmailError: true });
}

async function sendWithResend({ to, subject, text, attachment }) {
    try {
        const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${env.reportEmail.apiKey}`, "Content-Type": "application/json" },
            signal: AbortSignal.timeout(10000),
            body: JSON.stringify({
                from: env.reportEmail.from,
                to: [to],
                subject,
                text,
                ...(attachment ? { attachments: [{ filename: attachment.filename, content: attachment.content.toString("base64") }] } : {}),
            }),
        });
        const body = await response.json();
        if (!response.ok || !body?.id) throw new Error("Provider did not accept message");
    } catch {
        throw reportEmailError(502, "REPORT_EMAIL_SEND_FAILED", "Email provider did not confirm the request");
    }
}

function createReportEmailService({ pool, sendMail, settings, loadRows = getXlsxExportData }) {
    function requireAvailable(forXlsx = false) {
        const enabled = settings.enabled || (!forXlsx && settings.accountEnabled);
        if (!enabled || settings.otpSecret.length < 32 || !settings.apiKey || !settings.from) {
            throw reportEmailError(503, "REPORT_EMAIL_UNAVAILABLE", "Report email is not configured");
        }
    }

    function digest(user, code) {
        return createHmac("sha256", settings.otpSecret)
            .update(JSON.stringify([String(user.id), user.email, code])).digest("hex");
    }

    async function getStatus(user) {
        requireAvailable();
        const { rows } = await pool.query(
            `SELECT verified_at FROM report_email_verifications WHERE user_id = $1 AND email = $2`,
            [user.id, user.email]
        );
        return { email: user.email, verified: Boolean(rows[0]?.verified_at) };
    }

    async function requestCode(user, locale) {
        const status = await getStatus(user);
        if (status.verified) return status;
        const code = String(randomInt(1000000)).padStart(6, "0");
        const { rowCount } = await pool.query(
            `INSERT INTO report_email_verifications (user_id, email, code_digest, requested_at, expires_at)
             VALUES ($1, $2, $3, NOW(), NOW() + make_interval(mins => $4))
             ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, code_digest = EXCLUDED.code_digest,
               requested_at = EXCLUDED.requested_at, expires_at = EXCLUDED.expires_at, attempts = 0, verified_at = NULL
             WHERE report_email_verifications.requested_at <= NOW() - INTERVAL '60 seconds'
               AND (report_email_verifications.email <> EXCLUDED.email OR report_email_verifications.verified_at IS NULL)
             RETURNING user_id`,
            [user.id, user.email, digest(user, code), OTP_MINUTES]
        );
        if (!rowCount) {
            const current = await getStatus(user);
            if (current.verified) return current;
            throw reportEmailError(429, "REPORT_EMAIL_CODE_COOLDOWN", "Wait before requesting another code");
        }
        await sendMail({
            to: user.email,
            subject: locale === "id" ? "Kode verifikasi email Fluxen" : "Fluxen email verification code",
            text: locale === "id"
                ? `Kode verifikasi Fluxen: ${code}. Berlaku ${OTP_MINUTES} menit. Abaikan jika Anda tidak memintanya.`
                : `Fluxen verification code: ${code}. It expires in ${OTP_MINUTES} minutes. Ignore this message if you did not request it.`,
        });
        return { ...status, expires_in_seconds: OTP_MINUTES * 60 };
    }

    async function verifyCode(user, code) {
        requireAvailable();
        // Count failures and consume the correct code atomically, even with concurrent requests.
        const { rows } = await pool.query(
            `UPDATE report_email_verifications SET
               attempts = attempts + 1,
               verified_at = CASE WHEN code_digest = $3 THEN NOW() ELSE NULL END,
               code_digest = CASE WHEN code_digest = $3 OR attempts + 1 >= 5 THEN NULL ELSE code_digest END
             WHERE user_id = $1 AND email = $2 AND verified_at IS NULL
               AND expires_at > NOW() AND code_digest IS NOT NULL AND attempts < 5
             RETURNING verified_at`,
            [user.id, user.email, digest(user, code)]
        );
        if (!rows[0]?.verified_at) {
            throw reportEmailError(422, "REPORT_EMAIL_CODE_INVALID", "The code is invalid, expired or used");
        }
        return { email: user.email, verified: true };
    }

    async function sendReport(user, { device_code, from, to, locale }) {
        requireAvailable(true);
        const { verified } = await getStatus(user);
        if (!verified) throw reportEmailError(403, "REPORT_EMAIL_NOT_VERIFIED", "Verify the account email first");
        // Existing exporter enforces ownership by user ID before reading measurements.
        const rows = await loadRows(user.id, device_code, from, to);
        const workbook = buildTelemetryWorkbook({ deviceCode: device_code, from, to, rows });
        const content = Buffer.from(await workbook.xlsx.writeBuffer());
        const safeCode = device_code.replace(/[^a-z0-9_-]/gi, "_");
        await sendMail({
            to: user.email,
            subject: locale === "id" ? "Laporan pemakaian air Fluxen" : "Fluxen water usage report",
            text: locale === "id"
                ? `Laporan XLSX untuk periode ${from} sampai ${to} terlampir.`
                : `Your XLSX report for ${from} to ${to} is attached.`,
            attachment: { filename: `${safeCode}_${from}_${to}.xlsx`, content },
        });
        return { email: user.email };
    }

    return { getStatus, requestCode, verifyCode, sendReport };
}

module.exports = {
    ...createReportEmailService({ pool: db, sendMail: sendWithResend, settings: env.reportEmail }),
    createReportEmailService,
    reportEmailError,
    sendWithResend,
};
