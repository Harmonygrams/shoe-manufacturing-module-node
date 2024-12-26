import express, { Router } from 'express';
const router:Router = express.Router();
import { addInvoice, deleteInvoice, getInvoice, getInvoices } from './controllers';
router
    .post('/', addInvoice)
    .get('/', getInvoices)
    .get('/:id', getInvoice)
    .delete('/:id', deleteInvoice)  
export { router as invoiceRouter }