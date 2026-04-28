export type CategoryTreeNode = {
  id: string;
  slug: string;
  name: string;
  children: CategoryTreeNode[];
};

type CategoryAttributeOption = {
  id: string;
  label: string;
};

type CategoryAttribute = {
  id: string;
  code: string;
  name: string;
  isRequired: boolean;
};

export type CategoryAttributeDefinition = {
  attribute: CategoryAttribute;
  mapping: { isRequired: boolean };
  options: CategoryAttributeOption[];
};

const CATEGORY_TREE: CategoryTreeNode[] = [
  {
    id: 'kadin',
    slug: 'kadin',
    name: 'Kadin',
    children: [
      {
        id: 'kadin-giyim',
        slug: 'kadin-giyim',
        name: 'Giyim',
        children: [
          { id: 'kadin-elbise', slug: 'kadin-elbise', name: 'Elbise', children: [] },
          { id: 'kadin-tshirt', slug: 'kadin-tshirt', name: 'Tisort', children: [] },
        ],
      },
      {
        id: 'kadin-aksesuar',
        slug: 'kadin-aksesuar',
        name: 'Aksesuar',
        children: [
          { id: 'kadin-canta', slug: 'kadin-canta', name: 'Canta', children: [] },
        ],
      },
    ],
  },
  {
    id: 'erkek',
    slug: 'erkek',
    name: 'Erkek',
    children: [
      {
        id: 'erkek-giyim',
        slug: 'erkek-giyim',
        name: 'Giyim',
        children: [
          { id: 'erkek-gomlek', slug: 'erkek-gomlek', name: 'Gomlek', children: [] },
          { id: 'erkek-pantolon', slug: 'erkek-pantolon', name: 'Pantolon', children: [] },
        ],
      },
    ],
  },
  {
    id: 'anne-cocuk',
    slug: 'anne-cocuk',
    name: 'Anne ve Cocuk',
    children: [
      {
        id: 'cocuk-giyim',
        slug: 'cocuk-giyim',
        name: 'Cocuk Giyim',
        children: [
          { id: 'bebek-body', slug: 'bebek-body', name: 'Bebek Body', children: [] },
        ],
      },
    ],
  },
  {
    id: 'ev-yasam',
    slug: 'ev-yasam',
    name: 'Ev ve Yasam',
    children: [
      {
        id: 'ev-tekstil',
        slug: 'ev-tekstil',
        name: 'Ev Tekstil',
        children: [
          { id: 'nevresim', slug: 'nevresim', name: 'Nevresim', children: [] },
        ],
      },
    ],
  },
  {
    id: 'supermarket',
    slug: 'supermarket',
    name: 'Market',
    children: [
      {
        id: 'paketli-gida',
        slug: 'paketli-gida',
        name: 'Paketli Gida',
        children: [
          { id: 'atistirmalik', slug: 'atistirmalik', name: 'Atistirmalik', children: [] },
        ],
      },
    ],
  },
  {
    id: 'kozmetik',
    slug: 'kozmetik',
    name: 'Kozmetik',
    children: [
      {
        id: 'cilt-bakim',
        slug: 'cilt-bakim',
        name: 'Cilt Bakim',
        children: [
          { id: 'nemlendirici', slug: 'nemlendirici', name: 'Nemlendirici', children: [] },
        ],
      },
    ],
  },
  {
    id: 'ayakkabi-canta',
    slug: 'ayakkabi-canta',
    name: 'Ayakkabi ve Canta',
    children: [
      {
        id: 'spor-ayakkabi',
        slug: 'spor-ayakkabi',
        name: 'Spor Ayakkabi',
        children: [
          { id: 'kosu-ayakkabisi', slug: 'kosu-ayakkabisi', name: 'Kosu Ayakkabisi', children: [] },
        ],
      },
    ],
  },
  {
    id: 'elektronik',
    slug: 'elektronik',
    name: 'Elektronik',
    children: [
      {
        id: 'telefon-tablet',
        slug: 'telefon-tablet',
        name: 'Telefon ve Tablet',
        children: [
          { id: 'akilli-telefon', slug: 'akilli-telefon', name: 'Akilli Telefon', children: [] },
          { id: 'tablet', slug: 'tablet', name: 'Tablet', children: [] },
        ],
      },
      {
        id: 'bilgisayar',
        slug: 'bilgisayar',
        name: 'Bilgisayar',
        children: [
          { id: 'dizustu', slug: 'dizustu', name: 'Dizustu', children: [] },
        ],
      },
    ],
  },
  {
    id: 'saat-aksesuar',
    slug: 'saat-aksesuar',
    name: 'Saat ve Aksesuar',
    children: [
      {
        id: 'kol-saati',
        slug: 'kol-saati',
        name: 'Kol Saati',
        children: [
          { id: 'akilli-saat', slug: 'akilli-saat', name: 'Akilli Saat', children: [] },
        ],
      },
    ],
  },
  {
    id: 'spor-outdoor',
    slug: 'spor-outdoor',
    name: 'Spor ve Outdoor',
    children: [
      {
        id: 'fitness',
        slug: 'fitness',
        name: 'Fitness',
        children: [
          { id: 'dambel', slug: 'dambel', name: 'Dambel', children: [] },
        ],
      },
    ],
  },
  {
    id: 'otomotiv',
    slug: 'otomotiv',
    name: 'Otomotiv',
    children: [
      {
        id: 'oto-aksesuar',
        slug: 'oto-aksesuar',
        name: 'Oto Aksesuar',
        children: [
          { id: 'arac-ici', slug: 'arac-ici', name: 'Arac Ici', children: [] },
        ],
      },
    ],
  },
  {
    id: 'kitap-hobi-kirtasiye',
    slug: 'kitap-hobi-kirtasiye',
    name: 'Kitap Hobi Kirtasiye',
    children: [
      {
        id: 'kitap',
        slug: 'kitap',
        name: 'Kitap',
        children: [
          { id: 'roman', slug: 'roman', name: 'Roman', children: [] },
        ],
      },
    ],
  },
  {
    id: 'pet-shop',
    slug: 'pet-shop',
    name: 'Pet Shop',
    children: [
      {
        id: 'kedi-kopek',
        slug: 'kedi-kopek',
        name: 'Kedi ve Kopek',
        children: [
          { id: 'mama', slug: 'mama', name: 'Mama', children: [] },
        ],
      },
    ],
  },
  {
    id: 'yapi-market-bahce',
    slug: 'yapi-market-bahce',
    name: 'Yapi Market Bahce',
    children: [
      {
        id: 'el-aletleri',
        slug: 'el-aletleri',
        name: 'El Aletleri',
        children: [
          { id: 'matkap', slug: 'matkap', name: 'Matkap', children: [] },
        ],
      },
    ],
  },
  {
    id: 'ofis-is',
    slug: 'ofis-is',
    name: 'Ofis ve Is',
    children: [
      {
        id: 'ofis-ekipman',
        slug: 'ofis-ekipman',
        name: 'Ofis Ekipman',
        children: [
          { id: 'yazici', slug: 'yazici', name: 'Yazici', children: [] },
        ],
      },
    ],
  },
];

