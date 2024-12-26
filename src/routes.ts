import express from 'express';
import {Request, Response } from 'express';
import { productRouter } from "./products/routes";
import { customerRouter } from './customers/routes';
import { materialRouter } from './materials/routes';
import { unitRouter } from './units/routes';
import { transactionRouter } from './transactions/routes';
import { supplierRouter } from './suppliers/routes';
import { bomRouter } from './bom/routes';
import { sizeRouter } from './sizes/routes';
import { colorRouter } from './colors/routes';
import { ordersRouter } from './orders/routes';
import { manufacturingRoutes } from './manufacturing/routes';
import { purchaseRouter } from './purchase/routes';
import { invoiceRouter } from './invoices/routes';
import { manufacturingCostRouter } from './manufacturing-cost/routes';
const router = express.Router();

router.use('/products', productRouter)
router.use('/customers', customerRouter)
router.use('/materials', materialRouter)
router.use('/units', unitRouter)
router.use('/transactions', transactionRouter)
router.use('/sizes', sizeRouter)
router.use('/colors', colorRouter)
router.use('/suppliers', supplierRouter)
router.use('/bom', bomRouter)
router.use('/orders', ordersRouter)
router.use('/manufacturing', manufacturingRoutes)
router.use('/purchases', purchaseRouter)
router.use('/invoices', invoiceRouter) 
router.use('/manufacturing-costs', manufacturingCostRouter)

router.use('/', (req : Request, res : Response) => {res.status(200).json({message : 'Server in good health'})})

export {router as indexRoutersV1};