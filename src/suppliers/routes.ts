import express, { Router} from 'express';
import { addSupplier, getSuppliers } from './controllers';
const router: Router = express.Router();

router
    .post('/', addSupplier)
    .get('/', getSuppliers)

export { router as supplierRouter }
