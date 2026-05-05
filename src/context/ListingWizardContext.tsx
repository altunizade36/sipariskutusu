import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCategoryById, getCategoryTree, type CategoryTreeNode } from '../catalog';
import { getDistrictNamesByProvinceName } from '../address/trAddress';

export type ListingDraft = {
  rootId: string;
  branchId: string;
  leafId: string;
  condition: string;
  title: string;
  description: string;
  price: string;
  hashtags: string;
  city: string;
  district: string;
  delivery: string[];
  photos: string[];
  videoUri: string;
  bargaining: boolean;
  stock: string;
  attributeValues: Record<string, string>;
};

type ListingWizardContextValue = {
  draft: ListingDraft;
  currentStep: number;
  draftSavedAt: string | null;
  hasDraft: boolean;
  completionPercent: number;
  isHydrated: boolean;
  rootCategories: CategoryTreeNode[];
  branchOptions: CategoryTreeNode[];
  leafOptions: CategoryTreeNode[];
  selectedCategoryName: string;
  setCurrentStep: (step: number) => void;
  selectRoot: (rootId: string) => void;
  selectBranch: (branchId: string) => void;
  selectLeaf: (leafId: string) => void;
  setDraftField: <K extends keyof ListingDraft>(field: K, value: ListingDraft[K]) => void;
  setAttributeValue: (code: string, value: string) => void;
  addPhoto: (uri: string) => void;
  removePhoto: (uri: string) => void;
  toggleDelivery: (deliveryType: string) => void;
  applyQuickListingPreset: () => void;
  saveDraft: () => void;
  resetDraft: () => void;
};

const ListingWizardContext = createContext<ListingWizardContextValue | null>(null);
const LISTING_WIZARD_STORAGE_KEY = 'listing-wizard-draft-v1';
const MAX_LISTING_MEDIA_COUNT = 8;

const rootCategories = getCategoryTree();

function findFirstLeaf(node: CategoryTreeNode): CategoryTreeNode {
  if (node.children.length === 0) return node;
  return findFirstLeaf(node.children[0]);
}

function getInitialSelection() {
  const root = rootCategories[0];
  const branch = root.children[0] ?? root;
  const leaf = findFirstLeaf(branch);

  return {
    rootId: root.id,
    branchId: branch.id,
    leafId: leaf.id,
  };
}

function getSafeCategorySelection(draft: ListingDraft) {
  const safeRoot = rootCategories.find((item) => item.id === draft.rootId) ?? rootCategories[0];
  const safeBranches = safeRoot?.children ?? [];
  const safeBranch = safeBranches.find((item) => item.id === draft.branchId) ?? safeBranches[0] ?? safeRoot;
  const safeLeaves = safeBranch?.children?.length ? safeBranch.children : safeBranch ? [safeBranch] : [];
  const safeLeaf = safeLeaves.find((item) => item.id === draft.leafId) ?? safeLeaves[0] ?? findFirstLeaf(safeBranch);

  return {
    rootId: safeRoot.id,
    branchId: safeBranch.id,
    leafId: safeLeaf.id,
  };
}

function createInitialDraft(): ListingDraft {
  const initial = getInitialSelection();
  const defaultCity = 'İstanbul';

  return {
    rootId: initial.rootId,
    branchId: initial.branchId,
    leafId: initial.leafId,
    condition: 'Yeni gibi',
    title: '',
    description: '',
    price: '',
    hashtags: '',
    city: defaultCity,
    district: getDistrictNamesByProvinceName(defaultCity)[0] ?? 'Merkez',
    delivery: ['Kargo'],
    photos: [],
    videoUri: '',
    bargaining: false,
    stock: '1',
    attributeValues: {},
  };
}

