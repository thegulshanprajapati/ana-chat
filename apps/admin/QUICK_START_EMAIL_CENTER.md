# 🚀 Email Center - Quick Start Guide

## How to Access

### From Admin Dashboard
1. Log in to Admin Panel
2. Click **"Email Center"** in the main sidebar
3. You'll see the Email Center overview with dedicated sidebar

---

## 📋 Email Center Routes

All routes are under `/email-center`:

| Module | URL | Purpose |
|--------|-----|---------|
| Overview | `/email-center` | Main dashboard & hub |
| Templates | `/email-center/templates` | Manage all email templates |
| Providers | `/email-center/providers` | Configure SMTP/API providers |
| Email Queue | `/email-center/queue` | Monitor queued emails |
| Email Logs | `/email-center/logs` | Track sent emails |
| Analytics | `/email-center/analytics` | Performance metrics |
| Test Email | `/email-center/test` | Send test emails |
| Branding | `/email-center/branding` | Global branding settings |
| Variables | `/email-center/variables` | Merge tags reference |
| Automation | `/email-center/automation` | Email workflows |

---

## 🎯 Quick Actions

### 1️⃣ Send Test Email
```
Email Center → Test Email → Select Template → Enter Email → Send
```

### 2️⃣ Add New Template
```
Email Center → Templates → New Template → Fill Details → Save
```

### 3️⃣ Configure Provider
```
Email Center → Providers → Add Provider → Enter Credentials → Test
```

### 4️⃣ Check Analytics
```
Email Center → Analytics → Select Time Range → View Charts
```

### 5️⃣ Create Automation
```
Email Center → Automation → Create Workflow → Define Trigger & Steps
```

---

## 📊 Understanding the Dashboard

### Overview Page Shows:
- 📈 Total Emails Sent
- ✅ Delivery Rate
- 👁️ Open & Click Rates
- 🔌 Provider Status
- 📋 Recent Activity

### Key Metrics:
- **Delivery Rate:** % of emails successfully delivered
- **Open Rate:** % of delivered emails that were opened
- **Click Rate:** % of emails that had links clicked
- **Bounce Rate:** % of emails that bounced

---

## 🎨 Email Templates

### Template Status:
- 🟢 **Active** - Live and can be sent
- 🔴 **Inactive** - Exists but not sendable
- 🟡 **Draft** - Still in progress

### Template Categories:
- Authentication (Sign up, verification, password reset)
- Security (Login alerts, suspicious activity)
- Messaging (Notifications, mentions)
- Billing (Invoices, payments)
- Marketing (Newsletters, promotions)
- Support (Tickets, feedback)
- Subscription (Trial, renewal)

---

## ⚙️ Email Providers

### Supported Providers:
1. **SMTP** - Gmail, custom servers (Basic)
2. **Resend** - Modern email API
3. **SendGrid** - Enterprise email service
4. **Amazon SES** - AWS email service
5. **Mailgun** - Developer-friendly
6. **Postmark** - Transactional email
7. **Brevo** - SMS + Email platform

### Provider Configuration:
1. Add provider credentials
2. Test connection
3. Set priority order
4. Enable/Disable
5. Check lastTested timestamp

### Failover:
If primary provider fails, automatically tries next in priority order.

---

## 📮 Email Queue

### Queue Status Meanings:
- 🔷 **Queued** - Waiting to be sent
- 🔶 **Sending** - Currently being delivered
- ✅ **Sent** - Successfully sent
- ❌ **Failed** - Delivery failed
- 🔄 **Retrying** - Attempting resend
- ⏹️ **Cancelled** - Manually stopped

### Queue Actions:
- **Retry** - Resend failed emails
- **Pause** - Stop outgoing
- **Delete** - Remove from queue
- **View Details** - See full information

---

## 📋 Email Logs

### Tracking Data:
- Who received the email
- Which template was used
- When it was sent
- Delivery status
- How many times opened
- How many links clicked

### Export:
Download logs as CSV for further analysis

### Filter Options:
- By status (Delivered, Opened, Bounced, etc.)
- By date range
- By provider
- By template
- By recipient

---

## 📈 Analytics Features

### Time Ranges:
- 📅 24 Hours
- 📅 7 Days  
- 📅 30 Days
- 📅 90 Days
- 📅 All Time

