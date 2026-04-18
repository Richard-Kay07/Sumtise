/**
 * Email Templates
 * 
 * Templates for invoices, reminders, and payment confirmations
 * Uses Mustache-style variable substitution: {{variableName}}
 */

import { EmailTemplate } from './types'

/**
 * Render template with variables
 */
export function renderTemplate(template: string, variables: Record<string, any>): string {
  let rendered = template
  
  // Replace {{variable}} with actual values
  Object.keys(variables).forEach((key) => {
    const value = variables[key] || ''
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
    rendered = rendered.replace(regex, String(value))
  })
  
  // Remove any unmatched variables (optional - could throw error instead)
  rendered = rendered.replace(/\{\{[\w]+\}\}/g, '')
  
  return rendered
}

/**
 * Get invoice email template
 */
export function getInvoiceTemplate(version: number = 1): EmailTemplate {
  return {
    name: 'invoice',
    version,
    subject: 'Invoice {{invoiceNumber}} from {{companyName}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .invoice-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .amount { font-size: 24px; font-weight: bold; color: #4F46E5; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{companyName}}</h1>
    </div>
    <div class="content">
      <p>Dear {{customerName}},</p>
      <p>Please find attached invoice <strong>{{invoiceNumber}}</strong> for your records.</p>
      
      <div class="invoice-details">
        <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
        <p><strong>Date:</strong> {{invoiceDate}}</p>
        <p><strong>Due Date:</strong> {{dueDate}}</p>
        <p><strong>Amount:</strong> <span class="amount">{{currency}} {{total}}</span></p>
      </div>
      
      <p>Payment is due by {{dueDate}}. Please contact us if you have any questions.</p>
      
      <p>Thank you for your business!</p>
      <p>{{companyName}}</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply directly to this message.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Invoice {{invoiceNumber}} from {{companyName}}

Dear {{customerName}},

Please find attached invoice {{invoiceNumber}} for your records.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Date: {{invoiceDate}}
- Due Date: {{dueDate}}
- Amount: {{currency}} {{total}}

Payment is due by {{dueDate}}. Please contact us if you have any questions.

Thank you for your business!
{{companyName}}

---
This is an automated email. Please do not reply directly to this message.
    `.trim(),
    variables: [
      'companyName',
      'customerName',
      'invoiceNumber',
      'invoiceDate',
      'dueDate',
      'currency',
      'total',
    ],
  }
}

/**
 * Get reminder email template
 */
export function getReminderTemplate(version: number = 1): EmailTemplate {
  return {
    name: 'reminder',
    version,
    subject: 'Reminder: Invoice {{invoiceNumber}} - Payment Due',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #F59E0B; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .invoice-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .amount { font-size: 24px; font-weight: bold; color: #DC2626; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
    .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Reminder</h1>
    </div>
    <div class="content">
      <p>Dear {{customerName}},</p>
      <p>This is a friendly reminder that invoice <strong>{{invoiceNumber}}</strong> is {{daysOverdue}} days {{overdueStatus}}.</p>
      
      <div class="invoice-details">
        <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
        <p><strong>Date:</strong> {{invoiceDate}}</p>
        <p><strong>Due Date:</strong> {{dueDate}}</p>
        <p><strong>Amount Due:</strong> <span class="amount">{{currency}} {{balance}}</span></p>
      </div>
      
      <p>Please arrange payment at your earliest convenience. If you have already made payment, please disregard this reminder.</p>
      
      <p>If you have any questions, please contact us.</p>
      <p>Thank you,<br>{{companyName}}</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply directly to this message.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Payment Reminder

Dear {{customerName}},

This is a friendly reminder that invoice {{invoiceNumber}} is {{daysOverdue}} days {{overdueStatus}}.

Invoice Details:
- Invoice Number: {{invoiceNumber}}
- Date: {{invoiceDate}}
- Due Date: {{dueDate}}
- Amount Due: {{currency}} {{balance}}

Please arrange payment at your earliest convenience. If you have already made payment, please disregard this reminder.

If you have any questions, please contact us.

Thank you,
{{companyName}}

---
This is an automated email. Please do not reply directly to this message.
    `.trim(),
    variables: [
      'companyName',
      'customerName',
      'invoiceNumber',
      'invoiceDate',
      'dueDate',
      'currency',
      'balance',
      'daysOverdue',
      'overdueStatus',
    ],
  }
}

/**
 * Get payment confirmation email template
 */
export function getPaymentConfirmationTemplate(version: number = 1): EmailTemplate {
  return {
    name: 'payment_confirmation',
    version,
    subject: 'Payment Confirmation - {{paymentReference}}',
    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #10B981; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .payment-details { background-color: white; padding: 15px; margin: 20px 0; border-radius: 5px; }
    .amount { font-size: 24px; font-weight: bold; color: #10B981; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Received</h1>
    </div>
    <div class="content">
      <p>Dear {{vendorName}},</p>
      <p>This email confirms that we have received your payment.</p>
      
      <div class="payment-details">
        <p><strong>Payment Reference:</strong> {{paymentReference}}</p>
        <p><strong>Date:</strong> {{paymentDate}}</p>
        <p><strong>Amount:</strong> <span class="amount">{{currency}} {{amount}}</span></p>
        <p><strong>Method:</strong> {{paymentMethod}}</p>
        {{#if billNumber}}
        <p><strong>Applied to Bill:</strong> {{billNumber}}</p>
        {{/if}}
      </div>
      
      <p>Thank you for your payment!</p>
      <p>{{companyName}}</p>
    </div>
    <div class="footer">
      <p>This is an automated email. Please do not reply directly to this message.</p>
    </div>
  </div>
</body>
</html>
    `.trim(),
    text: `
Payment Received

Dear {{vendorName}},

This email confirms that we have received your payment.

Payment Details:
- Payment Reference: {{paymentReference}}
- Date: {{paymentDate}}
- Amount: {{currency}} {{amount}}
- Method: {{paymentMethod}}
{{#if billNumber}}
- Applied to Bill: {{billNumber}}
{{/if}}

Thank you for your payment!

{{companyName}}

---
This is an automated email. Please do not reply directly to this message.
    `.trim(),
    variables: [
      'companyName',
      'vendorName',
      'paymentReference',
      'paymentDate',
      'currency',
      'amount',
      'paymentMethod',
      'billNumber',
    ],
  }
}

/**
 * Get all templates
 */
export function getAllTemplates(): EmailTemplate[] {
  return [
    getInvoiceTemplate(),
    getReminderTemplate(),
    getPaymentConfirmationTemplate(),
  ]
}

/**
 * Get template by name
 */
export function getTemplate(name: string, version?: number): EmailTemplate | null {
  const templates: Record<string, () => EmailTemplate> = {
    invoice: () => getInvoiceTemplate(version),
    reminder: () => getReminderTemplate(version),
    payment_confirmation: () => getPaymentConfirmationTemplate(version),
  }

  const templateGetter = templates[name]
  if (!templateGetter) {
    return null
  }

  return templateGetter()
}




