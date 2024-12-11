import express, { Router } from "express";
import { addOpeningStock, addPurchase } from "./controllers";
const router : Router = express.Router();
router.post('/opening-stock', addOpeningStock)
router.post('/add-purchase', addPurchase)

export { router as transactionRouter };