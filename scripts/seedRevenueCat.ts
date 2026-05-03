import { getUncachableRevenueCatClient } from './revenueCatClient';
import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'Sipariş Kutusu';
const APP_STORE_APP_NAME = 'Sipariş Kutusu iOS';
const APP_STORE_BUNDLE_ID = 'com.sipariskutusu.app';
const PLAY_STORE_APP_NAME = 'Sipariş Kutusu Android';
const PLAY_STORE_PACKAGE_NAME = 'com.sipariskutusu.app';

type SubProduct = {
  id: string;
  displayName: string;
  title: string;
  duration: 'P1M' | 'P1Y';
  priceTRY: number;
};

type CreditProduct = {
  id: string;
  displayName: string;
  title: string;
  credits: number;
  priceTRY: number;
};

type EntitlementDef = {
  lookupKey: string;
  displayName: string;
  productIds: string[];
};

const SUBSCRIPTION_PRODUCTS: SubProduct[] = [
  { id: 'com.sipariskutusu.starter.monthly', displayName: 'Starter Aylık', title: 'Starter Aylık Abonelik', duration: 'P1M', priceTRY: 79 },
  { id: 'com.sipariskutusu.plus.monthly',    displayName: 'Plus Aylık',    title: 'Plus Aylık Abonelik',    duration: 'P1M', priceTRY: 149 },
  { id: 'com.sipariskutusu.pro.monthly',     displayName: 'Pro Aylık',     title: 'Pro Aylık Abonelik',     duration: 'P1M', priceTRY: 299 },
  { id: 'com.sipariskutusu.elite.monthly',   displayName: 'Elite Aylık',   title: 'Elite Aylık Abonelik',   duration: 'P1M', priceTRY: 599 },
  { id: 'com.sipariskutusu.starter.yearly',  displayName: 'Starter Yıllık', title: 'Starter Yıllık Abonelik', duration: 'P1Y', priceTRY: 790 },
  { id: 'com.sipariskutusu.plus.yearly',     displayName: 'Plus Yıllık',   title: 'Plus Yıllık Abonelik',   duration: 'P1Y', priceTRY: 1490 },
  { id: 'com.sipariskutusu.pro.yearly',      displayName: 'Pro Yıllık',    title: 'Pro Yıllık Abonelik',    duration: 'P1Y', priceTRY: 2990 },
  { id: 'com.sipariskutusu.elite.yearly',    displayName: 'Elite Yıllık',  title: 'Elite Yıllık Abonelik',  duration: 'P1Y', priceTRY: 5990 },
];

const CREDIT_PRODUCTS: CreditProduct[] = [
  { id: 'com.sipariskutusu.credits.30',   displayName: '30 Kredi',   title: '30 Kredi Paketi',   credits: 30,   priceTRY: 39 },
  { id: 'com.sipariskutusu.credits.80',   displayName: '80 Kredi',   title: '80 Kredi Paketi',   credits: 80,   priceTRY: 79 },
  { id: 'com.sipariskutusu.credits.180',  displayName: '180 Kredi',  title: '180 Kredi Paketi',  credits: 180,  priceTRY: 149 },
  { id: 'com.sipariskutusu.credits.420',  displayName: '420 Kredi',  title: '420 Kredi Paketi',  credits: 420,  priceTRY: 299 },
  { id: 'com.sipariskutusu.credits.1000', displayName: '1000 Kredi', title: '1000 Kredi Paketi', credits: 1000, priceTRY: 599 },
];

