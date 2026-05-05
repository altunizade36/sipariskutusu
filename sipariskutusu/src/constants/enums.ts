// App Status Enums
export enum AppEnvironment {
  DEVELOPMENT = 'development',
  STAGING = 'staging',
  PRODUCTION = 'production',
}

export enum NetworkStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  SLOW = 'slow',
  UNKNOWN = 'unknown',
}

export enum UserRole {
  ADMIN = 'admin',
  SELLER = 'seller',
  BUYER = 'buyer',
  MODERATOR = 'moderator',
}

export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SOLD = 'sold',
  ARCHIVED = 'archived',
  FLAGGED = 'flagged',
  REMOVED = 'removed',
}

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  RETURNED = 'returned',
}

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export enum ReportType {
  SPAM = 'spam',
  INAPPROPRIATE = 'inappropriate',
  FAKE_LISTING = 'fake_listing',
  MISLEADING = 'misleading',
  SCAM = 'scam',
  OTHER = 'other',
}

export enum ReportStatus {
  SUBMITTED = 'submitted',
  INVESTIGATING = 'investigating',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
  ESCALATED = 'escalated',
}

// Transaction Types
export enum TransactionType {
  SALE = 'sale',
  REFUND = 'refund',
  RETURN = 'return',
  COMMISSION = 'commission',
  WITHDRAWAL = 'withdrawal',
}

// Event Types
export enum EventType {
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  LISTING_CREATED = 'listing_created',
  LISTING_UPDATED = 'listing_updated',
  LISTING_DELETED = 'listing_deleted',
  PRODUCT_VIEWED = 'product_viewed',
  PRODUCT_FAVORITED = 'product_favorited',
  PRODUCT_UNFAVORITED = 'product_unfavorited',
  PURCHASE_COMPLETED = 'purchase_completed',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_RECEIVED = 'message_received',
  SELLER_REVIEWED = 'seller_reviewed',
}

// UI Enums
export enum ToastType {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

export enum ModalType {
  ALERT = 'alert',
  CONFIRM = 'confirm',
  PROMPT = 'prompt',
  CUSTOM = 'custom',
}

export enum ButtonVariant {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  DANGER = 'danger',
  GHOST = 'ghost',
  OUTLINE = 'outline',
}

export enum InputType {
  TEXT = 'text',
  EMAIL = 'email',
  PASSWORD = 'password',
  PHONE = 'phone',
  NUMBER = 'number',
  DATE = 'date',
  TEXTAREA = 'textarea',
}

// Cache Enums
export enum CacheDuration {
  SHORT = 5 * 60 * 1000, // 5 minutes
  MEDIUM = 30 * 60 * 1000, // 30 minutes
  LONG = 24 * 60 * 60 * 1000, // 24 hours
}

// Permission Enums
export enum PermissionType {
  CAMERA = 'camera',
  PHOTO_LIBRARY = 'photo_library',
  MICROPHONE = 'microphone',
  LOCATION = 'location',
  CALENDAR = 'calendar',
  CONTACTS = 'contacts',
  HEALTH = 'health',
}

export enum PermissionStatus {
  GRANTED = 'granted',
  DENIED = 'denied',
  BLOCKED = 'blocked',
  UNDETERMINED = 'undetermined',
}

// Sort/Filter Enums
export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export enum SortField {
  PRICE = 'price',
  RATING = 'rating',
  POPULARITY = 'popularity',
  DATE_CREATED = 'date_created',
  DATE_UPDATED = 'date_updated',
  NAME = 'name',
}

// Pagination
export const PAGINATION_DEFAULTS = {
  PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  INITIAL_PAGE: 1,
} as const;

// Rate Limiting
export const RATE_LIMIT_DEFAULTS = {
  API_CALLS_PER_SECOND: 10,
  API_CALLS_PER_MINUTE: 300,
  UPLOAD_SIZE_MB: 50,
  MAX_CONCURRENT_UPLOADS: 5,
} as const;

// Storage Limits
export const STORAGE_LIMITS = {
  MAX_RECENTLY_VIEWED: 20,
  MAX_SEARCH_HISTORY: 10,
  MAX_NOTIFICATIONS: 100,
  MAX_MESSAGE_CACHE: 500,
  MAX_LISTING_CACHE: 200,
} as const;

// API Endpoints
export const API_ENDPOINTS = {
  LISTINGS: '/listings',
  PRODUCTS: '/products',
  ORDERS: '/orders',
  MESSAGES: '/messages',
  USERS: '/users',
  SELLERS: '/sellers',
  REVIEWS: '/reviews',
  REPORTS: '/reports',
  PAYMENTS: '/payments',
  CATEGORIES: '/categories',
} as const;

// UI Constants
export const UI_CONSTANTS = {
  TOAST_DURATION: 3000,
  ANIMATION_DURATION: 300,
  DEBOUNCE_DELAY: 500,
  SEARCH_DEBOUNCE_DELAY: 300,
  LONG_PRESS_DURATION: 500,
} as const;

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_TURKISH: /^(\+90|0)[1-9]\d{9}$/,
  URL: /^https?:\/\/.+/,
  PRICE: /^\d+(\.\d{1,2})?$/,
  CREDIT_CARD: /^\d{13,19}$/,
} as const;

// Error Codes
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  SERVER_ERROR: 'SERVER_ERROR',
  UNKNOWN: 'UNKNOWN',
} as const;

// Feature Flags
export const FEATURE_FLAGS = {
  ENABLE_DARK_MODE: true,
  ENABLE_PUSH_NOTIFICATIONS: true,
  ENABLE_OFFLINE_MODE: true,
  ENABLE_BIOMETRIC_AUTH: true,
  ENABLE_ADVANCED_SEARCH: true,
  ENABLE_SELLER_DASHBOARD: true,
  ENABLE_ANALYTICS: true,
} as const;
