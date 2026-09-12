import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import type { ReasonOption } from "@/api/payments";
import Button from "@/components/Button";
import ReasonPicker, {
  EMPTY_REASON,
  type ReasonValue,
} from "@/components/ReasonPicker";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { colors, typography } from "@/theme/tokens";

interface Props {
  visible: boolean;
  kind: ReasonOption["kind"];
  title: string;
  subtitle?: string;
  confirmLabel: string;
  danger?: boolean;
  manager: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: {
    reason_id: string | null;
    reason_text: string;
  }) => void;
}

/** "Why?" dialog for voids, comps and refunds. */
export default function ReasonSheet({
  visible,
  kind,
  title,
  subtitle,
  confirmLabel,
  danger,
  manager,
  loading,
  error,
  onClose,
  onConfirm,
}: Props) {
  const t = useT();
  const [reason, setReason] = useState<ReasonValue>(EMPTY_REASON);
  const ready = !!(reason.reason_id || reason.reason_text.trim());

  return (
    <Sheet
      visible={visible}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            title={confirmLabel}
            variant={danger ? "danger" : "primary"}
            size="lg"
            fullWidth
            disabled={!ready || loading}
            loading={loading}
            onPress={() =>
              onConfirm({
                reason_id: reason.reason_id,
                reason_text: reason.reason_id ? "" : reason.reason_text.trim(),
              })
            }
          />
          <Button
            title={t.cash.cancel}
            variant="outline"
            size="lg"
            fullWidth
            onPress={onClose}
          />
        </>
      }
    >
      <ReasonPicker
        kind={kind}
        value={reason}
        onChange={setReason}
        manager={manager}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
});