const CATEGORY_PATHS = new Map<string, CategoryTreeNode[]>();

function indexTree(nodes: CategoryTreeNode[], path: CategoryTreeNode[] = []) {
  nodes.forEach((node) => {
    const nextPath = [...path, node];
    CATEGORY_PATHS.set(node.id, nextPath);
    indexTree(node.children, nextPath);
  });
}

indexTree(CATEGORY_TREE);

const DEFAULT_ATTRIBUTES: CategoryAttributeDefinition[] = [
  {
    attribute: { id: 'brand', code: 'brand', name: 'Marka', isRequired: true },
    mapping: { isRequired: true },
    options: [],
  },
  {
    attribute: { id: 'model', code: 'model', name: 'Model', isRequired: false },
    mapping: { isRequired: false },
    options: [],
  },
  {
    attribute: { id: 'color', code: 'color', name: 'Renk', isRequired: false },
    mapping: { isRequired: false },
    options: [
      { id: 'siyah', label: 'Siyah' },
      { id: 'beyaz', label: 'Beyaz' },
      { id: 'mavi', label: 'Mavi' },
      { id: 'kirmizi', label: 'Kirmizi' },
      { id: 'yesil', label: 'Yesil' },
    ],
  },
  {
    attribute: { id: 'size', code: 'size', name: 'Beden', isRequired: false },
    mapping: { isRequired: false },
    options: [
      { id: 'xs', label: 'XS' },
      { id: 's', label: 'S' },
      { id: 'm', label: 'M' },
      { id: 'l', label: 'L' },
      { id: 'xl', label: 'XL' },
    ],
  },
  {
    attribute: { id: 'warranty', code: 'warranty', name: 'Garanti', isRequired: false },
    mapping: { isRequired: false },
    options: [
      { id: 'yok', label: 'Yok' },
      { id: '3-ay', label: '3 Ay' },
      { id: '6-ay', label: '6 Ay' },
      { id: '12-ay', label: '12 Ay' },
      { id: '24-ay', label: '24 Ay' },
    ],
  },
];

