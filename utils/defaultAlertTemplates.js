/**
 * Default email templates for store customer alerts.
 */
export const getDefaultTemplates = (storeName = "Our Store") => [
  {
    eventType: "order_placed",
    name: "Order Placed Template",
    subject: `Order Received - {{storeName}}`,
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #76b900;">Order Confirmation</h2>
  <p>Hi {{customerName}},</p>
  <p>Thank you for shopping with <strong>{{storeName}}</strong>! We have received your order and are currently processing it.</p>
  <h3 style="margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 5px;">Order Summary (ID: {{orderId}})</h3>
  {{orderItems}}
  <p style="text-align: right; font-size: 16px;"><strong>Total Amount: ₹{{totalAmount}}</strong></p>
  <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via {{storeName}}.</p>
</div>`,
    isActive: true,
  },
  {
    eventType: "order_shipped",
    name: "Order Shipped Template",
    subject: `Your order has been shipped! - {{storeName}}`,
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #3b82f6;">Order Shipped</h2>
  <p>Hi {{customerName}},</p>
  <p>Good news! Your order <strong>#{{orderId}}</strong> from <strong>{{storeName}}</strong> has been shipped and is on its way to you.</p>
  {{trackingDetails}}
  <h3 style="margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 5px;">Order Details</h3>
  {{orderItems}}
  <p style="text-align: right; font-size: 16px;"><strong>Total Amount: ₹{{totalAmount}}</strong></p>
  <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via {{storeName}}.</p>
</div>`,
    isActive: true,
  },
  {
    eventType: "order_delivered",
    name: "Order Delivered Template",
    subject: `Your order has been delivered! - {{storeName}}`,
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #10b981;">Order Delivered</h2>
  <p>Hi {{customerName}},</p>
  <p>Your order <strong>#{{orderId}}</strong> from <strong>{{storeName}}</strong> has been successfully delivered. We hope you enjoy your purchase!</p>
  <h3 style="margin-top: 30px; border-bottom: 2px solid #eee; padding-bottom: 5px;">Order Details</h3>
  {{orderItems}}
  <p style="text-align: right; font-size: 16px;"><strong>Total Amount: ₹{{totalAmount}}</strong></p>
  <div style="margin-top: 30px; padding: 20px; background-color: #f8fafc; border-radius: 12px; text-align: center;">
    <h3 style="margin-top: 0; color: #333;">How did we do?</h3>
    <p style="font-size: 14px; color: #555; margin-bottom: 20px;">We would love to hear your feedback on your purchased items:</p>
    {{reviewLinks}}
  </div>
  <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via {{storeName}}.</p>
</div>`,
    isActive: true,
  },
  {
    eventType: "order_canceled",
    name: "Order Canceled Template",
    subject: `Order Canceled - {{storeName}}`,
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #ef4444;">Order Canceled</h2>
  <p>Hi {{customerName}},</p>
  <p>We're writing to let you know that your order <strong>#{{orderId}}</strong> from <strong>{{storeName}}</strong> has been canceled.</p>
  <p>If you have any questions, please contact our support team.</p>
  <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via {{storeName}}.</p>
</div>`,
    isActive: true,
  },
  {
    eventType: "order_returned",
    name: "Order Returned Template",
    subject: `Order Returned - {{storeName}}`,
    body: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #f59e0b;">Order Returned</h2>
  <p>Hi {{customerName}},</p>
  <p>We have received your returned items for order <strong>#{{orderId}}</strong> at <strong>{{storeName}}</strong>.</p>
  <p>Your refund will be processed shortly according to our store policy.</p>
  <p style="margin-top: 30px; color: #777; font-size: 12px; text-align: center;">This is an automated email sent via {{storeName}}.</p>
</div>`,
    isActive: true,
  },
  {
    eventType: "bill_receipt",
    name: "Customer Bill Receipt",
    subject: `Invoice - {{storeName}}`,
    body: `<div style="font-family: sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; color: #333; border: 1px solid #ddd;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h1 style="margin: 0; color: #333;">INVOICE</h1>
    <h2 style="margin: 5px 0; color: #76b900;">{{storeName}}</h2>
  </div>
  <div style="display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #eee; padding-bottom: 20px;">
    <div>
      <p style="margin: 2px 0;"><strong>Billed To:</strong></p>
      <p style="margin: 2px 0;">{{customerName}}</p>
      <p style="margin: 2px 0;">{{customerPhone}}</p>
      <p style="margin: 2px 0;">{{customerEmail}}</p>
      <p style="margin: 2px 0;">{{customerAddress}}</p>
    </div>
    <div style="text-align: right;">
      <p style="margin: 2px 0;"><strong>Invoice #:</strong> {{orderId}}</p>
      <p style="margin: 2px 0;"><strong>Date:</strong> {{orderDate}}</p>
      <p style="margin: 2px 0;"><strong>Payment Method:</strong> {{paymentMethod}}</p>
      <p style="margin: 2px 0;"><strong>Order Status:</strong> {{orderStatus}}</p>
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
    <thead>
      <tr style="background-color: #f8f9fa;">
        <th style="padding: 10px; border-bottom: 1px solid #ddd; text-align: left;">Item</th>
        <th style="padding: 10px; border-bottom: 1px solid #ddd; text-align: center;">Qty</th>
        <th style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">Price</th>
        <th style="padding: 10px; border-bottom: 1px solid #ddd; text-align: right;">Total</th>
      </tr>
    </thead>
    <tbody>
      {{billItems}}
    </tbody>
  </table>
  <div style="width: 100%; display: flex; justify-content: flex-end;">
    <table style="width: 300px; border-collapse: collapse;">
      <tr><td style="padding: 5px 10px; text-align: left;"><strong>Subtotal:</strong></td><td style="padding: 5px 10px; text-align: right;">₹{{subTotal}}</td></tr>
      {{discountRows}}
      <tr><td style="padding: 5px 10px; text-align: left;"><strong>Shipping:</strong></td><td style="padding: 5px 10px; text-align: right;">₹{{shippingCharge}}</td></tr>
      <tr><td style="padding: 10px; text-align: left; font-size: 18px; border-top: 2px solid #333;"><strong>Total:</strong></td><td style="padding: 10px; text-align: right; font-size: 18px; border-top: 2px solid #333;"><strong>₹{{totalAmount}}</strong></td></tr>
    </table>
  </div>
  <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #777;"><p>Thank you for your business!</p></div>
</div>`,
    isActive: true,
  }
];
