import { useMemo, useState } from 'react';
import { X, ScanBarcode, PenLine, Loader2, CircleCheck, Utensils, History, Search, Package } from 'lucide-react-native';
import { Modal, ScrollView, Text, View } from 'react-native';
import { useAppStore } from '@/store/useAppStore';
import type { MealType } from '@fittrack/shared';
import {
  addDaysISO,
  colors,
  foodsFromDay,
  highProteinPicks,
  normalizeFoodText,
  recentFoods,
  scalePer100g,
  searchGenericFoods,
  searchRecentFoods,
  servingLabelFor,
  todayISO,
  type GenericFood,
  type RecentFood,
} from '@fittrack/shared';
import { lookupBarcode, searchProducts, SearchRateLimitedError, type FoodCandidate } from '@/lib/food-api';
import BarcodeScannerModal from './barcode-scanner-modal';
import TextField from './ui/text-field';
import PressableScale from '@/components/ui/pressable-scale';

type Mode = 'choose' | 'scan' | 'manual' | 'confirm' | 'savedMeals';

type RemoteSearch =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; results: FoodCandidate[] }
  | { status: 'error'; query: string; message: string };

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  dinner: 'dinner',
  snack: 'snacks',
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-sm font-medium mb-1.5" style={{ color: colors.textSecondary }}>
      {children}
    </Text>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: colors.textMuted }}>
      {children}
    </Text>
  );
}

function ChoiceRow({ icon: Icon, title, sub, onPress }: { icon: typeof ScanBarcode; title: string; sub: string; onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      className="flex-row items-center gap-3 p-4 rounded-xl border"
      style={{ borderColor: colors.gridline }}
    >
      <Icon color={colors.brandPrimary} size={22} />
      <View className="flex-1">
        <Text className="font-medium text-sm" style={{ color: colors.textPrimary }}>
          {title}
        </Text>
        <Text className="text-xs" style={{ color: colors.textMuted }}>
          {sub}
        </Text>
      </View>
    </PressableScale>
  );
}

