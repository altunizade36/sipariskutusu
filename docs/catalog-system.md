# Catalog System Blueprint

## Architecture

This workspace now includes a frontend-compatible catalog domain under `src/catalog` that models:

- 12 root categories and a multi-level taxonomy
- closure-table category paths
- 500+ reusable attributes
- category-to-attribute mappings
- variant-capable product metadata
- dynamic category attribute and filter selectors

Recommended backend architecture for production:

1. `catalog` module
2. `products` module
3. `variants` module
4. `search` module
5. `admin-taxonomy` module

Recommended stack:

- Backend: NestJS + TypeScript
- Database: PostgreSQL
- Search: PostgreSQL faceting first, Elasticsearch/OpenSearch later if traffic requires it
- Frontend: Next.js or Expo-compatible consumers using the same contracts

## Folder Layout

```text
src/catalog/
  contracts.ts
  index.ts
  selectors.ts
  seedAttributes.ts
  seedCategories.ts
  seedCategoryAttributes.ts
  entities/
    attribute.entity.ts
    category.entity.ts
    category-attribute.entity.ts
    product.entity.ts
    product-attribute-value.entity.ts
    product-variant.entity.ts
  types.ts
```

## PostgreSQL Schema

```sql
create table categories (
  id uuid primary key,
  parent_id uuid null references categories(id) on delete cascade,
  root_id uuid not null,
  name text not null,
  slug text not null,
  level integer not null,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  icon text,
  seo_title text,
  seo_description text,
  unique(parent_id, slug)
);

create table category_paths (
  ancestor_id uuid not null references categories(id) on delete cascade,
  descendant_id uuid not null references categories(id) on delete cascade,
  depth integer not null,
  primary key (ancestor_id, descendant_id)
);

create table attributes (
  id uuid primary key,
  name text not null,
  code text not null unique,
  input_type text not null,
  unit text,
  is_required boolean not null default false,
  is_filterable boolean not null default true,
  is_variant boolean not null default false,
  is_searchable boolean not null default true,
  group_name text not null,
  description text
);

create table attribute_options (
  id uuid primary key,
  attribute_id uuid not null references attributes(id) on delete cascade,
  label text not null,
  value text not null,
  sort_order integer not null default 0
);

create table category_attributes (
  id uuid primary key,
  category_id uuid not null references categories(id) on delete cascade,
  attribute_id uuid not null references attributes(id) on delete cascade,
  is_required boolean not null default false,
  is_filterable boolean not null default true,
  is_variant boolean not null default false,
  sort_order integer not null default 0,
  unique(category_id, attribute_id)
);

create table brands (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  logo text
);

create table sellers (
  id uuid primary key,
  store_name text not null,
  tax_number text,
  status text not null
);

create table products (
  id uuid primary key,
  seller_id uuid not null references sellers(id),
  category_id uuid not null references categories(id),
  title text not null,
  slug text not null unique,
  description text not null,
  brand_id uuid references brands(id),
  price numeric(12,2) not null,
  sale_price numeric(12,2),
  stock integer not null,
  sku text not null unique,
  barcode text,
  status text not null
);

create table product_attribute_values (
  id uuid primary key,
  product_id uuid not null references products(id) on delete cascade,
  attribute_id uuid not null references attributes(id),
  value_text text,
  value_number numeric,
  value_boolean boolean,
  option_id uuid references attribute_options(id)
);

create table product_variants (
  id uuid primary key,
  product_id uuid not null references products(id) on delete cascade,
  sku text not null unique,
  barcode text,
  price numeric(12,2) not null,
  stock integer not null
);

create table product_variant_values (
  id uuid primary key,
  variant_id uuid not null references product_variants(id) on delete cascade,
  attribute_id uuid not null references attributes(id),
  option_id uuid not null references attribute_options(id)
);
```

## Dynamic Filter Logic

1. Resolve category by slug path via closure table.
2. Fetch `category_attributes` for the target leaf category.
3. Keep only `is_filterable=true` attributes.
4. Join `attribute_options` for selectable filters.
5. Calculate facet counts from active result set only.
6. Hide empty options from the current result set.
7. Return grouped filters ordered by `sort_order` and `group_name`.

## Dynamic Product Form Logic

1. Seller selects a leaf category.
2. Frontend requests `GET /categories/:slug/attributes`.
3. Backend returns category-specific form fields and options.
4. Fields marked `is_variant=true` can be used to build combinations.
5. Fields marked `is_required=true` must be validated before create/update.

## API Endpoints

```text
GET    /categories/tree
GET    /categories/:slug/attributes
GET    /categories/:slug/filters
GET    /categories/:slug/products
POST   /admin/categories
PATCH  /admin/categories/:id
POST   /admin/attributes
PATCH  /admin/attributes/:id
POST   /admin/category-attributes
POST   /products
PATCH  /products/:id
POST   /products/:id/variants
```

## Example Filter Response

```json
{
  "category": {
    "id": "elektronik-telefon-akilli-telefon",
    "name": "Akıllı Telefon",
    "slug": "akilli-telefon"
  },
  "filters": [
    {
      "attribute": {
        "code": "brand",
        "name": "Marka",
        "inputType": "select",
        "groupName": "Genel"
      },
      "options": [
        { "label": "Samsung", "value": "samsung", "count": 128 },
        { "label": "Apple", "value": "apple", "count": 84 }
      ]
    },
    {
      "attribute": {
        "code": "ram",
        "name": "RAM",
        "inputType": "number",
        "groupName": "Elektronik"
      },
      "options": []
    }
  ]
}
```

## Example Attributes Response

```json
{
  "category": {
    "id": "moda-kadin-giyim-elbise",
    "name": "Elbise",
    "slug": "elbise"
  },
  "fields": [
    {
      "attribute": {
        "code": "size",
        "name": "Beden",
        "inputType": "size",
        "isVariant": true,
        "groupName": "Varyant"
      },
      "options": [
        { "label": "S", "value": "s" },
        { "label": "M", "value": "m" }
      ]
    }
  ]
}
```

## Admin View Models

Category management row:

```ts
type AdminCategoryRow = {
  id: string;
  parentId: string | null;
  name: string;
  slug: string;
  level: number;
  sortOrder: number;
  isActive: boolean;
  seoTitle?: string;
  seoDescription?: string;
};
```

Attribute management row:

```ts
type AdminAttributeRow = {
  id: string;
  name: string;
  code: string;
  inputType: string;
  groupName: string;
  isRequired: boolean;
  isFilterable: boolean;
  isVariant: boolean;
  isSearchable: boolean;
};
```

## Current Repo Status

- Taxonomy seed exists in `src/catalog/seedCategories.ts`
- Attribute seed exists in `src/catalog/seedAttributes.ts`
- Category-attribute mapping exists in `src/catalog/seedCategoryAttributes.ts`
- Dynamic selectors exist in `src/catalog/selectors.ts`
- API request/response DTO-like contracts exist in `src/catalog/contracts.ts`

This is enough to drive a NestJS service layer or a Next.js/Expo dynamic form/filter UI without redesigning the data model.