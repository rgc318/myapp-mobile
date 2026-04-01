import { ReturnCreateScreen } from '@/components/return-create-screen';

export default function PurchaseReturnCreateScreen() {
  return (
    <ReturnCreateScreen
      businessType="purchase"
      description="基于采购发票或收货事实创建独立退货单；已付款场景会在结果页提示后续供应商退款方向。"
      title="采购退货"
    />
  );
}
