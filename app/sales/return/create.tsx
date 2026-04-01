import { ReturnCreateScreen } from '@/components/return-create-screen';

export default function SalesReturnCreateScreen() {
  return (
    <ReturnCreateScreen
      businessType="sales"
      description="基于销售发票或发货事实创建独立退货单；已收款场景会在结果页提示后续退款方向。"
      title="销售退货"
    />
  );
}
