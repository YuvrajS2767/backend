import express from "express";
import { config } from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import fileUpload from "express-fileupload";
import { createTables } from "./utils/createTables.js";
import { errorMiddleware } from "./middlewares/errorMiddleware.js";
import authRouter from "./router/authRoutes.js";
import productRouter from "./router/productRoutes.js";
import adminRouter from "./router/adminRoutes.js";
import orderRouter from "./router/orderRoutes.js";
import Stripe from "stripe";
import database from "./database/db.js";

const app = express();

config();

app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        "https://papaya-pegasus-cb47d3.netlify.app", // client
        "https://silver-seahorse-46e5f7.netlify.app",   // dashboard (replace this)
      ];

      // allow requests with no origin (like Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.post(
  "/api/v1/payment/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = Stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      return res.status(400).send(`Webhook Error: ${error.message || error}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const paymentIntentId = event.data.object.id;

      try {
        const updatedPaymentStatus = "Paid";

        const paymentTableUpdateResult = await database.query(
          `UPDATE payments SET payment_status = $1 WHERE payment_intent_id = $2 RETURNING *`,
          [updatedPaymentStatus, paymentIntentId]
        );

        if (!paymentTableUpdateResult.rows.length) {
          return res.status(400).send("Payment not found in DB");
        }

        const orderId = paymentTableUpdateResult.rows[0].order_id;

        await database.query(
          `UPDATE orders SET paid_at = NOW() WHERE id = $1`,
          [orderId]
        );

        const { rows: orderedItems } = await database.query(
          `SELECT product_id, quantity FROM order_items WHERE order_id = $1`,
          [orderId]
        );

        for (const item of orderedItems) {
          await database.query(
            `UPDATE products SET stock = stock - $1 WHERE id = $2`,
            [item.quantity, item.product_id]
          );
        }
      } catch (error) {
        console.error(error);
        return res.status(500).send("Error updating order after payment");
      }
    }

    // ✅ VERY IMPORTANT (Stripe needs this)
    res.status(200).send({ received: true });
  }
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    tempFileDir: "./uploads",
    useTempFiles: true,
  })
);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/order", orderRouter);

createTables();

app.use(errorMiddleware);

export default app;
