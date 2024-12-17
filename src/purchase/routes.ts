import express, { Router } from 'express';
import { addPurchase, getPurchases } from './controllers';
const router:Router = express.Router();

router
    .post('/', addPurchase)
    .get('/', getPurchases)

export { router as purchaseRouter }