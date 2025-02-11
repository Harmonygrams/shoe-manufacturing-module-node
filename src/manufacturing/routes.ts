import express, { Router } from 'express';
import { addProduction, getProductions, getProduction, deleteProduction, updateProductionStatusMetadata, updateProductionStatus} from './controllers';

const router : Router = express.Router(); 

router
    .post('/', addProduction)
    .get('/', getProductions)
    .get('/:id', getProduction)
    .get('/update-metadata/:id', updateProductionStatusMetadata)
    .put('/update-metadata/:id', updateProductionStatus)
    .delete('/:id', deleteProduction)

export { router as manufacturingRoutes }