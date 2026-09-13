import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  giftCardErrorCode,
  sellGiftCard,
  type GiftCardRow,
} from "@/api/giftcards";
import Button from "@/components/Button";
import Sheet from "@/components/Sheet";
import { useT } from "@/i18n";
import { fixed, money } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

const AMOUNTS = [25, 50, 100, 200];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSold?: (card: GiftCardRow) => void;
}

/** Sell a gift card at the till: pick the value, cash or card, recipient (digital cards go out by SMS). */
export default function SellGiftCardSheet({ visible, onClose, onSold }: Props) {
  const t = useT();
  const [amount, setAmount] = useState("50");
  const [method, setMethod] = useState<"cash" | "card_terminal">("cash");
  const [kind, setKind] = useState<"physical" | "digital">("physical");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sold, setSold] = useState<GiftCardRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setAmount("50");
      setMethod("cash");
      setKind("physical");
      setName("");
      setPhone("");
      setSold(null);
      setError(null);
    }
  }, [visible]);
  const sell = useMutation({
    mutationFn: () =>
      sellGiftCard({
        amount: fixed(Number(amount) || 0),
        method,
        tendered: method === "cash" ? fixed(Number(amount) || 0) : undefined,
        kind,
        recipient_name: name.trim() || undefined,
        recipient_phone: phone.trim() || undefined,
      }),
    onSuccess: (card) => {
      setSold(card);
      setError(null);
      onSold?.(card);
    },
    onError: (err) => {
      const code = giftCardErrorCode(err);
      const known = code
        ? ((t.giftcards.errors as Record<string, string>)[code] ??
          (t.cash.errors as Record<string, string>)[code])
        : undefined;
      setError(known ?? t.giftcards.errors.generic);
    },
  });
  return (
    <Sheet
      visible={visible}
      title={t.giftcards.sell}
      onClose={onClose}
      maxWidth={480}
      testID="sell-gift-card-sheet"
      footer={
        sold ? (
          <Button
            title={t.cash.done}
            variant="primary"
            size="lg"
            fullWidth
            onPress={onClose}
          />
        ) : (
          <>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              title={`${t.giftcards.sell} · ${money(Number(amount) || 0)}`}
              variant="success"
              size="lg"
              fullWidth
              disabled={
                !(Number(amount) > 0) ||
                sell.isPending ||
                (kind === "digital" && !phone.trim())
              }
              loading={sell.isPending}
              onPress={() => sell.mutate()}
              testID="sell-gift-card-submit"
            />
          </>
        )
      }
    >
      {sold ? (
        <View style={styles.soldBox} testID="gift-card-sold">
          <Text style={styles.soldTitle}>
            {t.giftcards.sold.replace("{code}", sold.code)}
          </Text>
          <Text style={styles.code}>{sold.code}</Text>
          <Text style={styles.meta}>{money(sold.balance)}</Text>
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={styles.chips}>
            {AMOUNTS.map((a) => (
              <Pressable
                key={a}
                onPress={() => setAmount(String(a))}
                style={[styles.chip, amount === String(a) && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    amount === String(a) && styles.chipTextActive,
                  ]}
                >
                  {a} ₾
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t.giftcards.amount}
            placeholderTextColor={colors.slate400}
            style={styles.input}
            testID="gift-card-amount"
          />
          <View style={styles.chips}>
            {(["cash", "card_terminal"] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMethod(m)}
                style={[styles.chip, method === m && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    method === m && styles.chipTextActive,
                  ]}
                >
                  {t.cash.methods[m]}
                </Text>
              </Pressable>
            ))}
            {(["physical", "digital"] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.chip, kind === k && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, kind === k && styles.chipTextActive]}
                >
                  {k === "physical"
                    ? t.giftcards.physical
                    : t.giftcards.digital}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t.giftcards.recipient}
            placeholderTextColor={colors.slate400}
            style={styles.input}
          />
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t.giftcards.recipientPhone}
            placeholderTextColor={colors.slate400}
            style={styles.input}
          />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
  },
  chipText: { fontSize: 14, color: colors.foreground },
  chipTextActive: { color: colors.primary, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.lg,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  error: { color: colors.danger, fontSize: 13 },
  soldBox: {
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.lg,
    backgroundColor: colors.successTint,
    borderRadius: radius.md,
  },
  soldTitle: { fontSize: typography.sizes.md, color: colors.foreground },
  code: {
    fontSize: 28,
    fontWeight: typography.weights.bold,
    letterSpacing: 3,
    color: colors.foreground,
  },
  meta: { fontSize: typography.sizes.lg, color: colors.muted },
});
