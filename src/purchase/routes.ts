import express, { Router } from 'express';
import { addPurchase, getPurchases, deletePurchase, getPurchase, editPurchase } from './controllers';
const router:Router = express.Router();

router
    .post('/', addPurchase)
    .get('/', getPurchases)
    .get('/:id', getPurchase)
    .put('/:id', editPurchase)
    .delete('/:id', deletePurchase)


export { router as purchaseRouter }