### Charts Available:
- **Daily Sent** - Line chart of emails per day
- **Status Distribution** - Pie chart showing delivery status
- **Template Performance** - Table with metrics per template
- **Provider Performance** - Comparison of providers

### Metrics Tracked:
- Sent Count
- Delivered Count
- Open Count & Rate
- Click Count & Rate
- Bounce Rate
- Spam Rate
- Failure Rate

---

## 🧪 Test Email Features

### What You Can Do:
1. **Select Template** - Choose from all templates
2. **Enter Email** - Test recipient (your email)
3. **Override Variables** - Customize merge tags
   - {{user.name}}
   - {{verification_code}}
   - {{reset_link}}
   - etc.
4. **Preview** - See how it looks
5. **Send** - Get immediate feedback
6. **Download** - Full SMTP response

### Response Info:
- ✅ Success or Error
- Provider used (Gmail, Resend, etc.)
- Message ID
- Timestamp
- Any error details

---

## 🎨 Branding Settings

### What You Can Customize:
- Company Name
- Website & Support URLs
- Phone & Email
- Primary & Secondary Colors
- Font Family
- Email Width
- Footer Text
- Copyright Notice
- Social Links

### Live Preview:
See changes in real-time in the email preview

### Applied To:
All emails automatically inherit these settings

---

## 🏷️ Merge Tags (Variables)

### How to Use:
Simply type in your template content:
```
Hello {{user.name}},

Your OTP is: {{otp}}

Reset your password: {{reset_link}}
```

### Common Tags:
| Tag | Example | Use |
|-----|---------|-----|
| {{user.name}} | John Doe | Personalization |
| {{app.name}} | AnaChat | Brand reference |
| {{otp}} | 123456 | One-time password |
| {{verification_link}} | https://... | Email verification |
| {{reset_link}} | https://... | Password reset |
| {{support.email}} | support@... | Contact info |
| {{current_date}} | 2024-01-15 | Date insertion |

### All Available Tags:
Click **"Variables"** in Email Center to see all 42+ tags with examples.

---

## ⚡ Automation Workflows

### Example Workflow: Welcome Series

```
🎯 TRIGGER
   ↓
User Registration Event
   ↓
📧 STEP 1: Send Welcome Email (Immediate)
   ↓
⏳ STEP 2: Wait 3 Days
   ↓
📧 STEP 3: Send Tips Email
   ↓
⏳ STEP 4: Wait 7 Days
   ↓
📧 STEP 5: Send Feature Email
```

### Creating Workflows:
1. Select **Trigger** (What starts workflow?)
2. Add **Steps** (What actions to take?)
3. Set **Conditions** (Optional: if/else logic)
4. Configure **Delays** (Wait between emails)
5. **Test** before activating

### Built-in Workflow Examples:
1. Welcome Series - New user sequence
2. Abandoned Cart - Recovery emails
3. Trial Expiration - Upgrade prompts
4. Post-Purchase - Satisfaction surveys
5. Re-engagement - Win-back campaigns

---

## 🔒 Security Features

- ✅ Encrypted provider credentials
- ✅ Encrypted API keys
- ✅ Role-based access control
- ✅ Audit logs of all changes
- ✅ Input validation
- ✅ Rate limiting
- ✅ Sensitive data masking

---

## 📞 Need Help?

### Common Tasks:

**Q: How do I change an email template?**
A: Go to Templates → Find template → Click Edit → Save changes

**Q: Why is my email failing?**
A: Check Email Logs (logs/page.tsx) for error details or test provider connection

**Q: How do I use merge tags?**
A: Go to Variables page, copy the tag, paste in template editor

**Q: Can I preview before sending?**
A: Yes! Use Test Email section to preview and send test

**Q: How do I track email opens?**
A: Check Email Logs - opens count shown there

---

## 🚀 Next Steps

1. ✅ Explore the Email Center modules
2. ✅ Create your first template
3. ✅ Configure email providers
4. ✅ Send test emails
5. ✅ Set up branding
6. ✅ Create automation workflows
7. ✅ Monitor analytics

---

## 📊 Useful Resources

- **Email Templates Doc**: `EMAIL_CENTER_DOCUMENTATION.md`
- **Admin Dashboard**: Main navigation sidebar
- **Test Email Tool**: Quick way to verify everything works
- **Analytics**: Real-time performance insights
- **Logs**: Complete email history

---

**Email Center v1.0**
Ready for production use in AnaChat Admin Dashboard
