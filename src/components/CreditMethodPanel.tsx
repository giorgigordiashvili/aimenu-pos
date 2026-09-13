import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { lookupGiftCard, type GiftCardLookup } from "@/api/giftcards";
import { listHouseAccounts, type HouseAccountRow } from "@/api/houseaccounts";
import { useT } from "@/i18n";
import { money, num } from "@/lib/money";
import { colors, radius, spacing, typography } from "@/theme/tokens";

interface GiftProps {
  code: string;
  onCodeChange: (code: string) => void;
  onLookup: (card: GiftCardLookup | null) => void;
  due: number;
}

/** Gift card code + balance check inside the payment sheet. */
export function GiftCardMethod({
  code,
  onCodeChange,
  onLookup,
  due,
}: GiftProps) {
  const t = useT();
  const [card, setCard] = useState<GiftCardLookup | null>(null);
  const [busy, setBusy] = useState(false);
  const check = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const res = await lookupGiftCard(code.trim());
      setCard(res);
      onLookup(res.is_usable ? res : null);
    } catch {
      setCard(null);
      onLookup(null);
    } finally {
      setBusy(false);
    }
  };
  const usable = card?.is_usable ?? false;
  const willUse = usable ? Math.min(num(card!.balance), due) : 0;
  return (
    <View style={styles.block} testID="gift-card-method">
      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={(v) => {
            onCodeChange(v.toUpperCase());
            setCard(null);
            onLookup(null);
          }}
          placeholder={t.giftcards.code}
          placeholderTextColor={colors.slate400}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[styles.input, { flex: 1 }]}
          testID="gift-card-code"
        />
        <Pressable
          onPress={check}
          disabled={busy || !code.trim()}
          style={styles.checkBtn}
          testID="gift-card-check"
        >
          <Text style={styles.checkText}>{t.giftcards.check}</Text>
        </Pressable>
      </View>
      {card ? (
        usable ? (
          <Text style={styles.ok}>
            {t.giftcards.balance.replace("{amount}", money(card.balance))} ·{" "}
            {t.giftcards.willUse.replace("{amount}", money(willUse))}
          </Text>
        ) : (
          <Text style={styles.error}>
            {(t.giftcards.errors as Record<string, string>)[
              card.error_code || card.status
            ] ?? t.giftcards.errors.generic}
          </Text>
        )
      ) : null}
    </View>
  );
}

interface HouseProps {
  selected: HouseAccountRow | null;
  onSelect: (a: HouseAccountRow | null) => void;
  signedBy: string;
  onSignedByChange: (v: string) => void;
  suggestedPhone?: string;
}

/** House account picker (search by name / company / phone) inside the payment sheet. */
export function HouseAccountMethod({
  selected,
  onSelect,
  signedBy,
  onSignedByChange,
  suggestedPhone,
}: HouseProps) {
  const t = useT();
  const [q, setQ] = useState("");
  const accounts = useQuery({
    queryKey: ["house-accounts", q],
    queryFn: () => listHouseAccounts(q),
    staleTime: 30_000,
  });
  useEffect(() => {
    if (selected || !suggestedPhone || !accounts.data) return;
    const match = accounts.data.find(
      (a) =>
        a.phone &&
        suggestedPhone
          .replace(/\D/g, "")
          .endsWith(a.phone.replace(/\D/g, "").slice(-9)),
    );
    if (match) onSelect(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.data, suggestedPhone]);
  return (
    <View style={styles.block} testID="house-account-method">
      {selected ? (
        <View style={styles.selected}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>
              {selected.name}
              {selected.company ? ` · ${selected.company}` : ""}
            </Text>
            <Text style={styles.meta}>
              {t.houseaccounts.balance.replace(
                "{balance}",
                money(selected.balance),
              )}{" "}
              ·{" "}
              {selected.available === null
                ? t.houseaccounts.noLimit
                : t.houseaccounts.available.replace(
                    "{available}",
                    money(selected.available),
                  )}
            </Text>
          </View>
          <Pressable onPress={() => onSelect(null)} style={styles.checkBtn}>
            <Text style={styles.checkText}>✕</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder={t.houseaccounts.search}
            placeholderTextColor={colors.slate400}
            style={styles.input}
            testID="house-account-search"
          />
          <View style={styles.list}>
            {(accounts.data ?? []).length === 0 ? (
              <Text style={styles.meta}>{t.houseaccounts.none}</Text>
            ) : (
              (accounts.data ?? []).slice(0, 8).map((a) => (
                <Pressable
                  key={a.id}
                  onPress={() => onSelect(a)}
                  style={styles.item}
                  testID={`house-account-${a.id}`}
                >
                  <Text style={styles.name}>
                    {a.name}
                    {a.company ? ` · ${a.company}` : ""}
                  </Text>
                  <Text style={styles.meta}>
                    {t.houseaccounts.balance.replace(
                      "{balance}",
                      money(a.balance),
                    )}
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </>
      )}
      {selected?.require_signature ? (
        <TextInput
          value={signedBy}
          onChangeText={onSignedByChange}
          placeholder={t.houseaccounts.signedBy}
          placeholderTextColor={colors.slate400}
          style={styles.input}
          testID="house-account-signed-by"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: typography.sizes.lg,
    letterSpacing: 1,
    color: colors.foreground,
    backgroundColor: colors.surface,
  },
  checkBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: colors.slate900,
  },
  checkText: { color: colors.white, fontWeight: "700" },
  ok: { color: colors.successDark, fontSize: 13, fontWeight: "600" },
  error: { color: colors.danger, fontSize: 13 },
  selected: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successTint,
  },
  list: { gap: 4 },
  item: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.foreground,
  },
  meta: { fontSize: 13, color: colors.muted },
});
