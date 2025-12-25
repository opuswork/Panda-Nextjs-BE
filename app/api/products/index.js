// app/api/products/index.js

const PRODUCTS_API = '/api/products';

/**
 * Get single product
 */
export async function getProduct(id) {
  try {
    const url = `${PRODUCTS_API}/${id}`;
    console.log('[getProduct] Fetching:', url);

    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('상품을 찾을 수 없습니다.');
      }
      throw new Error(`Failed to fetch product (${response.status})`);
    }

    const product = await response.json();
    return product;

  } catch (error) {
    console.error('[getProduct] Error:', error);
    throw error;
  }
}

/**
 * Get product list with pagination
 */
export async function getProducts({
  page = 1,
  pageSize = 10,
  orderBy = 'recent',
  keyword = '',
} = {}) {
  try {
    const url = new URL(PRODUCTS_API, window.location.origin);

    url.searchParams.set('page', page);
    url.searchParams.set('pageSize', pageSize);
    if (orderBy) url.searchParams.set('orderBy', orderBy);
    if (keyword) url.searchParams.set('keyword', keyword);

    console.log('[getProducts] Fetching:', url.toString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // ✅ MATCH Prisma API response
    return {
      products: data.items,
      pagination: data.pagination,
    };

  } catch (error) {
    console.error('[getProducts] Error:', error);
    return {
      products: [],
      pagination: {
        page: 1,
        pageSize,
        total: 0,
        totalPages: 0,
      },
    };
  }
}
