import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts } from '../constants/theme';
import {
  MARKETPLACE_CATEGORIES,
  OTHER_SUBCATEGORY_ID,
  type MarketplaceCategory,
} from '../constants/marketplaceCategories';

type CategoryPickerProps = {
  selectedCategoryId: string;
  selectedSubCategoryId: string;
  customSubCategory: string;
  onChangeCategory: (categoryId: string) => void;
  onChangeSubCategory: (subCategoryId: string) => void;
  onChangeCustomSubCategory: (value: string) => void;
};

function findCategory(categoryId: string): MarketplaceCategory {
  return MARKETPLACE_CATEGORIES.find((item) => item.id === categoryId) ?? MARKETPLACE_CATEGORIES[0];
}

export function CategoryPicker({
  selectedCategoryId,
  selectedSubCategoryId,
  customSubCategory,
  onChangeCategory,
  onChangeSubCategory,
  onChangeCustomSubCategory,
}: CategoryPickerProps) {
  const [subCategorySearch, setSubCategorySearch] = useState('');
  const selectedCategory = findCategory(selectedCategoryId);

  useEffect(() => {
    setSubCategorySearch('');
  }, [selectedCategoryId]);

  const visibleSubcategories = useMemo(() => {
    const query = subCategorySearch.trim().toLocaleLowerCase('tr-TR');
    if (!query) {
      return selectedCategory.subcategories;
    }

    return selectedCategory.subcategories.filter((item) =>
      item.name.toLocaleLowerCase('tr-TR').includes(query),
    );
  }, [selectedCategory.subcategories, subCategorySearch]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ana Kategori</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {MARKETPLACE_CATEGORIES.map((category) => {
          const active = category.id === selectedCategory.id;
          return (
            <Pressable
              key={category.id}
              onPress={() => onChangeCategory(category.id)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {category.icon} {category.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.label, { marginTop: 12 }]}>Alt Kategori</Text>
      <TextInput
        value={subCategorySearch}
        onChangeText={setSubCategorySearch}
        placeholder="Alt kategoride ara"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
      />
      <View style={styles.wrapRow}>
        {visibleSubcategories.map((subcategory) => {
          const active = subcategory.id === selectedSubCategoryId;
          return (
            <Pressable
              key={`${selectedCategory.id}-${subcategory.id}`}
              onPress={() => onChangeSubCategory(subcategory.id)}
              style={[styles.pill, active && styles.pillActive]}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {subcategory.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visibleSubcategories.length === 0 ? (
        <Text style={styles.emptyText}>Aramana uygun alt kategori bulunamadi.</Text>
      ) : null}

      {selectedSubCategoryId === OTHER_SUBCATEGORY_ID ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.label}>Özel Alt Kategori</Text>
          <TextInput
            value={customSubCategory}
            onChangeText={onChangeCustomSubCategory}
            placeholder="Örn: Ahşap tasarım ürünleri"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  row: {
    gap: 8,
    paddingRight: 4,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  pillActive: {
    backgroundColor: '#EFF6FF',
    borderColor: colors.primary,
  },
  pillText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textPrimary,
  },
  pillTextActive: {
    color: colors.primary,
    fontFamily: fonts.bold,
  },
  input: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textPrimary,
  },
  emptyText: {
    marginTop: 8,
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textMuted,
  },
});
