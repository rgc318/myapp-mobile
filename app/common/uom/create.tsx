import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { AppShell } from '@/components/app-shell';
import { ProductTextField } from '@/components/product-form-controls';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useFeedback } from '@/providers/feedback-provider';
import { createUom } from '@/services/uoms';

export default function UomCreateScreen() {
  const router = useRouter();
  const { showError, showSuccess } = useFeedback();
  const tintColor = useThemeColor({}, 'tint');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const borderColor = useThemeColor({}, 'border');
  const warning = useThemeColor({}, 'warning');

  const [uomName, setUomName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [mustBeWholeNumber, setMustBeWholeNumber] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!uomName.trim()) {
      showError('请先填写单位名称。');
      return;
    }

    try {
      setIsSaving(true);
      const created = await createUom({
        uomName: uomName.trim(),
        symbol: symbol.trim() || undefined,
        description: description.trim() || undefined,
        enabled,
        mustBeWholeNumber,
      });

      if (!created) {
        throw new Error('单位创建失败');
      }

      showSuccess(`单位 ${created.uomName} 已创建`);
      router.replace({
        pathname: '/common/uom/[uomName]',
        params: { uomName: created.name },
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : '创建单位失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      compactHeader
      contentCard={false}
      description="新增业务单位，补充符号、整数规则和说明，供商品、订单与库存流程复用。"
      footer={
        <View style={styles.footerBar}>
          <Pressable onPress={() => router.replace('/common/uoms')} style={styles.footerSecondary}>
            <ThemedText style={{ color: tintColor }} type="defaultSemiBold">
              返回单位
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => void handleCreate()}
            style={[styles.footerPrimary, { backgroundColor: tintColor, opacity: isSaving ? 0.72 : 1 }]}>
            <ThemedText style={styles.footerPrimaryText} type="defaultSemiBold">
              {isSaving ? '创建中…' : '创建单位'}
            </ThemedText>
          </Pressable>
        </View>
      }
      title="新增单位">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            单位资料
          </ThemedText>
          <ProductTextField label="单位名称" onChangeText={setUomName} placeholder="例如 箱、件、瓶、托" required value={uomName} />
          <ProductTextField label="单位符号" onChangeText={setSymbol} placeholder="例如 ct、pcs、btl，可留空" value={symbol} />
          <ProductTextField
            label="单位说明"
            multiline
            onChangeText={setDescription}
            placeholder="补充使用场景、约束或业务说明"
            value={description}
          />
        </View>

        <View style={styles.sectionBlock}>
          <ThemedText style={styles.sectionTitle} type="defaultSemiBold">
            使用规则
          </ThemedText>
          <View style={[styles.ruleCard, { backgroundColor: surfaceMuted, borderColor }]}>
            <View style={styles.ruleRow}>
              <View style={styles.ruleCopy}>
                <ThemedText style={styles.ruleLabel} type="defaultSemiBold">
                  必须为整数
                </ThemedText>
                <ThemedText style={styles.ruleHint}>启用后，这个单位在业务录入时不允许输入小数数量。</ThemedText>
              </View>
              <Switch onValueChange={setMustBeWholeNumber} value={mustBeWholeNumber} />
            </View>
            <View style={styles.ruleDivider} />
            <View style={styles.ruleRow}>
              <View style={styles.ruleCopy}>
                <ThemedText style={styles.ruleLabel} type="defaultSemiBold">
                  创建后立即启用
                </ThemedText>
                <ThemedText style={styles.ruleHint}>关闭后单位会先以停用状态创建，可后续再启用。</ThemedText>
              </View>
              <Switch onValueChange={setEnabled} value={enabled} />
            </View>
          </View>
          <View style={styles.tipCard}>
            <ThemedText style={[styles.tipTitle, { color: warning }]} type="defaultSemiBold">
              使用提醒
            </ThemedText>
            <ThemedText style={styles.tipBody}>
              一旦单位已被商品或业务单据引用，后端会限制直接删除，且“必须为整数”规则也不能随意修改。
            </ThemedText>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingBottom: 20,
  },
  sectionBlock: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
  },
  ruleCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ruleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ruleCopy: {
    flex: 1,
    gap: 4,
  },
  ruleLabel: {
    fontSize: 16,
  },
  ruleHint: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  ruleDivider: {
    backgroundColor: '#DEE4EA',
    height: 1,
  },
  tipCard: {
    gap: 4,
    paddingHorizontal: 4,
  },
  tipTitle: {
    fontSize: 15,
  },
  tipBody: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
  },
  footerBar: {
    flexDirection: 'row',
    gap: 12,
  },
  footerSecondary: {
    alignItems: 'center',
    borderColor: '#1677FF',
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerPrimary: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
  },
  footerPrimaryText: {
    color: '#FFF',
    fontSize: 16,
  },
});
