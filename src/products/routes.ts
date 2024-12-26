import express, { Router } from 'express';
import { addProduct, deleteProduct, getProduct, getProducts, updateProduct, fetchProductsForInvoicing } from './controller';
const router:Router = express.Router();

router
    .post('/', addProduct)
    .get('/', getProducts)
    .get('/invoicing', fetchProductsForInvoicing)
    .get('/:id', getProduct)
    .put('/:id', updateProduct)
    .delete('/:id', deleteProduct)

export { router as productRouter }