export function ListingWizardProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<ListingDraft>(() => createInitialDraft());
  const [currentStep, setCurrentStep] = useState(1);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let alive = true;

    async function hydrate() {
      try {
        const serialized = await AsyncStorage.getItem(LISTING_WIZARD_STORAGE_KEY);

        if (!serialized) {
          return;
        }

        const parsed = JSON.parse(serialized) as {
          draft?: Partial<ListingDraft>;
          currentStep?: number;
          draftSavedAt?: string | null;
        };

        if (!alive) {
          return;
        }

        if (parsed.draft) {
          setDraft((current) => ({
            ...current,
            ...parsed.draft,
            delivery: Array.isArray(parsed.draft.delivery) ? parsed.draft.delivery : current.delivery,
            photos: Array.isArray(parsed.draft.photos) ? parsed.draft.photos.slice(0, MAX_LISTING_MEDIA_COUNT) : current.photos,
            attributeValues: parsed.draft.attributeValues ?? current.attributeValues,
            hashtags: typeof parsed.draft.hashtags === 'string' ? parsed.draft.hashtags : current.hashtags,
            videoUri: typeof parsed.draft.videoUri === 'string' ? parsed.draft.videoUri : current.videoUri,
          }));
        }

        if (typeof parsed.currentStep === 'number' && Number.isFinite(parsed.currentStep)) {
          setCurrentStep(Math.min(Math.max(Math.trunc(parsed.currentStep), 1), 10));
        }

        if (typeof parsed.draftSavedAt === 'string') {
          setDraftSavedAt(parsed.draftSavedAt);
        }
      } catch {
        // Ignore hydration errors and continue with defaults.
      } finally {
        if (alive) {
          setIsHydrated(true);
        }
      }
    }

    hydrate();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const payload = JSON.stringify({
      draft,
      currentStep,
      draftSavedAt,
    });

    AsyncStorage.setItem(LISTING_WIZARD_STORAGE_KEY, payload).catch(() => {
      // Ignore persistence errors to avoid blocking UX.
    });
  }, [draft, currentStep, draftSavedAt, isHydrated]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const safe = getSafeCategorySelection(draft);

    if (safe.rootId === draft.rootId && safe.branchId === draft.branchId && safe.leafId === draft.leafId) {
      return;
    }

    setDraft((current) => ({
      ...current,
      rootId: safe.rootId,
      branchId: safe.branchId,
      leafId: safe.leafId,
      attributeValues: {},
    }));
  }, [draft, isHydrated]);

  const selectedRoot = rootCategories.find((item) => item.id === draft.rootId) ?? rootCategories[0];
  const branchOptions = selectedRoot?.children ?? [];
  const selectedBranch = branchOptions.find((item) => item.id === draft.branchId) ?? branchOptions[0] ?? selectedRoot;
  const leafOptions = selectedBranch?.children?.length ? selectedBranch.children : selectedBranch ? [selectedBranch] : [];

  function selectRoot(rootId: string) {
    const rootNode = rootCategories.find((item) => item.id === rootId);
    if (!rootNode) return;

    const nextBranch = rootNode.children[0] ?? rootNode;
    const nextLeaf = findFirstLeaf(nextBranch);

    setDraft((current) => ({
      ...current,
      rootId: rootNode.id,
      branchId: nextBranch.id,
      leafId: nextLeaf.id,
      attributeValues: {},
    }));
  }

  function selectBranch(branchId: string) {
    const branchNode = branchOptions.find((item) => item.id === branchId);
    if (!branchNode) return;

    const nextLeaf = findFirstLeaf(branchNode);

    setDraft((current) => ({
      ...current,
      branchId: branchNode.id,
      leafId: nextLeaf.id,
      attributeValues: {},
    }));
  }

  function selectLeaf(leafId: string) {
    setDraft((current) => ({ ...current, leafId, attributeValues: {} }));
  }

  function setDraftField<K extends keyof ListingDraft>(field: K, value: ListingDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setAttributeValue(code: string, value: string) {
    setDraft((current) => ({
      ...current,
      attributeValues: {
        ...current.attributeValues,
        [code]: value,
      },
    }));
  }

  function addPhoto(uri: string) {
    setDraft((current) => ({
      ...current,
      photos: current.photos.includes(uri) ? current.photos : [...current.photos, uri].slice(0, MAX_LISTING_MEDIA_COUNT),
    }));
  }

  function removePhoto(uri: string) {
    setDraft((current) => ({
      ...current,
      photos: current.photos.filter((item) => item !== uri),
    }));
  }

  function toggleDelivery(deliveryType: string) {
    setDraft((current) => {
      const exists = current.delivery.includes(deliveryType);
      const delivery = exists ? current.delivery.filter((item) => item !== deliveryType) : [...current.delivery, deliveryType];
      return { ...current, delivery };
    });
  }

  function applyQuickListingPreset() {
    const categoryName = getCategoryById(draft.leafId)?.name ?? 'Ürün';
    const nextCity = draft.city.trim() || 'İstanbul';
    const nextDistrict = draft.district.trim() || getDistrictNamesByProvinceName(nextCity)[0] || 'Merkez';

    setDraft((current) => ({
      ...current,
      title: current.title.trim() || `${categoryName} hızlı ilan`,
      description: current.description.trim() || `${categoryName} için hızlı oluşturulmuş ilan. Detaylar mesajda paylaşılacaktır.`,
      hashtags: current.hashtags.trim() || `#${categoryName.toLocaleLowerCase('tr-TR').replace(/\s+/g, '')} #hizliilan`,
      city: nextCity,
      district: nextDistrict,
      delivery: current.delivery.length > 0 ? current.delivery : ['Kargo'],
      stock: current.stock.trim() || '1',
    }));
  }

  function saveDraft() {
    setDraftSavedAt(new Date().toISOString());
  }

  function resetDraft() {
    setDraft(createInitialDraft());
    setCurrentStep(1);
    setDraftSavedAt(null);
    AsyncStorage.removeItem(LISTING_WIZARD_STORAGE_KEY).catch(() => {
      // no-op
    });
  }

  const selectedCategoryName = getCategoryById(draft.leafId)?.name ?? 'Kategori';
  const hasDraft = Boolean(
    draft.title.trim() ||
    draft.description.trim() ||
    draft.price.trim() ||
    draft.hashtags.trim() ||
    draft.photos.length > 0 ||
    draft.videoUri.trim() ||
    Object.keys(draft.attributeValues).length > 0,
  );
  const completionPercent = useMemo(() => {
    const parsedPrice = Number(draft.price.replace(',', '.'));
    const checkpoints = [
      Boolean(draft.rootId),
      Boolean(draft.branchId),
      Boolean(draft.leafId),
      draft.title.trim().length >= 6,
      draft.description.trim().length >= 20,
      !draft.price.trim() || (Number.isFinite(parsedPrice) && parsedPrice > 0),
      Boolean(draft.city.trim()),
      Boolean(draft.district.trim()),
      draft.delivery.length > 0,
      draft.photos.length > 0 || Boolean(draft.videoUri.trim()),
    ];

    return Math.round((checkpoints.filter(Boolean).length / checkpoints.length) * 100);
  }, [draft]);

  const value = useMemo<ListingWizardContextValue>(
    () => ({
      draft,
      currentStep,
      draftSavedAt,
      hasDraft,
      completionPercent,
      isHydrated,
      rootCategories,
      branchOptions,
      leafOptions,
      selectedCategoryName,
      setCurrentStep,
      selectRoot,
      selectBranch,
      selectLeaf,
      setDraftField,
      setAttributeValue,
      addPhoto,
      removePhoto,
      toggleDelivery,
      applyQuickListingPreset,
      saveDraft,
      resetDraft,
    }),
    [draft, currentStep, draftSavedAt, hasDraft, completionPercent, isHydrated, branchOptions, leafOptions, selectedCategoryName],
  );

  return <ListingWizardContext.Provider value={value}>{children}</ListingWizardContext.Provider>;
}

export function useListingWizard() {
  const context = useContext(ListingWizardContext);
  if (!context) throw new Error('useListingWizard must be used inside ListingWizardProvider');
  return context;
}
