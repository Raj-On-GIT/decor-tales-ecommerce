import { getAccessToken, refreshAccessToken, clearTokens } from './auth';

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
    const url = `${API_BASE}/api/products/?${params.toString()}`;
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
    const response = await fetchWithAuth(
      `${API_BASE}/api/orders/create/`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderData),
      }
    );

    if (!response.ok) {
      throw new Error("Failed to create order");
    }

    return response.json();
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
    const url = `${API_BASE}/api/categories/`;
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
    const res = await fetch(`${API_BASE}/api/products/trending/`, {
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
    `${API_BASE}/api/search/?q=${encodeURIComponent(query)}`
  );
  const data = await res.json();
  
  // Transform image URLs for products (same as getProducts)
  if (data.products) {
    data.products = data.products.map(product => ({
      ...product,
      image: product.image?.startsWith('http') 
        ? product.image 
        : `${BACKEND}${product.image}`,
      images: product.images?.map(img => ({
        ...img,
        image: img.image?.startsWith('http')
          ? img.image
          : `${BACKEND}${img.image}`
      }))
    }));
  }
  
  return data;
}

async function fetchWithAuth(url, options = {}) {
  let token = getAccessToken();

  if (!token) {
    throw new Error("Not authenticated");
  }

  let response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  // If token expired → try refresh once
  if (response.status === 401) {
  const refreshed = await refreshAccessToken();

  if (refreshed) {
    token = getAccessToken();

    response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } else {
    clearTokens();
    window.location.href = "/login";
    throw new Error("Session expired");
  }
}

  return response;
}

// Use in existing functions
export async function addToCart(
  productId,
  quantity = 1,
  variantId = null
) {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/cart/add/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: productId,
        quantity,
        variant_id: variantId,
      }),
    }
  );

  if (!response.ok) {
  let message = "Failed to add item to cart";

  try {
    const errorData = await response.json();
    message = errorData.error || message;
  } catch (_) {
    // ignore JSON parse errors
  }

  throw new Error(message);
}

  return response.json();
}

export async function getCart() {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/cart/`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch cart");
  }

  const data = await response.json();

  // 🧠 Transform server cart → UI cart
  const transformedItems = (data.items || []).map((item) => {
    const product = item.product || {};
    const variant = item.variant || null;
    
    return {
      id: item.id,
      product_id: product.id,
      title: product.title,

      price: Number(product.price || 0),

      image: product.image?.startsWith("http")
        ? product.image
        : `${process.env.NEXT_PUBLIC_BACKEND_URL}${product.image}`,

      category: product.category?.name || "Uncategorized",
      stock: product.stock,
      stock_type: product.stock_type,
      qty: item.quantity,

      variant: variant
        ? {
            id: variant.id,
            size_name: variant.size_name,
            color_name: variant.color_name,
            stock: variant.stock,
          }
        : null,
    };
  });

  return {
    items: transformedItems,
    total: data.total,
    count: data.count,
  };
}

export async function removeFromCart(itemId) {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/cart/remove/${itemId}/`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("Failed to remove item");
  }

  return response.json();
}

export async function updateCartItem(itemId, quantity) {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/cart/update/${itemId}/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to update cart");
  }

  return response.json();
}

export async function clearCart() {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/cart/clear/`,
    { method: "DELETE" }
  );

  if (!response.ok) {
    throw new Error("Failed to clear cart");
  }

  return response.json();
}

export async function getMyOrders() {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/my-orders/`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch orders");
  }

  return response.json();
}

export async function getOrderDetail(orderId) {
  const response = await fetchWithAuth(
    `${API_BASE}/api/orders/${orderId}/`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch order detail");
  }

  return response.json();
}

export async function getProfile() {
  const response = await fetchWithAuth(
    `${API_BASE}/api/accounts/profile/`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch profile");
  }

  const data = await response.json();

  // 🔥 Fix avatar URL
  if (data.profile?.avatar && !data.profile.avatar.startsWith("http")) {
    data.profile.avatar = `${process.env.NEXT_PUBLIC_BACKEND_URL}${data.profile.avatar}`;
  }

  return data;
}

export async function updateProfile(formData) {
  const response = await fetchWithAuth(
    `${API_BASE}/api/accounts/profile/update/`,
    {
      method: "PATCH",
      body: formData, // multipart
    }
  );

  if (!response.ok) {
    const err = await response.json();
    throw new Error("Failed to update profile");
  }

  return response.json();
}

export async function getAddresses() {
  const res = await fetchWithAuth(`${API_BASE}/api/accounts/addresses/`);
  if (!res.ok) throw new Error();
  return res.json();
}

export async function createAddress(data) {
  const res = await fetchWithAuth(
    `${API_BASE}/api/accounts/addresses/create/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error();
  return res.json();
}

export async function updateAddress(id, data) {
  const res = await fetchWithAuth(
    `${API_BASE}/api/accounts/addresses/${id}/update/`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  if (!res.ok) throw new Error();
  return res.json();
}

export async function deleteAddress(id) {
  const res = await fetchWithAuth(
    `${API_BASE}/api/accounts/addresses/${id}/delete/`,
    { method: "DELETE" }
  );
  if (!res.ok) throw new Error();
  return res.json();
}

export async function createOrderWithAddress(addressId) {
  const res = await fetchWithAuth(
    `${API_BASE}/api/orders/create/`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address_id: addressId }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Order failed");
  }

  return res.json();
}