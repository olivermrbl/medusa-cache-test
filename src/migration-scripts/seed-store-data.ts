import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";

export default async function seedStoreData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const stockLocationModuleService = container.resolve(Modules.STOCK_LOCATION);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const productModuleService = container.resolve(Modules.PRODUCT);

  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  const [stockLocation] = await stockLocationModuleService.listStockLocations(
    {}
  );

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  });
  let shippingProfile = shippingProfiles[0];

  const categories = await productModuleService.listProductCategories({
    is_active: true,
  });

  const productTypes = [
    "T-Shirt",
    "Sweatshirt",
    "Hoodie",
    "Tank Top",
    "Polo Shirt",
    "Jeans",
    "Shorts",
    "Sweatpants",
    "Chinos",
    "Leggings",
    "Jacket",
    "Coat",
    "Blazer",
    "Vest",
    "Windbreaker",
    "Dress",
    "Skirt",
    "Blouse",
    "Cardigan",
    "Sweater",
    "Sneakers",
    "Boots",
    "Sandals",
    "Loafers",
    "Heels",
    "Hat",
    "Cap",
    "Beanie",
    "Scarf",
    "Gloves",
    "Backpack",
    "Tote Bag",
    "Messenger Bag",
    "Wallet",
    "Belt",
    "Watch",
    "Bracelet",
    "Necklace",
    "Ring",
    "Earrings",
    "Sunglasses",
    "Glasses",
    "Phone Case",
    "Laptop Sleeve",
    "Water Bottle",
  ];

  const colors = [
    "Black",
    "White",
    "Gray",
    "Navy",
    "Red",
    "Blue",
    "Green",
    "Yellow",
    "Orange",
    "Purple",
    "Pink",
    "Brown",
    "Beige",
    "Olive",
    "Teal",
  ];
  const sizes = ["XS", "S", "M", "L", "XL", "XXL"];
  const materials = [
    "Cotton",
    "Polyester",
    "Wool",
    "Linen",
    "Silk",
    "Denim",
    "Leather",
    "Canvas",
    "Nylon",
    "Fleece",
  ];
  const styles = [
    "Classic",
    "Modern",
    "Vintage",
    "Sport",
    "Casual",
    "Formal",
    "Street",
    "Minimalist",
    "Bold",
    "Retro",
  ];

  function generateProduct(index: number) {
    const productType = productTypes[index % productTypes.length];
    const material =
      materials[Math.floor(index / productTypes.length) % materials.length];
    const style =
      styles[
        Math.floor(index / (productTypes.length * materials.length)) %
          styles.length
      ];
    const productTitle = `${style} ${material} ${productType}`;
    const handle = productTitle.toLowerCase().replace(/\s+/g, "-");

    const selectedColors = colors.slice(0, 2 + (index % 3));
    const selectedSizes = sizes.slice(0, 4);

    const categoryNames = ["Shirts", "Sweatshirts", "Pants", "Merch"];
    const categoryName = categoryNames[index % categoryNames.length];
    const category = categories.find((cat) => cat.name === categoryName);

    const basePrice = 20 + (index % 80);

    const variants: any[] = [];

    selectedSizes.forEach((size) => {
      selectedColors.forEach((color) => {
        variants.push({
          title: `${size} / ${color}`,
          sku: `${handle.toUpperCase()}-${size}-${color.toUpperCase()}`,
          options: {
            Size: size,
            Color: color,
          },
          prices: [
            {
              amount: basePrice,
              currency_code: "eur",
            },
            {
              amount: Math.floor(basePrice * 1.1),
              currency_code: "usd",
            },
            {
              amount: Math.floor(basePrice * 7.5),
              currency_code: "dkk",
            },
            {
              amount: Math.floor(basePrice * 160),
              currency_code: "jpy",
            },
          ],
        });
      });
    });

    return {
      title: productTitle,
      category_ids: category ? [category.id] : [],
      description: `Experience the perfect blend of ${style.toLowerCase()} design and ${material.toLowerCase()} comfort with our ${productType.toLowerCase()}. Crafted for those who appreciate quality and style in their everyday wardrobe.`,
      handle: handle,
      weight: 200 + (index % 600),
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      thumbnail: "",
      images: [],
      options: [
        {
          title: "Size",
          values: selectedSizes,
        },
        {
          title: "Color",
          values: selectedColors,
        },
      ],
      variants: variants,
      sales_channels: [
        {
          id: defaultSalesChannel[0].id,
        },
      ],
    };
  }

  const products = [];
  for (let i = 0; i < 500; i++) {
    // @ts-ignore
    products.push(generateProduct(i));
  }

  logger.info(`Creating ${products.length} products...`);

  const batchSize = 50;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);
    await createProductsWorkflow(container).run({
      input: {
        products: batch,
      },
    });
    logger.info(
      `Created batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(
        products.length / batchSize
      )}`
    );
  }

  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "location_levels.*"],
  });

  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    // @ts-ignore
    if (!inventoryItem.location_levels?.length) {
      const inventoryLevel = {
        location_id: stockLocation.id,
        stocked_quantity: 1000000,
        inventory_item_id: inventoryItem.id,
      };
      inventoryLevels.push(inventoryLevel);
    }
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
}
