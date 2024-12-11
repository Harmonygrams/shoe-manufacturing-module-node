import express, { Router } from 'express';
import { addPurchase } from './controllers';
const router:Router = express.Router();

router
    .post('/', addPurchase)

export { router as purchaseRouter }