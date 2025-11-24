import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

interface PayPalProps {
  amount: number;
  onSuccess: (details: any) => void;
  onError: (err: any) => void;
}

export default function PayPalPayment({ amount, onSuccess, onError }: PayPalProps) {
  // Chuyển đổi VND sang USD (vì PayPal Sandbox thường dùng USD)
  // Tỷ giá ví dụ: 25.000 VND = 1 USD
  const amountUSD = (amount / 25000).toFixed(2);

  return (
    <PayPalScriptProvider options={{ 
      "clientId": "AfmoA10hnFXKY_A9Q0adiZODaVt5dLdqPLHkdsfYp4LBEYmpdNNsRAkHZ-wTwbPx0gE0HNNw8KG1cdtE", // Thay bằng Client ID Sandbox của bạn
      currency: "USD" 
    }}>
      <PayPalButtons
        style={{ layout: "horizontal" }}
        createOrder={(data, actions) => {
          return actions.order.create({
            intent: "CAPTURE", // Sửa lỗi type ở đây
            purchase_units: [
              {
                amount: {
                  currency_code: "USD",
                  value: amountUSD,
                },
              },
            ],
          });
        }}
        onApprove={(data, actions) => {
          if (!actions.order) return Promise.reject("Order not found");
          return actions.order.capture().then((details) => {
            onSuccess(details);
          });
        }}
        onError={onError}
      />
    </PayPalScriptProvider>
  );
}