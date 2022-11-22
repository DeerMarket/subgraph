import {
  BigInt,
  JSONValue,
  JSONValueKind,
  log,
  near,
} from "@graphprotocol/graph-ts";
import {
  Category,
  Order,
  Review,
  Store,
  StoreItem,
  Tag,
  User,
} from "../generated/schema";

export function handleDMS297Event(
  event: string,
  data: JSONValue,
  receipt: near.ReceiptWithOutcome
): void {
  // get store id from contract id
  let storeId = receipt.receipt.receiverId;
  // remove the suffix
  storeId = storeId.split(".")[0];

  if (event == "store_create" || event == "store_update") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let store = Store.load(storeId);
    if (!store) {
      store = new Store(storeId);
    }

    let entry = data.toObject();

    let owner_id = entry.mustGet("owner_id").toString();
    let owner = handleUser(owner_id);
    store.owner = owner.id;

    let arbiter_id = entry.mustGet("arbiter_id").toString();
    let arbiter = handleUser(arbiter_id);
    store.arbiter = arbiter.id;

    // loop through metadata
    let metadata = entry.mustGet("metadata");
    if (metadata.kind != JSONValueKind.OBJECT) {
      return;
    }
    let metadataEntry = metadata.toObject();
    for (let i: i32 = 0; i < metadataEntry.entries.length; i++) {
      let key = metadataEntry.entries[i].key;
      let value = metadataEntry.entries[i].value;
      if (value.kind == JSONValueKind.STRING) {
        if (key == "name") {
          store.name = value.toString();
        }
        if (key == "description") {
          store.description = value.toString();
        }
        if (key == "logo") {
          store.logo = value.toString();
        }
        if (key == "cover") {
          store.cover = value.toString();
        }
        if (key == "website") {
          store.website = value.toString();
        }
        if (key == "email") {
          store.email = value.toString();
        }
        if (key == "phone") {
          store.phone = value.toString();
        }
        if (key == "terms") {
          store.terms = value.toString();
        }
        if (key == "created_at") {
          store.createdAt = value.toString();
        }
        if (key == "updated_at") {
          store.updatedAt = value.toString();
        }
      } else if (value.kind == JSONValueKind.NUMBER) {
        if (key == "category") {
          let catId = value.toBigInt().toString();
          handleCategory(catId);
          store.category = catId;
        }
      } else if (value.kind == JSONValueKind.ARRAY) {
        if (key == "tags") {
          let tags = new Array<string>();
          let tagsArray = value.toArray();
          for (let i: i32 = 0; i < tagsArray.length; i++) {
            let tag = tagsArray[i];
            if (tag.kind == JSONValueKind.STRING) {
              handleTag(tag.toString());
              tags.push(tag.toString());
            }
          }
          store.tags = tags;
        }
      }
    } // end for

    if (event == "store_create") {
      store.total_items = 0;
      store.total_orders = 0;
      store.total_sales = BigInt.fromI32(0);
    }
    // save the store entity
    store.save();

    // increment the user store count
    if (event == "store_create") {
      owner.total_stores = owner.total_stores + 1;
      owner.save();
    }
  } else if (event == "item_create" || event == "item_update") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let itemIdEntry = entry.mustGet("item_id");
    let itemId: string;
    if (itemIdEntry.kind == JSONValueKind.NUMBER) {
      itemId = itemIdEntry.toBigInt().toString();
    } else if (itemIdEntry.kind == JSONValueKind.STRING) {
      itemId = itemIdEntry.toString();
    } else {
      return;
    }
    let store = Store.load(storeId);
    if (!store) {
      log.warning("Store {} not found", [storeId]);
      return;
    }

    const ItemId = storeId + ":i:" + itemId;
    let item = StoreItem.load(ItemId);
    if (!item) {
      item = new StoreItem(ItemId);
    }

    item.itemID = itemId;
    item.store = store.id;

    let price = entry.mustGet("price");
    if (price.kind == JSONValueKind.STRING) {
      let usePrice = BigInt.fromString(price.toString());
      item.price = usePrice;
    }

    let status = entry.mustGet("status");
    if (status.kind == JSONValueKind.STRING) {
      item.status = status.toString();
    }

    // loop through metadata
    let metadata = entry.mustGet("metadata");
    if (metadata.kind != JSONValueKind.OBJECT) {
      return;
    }
    let metadataEntry = metadata.toObject();
    for (let i: i32 = 0; i < metadataEntry.entries.length; i++) {
      let key = metadataEntry.entries[i].key;
      let value = metadataEntry.entries[i].value;
      if (value.kind == JSONValueKind.STRING) {
        log.info("Metadata: {} {}", [key, value.toString()]);
        if (key == "title") {
          item.title = value.toString();
        }
        if (key == "description") {
          item.description = value.toString();
        }
      } else if (value.kind == JSONValueKind.ARRAY) {
        if (key == "tags") {
          let tags = new Array<string>();
          let tagsArray = value.toArray();
          for (let i: i32 = 0; i < tagsArray.length; i++) {
            let tag = tagsArray[i];
            if (tag.kind == JSONValueKind.STRING) {
              handleTag(tag.toString());
              tags.push(tag.toString());
            }
          }
          item.tags = tags;
        } else if (key == "images") {
          let images = new Array<string>();
          let imagesArray = value.toArray();
          for (let i: i32 = 0; i < imagesArray.length; i++) {
            let image = imagesArray[i];
            if (image.kind == JSONValueKind.STRING) {
              images.push(image.toString());
            }
          }
          item.images = images;
        }
      }
    } // end for

    if(event == "item_create") {
      item.total_orders = 0;
    }

    // save the item entity
    item.save();

    if (event == "item_create") {
      // increment the store item count
      store.total_items = store.total_items + 1;
      store.save();
    }
  } else if (event == "item_delete") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let itemIdEntry = entry.mustGet("item_id");
    let itemId: string;
    if (itemIdEntry.kind == JSONValueKind.NUMBER) {
      itemId = itemIdEntry.toBigInt().toString();
    } else if (itemIdEntry.kind == JSONValueKind.STRING) {
      itemId = itemIdEntry.toString();
    } else {
      return;
    }

    const ItemId = storeId + ":i:" + itemId;
    let item = StoreItem.load(ItemId);
    if (!item) {
      log.warning("Item {} not found", [ItemId]);
      return;
    }

    item.status = "Deleted";
    item.save();

    // decrement the store item count
    let store = Store.load(storeId);
    if (!store) {
      log.warning("Store {} not found", [storeId]);
      return;
    }
    store.total_items = store.total_items - 1;
    store.save();
  } else if (event == "item_buy") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let itemId = "",
      buyerId = "",
      orderId = "",
      price = "";

    for (let i: i32 = 0; i < entry.entries.length; i++) {
      let key = entry.entries[i].key;
      let value = entry.entries[i].value;
      if (value.kind == JSONValueKind.STRING) {
        if (key == "buyer_id") {
          buyerId = value.toString();
        } else if (key == "item_id") {
          itemId = value.toString();
        } else if (key == "order_id") {
          orderId = value.toString();
        } else if (key == "price") {
          price = value.toString();
        }
      }
    } // end for

    if (itemId == "" || buyerId == "" || orderId == "" || price == "") {
      return;
    }

    const ItemId = storeId + ":i:" + itemId;
    let item = StoreItem.load(ItemId);
    if (!item) {
      log.warning("Item {} not found", [ItemId]);
      return;
    }

    const OrderId = storeId + ":o:" + orderId;
    let order = new Order(OrderId);

    order.orderID = orderId;
    order.store = storeId;
    order.item = item.id;
    order.price = BigInt.fromString(price);

    let buyer = handleUser(buyerId);
    order.buyer = buyer.id;

    let store = Store.load(storeId);
    if (!store) {
      log.warning("Store {} not found", [storeId]);
      return;
    }

    order.store = store.id;
    order.seller = store.owner;

    order.status = "PENDING";

    order.createdAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();
    order.updatedAt = order.createdAt;

    order.save();

    // increment the stores stats
    store.total_orders = store.total_orders + 1;
    store.save();
    // increment the items stats
    item.total_orders = item.total_orders + 1;
    item.save();
    // increment the buyers stats
    buyer.total_buy_orders = buyer.total_buy_orders + 1;
    buyer.total_active_buy_orders = buyer.total_active_buy_orders + 1;
    buyer.save();
    // increment the sellers stats
    if (store.owner) {
      let seller = handleUser(store.owner!);
      seller.total_sell_orders = seller.total_sell_orders + 1;
      seller.total_active_sell_orders = seller.total_active_sell_orders+ 1;
      seller.save();
    }
  } else if (event == "order_complete") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let orderIdEntry = entry.mustGet("order_id");
    let orderId: string;
    if (orderIdEntry.kind == JSONValueKind.STRING) {
      orderId = orderIdEntry.toString();
    } else {
      return;
    }

    const OrderId = storeId + ":o:" + orderId;
    let order = Order.load(OrderId);

    if (!order) {
      log.warning("Order {} not found", [orderId]);
      return;
    }

    order.status = "COMPLETED";
    order.updatedAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();

    order.save();

    // increment the stores sales
    let store = Store.load(storeId);
    if (!store) {
      log.warning("Store {} not found", [storeId]);
      return;
    }
    store.total_sales = store.total_sales!.plus(order.price!);
    store.save();

    // increment the users states
    let buyer = handleUser(order.buyer!);
    buyer.total_active_buy_orders = buyer.total_active_buy_orders -1;
    buyer.save();

    let seller = handleUser(order.seller!);
    seller.total_active_sell_orders = seller.total_active_sell_orders - 1;
    seller.total_sales = seller.total_sales!.plus(order.price!);
    seller.save();
  } else if (event == "order_shipped") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let orderIdEntry = entry.mustGet("order_id");
    let orderId: string;
    if (orderIdEntry.kind == JSONValueKind.STRING) {
      orderId = orderIdEntry.toString();
    } else {
      return;
    }

    const OrderId = storeId + ":o:" + orderId;
    let order = Order.load(OrderId);

    if (!order) {
      log.warning("Order {} not found", [orderId]);
      return;
    }

    order.status = "SHIPPED";
    order.updatedAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();

    order.save();
  } else if (event == "order_cancel") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let orderIdEntry = entry.mustGet("order_id");
    let orderId: string;
    if (orderIdEntry.kind == JSONValueKind.STRING) {
      orderId = orderIdEntry.toString();
    } else {
      return;
    }

    const OrderId = storeId + ":o:" + orderId;
    let order = Order.load(OrderId);

    if (!order) {
      log.warning("Order {} not found", [orderId]);
      return;
    }

    order.status = "CANCELLED";
    order.updatedAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();

    order.save();

    // decrement the stores stats
    let store = Store.load(storeId);
    if (!store) {
      log.warning("Store {} not found", [storeId]);
      return;
    }
    store.total_orders = store.total_orders - 1;
    store.save();
    // decrement the items stats
    let item = StoreItem.load(order.item!);
    if (!item) {
      log.warning("Item {} not found", [order.item!]);
      return;
    }
    item.total_orders = item.total_orders-1;
    item.save();
    // decrement the buyers stats
    let buyer = handleUser(order.buyer!);
    buyer.total_buy_orders = buyer.total_buy_orders - 1;
    buyer.total_active_buy_orders = buyer.total_active_buy_orders - 1;
    buyer.save();
    // decrement the sellers stats
    let seller = handleUser(order.seller!);
    seller.total_sell_orders = seller.total_sell_orders - 1;
    seller.total_active_sell_orders = seller.total_active_sell_orders - 1;
    seller.save();
  } else if (event == "dispute_start") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let orderIdEntry = entry.mustGet("order_id");
    let orderId: string;
    if (orderIdEntry.kind == JSONValueKind.STRING) {
      orderId = orderIdEntry.toString();
    } else {
      return;
    }

    const OrderId = storeId + ":o:" + orderId;
    let order = Order.load(OrderId);

    if (!order) {
      log.warning("Order {} not found", [orderId]);
      return;
    }

    order.status = "DISPUTED";
    order.updatedAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();

    order.save();
  } else if (event == "dispute_resolve") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();

    let orderIdEntry = entry.mustGet("order_id");
    let orderId: string;
    if (orderIdEntry.kind == JSONValueKind.STRING) {
      orderId = orderIdEntry.toString();
    } else {
      return;
    }

    const OrderId = storeId + ":o:" + orderId;
    let order = Order.load(OrderId);

    if (!order) {
      log.warning("Order {} not found", [orderId]);
      return;
    }

    order.status = "RESOLVED";
    order.updatedAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();

    let resEntry = entry.get("resolution");
    if (resEntry) {
      if (resEntry.kind == JSONValueKind.STRING) {
        order.resolution = resEntry.toString();
      }
    }

    order.save();

    // increment the stats
    let store = Store.load(storeId);
    if (!store) {
      log.warning("Store {} not found", [storeId]);
      return;
    }
    let buyer = handleUser(order.buyer!);
    let seller = handleUser(order.seller!);
    buyer.total_active_buy_orders = buyer.total_active_buy_orders - 1;
    seller.total_active_sell_orders = seller.total_active_sell_orders - 1;

    if (order.resolution == "SellerWon") {
        store.total_sales = store.total_sales!.plus(order.price!);
        seller.total_sales = seller.total_sales!.plus(order.price!);
    } else if (order.resolution == "Draw") {
        store.total_sales = store.total_sales!.plus(order.price!.div(BigInt.fromString("2")));
        seller.total_sales = seller.total_sales!.plus(order.price!.div(BigInt.fromString("2")));
    }
    seller.save();
    buyer.save();   
    store.save();
  } else if (event == "review_create") {
    if (data.kind != JSONValueKind.OBJECT) {
      return;
    }
    let entry = data.toObject();
    let itemId = "",
      reviewId = "",
      reviewerId = "",
      rating = "",
      comment = "";

    for (let i: i32 = 0; i < entry.entries.length; i++) {
      let key = entry.entries[i].key;
      let value = entry.entries[i].value;
      if (value.kind == JSONValueKind.STRING) {
        if (key == "item_id") {
          itemId = value.toString();
        } else if (key == "review_id") {
          reviewId = value.toString();
        } else if (key == "reviewer_id") {
          reviewerId = value.toString();
        } else if (key == "rating") {
          rating = value.toString();
        } else if (key == "comment") {
          comment = value.toString();
        }
      }

      if (value.kind == JSONValueKind.NUMBER) {
        if (key == "rating") {
          rating = value.toString();
        }
      }
    } // end for

    if (itemId == "" || reviewId == "" || reviewerId == "" || rating == "") {
      return;
    }

    let ItemId = storeId + ":i:" + itemId;
    let item = StoreItem.load(ItemId);
    if (!item) {
      log.warning("Item {} not found", [ItemId]);
      return;
    }

    let ReviewId = storeId + ":r:" + reviewId;
    let review = new Review(ReviewId);

    review.reviewID = reviewId;
    review.store = storeId;
    review.item = item.id;
    review.rating = rating;
    review.comment = comment ? comment : "";

    review.createdAt = BigInt.fromString(
      receipt.block.header.timestampNanosec.toString()
    )
      .div(BigInt.fromString("1000000000"))
      .toString();
    review.updatedAt = review.createdAt;

    let reviewer = handleUser(reviewerId);
    review.reviewer = reviewer.id;

    review.save();
  }
}

// Create a new user entity if it doesn't exist
function handleUser(id: string): User {
  let user = User.load(id);
  // if account doesn't exist save new account
  if (!user) {
    user = new User(id);
    user.total_buy_orders = 0;
    user.total_sell_orders = 0;
    user.total_active_buy_orders = 0;
    user.total_active_sell_orders = 0;
    user.total_stores = 0;
    user.total_sales = BigInt.fromI32(0);
  }
  user.save();
  return user as User;
}

// Create a new category entity if it doesn't exist
function handleCategory(id: string): void {
  let category = Category.load(id);

  // if category doesn't exist save new category
  if (!category) {
    category = new Category(id);
    category.name = CATEGORIES_NAMES[parseInt(id) as i32] || "Unknown";
  }

  category.save();
}
// Category names
const CATEGORIES_NAMES: string[] = [
  "Other",
  "Services",
  "Digital Goods",
  "Physical Goods",
  "NFTs",
  "Courses",
];

// Create a new tag entity if it doesn't exist
function handleTag(id: string): void {
  let tag = Tag.load(id);

  // if tag doesn't exist save new tag
  if (!tag) {
    tag = new Tag(id);
    tag.name = id;
  }

  tag.save();
}
