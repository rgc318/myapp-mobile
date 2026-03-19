export type PaymentResultHandoff = {
  invoiceName: string;
  paymentEntry?: string;
  writeoffAmount?: number;
  unallocatedAmount?: number;
  paidAmount?: number;
  currency?: string;
};

const paymentResultStore = new Map<string, PaymentResultHandoff>();

export function rememberPaymentResultHandoff(payload: PaymentResultHandoff) {
  if (!payload.invoiceName) {
    return;
  }

  paymentResultStore.set(payload.invoiceName, payload);
}

export function getPaymentResultHandoff(invoiceName: string) {
  if (!invoiceName) {
    return null;
  }

  return paymentResultStore.get(invoiceName) ?? null;
}

export function clearPaymentResultHandoff(invoiceName: string) {
  if (!invoiceName) {
    return;
  }

  paymentResultStore.delete(invoiceName);
}
