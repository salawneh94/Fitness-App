import { useEffect, useState } from 'react';
import Slider from '@react-native-community/slider';
import { Image } from 'expo-image';
import { LayoutChangeEvent, Text, View } from 'react-native';
import { colors } from '@fittrack/shared';
import { getPhotoUri } from '@/lib/photo-store';
import Card from './ui/card';

interface PhotoMeta {
  id: string;
  date: string;
}

export default function PhotoCompareSlider({ photos }: { photos: PhotoMeta[] }) {
  const sorted = [...photos].sort((a, b) => a.date.localeCompare(b.date));
  const [beforeId, setBeforeId] = useState(sorted[0]?.id ?? '');
  const [afterId, setAfterId] = useState(sorted[sorted.length - 1]?.id ?? '');
  const [sliderPct, setSliderPct] = useState(50);
  const [boxWidth, setBoxWidth] = useState(0);

  function onBoxLayout(e: LayoutChangeEvent) {
    setBoxWidth(e.nativeEvent.layout.width);
  }

  useEffect(() => {
    if (sorted.length === 0) return;
    if (!beforeId) setBeforeId(sorted[0].id);
    if (!afterId) setAfterId(sorted[sorted.length - 1].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  if (sorted.length < 2) {
    return (
      <Card title="Compare Progress Photos">
        <Text className="text-sm" style={{ color: colors.textMuted }}>
          Add at least two progress photos to compare them side by side.
        </Text>
      </Card>
    );
  }

  const beforeUri = getPhotoUri(beforeId);
  const afterUri = getPhotoUri(afterId);
  const beforeDate = sorted.find((p) => p.id === beforeId)?.date;
  const afterDate = sorted.find((p) => p.id === afterId)?.date;

  return (
    <Card title="Compare Progress Photos">
      <View className="flex-row gap-3 mb-4">
        <PhotoPicker label="Before" photos={sorted} selectedId={beforeId} onSelect={setBeforeId} />
        <PhotoPicker label="After" photos={sorted} selectedId={afterId} onSelect={setAfterId} />
      </View>

      {beforeUri && afterUri ? (
        <View>
          <View
            onLayout={onBoxLayout}
            className="relative overflow-hidden rounded-2xl self-center"
            style={{ width: '100%', maxWidth: 320, aspectRatio: 3 / 4, backgroundColor: colors.chartSurface }}
          >
            <Image source={{ uri: beforeUri }} style={{ position: 'absolute', inset: 0 }} contentFit="cover" />
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: `${100 - sliderPct}%`, overflow: 'hidden' }}>
              {boxWidth > 0 && (
                <Image
                  source={{ uri: afterUri }}
                  style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: boxWidth, height: '100%' }}
                  contentFit="cover"
                />
              )}
            </View>
            <View style={{ position: 'absolute', top: 0, bottom: 0, left: `${sliderPct}%`, width: 2, backgroundColor: 'white' }} />
            <View
              className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              <Text className="text-[10px] text-white">
                {beforeDate && new Date(beforeDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            <View
              className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            >
              <Text className="text-[10px] text-white">
                {afterDate && new Date(afterDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
          </View>
          <Slider
            style={{ marginTop: 12 }}
            minimumValue={0}
            maximumValue={100}
            value={sliderPct}
            onValueChange={setSliderPct}
            minimumTrackTintColor={colors.brandPrimary}
            maximumTrackTintColor={colors.gridline}
            thumbTintColor={colors.brandPrimary}
          />
        </View>
      ) : (
        <View className="items-center justify-center" style={{ height: 192 }}>
          <Text className="text-sm" style={{ color: colors.textMuted }}>
            Loading photos…
          </Text>
        </View>
      )}
    </Card>
  );
}

function PhotoPicker({
  label,
  photos,
  selectedId,
  onSelect,
}: {
  label: string;
  photos: PhotoMeta[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View className="flex-1">
      <Text className="text-xs font-medium mb-1" style={{ color: colors.textMuted }}>
        {label}
      </Text>
      <View className="rounded-lg border px-3 py-2" style={{ borderColor: colors.gridline }}>
        <View className="flex-row flex-wrap gap-1.5">
          {photos.map((p) => {
            const isSelected = p.id === selectedId;
            const dateLabel = new Date(p.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            return (
              <Text
                key={p.id}
                onPress={() => onSelect(p.id)}
                className="text-xs"
                style={{
                  color: isSelected ? colors.brandPrimary : colors.textSecondary,
                  fontWeight: isSelected ? '700' : '400',
                }}
              >
                {dateLabel}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}
