/**
 * listingPermissionService.ts
 * Listing ownership and permission verification
 * Ensures users can only manage their own listings
 */

import { getSupabaseClient } from './supabase';
import type { Listing } from './listingService';

export interface ListingOwnershipCheck {
  isOwner: boolean;
  listing?: Listing;
  error?: string;
}

/**
 * checkListingOwnership
 * Verifies if a user owns a listing
 */
export async function checkListingOwnership(
  listingId: string,
  userId: string
): Promise<ListingOwnershipCheck> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id, seller_id, owner_id, title, price, status')
      .eq('id', listingId)
      .single();

    if (error || !data) {
      return {
        isOwner: false,
        error: 'İlan bulunamadı',
      };
    }

    const ownerId = data.owner_id ?? data.seller_id;
    const isOwner = ownerId === userId;

    return {
      isOwner,
      listing: data as unknown as Listing,
      error: isOwner ? undefined : 'Bu ilana yetkiniz yok',
    };
  } catch (err) {
    return {
      isOwner: false,
      error: 'İzin kontrol edilemedi',
    };
  }
}

/**
 * getListingsByUser
 * Gets all listings owned by a user
 */
export async function getListingsByUser(
  userId: string,
  includeInactive: boolean = false
): Promise<Listing[]> {
  const supabase = getSupabaseClient();

  try {
    let query = supabase
      .from('listings')
      .select(
        `
        id, seller_id, owner_id, store_id, title, description, price, 
        original_price, currency, category_id, condition, status, 
        delivery, city, district, stock, view_count, favorite_count, 
        is_negotiable, created_at, updated_at
        `
      )
      .or(`seller_id.eq.${userId},owner_id.eq.${userId}`);

    if (!includeInactive) {
      query = query.eq('status', 'active');
    } else {
      query = query.neq('status', 'deleted');
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user listings:', error);
      return [];
    }

    return (data || []) as unknown as Listing[];
  } catch (err) {
    console.error('Error in getListingsByUser:', err);
    return [];
  }
}

/**
 * canEditListing
 * Checks if user can edit a specific listing
 */
export async function canEditListing(
  listingId: string,
  userId: string
): Promise<boolean> {
  const check = await checkListingOwnership(listingId, userId);
  return check.isOwner;
}

/**
 * canDeleteListing
 * Checks if user can delete a listing
 */
export async function canDeleteListing(
  listingId: string,
  userId: string
): Promise<boolean> {
  const check = await checkListingOwnership(listingId, userId);
  return check.isOwner;
}

/**
 * canManageListingImages
 * Checks if user can manage images for a listing
 */
export async function canManageListingImages(
  listingId: string,
  userId: string
): Promise<boolean> {
  const check = await checkListingOwnership(listingId, userId);
  return check.isOwner;
}

/**
 * enforceListingOwnership
 * Throws error if user doesn't own listing
 * Used as middleware before operations
 */
export async function enforceListingOwnership(
  listingId: string,
  userId: string
): Promise<Listing> {
  const check = await checkListingOwnership(listingId, userId);

  if (!check.isOwner) {
    throw new Error(check.error || 'Bu ilana yetkiniz yok');
  }

  if (!check.listing) {
    throw new Error('İlan bulunamadı');
  }

  return check.listing;
}

/**
 * getUserListingIds
 * Gets all listing IDs owned by a user (for quick checks)
 */
export async function getUserListingIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('listings')
      .select('id')
      .or(`seller_id.eq.${userId},owner_id.eq.${userId}`)
      .neq('status', 'deleted');

    if (error) {
      return [];
    }

    return (data || []).map((item: any) => item.id);
  } catch (err) {
    return [];
  }
}

/**
 * validateListingUpdateInput
 * Validates listing update payload before sending to DB
 */
export interface ListingUpdateInput {
  title?: string;
  description?: string;
  price?: number;
  status?: 'active' | 'published' | 'draft' | 'pending_review' | 'rejected' | 'passive' | 'sold' | 'paused' | 'deleted';
  stock?: number;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  is_negotiable?: boolean;
}

export function validateListingUpdateInput(input: ListingUpdateInput): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim().length < 3) {
      errors.push('Başlık minimum 3 karakter olmalı');
    }
    if (input.title.length > 100) {
      errors.push('Başlık maksimum 100 karakter olmalı');
    }
  }

  if (input.description !== undefined) {
    if (typeof input.description !== 'string' || input.description.trim().length < 10) {
      errors.push('Açıklama minimum 10 karakter olmalı');
    }
    if (input.description.length > 5000) {
      errors.push('Açıklama maksimum 5000 karakter olmalı');
    }
  }

  if (input.price !== undefined) {
    if (typeof input.price !== 'number' || input.price < 0) {
      errors.push('Fiyat sıfırdan büyük olmalı');
    }
    if (input.price > 999999999) {
      errors.push('Fiyat çok yüksek');
    }
  }

  if (input.stock !== undefined) {
    if (typeof input.stock !== 'number' || input.stock < 0 || !Number.isInteger(input.stock)) {
      errors.push('Stok geçerli bir tamsayı olmalı');
    }
  }

  if (input.status !== undefined) {
    const validStatuses = ['active', 'published', 'draft', 'pending_review', 'rejected', 'passive', 'sold', 'paused', 'deleted'];
    if (!validStatuses.includes(input.status)) {
      errors.push('Geçersiz durum');
    }
  }

  if (input.condition !== undefined) {
    const validConditions = ['new', 'like_new', 'good', 'fair', 'poor'];
    if (!validConditions.includes(input.condition)) {
      errors.push('Geçersiz durum');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
