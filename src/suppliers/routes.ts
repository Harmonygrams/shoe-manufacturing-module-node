import express, { Router} from 'express';
import { addSupplier, getSupplier, getSuppliers } from './controllers';
const router: Router = express.Router();

router
    .post('/', addSupplier)
    .get('/', getSuppliers)
    .get('/:id', getSupplier)

export { router as supplierRouter }
