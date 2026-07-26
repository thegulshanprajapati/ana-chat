/**
 * emailTemplate.js — Email template loader and variable substitution engine.
 *
 * Loads templates from PostgreSQL (with in-memory mock fallback).
 * Replaces {{variable}} placeholders with actual values.
 */
import { query } from "../dbPostgres.js";
import { mockDb } from "../dbPostgres.js";

const BRAND_NAME = process.env.BRAND_NAME || "AnaChat";
const WEBSITE = process.env.APP_URL || "https://chat.myana.site";
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "support@myana.site";

/**
 * Get a template by its key from the database.
 * @param {string} key - Template key e.g. "forgot_password"
 * @returns {object|null}
 */
export async function getTemplate(key) {
  try {
    const res = await query(
      "SELECT * FROM email_templates WHERE template_key = $1 AND is_active = TRUE LIMIT 1",
      [key]
    );
    return res.rows[0] || null;
  } catch {
    return mockDb.email_templates.find(t => t.template_key === key && t.is_active !== false) || null;
  }
}

/**
 * Get all templates.
 * @returns {Array}
 */
export async function getAllTemplates() {
  try {
    const res = await query("SELECT * FROM email_templates ORDER BY name ASC");
    return res.rows;
  } catch {
    return mockDb.email_templates;
  }
}

/**
 * Upsert a template.
 * @param {string} key
 * @param {object} fields
 */
export async function upsertTemplate(key, fields) {
  const {
    name, subject, html_content, plain_text,
    sender_name, reply_to, button_color, brand_color,
    bg_color, logo_url, support_email, social_links,
    header_html, footer_html
  } = fields;

  const res = await query(
    `INSERT INTO email_templates
       (template_key, name, subject, html_content, plain_text, sender_name, reply_to,
        button_color, brand_color, bg_color, logo_url, support_email, social_links,
        header_html, footer_html)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (template_key) DO UPDATE SET
       name = EXCLUDED.name,
       subject = EXCLUDED.subject,
       html_content = EXCLUDED.html_content,
       plain_text = EXCLUDED.plain_text,
       sender_name = EXCLUDED.sender_name,
       reply_to = EXCLUDED.reply_to,
       button_color = EXCLUDED.button_color,
       brand_color = EXCLUDED.brand_color,
       bg_color = EXCLUDED.bg_color,
       logo_url = EXCLUDED.logo_url,
       support_email = EXCLUDED.support_email,
       social_links = EXCLUDED.social_links,
       header_html = EXCLUDED.header_html,
       footer_html = EXCLUDED.footer_html,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      key, name || key, subject || "", html_content || "",
      plain_text || "", sender_name || "AnaChat", reply_to || "",
      button_color || "#e11d48", brand_color || "#e11d48",
      bg_color || "#f8fafc", logo_url || "", support_email || "",
      JSON.stringify(social_links || []),
      header_html || "", footer_html || ""
    ]
  );
  return res.rows[0] || null;
}

/**
 * Replace all {{variable}} placeholders in a string.
 * @param {string} content
 * @param {object} vars
 * @returns {string}
 */
export function renderTemplate(content, vars = {}) {
  if (!content) return "";
  let result = content;
  const allVars = {
    brand_name: BRAND_NAME,
    company_name: BRAND_NAME,
    website: WEBSITE,
    support_email: SUPPORT_EMAIL,
    current_year: new Date().getFullYear(),
    logo: vars.logo_url || "",
    ...vars
  };

  for (const [key, value] of Object.entries(allVars)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    result = result.replace(regex, String(value ?? ""));
  }

  return result;
}

/**
 * Compose a ready-to-send email from a template key and variables.
 * @param {string} templateKey
 * @param {object} vars - Dynamic values to inject
 * @returns {{ subject, html, text, from, replyTo }}
 */
export async function composeEmail(templateKey, vars = {}) {
  const template = await getTemplate(templateKey);

  if (!template) {
    throw new Error(`Email template "${templateKey}" not found or inactive.`);
  }

  // Merge template-level style vars
  const mergedVars = {
    button_color: template.button_color || "#e11d48",
    brand_color: template.brand_color || "#e11d48",
    bg_color: template.bg_color || "#f8fafc",
    logo_url: template.logo_url || "",
    support_email: template.support_email || SUPPORT_EMAIL,
    ...vars
  };

  // Build full HTML with optional header/footer
  let fullHtml = "";
  if (template.header_html) fullHtml += renderTemplate(template.header_html, mergedVars);
  fullHtml += renderTemplate(template.html_content, mergedVars);
  if (template.footer_html) fullHtml += renderTemplate(template.footer_html, mergedVars);

  return {
    subject: renderTemplate(template.subject, mergedVars),
    html: fullHtml,
    text: renderTemplate(template.plain_text, mergedVars),
    senderName: template.sender_name || "AnaChat",
    replyTo: template.reply_to || undefined
  };
}
