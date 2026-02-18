import { getAccessToken, refreshToken, clearTokens } from './auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE;
const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

if (!API_BASE) {
  console.warn("NEXT_PUBLIC_API_BASE environment variable is not set");
}

export async function getProducts(filters = {}) {
  if (!API_BASE) {
    console.error("API_BASE is undefined. Check your .env.local file.");
    return [];
  }

  try {
    const params = new URLSearchParams();
    if (filters.category) {
      params.set("category_slug", filters.category);
    }
    const url = `${API_BASE}/products/?${params.toString()}`;
    const res = await fetch(url, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();

    // ✅ Handle paginated response
    const products = Array.isArray(data)
      ? data
      : data.results || [];

    // Transform image URLs
    return products.map(product => {

      // The main image for the card should be product.image
      const mainImageUrl = (product.image && product.image.startsWith("http"))
        ? product.image
        : product.image
        ? `${BACKEND}${product.image}`
        : null;

      // Start the gallery with the main image if it exists
      const galleryImages = [];
      if (product.image) {
        galleryImages.push({ 
          id: `main-${product.id}`, 
          image: mainImageUrl 
        });
      }

      // Add the rest of the gallery images
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach(img => {
          const galleryImageUrl = (img.image && img.image.startsWith("http"))
            ? img.image
            : img.image
            ? `${BACKEND}${img.image}`
            : null;
            
          if (galleryImageUrl) {
            galleryImages.push({ ...img, image: galleryImageUrl });
          }
        });
      }
      
      // If there's no main image, use the first gallery image for the card.
      const cardImageUrl = mainImageUrl || (galleryImages.length > 0 ? galleryImages[0].image : null);

      return {
        ...product,
        image: cardImageUrl,
        images: galleryImages,
      };
    });
  } catch (error) {
    console.error("Failed to fetch products:", error.message);
    console.error("Full error:", error);
    return [];
  }
}

export async function createOrder(orderData) {
  try {
    const res = await fetch(`${API_BASE}/orders/create/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (error) {
    console.error("Failed to create order:", error);
    throw error;
  }
}

export async function getCategories() {
  if (!API_BASE) {
    console.error("API_BASE is undefined. Check your .env.local file.");
    return getMockCategories();
  }

  try {
    const url = `${API_BASE}/categories/`;
    const res = await fetch(url, {
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`API response status: ${res.status} ${res.statusText}`);
      console.error("Full URL attempted:", url);
      console.warn("Backend categories endpoint not found, using mock data");
      return getMockCategories();
    }
    const data = await res.json();

    const categories = Array.isArray(data)
      ? data
      : data.results || [];

    return categories.map((category) => {

      if (category.image && !category.image.startsWith("http")) {
        category.image = `${BACKEND}${category.image}`;
      }
      return category;
    });
  } catch (error) {
    console.error("Failed to fetch categories:", error.message);
    return getMockCategories();
  }
}

export async function getTrendingProducts() {
  if (!API_BASE) return [];

  try {
    const res = await fetch(`${API_BASE}/products/trending/`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      const products = Array.isArray(data)
        ? data
        : data.results || [];

      return products.map(product => {

      const mainImageUrl = (product.image && product.image.startsWith("http"))
        ? product.image
        : product.image
        ? `${BACKEND}${product.image}`
        : null;

      const galleryImages = [];
      if (product.image) {
        galleryImages.push({ id: `main-${product.id}`, image: mainImageUrl });
      }
      if (product.images && Array.isArray(product.images)) {
        product.images.forEach(img => {
          const url = (img.image && img.image.startsWith("http"))
            ? img.image
            : img.image ? `${BACKEND}${img.image}` : null;
          if (url) galleryImages.push({ ...img, image: url });
        });
      }

      return {
        ...product,
        image: mainImageUrl || (galleryImages[0]?.image ?? null),
        images: galleryImages,
      };
    });
  } catch (error) {
    console.error("Failed to fetch trending products:", error.message);
    return [];
  }
}

export async function incrementCartAdd(productId) {
  if (!API_BASE) return;
  try {
    await fetch(`${API_BASE}/products/${productId}/cart-add/`, {
      method: "POST",
    });
  } catch (_) {
    // fire-and-forget — never block the UI
  }
}

function getMockCategories() {
  return [
    { id: 1, name: "Sunglasses", slug: "sunglasses" },
    { id: 2, name: "Reading Glasses", slug: "reading-glasses" },
    { id: 3, name: "Prescription", slug: "prescription" },
  ];
}

export { BACKEND };

export async function searchProducts(query) {
  if (!query || query.length < 2) {
    return { products: [], categories: [], subcategories: [], query: '' };
  }
  
  const res = await fetch(
    `http://127.0.0.1:8000/api/search/?q=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  
  // Transform image URLs for products (same as getProducts)
  if (data.products) {
    data.products = data.products.map(product => ({
      ...product,
      image: product.image?.startsWith('http') 
        ? product.image 
        : `http://127.0.0.1:8000${product.image}`,
      images: product.images?.map(img => ({
        ...img,
        image: img.image?.startsWith('http')
          ? img.image
          : `http://127.0.0.1:8000${img.image}`
      }))
    }));
  }
  
  return data;
}

async function fetchWithAuth(url, options = {}) {
  const token = getAccessToken();
  
  if (!token) {
    throw new Error('Not authenticated');
  }
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });
  
  // Handle token expiry
  if (response.status === 401) {
    // Try to refresh
    const refreshToken = localStorage.getItem('refresh_token');
    const newTokens = await refreshToken(refreshToken);
    
    if (newTokens) {
      setTokens(newTokens.access, newTokens.refresh);
      // Retry original request
      return fetchWithAuth(url, options);
    } else {
      // Refresh failed, redirect to login
      clearTokens();
      window.location.href = '/login';
      throw new Error('Session expired');
    }
  }
  
  return response;
}

// Use in existing functions
export async function addToCart(productId, quantity) {
  const response = await fetchWithAuth('http://127.0.0.1:8000/api/cart/add/', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({product_id: productId, quantity})
  });
  
  return response.json();
}
