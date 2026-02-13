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
    console.log("Fetching from:", url);
    const res = await fetch(url, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const products = await res.json();
    
    console.log("Raw API response:", products);
    
    // Transform image URLs to full paths
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
    console.log("Fetching categories from:", url);
    const res = await fetch(url, {
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`API response status: ${res.status} ${res.statusText}`);
      console.error("Full URL attempted:", url);
      console.warn("Backend categories endpoint not found, using mock data");
      return getMockCategories();
    }
    const categories = await res.json();
    console.log("Categories fetched successfully:", categories);
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

function getMockCategories() {
  return [
    { id: 1, name: "Sunglasses", slug: "sunglasses" },
    { id: 2, name: "Reading Glasses", slug: "reading-glasses" },
    { id: 3, name: "Prescription", slug: "prescription" },
  ];
}

export { BACKEND };
