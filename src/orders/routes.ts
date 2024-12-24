import express, { Router} from 'express'
import { addSalesOrder, getSalesOrders, getSalesOrder } from './controllers';

const router : Router = express.Router(); 

router
    .post('/', addSalesOrder)
    .get('/', getSalesOrders)
    .get('/:id', getSalesOrder)

export { router as ordersRouter}