/** A bordered list of tappable food rows — recents, staples and search hits all render alike. */
function FoodList<T>({
  items,
  keyOf,
  title,
  sub,
  trailing,
  onPress,
  haptic = 'selection',
}: {
  items: T[];
  keyOf: (item: T, index: number) => string;
  title: (item: T) => string;
  sub: (item: T) => string;
  trailing: (item: T) => string;
  onPress: (item: T) => void;
  haptic?: 'selection' | 'success';
}) {
  return (
    <View className="rounded-xl border overflow-hidden" style={{ borderColor: colors.gridline }}>
      {items.map((item, i) => (
        <PressableScale
          key={keyOf(item, i)}
          hapticStyle={haptic}
          accessibilityRole="button"
          accessibilityLabel={`${haptic === 'success' ? 'Log' : 'Choose'} ${title(item)}`}
          onPress={() => onPress(item)}
          className="flex-row items-center justify-between gap-3 px-4 py-3"
          style={i > 0 ? { borderTopWidth: 1, borderTopColor: colors.gridline } : undefined}
        >
          <View className="flex-1 min-w-0">
            <Text numberOfLines={1} className="text-sm font-medium" style={{ color: colors.textPrimary }}>
              {title(item)}
            </Text>
            <Text numberOfLines={1} className="text-xs" style={{ color: colors.textMuted }}>
              {sub(item)}
            </Text>
          </View>
          <Text className="text-sm shrink-0" style={{ color: colors.textSecondary }}>
            {trailing(item)}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

const recentKey = (food: RecentFood) => `${food.name}-${food.brand ?? ''}-${food.servingLabel ?? ''}`;

function stapleToCandidate(food: GenericFood): FoodCandidate {
  return { name: food.name, per100g: food.per100g, servings: food.servings, source: 'search' };
}

export default function AddFoodModal({
  meal,
  onClose,
  highlight,
}: {
  meal: MealType;
  onClose: () => void;
  /** Open on a focused list — the protein insight sends people here to act on it. */
  highlight?: 'protein';
}) {
  const addFoodEntry = useAppStore((s) => s.addFoodEntry);
  const foodEntries = useAppStore((s) => s.foodEntries);
  const savedMeals = useAppStore((s) => s.savedMeals);
  const logSavedMeal = useAppStore((s) => s.logSavedMeal);
  const [mode, setMode] = useState<Mode>('choose');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<FoodCandidate | null>(null);
  const [grams, setGrams] = useState('100');
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<RemoteSearch>({ status: 'idle' });

  // All walk the whole history, so they're memoized — this modal opens on every meal log. The
  // wider pool is what gets searched: something eaten forty foods ago should still be findable by
  // name even though it's long gone from the top-12 list.
  const recentPool = useMemo(() => recentFoods(foodEntries, meal, 300), [foodEntries, meal]);

  const yesterdays = useMemo(
    () => foodsFromDay(foodEntries, addDaysISO(todayISO(), -1), meal),
    [foodEntries, meal]
  );

  const proteinPicks = useMemo(
    () => (highlight === 'protein' ? highProteinPicks(recentPool) : null),
    [highlight, recentPool]
  );
  // A food already offered as a protein pick isn't listed a second time under Recent.
  const recents = useMemo(() => {
    const picked = new Set(proteinPicks?.mine.map(recentKey));
    return recentPool.filter((f) => !picked.has(recentKey(f))).slice(0, 12);
  }, [recentPool, proteinPicks]);

  const normalizedQuery = normalizeFoodText(query);
  const searching = normalizedQuery.length > 0;
  // Local matches update on every keystroke — both lists are on-device and small. Only the
  // packaged-food search goes over the network, and only when asked (see searchProducts).
  const myMatches = useMemo(() => (searching ? searchRecentFoods(recentPool, query) : []), [recentPool, query, searching]);
  const stapleMatches = useMemo(() => (searching ? searchGenericFoods(query) : []), [query, searching]);
  const remoteIsCurrent = remote.status !== 'idle' && remote.query === normalizedQuery;

  const [manual, setManual] = useState({
    name: '',
    calories: '0',
    proteinG: '0',
    carbsG: '0',
    fatG: '0',
    quantity: '1',
    servingLabel: 'serving',
  });

  /** Re-log a previously eaten food as a new entry today — never a copy of the old row. */
  function logRecent(food: RecentFood) {
    addFoodEntry({ ...food, date: todayISO(), meal });
  }

  function openConfirm(next: FoodCandidate) {
    setCandidate(next);
    // Start from the food's natural portion when it has one — "1 medium banana" is what someone
    // just ate, 100 g is a unit nobody eats in.
    setGrams(String(next.servings[0]?.grams ?? 100));
    setMode('confirm');
  }

  function openManual(name: string) {
    setManual((m) => ({ ...m, name }));
    setMode('manual');
  }

  async function runRemoteSearch() {
    if (!searching || remote.status === 'loading') return;
    const q = normalizedQuery;
    setRemote({ status: 'loading', query: q });
    try {
      const results = await searchProducts(query);
      setRemote({ status: 'done', query: q, results });
    } catch (e) {
      setRemote({
        status: 'error',
        query: q,
        message:
          e instanceof SearchRateLimitedError
            ? `That's a lot of searches in a row — the food database allows a few a minute. Try again in ${e.retryInSec}s.`
            : 'Could not reach the food database. Check your connection, or pick from the matches above.',
      });
    }
  }

  async function handleDetected(barcode: string) {
    setMode('choose');
    setLoading(true);
    setError(null);
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        setError(`No product found for barcode ${barcode}. Try searching by name or manual entry.`);
      } else {
        openConfirm(product);
      }
    } catch {
      setError('Could not reach the product database. Check your connection or use manual entry.');
    } finally {
      setLoading(false);
    }
  }

  const gramsValue = Number(grams) || 0;
  const preview = candidate ? scalePer100g(candidate.per100g, gramsValue) : null;

  function confirmCandidate() {
    if (!candidate || gramsValue <= 0) return;
    addFoodEntry({
      date: todayISO(),
      meal,
      name: candidate.name,
      brand: candidate.brand,
      quantity: 1,
      servingLabel: servingLabelFor(gramsValue, candidate.servings),
      ...scalePer100g(candidate.per100g, gramsValue),
      source: candidate.source,
      barcode: candidate.barcode,
    });
    onClose();
  }

  function submitManual() {
    if (!manual.name.trim()) return;
    addFoodEntry({
      date: todayISO(),
      meal,
      name: manual.name.trim(),
      quantity: Number(manual.quantity) || 1,
      servingLabel: manual.servingLabel,
      calories: Number(manual.calories) || 0,
      proteinG: Number(manual.proteinG) || 0,
      carbsG: Number(manual.carbsG) || 0,
      fatG: Number(manual.fatG) || 0,
      source: 'manual',
    });
    onClose();
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView className="flex-1 p-5" keyboardShouldPersistTaps="handled">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="font-semibold capitalize" style={{ color: colors.textPrimary }}>
              Add to {meal}
            </Text>
            <PressableScale accessibilityLabel="Close" accessibilityRole="button" onPress={onClose} className="p-1">
              <X size={18} color={colors.textPrimary} />
            </PressableScale>
          </View>

          {loading && (
            <View className="flex-row items-center justify-center gap-2 py-8">
              <Loader2 size={18} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary }}>Looking up product…</Text>
            </View>
          )}

          {!loading && mode === 'choose' && (
            <View className="gap-3">
              {/* Search sits above everything: typing a name is how people expect to find a
                  food, and until now it wasn't possible at all — every unpackaged food meant
                  typing four macro numbers by hand. */}
              <View>
                <TextField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search foods — e.g. banana, greek yogurt"
                  returnKeyType="search"
                  onSubmitEditing={runRemoteSearch}
                  autoCorrect={false}
                  accessibilityLabel="Search foods"
                  style={{ paddingLeft: 40 }}
                />
                <View pointerEvents="none" className="absolute left-3.5 top-0 bottom-0 justify-center">
                  <Search size={16} color={colors.textMuted} />
                </View>
              </View>

              {error && (
                <Text className="text-sm" style={{ color: colors.statusWarning }}>
                  {error}
                </Text>
              )}

              {searching ? (
                <>
                  {myMatches.length > 0 && (
                    <View>
                      <SectionLabel>Your foods</SectionLabel>
                      <FoodList
                        items={myMatches}
                        keyOf={recentKey}
                        title={(f) => f.name}
                        sub={(f) => `${f.brand ? `${f.brand} · ` : ''}${f.quantity} × ${f.servingLabel ?? 'serving'}`}
                        trailing={(f) => `${Math.round(f.calories * f.quantity)} kcal`}
                        haptic="success"
                        onPress={(f) => {
                          logRecent(f);
                          onClose();
                        }}
                      />
                    </View>
                  )}

                  {stapleMatches.length > 0 && (
                    <View>
                      <SectionLabel>Common foods</SectionLabel>
                      <FoodList
                        items={stapleMatches}
                        keyOf={(f) => f.id}
                        title={(f) => f.name}
                        sub={(f) => (f.servings[0] ? `${f.servings[0].label} · ${f.servings[0].grams} g` : 'per 100 g')}
                        trailing={(f) =>
                          `${f.servings[0] ? scalePer100g(f.per100g, f.servings[0].grams).calories : f.per100g.calories} kcal`
                        }
                        onPress={(f) => openConfirm(stapleToCandidate(f))}
                      />
                    </View>
                  )}

                  <View>
                    <SectionLabel>Packaged foods</SectionLabel>
                    {!remoteIsCurrent && (
                      <ChoiceRow
                        icon={Package}
                        title={`Search packaged foods for “${query.trim()}”`}
                        sub="Brands and products from Open Food Facts"
                        onPress={runRemoteSearch}
                      />
                    )}
                    {remoteIsCurrent && remote.status === 'loading' && (
                      <View className="flex-row items-center gap-2 py-4 px-1">
                        <Loader2 size={16} color={colors.textSecondary} />
                        <Text className="text-sm" style={{ color: colors.textSecondary }}>
                          Searching…
                        </Text>
                      </View>
                    )}
                    {remoteIsCurrent && remote.status === 'error' && (
                      <View className="py-2 gap-2">
                        <Text className="text-sm" style={{ color: colors.statusWarning }}>
                          {remote.message}
                        </Text>
                        <PressableScale hapticStyle="selection" accessibilityRole="button" onPress={runRemoteSearch} className="self-start">
                          <Text className="text-sm font-medium" style={{ color: colors.brandPrimary }}>
                            Try again
                          </Text>
                        </PressableScale>
                      </View>
                    )}
                    {remoteIsCurrent && remote.status === 'done' && remote.results.length === 0 && (
                      <Text className="text-sm py-2" style={{ color: colors.textMuted }}>
                        No packaged products with nutrition info matched “{query.trim()}”.
                      </Text>
                    )}
                    {remoteIsCurrent && remote.status === 'done' && remote.results.length > 0 && (
                      <FoodList
                        items={remote.results}
                        keyOf={(f, i) => f.barcode ?? `${f.name}-${i}`}
                        title={(f) => f.name}
                        sub={(f) => f.brand ?? 'per 100 g'}
                        trailing={(f) => `${f.per100g.calories} kcal/100g`}
                        onPress={openConfirm}
                      />
                    )}
                  </View>

                  <ChoiceRow
                    icon={PenLine}
                    title={`Enter “${query.trim()}” manually`}
                    sub="Not listed? Type in the details yourself"
                    onPress={() => openManual(query.trim())}
                  />
                </>
              ) : (
                <>
                  {proteinPicks && (proteinPicks.mine.length > 0 || proteinPicks.staples.length > 0) && (
                    <View className="gap-3">
                      <View>
                        <SectionLabel>High-protein picks</SectionLabel>
                        <Text className="text-xs -mt-1 mb-2" style={{ color: colors.textMuted }}>
                          Most protein for the calories — your own foods first.
                        </Text>
                        {proteinPicks.mine.length > 0 && (
                          <FoodList
                            items={proteinPicks.mine}
                            keyOf={recentKey}
                            title={(f) => f.name}
                            sub={(f) => `${Math.round(f.proteinG * f.quantity)} g protein · ${f.quantity} × ${f.servingLabel ?? 'serving'}`}
                            trailing={(f) => `${Math.round(f.calories * f.quantity)} kcal`}
                            haptic="success"
                            onPress={(f) => {
                              logRecent(f);
                              onClose();
                            }}
                          />
                        )}
                      </View>
                      {proteinPicks.staples.length > 0 && (
                        <FoodList
                          items={proteinPicks.staples}
                          keyOf={(f) => f.id}
                          title={(f) => f.name}
                          sub={(f) => {
                            const grams = f.servings[0]?.grams ?? 100;
                            const label = f.servings[0]?.label ?? '100 g';
                            return `${Math.round(scalePer100g(f.per100g, grams).proteinG)} g protein · ${label}`;
                          }}
                          trailing={(f) => `${scalePer100g(f.per100g, f.servings[0]?.grams ?? 100).calories} kcal`}
                          onPress={(f) => openConfirm(stapleToCandidate(f))}
                        />
                      )}
                    </View>
                  )}

                  {/* Repeat and recents come first, above scan and manual entry: for anyone past
                      their first week these are the paths that get used, and burying them under
                      "Scan Barcode" is what makes logging feel like data entry. */}
                  {yesterdays.length > 0 && (
                    <ChoiceRow
                      icon={History}
                      title={`Repeat yesterday's ${MEAL_LABELS[meal]}`}
                      sub={`${yesterdays.length} item${yesterdays.length === 1 ? '' : 's'} · ${Math.round(
                        yesterdays.reduce((s, f) => s + f.calories * f.quantity, 0)
                      )} kcal`}
                      onPress={() => {
                        for (const food of yesterdays) logRecent(food);
                        onClose();
                      }}
                    />
                  )}

                  {recents.length > 0 && (
                    <View>
                      <SectionLabel>Recent</SectionLabel>
                      <FoodList
                        items={recents}
                        keyOf={recentKey}
                        title={(f) => f.name}
                        sub={(f) => `${f.brand ? `${f.brand} · ` : ''}${f.quantity} × ${f.servingLabel ?? 'serving'}`}
                        trailing={(f) => `${Math.round(f.calories * f.quantity)} kcal`}
                        haptic="success"
                        onPress={(f) => {
                          logRecent(f);
                          onClose();
                        }}
                      />
                    </View>
                  )}

                  <ChoiceRow
                    icon={ScanBarcode}
                    title="Scan Barcode / QR"
                    sub="Auto-fill nutrition from packaging"
                    onPress={() => setMode('scan')}
                  />
                  <ChoiceRow icon={PenLine} title="Manual Entry" sub="Type in the details yourself" onPress={() => setMode('manual')} />
                  {savedMeals.length > 0 && (
                    <ChoiceRow
                      icon={Utensils}
                      title="From Saved Meals"
                      sub="Quick-add a meal you've saved before"
                      onPress={() => setMode('savedMeals')}
                    />
                  )}
                </>
              )}
            </View>
          )}

          {mode === 'savedMeals' && (
            <View className="gap-2">
              {savedMeals.map((m) => {
                const totalCals = m.items.reduce((s, i) => s + i.calories * i.quantity, 0);
                return (
                  <PressableScale
                    key={m.id}
                    onPress={() => {
                      logSavedMeal(m.id, meal);
                      onClose();
                    }}
                    className="flex-row items-center justify-between p-3 rounded-xl border"
                    style={{ borderColor: colors.gridline }}
                  >
                    <View>
                      <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                        {m.name}
                      </Text>
                      <Text className="text-xs" style={{ color: colors.textMuted }}>
                        {m.items.length} items
                      </Text>
                    </View>
                    <Text className="text-xs font-medium" style={{ color: colors.textMuted }}>
                      {Math.round(totalCals)} kcal
                    </Text>
                  </PressableScale>
                );
              })}
              <PressableScale hapticStyle="selection"
                onPress={() => setMode('choose')}
                className="py-2.5 rounded-lg border items-center"
                style={{ borderColor: colors.gridline }}
              >
                <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                  Back
                </Text>
              </PressableScale>
            </View>
          )}

          {mode === 'scan' && <BarcodeScannerModal onDetected={handleDetected} onClose={() => setMode('choose')} />}

          {mode === 'confirm' && candidate && preview && (
            <View className="gap-4">
              <View className="flex-row items-start gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(34,211,238,0.1)' }}>
                <CircleCheck size={18} color={colors.brandPrimary} style={{ marginTop: 2 }} />
                <View className="flex-1">
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    {candidate.name}
                  </Text>
                  {candidate.brand && (
                    <Text className="text-xs" style={{ color: colors.textMuted }}>
                      {candidate.brand}
                    </Text>
                  )}
                </View>
              </View>

              {candidate.per100g.calories === 0 && candidate.source === 'barcode' && (
                <PressableScale onPress={() => openManual(candidate.name)}>
                  <Text className="text-sm" style={{ color: colors.statusWarning }}>
                    This product has no nutrition info on file.{' '}
                    <Text style={{ textDecorationLine: 'underline' }}>Enter it manually</Text>
                  </Text>
                </PressableScale>
              )}

              {/* Portion chips: one tap for the amount people actually eat, so the grams field
                  is for the exceptions rather than every single log. */}
              <View className="flex-row flex-wrap gap-2">
                {[...candidate.servings, { label: '100 g', grams: 100 }].map((s) => {
                  const selected = Math.abs(gramsValue - s.grams) < 0.05;
                  return (
                    <PressableScale
                      key={`${s.label}-${s.grams}`}
                      hapticStyle="selection"
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setGrams(String(s.grams))}
                      className="px-3 py-1.5 rounded-full border"
                      style={{
                        borderColor: selected ? colors.brandPrimary : colors.gridline,
                        backgroundColor: selected ? 'rgba(34,211,238,0.12)' : 'transparent',
                      }}
                    >
                      <Text className="text-xs font-medium" style={{ color: selected ? colors.brandPrimary : colors.textSecondary }}>
                        {s.label === '100 g' ? s.label : `${s.label} · ${s.grams} g`}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>

              <View>
                <FieldLabel>Amount (grams)</FieldLabel>
                <TextField keyboardType="numeric" value={grams} onChangeText={setGrams} />
              </View>
              <View className="flex-row gap-2">
                {[
                  { label: 'kcal', value: preview.calories },
                  { label: 'protein', value: `${Math.round(preview.proteinG)}g` },
                  { label: 'carbs', value: `${Math.round(preview.carbsG)}g` },
                  { label: 'fat', value: `${Math.round(preview.fatG)}g` },
                ].map((s) => (
                  <View key={s.label} className="flex-1 rounded-lg py-2 items-center" style={{ backgroundColor: colors.chartSurface }}>
                    <Text className="font-semibold" style={{ color: colors.textPrimary }}>
                      {s.value}
                    </Text>
                    <Text className="text-[10px] uppercase" style={{ color: colors.textMuted }}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
              <View className="flex-row gap-2">
                <PressableScale hapticStyle="selection"
                  onPress={() => setMode('choose')}
                  className="flex-1 py-2.5 rounded-lg border items-center"
                  style={{ borderColor: colors.gridline }}
                >
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    Back
                  </Text>
                </PressableScale>
                <PressableScale
                  hapticStyle="success"
                  onPress={confirmCandidate}
                  disabled={gramsValue <= 0}
                  className="flex-1 py-2.5 rounded-full items-center"
                  style={{ backgroundColor: colors.brandPrimaryDark, opacity: gramsValue <= 0 ? 0.5 : 1 }}
                >
                  <Text className="text-white text-sm font-semibold">Add to log</Text>
                </PressableScale>
              </View>
            </View>
          )}

          {mode === 'manual' && (
            <View className="gap-3">
              <View>
                <FieldLabel>Food name</FieldLabel>
                <TextField
                  value={manual.name}
                  onChangeText={(name) => setManual((m) => ({ ...m, name }))}
                  placeholder="Grilled chicken breast"
                  autoFocus
                />
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FieldLabel>Calories</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.calories} onChangeText={(v) => setManual((m) => ({ ...m, calories: v }))} />
                </View>
                <View className="flex-1">
                  <FieldLabel>Servings</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.quantity} onChangeText={(v) => setManual((m) => ({ ...m, quantity: v }))} />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FieldLabel>Protein (g)</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.proteinG} onChangeText={(v) => setManual((m) => ({ ...m, proteinG: v }))} />
                </View>
                <View className="flex-1">
                  <FieldLabel>Carbs (g)</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.carbsG} onChangeText={(v) => setManual((m) => ({ ...m, carbsG: v }))} />
                </View>
              </View>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <FieldLabel>Fat (g)</FieldLabel>
                  <TextField keyboardType="numeric" value={manual.fatG} onChangeText={(v) => setManual((m) => ({ ...m, fatG: v }))} />
                </View>
                <View className="flex-1">
                  <FieldLabel>Serving label</FieldLabel>
                  <TextField value={manual.servingLabel} onChangeText={(v) => setManual((m) => ({ ...m, servingLabel: v }))} placeholder="1 cup" />
                </View>
              </View>
              <View className="flex-row gap-2 pt-1">
                <PressableScale hapticStyle="selection"
                  onPress={() => setMode('choose')}
                  className="flex-1 py-2.5 rounded-lg border items-center"
                  style={{ borderColor: colors.gridline }}
                >
                  <Text className="text-sm font-medium" style={{ color: colors.textPrimary }}>
                    Back
                  </Text>
                </PressableScale>
                <PressableScale hapticStyle="success" onPress={submitManual} className="flex-1 py-2.5 rounded-full items-center" style={{ backgroundColor: colors.brandPrimaryDark }}>
                  <Text className="text-white text-sm font-semibold">Add to log</Text>
                </PressableScale>
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}
