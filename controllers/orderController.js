import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddleware.js";
import database from "../database/db.js";
import { generatePaymentIntent } from "../utils/generatePaymentIntent.js";


// ✅ PLACE NEW ORDER
export const placeNewOrder = catchAsyncErrors(async (req, res, next) => {
  const {
    orderItems,
    shippingInfo,
    items_price,
    tax_price,
    shipping_price,
    total_price,
  } = req.body;

  if (!req.user || !req.user.id) {
    return next(new ErrorHandler("User not authenticated", 401));
  }

  if (!orderItems || orderItems.length === 0) {
    return next(new ErrorHandler("No order items provided.", 400));
  }

  const orderResult = await database.query(
    `INSERT INTO orders (buyer_id, total_price, tax_price, shipping_price)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [req.user.id, total_price, tax_price, shipping_price]
  );

  const order = orderResult.rows[0];

  // insert order items
  for (const item of orderItems) {
    await database.query(
      `INSERT INTO order_items 
      (order_id, product_id, quantity, price, title, image)
      VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        order.id,
        item.product_id,
        item.quantity,
        item.price,
        item.title,
        item.image,
      ]
    );
  }

  // insert shipping info
  const {
    fullName,
    phone,
    address,
    city,
    state,
    country,
    pincode,
  } = shippingInfo;

  if (!fullName || !phone || !address || !city || !state || !country || !pincode) {
    return next(new ErrorHandler("Please provide complete shipping details.", 400));
  }

  await database.query(
    `INSERT INTO shipping_info 
    (order_id, full_name, phone, address, city, state, country, pincode)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [order.id, fullName, phone, address, city, state, country, pincode]
  );

  // create payment intent
  const payment = await generatePaymentIntent(order.id, total_price);

  if (!payment.success) {
    return next(new ErrorHandler(payment.message, 500));
  }

  res.status(201).json({
    success: true,
    message: "Order placed successfully.",
    order,
    clientSecret: payment.clientSecret,
  });
});


// ✅ FETCH MY ORDERS (FIXED)
export const fetchMyOrders = catchAsyncErrors(async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return next(new ErrorHandler("User not authenticated", 401));
  }

  const result = await database.query(
    `
    SELECT o.*, 
    COALESCE(
      json_agg(
        json_build_object(
          'order_item_id', oi.id,
          'product_id', oi.product_id,
          'quantity', oi.quantity,
          'price', oi.price,
          'image', oi.image,
          'title', oi.title
        )
      ) FILTER (WHERE oi.id IS NOT NULL), '[]'
    ) AS order_items,
    json_build_object(
      'full_name', s.full_name,
      'state', s.state,
      'city', s.city,
      'country', s.country,
      'address', s.address,
      'pincode', s.pincode,
      'phone', s.phone
    ) AS shipping_info
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN shipping_info s ON o.id = s.order_id
    WHERE o.buyer_id = $1
    GROUP BY o.id, s.id
    ORDER BY o.created_at DESC
    `,
    [req.user.id]
  );

  res.status(200).json({
    success: true,
    myOrders: result.rows || [],
  });
});


// ✅ FETCH SINGLE ORDER
export const fetchSingleOrder = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;

  const result = await database.query(
    `SELECT * FROM orders WHERE id = $1`,
    [orderId]
  );

  if (!result.rows.length) {
    return next(new ErrorHandler("Order not found", 404));
  }

  res.status(200).json({
    success: true,
    order: result.rows[0],
  });
});


// ✅ ADMIN: FETCH ALL ORDERS
export const fetchAllOrders = catchAsyncErrors(async (req, res, next) => {
  const result = await database.query(`SELECT * FROM orders ORDER BY created_at DESC`);

  res.status(200).json({
    success: true,
    orders: result.rows,
  });
});


// ✅ ADMIN: UPDATE ORDER STATUS
export const updateOrderStatus = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;
  const { status } = req.body;

  const result = await database.query(
    `UPDATE orders SET status = $1 WHERE id = $2 RETURNING *`,
    [status, orderId]
  );

  if (!result.rows.length) {
    return next(new ErrorHandler("Order not found", 404));
  }

  res.status(200).json({
    success: true,
    order: result.rows[0],
  });
});


// ✅ ADMIN: DELETE ORDER
export const deleteOrder = catchAsyncErrors(async (req, res, next) => {
  const { orderId } = req.params;

  const result = await database.query(
    `DELETE FROM orders WHERE id = $1 RETURNING *`,
    [orderId]
  );

  if (!result.rows.length) {
    return next(new ErrorHandler("Order not found", 404));
  }

  res.status(200).json({
    success: true,
    message: "Order deleted successfully",
  });
});