const ELECTRONICS_ATTRIBUTES: CategoryAttributeDefinition[] = [
  {
    attribute: { id: 'brand', code: 'brand', name: 'Marka', isRequired: true },
    mapping: { isRequired: true },
    options: [
      { id: 'apple', label: 'Apple' },
      { id: 'samsung', label: 'Samsung' },
      { id: 'xiaomi', label: 'Xiaomi' },
      { id: 'huawei', label: 'Huawei' },
    ],
  },
  {
    attribute: { id: 'storage', code: 'storage', name: 'Depolama', isRequired: true },
    mapping: { isRequired: true },
    options: [
      { id: '64', label: '64 GB' },
      { id: '128', label: '128 GB' },
      { id: '256', label: '256 GB' },
      { id: '512', label: '512 GB' },
    ],
  },
  {
    attribute: { id: 'ram', code: 'ram', name: 'RAM', isRequired: false },
    mapping: { isRequired: false },
    options: [
      { id: '4', label: '4 GB' },
      { id: '6', label: '6 GB' },
      { id: '8', label: '8 GB' },
      { id: '12', label: '12 GB' },
    ],
  },
  {
    attribute: { id: 'battery', code: 'battery', name: 'Pil Sagligi', isRequired: false },
    mapping: { isRequired: false },
    options: [
      { id: '100', label: '%100-%95' },
      { id: '94', label: '%94-%85' },
      { id: '84', label: '%84-%75' },
      { id: '74', label: '%74 ve alti' },
    ],
  },
  {
    attribute: { id: 'warranty', code: 'warranty', name: 'Garanti', isRequired: false },
    mapping: { isRequired: false },
    options: [
      { id: 'yok', label: 'Yok' },
      { id: 'devam', label: 'Devam ediyor' },
      { id: 'bitmis', label: 'Bitti' },
    ],
  },
];

const CATEGORY_ATTRIBUTES: Record<string, CategoryAttributeDefinition[]> = {
  elektronik: ELECTRONICS_ATTRIBUTES,
  'telefon-tablet': ELECTRONICS_ATTRIBUTES,
  'akilli-telefon': ELECTRONICS_ATTRIBUTES,
  tablet: ELECTRONICS_ATTRIBUTES,
  dizustu: ELECTRONICS_ATTRIBUTES,
};

function cloneAttributes(definitions: CategoryAttributeDefinition[]) {
  return definitions.map((definition) => ({
    attribute: { ...definition.attribute },
    mapping: { ...definition.mapping },
    options: definition.options.map((option) => ({ ...option })),
  }));
}

export function getCategoryTree(): CategoryTreeNode[] {
  return CATEGORY_TREE.map((node) => ({ ...node, children: node.children.map(cloneNode) }));
}

function cloneNode(node: CategoryTreeNode): CategoryTreeNode {
  return {
    ...node,
    children: node.children.map(cloneNode),
  };
}

export function getCategoryById(categoryId: string): CategoryTreeNode | null {
  const path = CATEGORY_PATHS.get(categoryId);
  if (!path || path.length === 0) return null;
  return path[path.length - 1];
}

export function getCategorySlugPath(categoryId: string): string[] {
  const path = CATEGORY_PATHS.get(categoryId);
  if (!path || path.length === 0) {
    return categoryId ? [categoryId] : [];
  }
  return path.map((item) => item.slug);
}

export function getCategoryAttributes(categoryId: string): CategoryAttributeDefinition[] {
  const path = CATEGORY_PATHS.get(categoryId) ?? [];
  const candidates = [
    categoryId,
    ...path.map((node) => node.id).reverse(),
  ];

  for (const candidate of candidates) {
    const definitions = CATEGORY_ATTRIBUTES[candidate];
    if (definitions) {
      return cloneAttributes(definitions);
    }
  }

  return cloneAttributes(DEFAULT_ATTRIBUTES);
}