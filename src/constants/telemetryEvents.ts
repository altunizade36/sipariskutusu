export const TELEMETRY_EVENTS = {
  SCREEN_VIEW: 'screen_view',
  LISTING_CREATED: 'listing_created',
  ORDER_PLACED: 'order_placed',
  SEARCH: 'search',
  MESSAGE_SENT: 'message_sent',

  SEARCH_SUBMITTED: 'search_submitted',
  SEARCH_RESULTS_LOADED: 'search_results_loaded',
  SEARCH_FILTERS_APPLIED: 'search_filters_applied',
  SEARCH_PRODUCTS_LOAD_MORE_CLICKED: 'search_products_load_more_clicked',
  SEARCH_STORES_LOAD_MORE_CLICKED: 'search_stores_load_more_clicked',
  SEARCH_RESULT_PRODUCT_CLICKED: 'search_result_product_clicked',
  SEARCH_RESULT_STORE_CLICKED: 'search_result_store_clicked',
  SEARCH_HISTORY_CLEARED: 'search_history_cleared',
  VISUAL_SEARCH_STARTED: 'visual_search_started',
  VISUAL_SEARCH_COMPLETED: 'visual_search_completed',

  LISTING_COMMENT_SUBMITTED: 'listing_comment_submitted',
  SIMILAR_LISTING_CLICKED: 'similar_listing_clicked',

  CREATE_LISTING_DRAFT_MIGRATED: 'create_listing_draft_migrated',

  PRODUCT_VIEWED: 'product_viewed',
  CART_INITIATED: 'cart_initiated',
  CART_STEP_ADVANCED: 'cart_step_advanced',
  ORDER_DRAFT_SENT: 'order_draft_sent',
  USER_SIGNED_IN: 'user_signed_in',
  USER_SIGNED_UP: 'user_signed_up',
  USER_SIGNED_OUT: 'user_signed_out',
  STORE_VIEWED: 'store_viewed',
  STORE_PRODUCT_CLICKED: 'store_product_clicked',
  STORE_CTA_CLICKED: 'store_cta_clicked',
  STORY_VIEWED: 'story_viewed',
  STORY_SHARED: 'story_shared',
} as const;

export type TelemetryEventName = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS];

export type TelemetryPrimitive = string | number | boolean | null | undefined;
export type TelemetryRecord = Record<string, TelemetryPrimitive>;

export type TelemetryEventPayloadMap = {
  [TELEMETRY_EVENTS.SCREEN_VIEW]: {
    screen: string;
  };
  [TELEMETRY_EVENTS.LISTING_CREATED]: {
    category_id?: string | null;
    price?: number | null;
  };
  [TELEMETRY_EVENTS.ORDER_PLACED]: {
    order_id: string;
    total: number;
  };
  [TELEMETRY_EVENTS.SEARCH]: {
    query: string;
    result_count: number;
  };
  [TELEMETRY_EVENTS.MESSAGE_SENT]: {
    conversation_id: string;
  };

  [TELEMETRY_EVENTS.SEARCH_SUBMITTED]: {
    source: string;
    query: string;
    is_instagram_query: boolean;
  };
  [TELEMETRY_EVENTS.SEARCH_RESULTS_LOADED]: {
    source: string;
    query: string;
    category_id?: string | null;
    result_count: number;
    has_more_products: boolean;
    has_more_stores: boolean;
  };
  [TELEMETRY_EVENTS.SEARCH_FILTERS_APPLIED]: {
    source: string;
    sort_option: string;
    min_price?: string | null;
    max_price?: string | null;
    city?: string | null;
  };
  [TELEMETRY_EVENTS.SEARCH_PRODUCTS_LOAD_MORE_CLICKED]: {
    source: string;
    query: string;
    current_count: number;
  };
  [TELEMETRY_EVENTS.SEARCH_STORES_LOAD_MORE_CLICKED]: {
    source: string;
    query: string;
    next_page: number;
    current_count: number;
  };
  [TELEMETRY_EVENTS.SEARCH_RESULT_PRODUCT_CLICKED]: {
    source: string;
    product_id: string;
    query?: string | null;
  };
  [TELEMETRY_EVENTS.SEARCH_RESULT_STORE_CLICKED]: {
    source: string;
    store_id: string;
    query?: string | null;
  };
  [TELEMETRY_EVENTS.SEARCH_HISTORY_CLEARED]: {
    source: string;
  };
  [TELEMETRY_EVENTS.VISUAL_SEARCH_STARTED]: {
    source: string;
    picker_source: 'camera' | 'gallery';
  };
  [TELEMETRY_EVENTS.VISUAL_SEARCH_COMPLETED]: {
    source: string;
    picker_source: 'camera' | 'gallery';
    mode?: 'backend' | 'fallback';
    backend_source?: string | null;
    result_count?: number;
  };

  [TELEMETRY_EVENTS.LISTING_COMMENT_SUBMITTED]: {
    source: string;
    listing_id: string;
    parent_id?: string | null;
    is_reply: boolean;
    comment_length: number;
  };
  [TELEMETRY_EVENTS.SIMILAR_LISTING_CLICKED]: {
    source: string;
    source_listing_id: string;
    target_listing_id: string;
    position: number;
  };

  [TELEMETRY_EVENTS.CREATE_LISTING_DRAFT_MIGRATED]: {
    source: string;
    from_version: number;
    to_version: number;
  };

  [TELEMETRY_EVENTS.PRODUCT_VIEWED]: {
    product_id: string;
    title?: string | null;
    price?: number | null;
    seller_id?: string | null;
    category?: string | null;
    source?: string | null;
  };
  [TELEMETRY_EVENTS.CART_INITIATED]: {
    product_id: string;
    product_title?: string | null;
    price?: number | null;
    seller_id?: string | null;
  };
  [TELEMETRY_EVENTS.CART_STEP_ADVANCED]: {
    from_step: string;
    to_step: string;
    product_id?: string | null;
  };
  [TELEMETRY_EVENTS.ORDER_DRAFT_SENT]: {
    product_id: string;
    seller_id?: string | null;
    quantity: number;
    subtotal: number;
    total: number;
    payment_method: string;
    draft_order_id: string;
  };
  [TELEMETRY_EVENTS.USER_SIGNED_IN]: {
    method: 'email' | 'demo';
    account_role?: 'buyer' | 'seller' | null;
  };
  [TELEMETRY_EVENTS.USER_SIGNED_UP]: {
    method: 'email';
    account_role: 'buyer' | 'seller';
  };
  [TELEMETRY_EVENTS.USER_SIGNED_OUT]: Record<string, never>;
  [TELEMETRY_EVENTS.STORE_VIEWED]: {
    seller_id: string;
    store_name?: string | null;
    source?: string | null;
  };
  [TELEMETRY_EVENTS.STORE_PRODUCT_CLICKED]: {
    seller_id?: string | null;
    store_name?: string | null;
    product_id: string;
    source?: string | null;
  };
  [TELEMETRY_EVENTS.STORE_CTA_CLICKED]: {
    seller_id?: string | null;
    store_name?: string | null;
    cta: string;
    source?: string | null;
  };
  [TELEMETRY_EVENTS.STORY_VIEWED]: {
    story_id?: string | null;
    seller_id?: string | null;
    seller_name?: string | null;
  };
  [TELEMETRY_EVENTS.STORY_SHARED]: {
    listing_id?: string | null;
    category_id?: string | null;
    has_price: boolean;
  };
};

export type TelemetryEventPayload<E extends TelemetryEventName> =
  E extends keyof TelemetryEventPayloadMap ? TelemetryEventPayloadMap[E] : TelemetryRecord;