const ENTITLEMENTS_DEF: EntitlementDef[] = [
  { lookupKey: 'starter', displayName: 'Starter Erişimi', productIds: ['com.sipariskutusu.starter.monthly', 'com.sipariskutusu.starter.yearly'] },
  { lookupKey: 'plus',    displayName: 'Plus Erişimi',    productIds: ['com.sipariskutusu.plus.monthly', 'com.sipariskutusu.plus.yearly'] },
  { lookupKey: 'pro',     displayName: 'Pro Erişimi',     productIds: ['com.sipariskutusu.pro.monthly', 'com.sipariskutusu.pro.yearly'] },
  { lookupKey: 'elite',   displayName: 'Elite Erişimi',   productIds: ['com.sipariskutusu.elite.monthly', 'com.sipariskutusu.elite.yearly'] },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ── Project ───────────────────────────────────────────────────────────────
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({ client, query: { limit: 20 } });
  if (listProjectsError) throw new Error('Failed to list projects');
  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log('Project already exists:', existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({ client, body: { name: PROJECT_NAME } });
    if (error) throw new Error('Failed to create project');
    project = newProject;
    console.log('Created project:', project.id);
  }

  // ── Apps ──────────────────────────────────────────────────────────────────
  const { data: apps, error: listAppsError } = await listApps({ client, path: { project_id: project.id }, query: { limit: 20 } });
  if (listAppsError || !apps || apps.items.length === 0) throw new Error('No apps found');

  let testApp: App | undefined = apps.items.find((a) => a.type === 'test_store');
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === 'app_store');
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === 'play_store');

  if (!testApp) throw new Error('No test store app found');
  console.log('Test store app:', testApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({ client, path: { project_id: project.id }, body: { name: APP_STORE_APP_NAME, type: 'app_store', app_store: { bundle_id: APP_STORE_BUNDLE_ID } } });
    if (error) throw new Error('Failed to create App Store app');
    appStoreApp = newApp;
    console.log('Created App Store app:', appStoreApp.id);
  } else {
    console.log('App Store app found:', appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({ client, path: { project_id: project.id }, body: { name: PLAY_STORE_APP_NAME, type: 'play_store', play_store: { package_name: PLAY_STORE_PACKAGE_NAME } } });
    if (error) throw new Error('Failed to create Play Store app');
    playStoreApp = newApp;
    console.log('Created Play Store app:', playStoreApp.id);
  } else {
    console.log('Play Store app found:', playStoreApp.id);
  }

  // ── List existing products ─────────────────────────────────────────────────
  const { data: existingProducts, error: listProductsError } = await listProducts({ client, path: { project_id: project.id }, query: { limit: 100 } });
  if (listProductsError) throw new Error('Failed to list products');

  const ensureProduct = async (targetApp: App, isTestStore: boolean, identifier: string, displayName: string, title: string, type: 'subscription' | 'non_subscription', duration?: string, priceTRY?: number): Promise<Product> => {
    const existing = existingProducts.items?.find((p) => p.store_identifier === identifier && p.app_id === targetApp.id);
    if (existing) { console.log(`Product exists [${identifier}]:`, existing.id); return existing; }

    const body: CreateProductData['body'] = {
      store_identifier: identifier,
      app_id: targetApp.id,
      type,
      display_name: displayName,
    };

    if (isTestStore) {
      if (type === 'subscription' && duration) {
        body.subscription = { duration: duration as any };
      }
      body.title = title;
    }

    const { data: created, error } = await createProduct({ client, path: { project_id: project.id }, body });
    if (error) throw new Error(`Failed to create product ${identifier}: ${JSON.stringify(error)}`);
    console.log(`Created product [${identifier}]:`, created.id);

    if (isTestStore && priceTRY) {
      const priceMicros = priceTRY * 1_000_000;
      const { error: priceError } = await client.post<TestStorePricesResponse>({
        url: '/projects/{project_id}/products/{product_id}/test_store_prices',
        path: { project_id: project.id, product_id: created.id },
        body: { prices: [{ amount_micros: priceMicros, currency: 'TRY' }] },
      });
      if (priceError && (priceError as any).type !== 'resource_already_exists') {
        console.warn(`Failed to set test price for ${identifier}:`, priceError);
      } else {
        console.log(`  Set test price: ₺${priceTRY}`);
      }
    }

    return created;
  };

  // ── Create all subscription products ─────────────────────────────────────
  const subProductMap: Record<string, { test: Product; appStore: Product; playStore: Product }> = {};
  for (const sp of SUBSCRIPTION_PRODUCTS) {
    const playStoreId = `${sp.id.replace(/\./g, '_')}:monthly`.replace('_monthly_monthly', ':monthly').replace('_yearly_monthly', ':yearly');
    const [testProd, appStoreProd, playStoreProd] = await Promise.all([
      ensureProduct(testApp, true, sp.id, sp.displayName, sp.title, 'subscription', sp.duration, sp.priceTRY),
      ensureProduct(appStoreApp, false, sp.id, sp.displayName, sp.title, 'subscription'),
      ensureProduct(playStoreApp, false, sp.id.replace(/\./g, '_'), sp.displayName, sp.title, 'subscription'),
    ]);
    subProductMap[sp.id] = { test: testProd, appStore: appStoreProd, playStore: playStoreProd };
  }

  // ── Create all credit products ────────────────────────────────────────────
  const creditProductMap: Record<string, { test: Product; appStore: Product; playStore: Product }> = {};
  for (const cp of CREDIT_PRODUCTS) {
    const [testProd, appStoreProd, playStoreProd] = await Promise.all([
      ensureProduct(testApp, true, cp.id, cp.displayName, cp.title, 'non_subscription', undefined, cp.priceTRY),
      ensureProduct(appStoreApp, false, cp.id, cp.displayName, cp.title, 'non_subscription'),
      ensureProduct(playStoreApp, false, cp.id.replace(/\./g, '_'), cp.displayName, cp.title, 'non_subscription'),
    ]);
    creditProductMap[cp.id] = { test: testProd, appStore: appStoreProd, playStore: playStoreProd };
  }

  // ── Entitlements (subscriptions only) ────────────────────────────────────
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({ client, path: { project_id: project.id }, query: { limit: 20 } });
  if (listEntitlementsError) throw new Error('Failed to list entitlements');

  for (const eDef of ENTITLEMENTS_DEF) {
    let ent: Entitlement;
    const existing = existingEntitlements.items?.find((e) => e.lookup_key === eDef.lookupKey);
    if (existing) {
      console.log(`Entitlement [${eDef.lookupKey}] exists:`, existing.id);
      ent = existing;
    } else {
      const { data: newEnt, error } = await createEntitlement({ client, path: { project_id: project.id }, body: { lookup_key: eDef.lookupKey, display_name: eDef.displayName } });
      if (error) throw new Error(`Failed to create entitlement ${eDef.lookupKey}`);
      ent = newEnt;
      console.log(`Created entitlement [${eDef.lookupKey}]:`, ent.id);
    }

    const productIds: string[] = [];
    for (const pid of eDef.productIds) {
      const map = subProductMap[pid];
      if (map) productIds.push(map.test.id, map.appStore.id, map.playStore.id);
    }

    if (productIds.length > 0) {
      const { error: attachError } = await attachProductsToEntitlement({ client, path: { project_id: project.id, entitlement_id: ent.id }, body: { product_ids: productIds } });
      if (attachError && (attachError as any).type !== 'unprocessable_entity_error') {
        console.warn(`Failed to attach products to entitlement ${eDef.lookupKey}:`, attachError);
      } else {
        console.log(`  Attached ${productIds.length} products to ${eDef.lookupKey}`);
      }
    }
  }

  // ── Offerings ─────────────────────────────────────────────────────────────
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({ client, path: { project_id: project.id }, query: { limit: 20 } });
  if (listOfferingsError) throw new Error('Failed to list offerings');

  const ensureOffering = async (lookupKey: string, displayName: string, isCurrent = false): Promise<Offering> => {
    const existing = existingOfferings.items?.find((o) => o.lookup_key === lookupKey);
    if (existing) { console.log(`Offering [${lookupKey}] exists:`, existing.id); return existing; }
    const { data: newOff, error } = await createOffering({ client, path: { project_id: project.id }, body: { lookup_key: lookupKey, display_name: displayName } });
    if (error) throw new Error(`Failed to create offering ${lookupKey}`);
    console.log(`Created offering [${lookupKey}]:`, newOff.id);
    if (isCurrent && !newOff.is_current) {
      await updateOffering({ client, path: { project_id: project.id, offering_id: newOff.id }, body: { is_current: true } });
    }
    return newOff;
  };

  const subOffering = await ensureOffering('subscriptions', 'Abonelikler', true);
  const creditsOffering = await ensureOffering('credits', 'Kredi Paketleri');

  // ── Packages for subscriptions offering ──────────────────────────────────
  const { data: existingSubPackages } = await listPackages({ client, path: { project_id: project.id, offering_id: subOffering.id }, query: { limit: 50 } });
  const subPackageKeys = [
    { key: 'starter_monthly', label: 'Starter Aylık',  productId: 'com.sipariskutusu.starter.monthly' },
    { key: 'plus_monthly',    label: 'Plus Aylık',     productId: 'com.sipariskutusu.plus.monthly' },
    { key: 'pro_monthly',     label: 'Pro Aylık',      productId: 'com.sipariskutusu.pro.monthly' },
    { key: 'elite_monthly',   label: 'Elite Aylık',    productId: 'com.sipariskutusu.elite.monthly' },
    { key: 'starter_yearly',  label: 'Starter Yıllık', productId: 'com.sipariskutusu.starter.yearly' },
    { key: 'plus_yearly',     label: 'Plus Yıllık',    productId: 'com.sipariskutusu.plus.yearly' },
    { key: 'pro_yearly',      label: 'Pro Yıllık',     productId: 'com.sipariskutusu.pro.yearly' },
    { key: 'elite_yearly',    label: 'Elite Yıllık',   productId: 'com.sipariskutusu.elite.yearly' },
  ];

  for (const pkgDef of subPackageKeys) {
    let pkg: Package;
    const existingPkg = existingSubPackages?.items?.find((p) => p.lookup_key === pkgDef.key);
    if (existingPkg) {
      console.log(`Package [${pkgDef.key}] exists:`, existingPkg.id);
      pkg = existingPkg;
    } else {
      const { data: newPkg, error } = await createPackages({ client, path: { project_id: project.id, offering_id: subOffering.id }, body: { lookup_key: pkgDef.key, display_name: pkgDef.label } });
      if (error) throw new Error(`Failed to create package ${pkgDef.key}`);
      pkg = newPkg;
      console.log(`Created package [${pkgDef.key}]:`, pkg.id);
    }

    const products = subProductMap[pkgDef.productId];
    if (products) {
      const { error: attachErr } = await attachProductsToPackage({ client, path: { project_id: project.id, package_id: pkg.id }, body: { products: [{ product_id: products.test.id, eligibility_criteria: 'all' }, { product_id: products.appStore.id, eligibility_criteria: 'all' }, { product_id: products.playStore.id, eligibility_criteria: 'all' }] } });
      if (attachErr && !((attachErr as any).message ?? '').includes('Cannot attach')) {
        console.warn(`Warning attaching products to ${pkgDef.key}:`, attachErr);
      }
    }
  }

  // ── Packages for credits offering ─────────────────────────────────────────
  const { data: existingCreditPackages } = await listPackages({ client, path: { project_id: project.id, offering_id: creditsOffering.id }, query: { limit: 20 } });
  const creditPackageKeys = CREDIT_PRODUCTS.map((cp) => ({ key: cp.id.split('.').pop()!, label: cp.displayName, productId: cp.id }));

  for (const pkgDef of creditPackageKeys) {
    let pkg: Package;
    const existingPkg = existingCreditPackages?.items?.find((p) => p.lookup_key === pkgDef.key);
    if (existingPkg) {
      console.log(`Credit package [${pkgDef.key}] exists:`, existingPkg.id);
      pkg = existingPkg;
    } else {
      const { data: newPkg, error } = await createPackages({ client, path: { project_id: project.id, offering_id: creditsOffering.id }, body: { lookup_key: pkgDef.key, display_name: pkgDef.label } });
      if (error) throw new Error(`Failed to create credit package ${pkgDef.key}`);
      pkg = newPkg;
      console.log(`Created credit package [${pkgDef.key}]:`, pkg.id);
    }

    const products = creditProductMap[pkgDef.productId];
    if (products) {
      const { error: attachErr } = await attachProductsToPackage({ client, path: { project_id: project.id, package_id: pkg.id }, body: { products: [{ product_id: products.test.id, eligibility_criteria: 'all' }, { product_id: products.appStore.id, eligibility_criteria: 'all' }, { product_id: products.playStore.id, eligibility_criteria: 'all' }] } });
      if (attachErr && !((attachErr as any).message ?? '').includes('Cannot attach')) {
        console.warn(`Warning attaching credit products to ${pkgDef.key}:`, attachErr);
      }
    }
  }

  // ── API Keys ──────────────────────────────────────────────────────────────
  const [testKeys, appKeys, playKeys] = await Promise.all([
    listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: testApp.id } }),
    listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: appStoreApp.id } }),
    listAppPublicApiKeys({ client, path: { project_id: project.id, app_id: playStoreApp.id } }),
  ]);

  console.log('\n============================');
  console.log('RevenueCat Seed Tamamlandı!');
  console.log('============================');
  console.log('Project ID:', project.id);
  console.log('Test Store App ID:', testApp.id);
  console.log('App Store App ID:', appStoreApp.id);
  console.log('Play Store App ID:', playStoreApp.id);
  console.log('\nAPI Keys:');
  console.log('  EXPO_PUBLIC_REVENUECAT_TEST_API_KEY =', testKeys.data?.items[0]?.key ?? 'N/A');
  console.log('  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY  =', appKeys.data?.items[0]?.key ?? 'N/A');
  console.log('  EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY =', playKeys.data?.items[0]?.key ?? 'N/A');
  console.log('\nEnv Vars:');
  console.log('  REVENUECAT_PROJECT_ID =', project.id);
  console.log('  REVENUECAT_TEST_STORE_APP_ID =', testApp.id);
  console.log('  REVENUECAT_APPLE_APP_STORE_APP_ID =', appStoreApp.id);
  console.log('  REVENUECAT_GOOGLE_PLAY_STORE_APP_ID =', playStoreApp.id);
  console.log('============================\n');
}

seedRevenueCat().catch((err) => { console.error(err); process.exit(1); });
