import express, { Router} from 'express'
import { addSalesOrder, getSalesOrders, getSalesOrder, deleteSalesOrders } from './controllers';

const router : Router = express.Router(); 

router
    .post('/', addSalesOrder)
    .get('/', getSalesOrders)
    .get('/:id', getSalesOrder)
    .delete('/:id', deleteSalesOrders)

export { router as ordersRouter}