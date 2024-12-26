import express, { Router } from 'express'; 
const router : Router = express.Router(); 
import { addManufacturingCost, getManufacturingCosts, deleteManufacturingCost, editManufacturingCost } from './controllers';
router
    .post('/', addManufacturingCost)
    .get('/', getManufacturingCosts)
    .put('/:id', editManufacturingCost)
    .delete('/:id', deleteManufacturingCost)
export { router as manufacturingCostRouter };